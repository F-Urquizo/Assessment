import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Listing, ListingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ModelService } from '../model/model.service';
import type { RequestUser } from '../auth/jwt.strategy';
import { computeDealDeltaPct, DealBadge, dealBadge } from './deal';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { SPEC_FIELDS, SpecField } from './dto/spec-options';

/** Anything carrying the 13 spec fields — a DTO, a Listing row, or a merge. */
type SpecInput = Partial<Record<SpecField, unknown>>;

/** A listing enriched with its derived Under/Fair/Over badge for the client. */
export type ListingView = Listing & { dealBadge: DealBadge | null };

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

    const listing = await this.prisma.listing.create({
      data: {
        ...this.writable(dto),
        ...valuation,
        dealDeltaPct,
        userId: user.id,
      } as Prisma.ListingUncheckedCreateInput,
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
    let predictedValue = existing.predictedValue;
    if (this.specChanged(existing, dto)) {
      const valuation = await this.valuate({ ...existing, ...dto });
      Object.assign(data, valuation);
      predictedValue = valuation.predictedValue;
    }

    // The deal delta depends on both asking price and predicted value, so it's
    // always recomputed from whichever values now apply.
    const askingPrice = dto.askingPrice ?? existing.askingPrice;
    data.dealDeltaPct = computeDealDeltaPct(askingPrice, predictedValue);

    const listing = await this.prisma.listing.update({
      where: { id },
      data: data,
    });
    return this.toView(listing);
  }

  async remove(user: RequestUser, id: string): Promise<void> {
    const existing = await this.requireListing(id);
    this.assertOwner(user, existing);
    await this.prisma.listing.delete({ where: { id } });
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  async findOne(id: string): Promise<ListingView> {
    return this.toView(await this.requireListing(id));
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

  // ── Internals ─────────────────────────────────────────────────────────────────

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
