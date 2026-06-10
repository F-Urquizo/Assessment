import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { dealBadge } from '../listings/deal';
import { ListingView } from '../listings/listings.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /** The user's favourited listings (with deal badge), newest first. */
  async list(userId: string): Promise<ListingView[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { listing: true },
    });
    return rows.map((f) => ({
      ...f.listing,
      dealBadge: dealBadge(f.listing.dealDeltaPct),
    }));
  }

  /** Just the favourited listing ids — lets the client hydrate hearts cheaply. */
  async ids(userId: string): Promise<string[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId },
      select: { listingId: true },
    });
    return rows.map((r) => r.listingId);
  }

  /** Favourite a listing. Idempotent: a duplicate is a no-op, not an error. */
  async add(userId: string, listingId: string): Promise<{ favorited: true }> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (!listing) throw new NotFoundException('listing not found');

    try {
      await this.prisma.favorite.create({ data: { userId, listingId } });
    } catch (e) {
      // P2002 = unique constraint (already favourited) → swallow for idempotency.
      if (
        !(e instanceof Prisma.PrismaClientKnownRequestError) ||
        e.code !== 'P2002'
      ) {
        throw e;
      }
    }
    return { favorited: true };
  }

  /** Un-favourite a listing. Idempotent — removing a non-favourite is a no-op. */
  async remove(userId: string, listingId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, listingId } });
  }
}
