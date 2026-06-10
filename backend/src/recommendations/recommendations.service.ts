import { Injectable } from '@nestjs/common';
import { ListingsService, ListingView } from '../listings/listings.service';

/** A recommended listing plus a 0–1 score and a human "why" string. */
export interface RecommendedListing {
  listing: ListingView;
  score: number;
  why: string;
}

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 24;

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

/**
 * Deal score in [0, 1]: a listing priced 20%+ below the model's valuation
 * scores 1.0, one priced 20%+ above scores 0.0, linear in between. This is the
 * cold-start signal; once Fran's favourites + search_history land, combine it
 * as 0.5*deal + 0.5*preference here.
 */
export function dealScore(deltaPct: number): number {
  return Math.round(clamp((20 - deltaPct) / 40, 0, 1) * 100) / 100;
}

/** Human explanation shown on the recommendation card. */
export function buildWhy(deltaPct: number): string {
  const pct = Math.round(Math.abs(deltaPct));
  if (deltaPct <= -10) return `Great deal — ${pct}% below the model's valuation`;
  if (deltaPct < 0) return `Priced ${pct}% under model value`;
  if (deltaPct === 0) return `Priced right at model value`;
  if (deltaPct <= 10) return `Fairly priced — about ${pct}% over model value`;
  return `Priced ${pct}% over model value`;
}

@Injectable()
export class RecommendationsService {
  constructor(private readonly listings: ListingsService) {}

  /**
   * Top-N active listings ranked by deal score. Unvalued listings (no
   * dealDeltaPct) are excluded — a recommendation needs a "why". Pass
   * excludeUserId to drop the viewer's own cars once auth is wired on the client.
   */
  async topPicks(
    opts: { limit?: number; excludeUserId?: string } = {},
  ): Promise<RecommendedListing[]> {
    const limit = clamp(opts.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);
    const active = await this.listings.findActive({
      excludeUserId: opts.excludeUserId,
    });

    return active
      .filter((l): l is ListingView & { dealDeltaPct: number } => l.dealDeltaPct !== null)
      .map((listing) => ({
        listing,
        score: dealScore(listing.dealDeltaPct),
        why: buildWhy(listing.dealDeltaPct),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
