// Marketplace API types — mirror the backend Prisma `Listing` plus the derived
// `dealBadge` the ListingsService attaches (backend/src/listings/listings.service.ts
// → ListingView). The backend is the source of truth; keep these aligned with
// backend/prisma/schema.prisma. JSON serialises DateTimes as ISO strings.

export type ListingStatus = 'draft' | 'active' | 'sold';

/** Under / Fair / Over priced — derived server-side from dealDeltaPct (±10%). */
export type DealBadge = 'under' | 'fair' | 'over';

/** A marketplace listing as returned by GET /listings and GET /listings/:id. */
export interface Listing {
  id: string;

  // ── Spec fields (1:1 with the model-service /predict input) ──
  manufacturer: string;
  model: string;
  year: number;
  odometer: number;
  cylinders: number | null;
  condition: string;
  fuel: string;
  titleStatus: string;
  transmission: string;
  drive: string;
  type: string;
  paintColor: string;
  state: string;

  // ── Marketplace fields ──
  askingPrice: number;
  description: string | null;
  contactEmail: string;
  contactPhone: string | null;
  status: ListingStatus;

  // ── Derived valuation (written by the service, never the client) ──
  predictedValue: number | null;
  predictedLow: number | null;
  predictedHigh: number | null;
  dealDeltaPct: number | null;
  dealBadge: DealBadge | null;

  // ── Ownership / audit ──
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/** Sort modes exposed by GET /listings (mirrors BrowseListingsDto `SORTS`). */
export type ListingSort = 'newest' | 'priceAsc' | 'priceDesc' | 'bestDeal';

/** Query params for GET /listings — every field optional. */
export interface BrowseQuery {
  make?: string; // filters `manufacturer`
  type?: string;
  state?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ListingSort;
  page?: number;
  pageSize?: number;
}

/** A page of marketplace results (mirrors the service `BrowseResult`). */
export interface BrowseResult {
  items: Listing[];
  total: number;
  page: number;
  pageSize: number;
}

/** Presentation metadata for the deal badge. Text label + class — never
 *  color alone (accessibility rubric #6). The threshold logic itself lives in
 *  the backend; the client only maps the already-computed badge to a label. */
export const DEAL_BADGE_META: Record<
  DealBadge,
  { label: string; cls: string; symbol: string }
> = {
  // symbol is a redundant non-colour cue (helps colour-blind users distinguish
  // badges at a glance); it's rendered aria-hidden since the label already says it.
  under: { label: 'Under priced', cls: 'badge-under', symbol: '▾' },
  fair: { label: 'Fair price', cls: 'badge-fair', symbol: '≈' },
  over: { label: 'Over priced', cls: 'badge-over', symbol: '▴' },
};

/** Why a price-history row was written (mirrors backend PriceChangeReason). */
export type PriceChangeReason = 'created' | 'asking_price_change' | 'revaluation';

/** One append-only price/valuation change (mirrors backend ListingPriceHistory). */
export interface PriceHistoryEntry {
  id: string;
  reason: PriceChangeReason;
  oldAskingPrice: number | null;
  newAskingPrice: number;
  oldPredictedValue: number | null;
  newPredictedValue: number | null;
  oldPredictedLow: number | null;
  newPredictedLow: number | null;
  oldPredictedHigh: number | null;
  newPredictedHigh: number | null;
  changedAt: string;
}

/** GET /listings/:id — a listing plus its price/valuation trail (oldest→newest). */
export interface ListingDetail extends Listing {
  priceHistory: PriceHistoryEntry[];
}

/** Body for POST/PATCH /listings (mirrors the backend CreateListingDto). The
 *  derived valuation fields are never sent — the service computes them. */
export interface ListingInput {
  manufacturer: string;
  model: string;
  year: number;
  odometer: number;
  cylinders?: number | null;
  condition: string;
  fuel: string;
  titleStatus: string;
  transmission: string;
  drive: string;
  type: string;
  paintColor: string;
  state: string;
  askingPrice: number;
  description?: string | null;
  contactEmail: string;
  contactPhone?: string | null;
  status?: ListingStatus;
}
