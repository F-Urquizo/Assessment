// MOCK: recommendations fallback — used when GET /recommendations is unreachable
// (e.g. backend down). Derives "best deal" picks from the shared listing
// fixtures so the rail is reviewable without the backend. fetchRecommendations()
// (lib/api.ts) hits the real endpoint first.
import { mockBrowse } from './marketplace-mock';
import {
  buildWhy,
  dealScore,
  type RecommendedListing,
} from './recommendations-types';

export function mockRecommendations(limit = 8): RecommendedListing[] {
  const { items } = mockBrowse({ sort: 'bestDeal', pageSize: limit + 6 });
  return items
    .filter((l) => l.dealDeltaPct !== null)
    .slice(0, limit)
    .map((listing) => ({
      listing,
      score: dealScore(listing.dealDeltaPct as number),
      why: buildWhy(listing.dealDeltaPct as number),
    }));
}
