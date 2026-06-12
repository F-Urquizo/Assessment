import type { Listing } from './marketplace-types';

// Mirrors the backend GET /recommendations response item
// (backend/src/recommendations/recommendations.service.ts → RecommendedListing).
export interface RecommendedListing {
  listing: Listing;
  score: number;
  why: string;
}

// Mirror of the backend cold-start helpers so the mock fallback produces the
// same scores/strings as the real endpoint. Keep in sync with the backend.

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

/** Deal score in [0,1]: 20%+ under model = 1.0, 20%+ over = 0.0, linear. */
export function dealScore(deltaPct: number): number {
  return Math.round(clamp((20 - deltaPct) / 40, 0, 1) * 100) / 100;
}

/** Human "why" shown on the recommendation card. */
export function buildWhy(deltaPct: number): string {
  const pct = Math.round(Math.abs(deltaPct));
  if (deltaPct <= -10) return `Great deal — ${pct}% below Bluebook value`;
  if (deltaPct < 0) return `Priced ${pct}% under Bluebook value`;
  if (deltaPct === 0) return `Priced right at Bluebook value`;
  if (deltaPct <= 10) return `Fairly priced — about ${pct}% over Bluebook value`;
  return `Priced ${pct}% over Bluebook value`;
}
