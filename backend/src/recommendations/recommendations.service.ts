import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService, ListingView } from '../listings/listings.service';
import { FavoritesService } from '../favorites/favorites.service';
import { SearchHistoryService } from '../listings/search-history.service';

// Algorithm constants — named so they're easy to tune and clearly match the
// spec (combined = 0.5 × deal + 0.5 × pref; cold-start → deal only).
const DEAL_WEIGHT = 0.5;
const PREF_WEIGHT = 0.5;

// Candidate pool pulled from findActive() — large enough for meaningful
// scoring without fetching the entire catalogue.
const CANDIDATE_POOL_SIZE = 200;

// Preference signal window: only look at the last 90 days of favorites and
// search history so stale preferences don't dominate.
const PREF_WINDOW_DAYS = 90;

export interface RecommendationItem extends ListingView {
  score: number;
  why: string;
}

interface PrefProfile {
  makes: Record<string, number>;
  types: Record<string, number>;
  fuels: Record<string, number>;
  drives: Record<string, number>;
  priceCenter: number | null;
}

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: ListingsService,
    private readonly favorites: FavoritesService,
    private readonly searchHistory: SearchHistoryService,
  ) {}

  async recommend(userId: string, limit: number): Promise<RecommendationItem[]> {
    const [candidates, profile] = await Promise.all([
      this.listings.findActive({ excludeUserId: userId, take: CANDIDATE_POOL_SIZE }),
      this.buildProfile(userId),
    ]);

    const isEmpty = this.isEmptyProfile(profile);

    return candidates
      .map((listing) => this.score(listing, profile, isEmpty))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ── Profile builder ────────────────────────────────────────────────────────

  private async buildProfile(userId: string): Promise<PrefProfile> {
    const since = new Date(Date.now() - PREF_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [favListings, searches] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId, createdAt: { gte: since } },
        include: { listing: true },
      }),
      this.searchHistory.recent(userId, PREF_WINDOW_DAYS),
    ]);

    const makes: Record<string, number> = {};
    const types: Record<string, number> = {};
    const fuels: Record<string, number> = {};
    const drives: Record<string, number> = {};
    const prices: number[] = [];

    for (const { listing } of favListings) {
      increment(makes, listing.manufacturer);
      increment(types, listing.type);
      increment(fuels, listing.fuel);
      increment(drives, listing.drive);
      prices.push(listing.askingPrice);
    }

    // Extract filter signals from search history (make/type/state filters used)
    for (const { filters } of searches) {
      const f = filters as Record<string, unknown>;
      if (typeof f['make'] === 'string') increment(makes, f['make']);
      if (typeof f['type'] === 'string') increment(types, f['type']);
    }

    return {
      makes,
      types,
      fuels,
      drives,
      priceCenter: prices.length ? median(prices) : null,
    };
  }

  // ── Scoring ────────────────────────────────────────────────────────────────

  private score(
    listing: ListingView,
    profile: PrefProfile,
    coldStart: boolean,
  ): RecommendationItem {
    const dealScore = normalizeDeal(listing.dealDeltaPct);
    const prefScore = coldStart ? 0 : this.prefScore(listing, profile);

    const combined = coldStart
      ? dealScore
      : DEAL_WEIGHT * dealScore + PREF_WEIGHT * prefScore;

    return { ...listing, score: combined, why: this.why(listing, profile, coldStart, dealScore) };
  }

  private prefScore(listing: ListingView, profile: PrefProfile): number {
    const matches = [
      normalizedFreq(profile.makes, listing.manufacturer),
      normalizedFreq(profile.types, listing.type),
      normalizedFreq(profile.fuels, listing.fuel),
      normalizedFreq(profile.drives, listing.drive),
    ];
    return matches.reduce((a, b) => a + b, 0) / matches.length;
  }

  // ── "Why" string ──────────────────────────────────────────────────────────

  private why(
    listing: ListingView,
    profile: PrefProfile,
    coldStart: boolean,
    dealScore: number,
  ): string {
    const parts: string[] = [];

    if (!coldStart) {
      const prefDims: string[] = [];
      if (topMatch(profile.makes, listing.manufacturer)) {
        prefDims.push(`manufacturer (${listing.manufacturer})`);
      }
      if (topMatch(profile.types, listing.type)) {
        prefDims.push(`type (${listing.type})`);
      }
      if (topMatch(profile.fuels, listing.fuel)) {
        prefDims.push(`fuel (${listing.fuel})`);
      }
      if (topMatch(profile.drives, listing.drive)) {
        prefDims.push(`drive (${listing.drive})`);
      }
      if (prefDims.length) {
        parts.push(`Matches your preferred ${prefDims.join(', ')}`);
      }
    }

    if (listing.dealDeltaPct !== null && listing.dealDeltaPct <= -10) {
      const pct = Math.abs(Math.round(listing.dealDeltaPct));
      parts.push(`${pct}% below market price`);
    } else if (coldStart && dealScore > 0.5) {
      parts.push('Competitively priced');
    }

    return parts.length ? parts.join(' · ') : 'Active listing';
  }

  private isEmptyProfile(p: PrefProfile): boolean {
    return (
      Object.keys(p.makes).length === 0 &&
      Object.keys(p.types).length === 0 &&
      Object.keys(p.fuels).length === 0 &&
      Object.keys(p.drives).length === 0
    );
  }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

/** Normalize dealDeltaPct to [0,1]. −30% → 1.0, 0% → 0.5, +30% → 0.0. */
function normalizeDeal(delta: number | null): number {
  if (delta === null) return 0.5;
  return Math.max(0, Math.min(1, (-delta + 30) / 60));
}

/** Frequency of `value` in `map`, normalized to [0,1] by the max frequency. */
function normalizedFreq(map: Record<string, number>, value: string): number {
  const count = map[value] ?? 0;
  if (count === 0) return 0;
  const max = Math.max(...Object.values(map));
  return max === 0 ? 0 : count / max;
}

/** Whether `value` is the top-ranked entry in `map`. */
function topMatch(map: Record<string, number>, value: string): boolean {
  if (!map[value]) return false;
  const max = Math.max(...Object.values(map));
  return map[value] === max;
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
