/**
 * Deal scoring derived from a listing's asking price vs the model-service
 * valuation. Pure functions — no I/O — so they're trivially testable and
 * reusable by Fran's RecommendationsModule for its deal_score signal.
 */

/** Listings priced within ±10% of predicted value are considered fairly priced. */
export const DEAL_THRESHOLD_PCT = 10;

export type DealBadge = 'under' | 'fair' | 'over';

/**
 * Percentage the asking price sits above (+) or below (−) the predicted value.
 * Negative means a buyer pays less than the model expects — a good deal.
 * Returns null when there's no usable predicted value to compare against.
 */
export function computeDealDeltaPct(
  askingPrice: number,
  predictedValue: number | null | undefined,
): number | null {
  if (!predictedValue) return null; // null/undefined/0 → not comparable
  const pct = ((askingPrice - predictedValue) / predictedValue) * 100;
  return Math.round(pct * 100) / 100;
}

/** Maps a deal delta to an Under / Fair / Over badge. Null delta → null badge. */
export function dealBadge(dealDeltaPct: number | null): DealBadge | null {
  if (dealDeltaPct === null) return null;
  if (dealDeltaPct <= -DEAL_THRESHOLD_PCT) return 'under';
  if (dealDeltaPct >= DEAL_THRESHOLD_PCT) return 'over';
  return 'fair';
}
