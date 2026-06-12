import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BrowseListingsDto } from './dto/browse-listings.dto';

@Injectable()
export class SearchHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Persist a browse call for an authenticated user. Fire-and-forget — callers
   *  should not await this; errors are silently swallowed so a DB hiccup never
   *  affects the browse response. */
  async record(userId: string, dto: BrowseListingsDto): Promise<void> {
    const filters = this.nonNullFilters(dto);
    if (Object.keys(filters).length === 0) return;
    await this.prisma.searchHistory.create({ data: { userId, filters: filters as Prisma.InputJsonValue } });
  }

  /** Fetch the last `days` days of search history for a user. */
  async recent(
    userId: string,
    days = 90,
  ): Promise<Array<{ filters: unknown; createdAt: Date }>> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.prisma.searchHistory.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { filters: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private nonNullFilters(dto: BrowseListingsDto): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const keys = [
      'q',
      'make',
      'type',
      'state',
      'minPrice',
      'maxPrice',
      'minYear',
      'maxYear',
      'minMiles',
      'maxMiles',
      'sort',
    ] as const;
    for (const k of keys) {
      if (dto[k] !== undefined && dto[k] !== null) out[k] = dto[k];
    }
    return out;
  }
}
