import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ListingView } from '../listings/listings.service';
import { dealBadge } from '../listings/deal';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async add(userId: string, listingId: string): Promise<void> {
    await this.requireListing(listingId);
    try {
      await this.prisma.favorite.create({ data: { userId, listingId } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('already favorited');
      }
      throw err;
    }
  }

  async remove(userId: string, listingId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, listingId } });
  }

  async list(userId: string): Promise<ListingView[]> {
    const favs = await this.prisma.favorite.findMany({
      where: { userId },
      include: { listing: true },
      orderBy: { createdAt: 'desc' },
    });
    return favs.map((f) => ({
      ...f.listing,
      dealBadge: dealBadge(f.listing.dealDeltaPct),
    }));
  }

  async listingIds(userId: string): Promise<Set<string>> {
    const favs = await this.prisma.favorite.findMany({
      where: { userId },
      select: { listingId: true },
    });
    return new Set(favs.map((f) => f.listingId));
  }

  private async requireListing(listingId: string): Promise<void> {
    const exists = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('listing not found');
  }
}
