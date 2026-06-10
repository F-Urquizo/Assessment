import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Listing,
  ListingPriceHistory,
  ListingStatus,
  Prisma,
  PriceChangeReason,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ModelService } from '../model/model.service';
import type { RequestUser } from '../auth/jwt.strategy';
import { computeDealDeltaPct, DealBadge, dealBadge } from './deal';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { BrowseListingsDto, Sort } from './dto/browse-listings.dto';
import { SPEC_FIELDS, SpecField } from './dto/spec-options';

/** Anything carrying the 13 spec fields — a DTO, a Listing row, or a merge. */
type SpecInput = Partial<Record<SpecField, unknown>>;

/** A listing enriched with its derived Under/Fair/Over badge for the client. */
export type ListingView = Listing & { dealBadge: DealBadge | null };

/** The single-listing detail view: the listing plus its price/valuation trend. */
export type ListingDetailView = ListingView & {
  priceHistory: ListingPriceHistory[];
};

/** A page of marketplace results plus the metadata the UI needs to paginate. */
export type BrowseResult = {
  items: ListingView[];
  total: number;
  page: number;
  pageSize: number;
};

/** Result of a model-service valuation, mapped to the columns we persist. */
type Valuation = {
  predictedValue: number | null;
  predictedLow: number | null;
  predictedHigh: number | null;
};

const NO_VALUATION: Valuation = {
  predictedValue: null,
  predictedLow: null,
  predictedHigh: null,
};

// Client-writable columns. Derived valuation fields and ownership are set by
// the service, never accepted from the request body.
const WRITABLE_FIELDS = [
  ...SPEC_FIELDS,
  'askingPrice',
  'description',
  'contactEmail',
  'contactPhone',
  'status',
] as const;

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly model: ModelService,
  ) {}

  // ── Commands ────────────────────────────────────────────────────────────────

  async create(user: RequestUser, dto: CreateListingDto): Promise<ListingView> {
    this.assertCanPublish(user, dto.status);

    const valuation = await this.valuate(dto);
    const dealDeltaPct = computeDealDeltaPct(
      dto.askingPrice,
      valuation.predictedValue,
    );

    // Listing write + its initial audit row commit together (or not at all),
    // so a price never exists without the history row that explains it.
    const listing = await this.prisma.$transaction(async (tx) => {
      const created = await tx.listing.create({
        data: {
          ...this.writable(dto),
          ...valuation,
          dealDeltaPct,
          userId: user.id,
        } as Prisma.ListingUncheckedCreateInput,
      });
      await tx.listingPriceHistory.create({
        data: {
          listingId: created.id,
          reason: PriceChangeReason.created,
          oldAskingPrice: null,
          newAskingPrice: created.askingPrice,
          oldPredictedValue: null,
          newPredictedValue: created.predictedValue,
          oldPredictedLow: null,
          newPredictedLow: created.predictedLow,
          oldPredictedHigh: null,
          newPredictedHigh: created.predictedHigh,
        },
      });
      return created;
    });
    return this.toView(listing);
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateListingDto,
  ): Promise<ListingView> {
    const existing = await this.requireListing(id);
    this.assertOwner(user, existing);
    this.assertCanPublish(user, dto.status);

    const data: Record<string, unknown> = this.writable(dto);

    // The valuation only depends on the spec fields. Re-call the model only
    // when one of them actually changed; otherwise reuse the stored value.
    let valuation: Valuation = {
      predictedValue: existing.predictedValue,
      predictedLow: existing.predictedLow,
      predictedHigh: existing.predictedHigh,
    };
    if (this.specChanged(existing, dto)) {
      valuation = await this.valuate({ ...existing, ...dto });
      Object.assign(data, valuation);
    }

    // The deal delta depends on both asking price and predicted value, so it's
    // always recomputed from whichever values now apply.
    const askingPrice = dto.askingPrice ?? existing.askingPrice;
    data.dealDeltaPct = computeDealDeltaPct(
      askingPrice,
      valuation.predictedValue,
    );

    const historyRow = this.diffHistoryRow(existing, askingPrice, valuation);

    // Update the listing and append its audit row atomically — the price and
    // the row that explains the change always land together.
    const listing = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.listing.update({ where: { id }, data });
      if (historyRow) {
        await tx.listingPriceHistory.create({ data: historyRow });
      }
      return updated;
    });
    return this.toView(listing);
  }

  async remove(user: RequestUser, id: string): Promise<void> {
    const existing = await this.requireListing(id);
    this.assertOwner(user, existing);
    await this.prisma.listing.delete({ where: { id } });
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  async findOne(id: string): Promise<ListingDetailView> {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: { priceHistory: { orderBy: { changedAt: 'asc' } } },
    });
    if (!listing) throw new NotFoundException('listing not found');

    const { priceHistory, ...row } = listing;
    return { ...this.toView(row), priceHistory };
  }

  /**
   * Active listings for the marketplace and — crucially — for Fran's
   * RecommendationsModule, which excludes the viewer's own cars and takes the
   * top-N candidates to score.
   */
  async findActive(
    opts: { excludeUserId?: string; take?: number } = {},
  ): Promise<ListingView[]> {
    const where: Prisma.ListingWhereInput = { status: ListingStatus.active };
    if (opts.excludeUserId) where.userId = { not: opts.excludeUserId };

    const listings = await this.prisma.listing.findMany({
      where,
      take: opts.take,
      orderBy: { createdAt: 'desc' },
    });
    return listings.map((l) => this.toView(l));
  }

  /**
   * Filtered, sorted, paged active listings for the marketplace browse page.
   * `findActive` stays the simple seam Fran's recommendations use; this is the
   * richer query the UI drives.
   */
  async browse(query: BrowseListingsDto): Promise<BrowseResult> {
    const where = this.browseWhere(query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // findMany + count run in one transaction so `total` reflects the same
    // filtered snapshot as the returned page.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        orderBy: this.browseOrderBy(query.sort ?? 'newest'),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return { items: rows.map((l) => this.toView(l)), total, page, pageSize };
  }

  /** The append-only price/valuation trail for a listing, oldest → newest. */
  async priceHistory(listingId: string): Promise<ListingPriceHistory[]> {
    return this.prisma.listingPriceHistory.findMany({
      where: { listingId },
      orderBy: { changedAt: 'asc' },
    });
  }

  // ── Internals ─────────────────────────────────────────────────────────────────

  /** Builds the `where` for a browse query — always pinned to active listings. */
  private browseWhere(query: BrowseListingsDto): Prisma.ListingWhereInput {
    const where: Prisma.ListingWhereInput = { status: ListingStatus.active };
    if (query.make) where.manufacturer = query.make;
    if (query.type) where.type = query.type;
    if (query.state) where.state = query.state;

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const askingPrice: Prisma.IntFilter = {};
      if (query.minPrice !== undefined) askingPrice.gte = query.minPrice;
      if (query.maxPrice !== undefined) askingPrice.lte = query.maxPrice;
      where.askingPrice = askingPrice;
    }
    return where;
  }

  /** Maps a sort mode to the Prisma `orderBy`. `bestDeal` floats the most
   *  underpriced cars first and pushes un-valuated ones (null delta) to the end. */
  private browseOrderBy(sort: Sort): Prisma.ListingOrderByWithRelationInput {
    switch (sort) {
      case 'priceAsc':
        return { askingPrice: 'asc' };
      case 'priceDesc':
        return { askingPrice: 'desc' };
      case 'bestDeal':
        return { dealDeltaPct: { sort: 'asc', nulls: 'last' } };
      case 'newest':
      default:
        return { createdAt: 'desc' };
    }
  }

  /**
   * Builds the audit row for an update, or `null` when neither the asking price
   * nor the valuation moved (nothing worth recording). `revaluation` wins when
   * any valuation field changed — it's the more informative single row.
   */
  private diffHistoryRow(
    existing: Listing,
    newAskingPrice: number,
    newValuation: Valuation,
  ): Prisma.ListingPriceHistoryUncheckedCreateInput | null {
    const priceChanged = newAskingPrice !== existing.askingPrice;
    const valuationChanged =
      newValuation.predictedValue !== existing.predictedValue ||
      newValuation.predictedLow !== existing.predictedLow ||
      newValuation.predictedHigh !== existing.predictedHigh;
    if (!priceChanged && !valuationChanged) return null;

    return {
      listingId: existing.id,
      reason: valuationChanged
        ? PriceChangeReason.revaluation
        : PriceChangeReason.asking_price_change,
      oldAskingPrice: existing.askingPrice,
      newAskingPrice,
      oldPredictedValue: existing.predictedValue,
      newPredictedValue: newValuation.predictedValue,
      oldPredictedLow: existing.predictedLow,
      newPredictedLow: newValuation.predictedLow,
      oldPredictedHigh: existing.predictedHigh,
      newPredictedHigh: newValuation.predictedHigh,
    };
  }

  private async requireListing(id: string): Promise<Listing> {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('listing not found');
    return listing;
  }

  private assertOwner(user: RequestUser, listing: Listing): void {
    if (listing.userId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('not your listing');
    }
  }

  private assertCanPublish(user: RequestUser, status?: ListingStatus): void {
    if (status === ListingStatus.active && !user.emailVerified) {
      throw new ForbiddenException('email not verified');
    }
  }

  private specChanged(existing: Listing, dto: UpdateListingDto): boolean {
    return SPEC_FIELDS.some(
      (f) => dto[f] !== undefined && dto[f] !== existing[f],
    );
  }

  private async valuate(spec: SpecInput): Promise<Valuation> {
    try {
      const r = (await this.model.post(
        '/predict',
        this.toPredictPayload(spec),
      )) as {
        price: number;
        low: number;
        high: number;
      };
      return {
        predictedValue: Math.round(r.price),
        predictedLow: Math.round(r.low),
        predictedHigh: Math.round(r.high),
      };
    } catch {
      // Model-service down or rejected the input — degrade gracefully so the
      // listing is still saved; valuation can be backfilled on a later edit.
      return { ...NO_VALUATION };
    }
  }

  /** Maps the camelCase spec fields to the snake_case keys /predict expects. */
  private toPredictPayload(spec: SpecInput) {
    return {
      manufacturer: spec.manufacturer,
      model: spec.model,
      year: spec.year,
      odometer: spec.odometer,
      cylinders: spec.cylinders,
      condition: spec.condition,
      fuel: spec.fuel,
      title_status: spec.titleStatus,
      transmission: spec.transmission,
      drive: spec.drive,
      type: spec.type,
      paint_color: spec.paintColor,
      state: spec.state,
    };
  }

  private writable(
    dto: CreateListingDto | UpdateListingDto,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of WRITABLE_FIELDS) {
      const value = (dto as Record<string, unknown>)[key];
      if (value !== undefined) out[key] = value;
    }
    return out;
  }

  private toView(listing: Listing): ListingView {
    return { ...listing, dealBadge: dealBadge(listing.dealDeltaPct) };
  }
}
