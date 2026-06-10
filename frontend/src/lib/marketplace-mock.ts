// MOCK: Paúl / Beto — dev fixtures + a client-side browse so the Marketplace UI
// is fully reviewable on localhost without the backend (Postgres + NestJS +
// model-service) running. fetchListings() (lib/api.ts) hits the real GET
// /listings first; MarketplaceView falls back to mockBrowse() only when that
// call fails. Swap point: delete this fallback once the backend is reliably up.
import type {
  BrowseQuery,
  BrowseResult,
  Listing,
  ListingDetail,
  ListingSort,
  PriceHistoryEntry,
} from './marketplace-types';
import type { Options } from '../types';

let seq = 0;

/** Builds a fixture listing from defaults + overrides, computing nothing —
 *  predicted/delta/badge are authored explicitly to mirror real server rows. */
function fixture(over: Partial<Listing>): Listing {
  seq += 1;
  const base: Listing = {
    id: `mock-${seq}`,
    manufacturer: 'ford',
    model: 'f-150',
    year: 2019,
    odometer: 60000,
    cylinders: 6,
    condition: 'good',
    fuel: 'gas',
    titleStatus: 'clean',
    transmission: 'automatic',
    drive: 'rwd',
    type: 'truck',
    paintColor: 'white',
    state: 'tx',
    askingPrice: 25000,
    description: null,
    contactEmail: 'seller@example.com',
    contactPhone: null,
    status: 'active',
    predictedValue: 25000,
    predictedLow: 22000,
    predictedHigh: 28000,
    dealDeltaPct: 0,
    dealBadge: 'fair',
    userId: 'mock-seller',
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
  };
  return { ...base, ...over };
}

// A spread of badges (under / fair / over / not-yet-valued) across makes, types,
// states and price points so every filter and sort has something to show.
const LISTINGS: Listing[] = [
  fixture({
    manufacturer: 'toyota', model: 'camry', year: 2020, odometer: 41200,
    type: 'sedan', state: 'ca', paintColor: 'silver',
    askingPrice: 18000, predictedValue: 21000, predictedLow: 19000, predictedHigh: 23000,
    dealDeltaPct: -14.29, dealBadge: 'under', createdAt: '2026-06-09T09:00:00.000Z',
  }),
  fixture({
    manufacturer: 'ford', model: 'f-150', year: 2019, odometer: 58800,
    type: 'truck', state: 'tx', paintColor: 'blue',
    askingPrice: 32000, predictedValue: 31000, predictedLow: 28000, predictedHigh: 34000,
    dealDeltaPct: 3.23, dealBadge: 'fair', createdAt: '2026-06-08T15:30:00.000Z',
  }),
  fixture({
    manufacturer: 'honda', model: 'civic', year: 2021, odometer: 22100,
    type: 'sedan', state: 'ny', paintColor: 'red',
    askingPrice: 24000, predictedValue: 21000, predictedLow: 19000, predictedHigh: 23000,
    dealDeltaPct: 14.29, dealBadge: 'over', createdAt: '2026-06-07T11:10:00.000Z',
  }),
  fixture({
    manufacturer: 'tesla', model: 'model 3', year: 2022, odometer: 18400,
    type: 'sedan', state: 'ca', paintColor: 'white', fuel: 'electric', cylinders: null,
    askingPrice: 33000, predictedValue: 38000, predictedLow: 35000, predictedHigh: 41000,
    dealDeltaPct: -13.16, dealBadge: 'under', createdAt: '2026-06-06T18:45:00.000Z',
  }),
  fixture({
    manufacturer: 'chevrolet', model: 'silverado', year: 2018, odometer: 72500,
    type: 'truck', state: 'fl', paintColor: 'black',
    askingPrice: 28000, predictedValue: 27500, predictedLow: 25000, predictedHigh: 30000,
    dealDeltaPct: 1.82, dealBadge: 'fair', createdAt: '2026-06-05T08:20:00.000Z',
  }),
  fixture({
    manufacturer: 'bmw', model: '330i', year: 2019, odometer: 39000,
    type: 'sedan', state: 'wa', paintColor: 'blue',
    askingPrice: 31000, predictedValue: 27000, predictedLow: 24000, predictedHigh: 30000,
    dealDeltaPct: 14.81, dealBadge: 'over', createdAt: '2026-06-04T14:00:00.000Z',
  }),
  fixture({
    manufacturer: 'toyota', model: 'rav4', year: 2020, odometer: 47300,
    type: 'suv', state: 'tx', paintColor: 'silver',
    askingPrice: 26000, predictedValue: 28000, predictedLow: 25000, predictedHigh: 31000,
    dealDeltaPct: -7.14, dealBadge: 'fair', createdAt: '2026-06-03T16:40:00.000Z',
  }),
  fixture({
    manufacturer: 'honda', model: 'cr-v', year: 2017, odometer: 81000,
    type: 'suv', state: 'ca', paintColor: 'white',
    askingPrice: 19000, predictedValue: 22000, predictedLow: 20000, predictedHigh: 24000,
    dealDeltaPct: -13.64, dealBadge: 'under', createdAt: '2026-06-02T10:05:00.000Z',
  }),
  fixture({
    manufacturer: 'ford', model: 'mustang', year: 2021, odometer: 15600,
    type: 'coupe', state: 'fl', paintColor: 'red',
    askingPrice: 41000, predictedValue: 39000, predictedLow: 35000, predictedHigh: 43000,
    dealDeltaPct: 5.13, dealBadge: 'fair', createdAt: '2026-06-01T19:25:00.000Z',
  }),
  fixture({
    manufacturer: 'chevrolet', model: 'bolt', year: 2022, odometer: 12900,
    type: 'hatchback', state: 'ny', paintColor: 'blue', fuel: 'electric', cylinders: null,
    askingPrice: 23000, predictedValue: null, predictedLow: null, predictedHigh: null,
    dealDeltaPct: null, dealBadge: null, createdAt: '2026-05-30T13:15:00.000Z',
  }),
];

/** nulls sort last under bestDeal, matching the backend's `nulls: 'last'`. */
const deltaForSort = (l: Listing): number =>
  l.dealDeltaPct === null ? Number.POSITIVE_INFINITY : l.dealDeltaPct;

function sortListings(items: Listing[], sort: ListingSort): Listing[] {
  const copy = [...items];
  switch (sort) {
    case 'priceAsc':
      return copy.sort((a, b) => a.askingPrice - b.askingPrice);
    case 'priceDesc':
      return copy.sort((a, b) => b.askingPrice - a.askingPrice);
    case 'bestDeal':
      return copy.sort((a, b) => deltaForSort(a) - deltaForSort(b));
    case 'newest':
    default:
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

/** Mirrors the backend browse: active-only, filtered, sorted, paged. */
export function mockBrowse(query: BrowseQuery = {}): BrowseResult {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  let items = LISTINGS.filter((l) => l.status === 'active');
  if (query.make) items = items.filter((l) => l.manufacturer === query.make);
  if (query.type) items = items.filter((l) => l.type === query.type);
  if (query.state) items = items.filter((l) => l.state === query.state);
  if (query.minPrice !== undefined)
    items = items.filter((l) => l.askingPrice >= query.minPrice!);
  if (query.maxPrice !== undefined)
    items = items.filter((l) => l.askingPrice <= query.maxPrice!);

  items = sortListings(items, query.sort ?? 'newest');

  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page, pageSize };
}

/** Synthesises a small price-history trail for a fixture: listed ~28 days ago a
 *  touch higher, then dropped to the current asking price. */
function synthHistory(l: Listing): PriceHistoryEntry[] {
  const created = new Date(l.createdAt);
  const earlier = new Date(created.getTime() - 28 * 86_400_000).toISOString();
  const initial = Math.round((l.askingPrice * 1.06) / 50) * 50;
  return [
    {
      id: `${l.id}-h1`,
      reason: 'created',
      oldAskingPrice: null,
      newAskingPrice: initial,
      oldPredictedValue: null,
      newPredictedValue: l.predictedValue,
      oldPredictedLow: null,
      newPredictedLow: l.predictedLow,
      oldPredictedHigh: null,
      newPredictedHigh: l.predictedHigh,
      changedAt: earlier,
    },
    {
      id: `${l.id}-h2`,
      reason: 'asking_price_change',
      oldAskingPrice: initial,
      newAskingPrice: l.askingPrice,
      oldPredictedValue: l.predictedValue,
      newPredictedValue: l.predictedValue,
      oldPredictedLow: l.predictedLow,
      newPredictedLow: l.predictedLow,
      oldPredictedHigh: l.predictedHigh,
      newPredictedHigh: l.predictedHigh,
      changedAt: l.createdAt,
    },
  ];
}

/** Mock GET /listings/:id — a fixture plus a synthesised price history. */
export function mockListingDetail(id: string): ListingDetail | null {
  const listing = LISTINGS.find((l) => l.id === id);
  if (!listing) return null;
  return { ...listing, priceHistory: synthHistory(listing) };
}

// MOCK: Beto — minimal /options fallback so the filter dropdowns populate when
// the backend is down. Covers every make/type/state present in the fixtures.
export const MOCK_OPTIONS: Options = {
  manufacturers: ['bmw', 'chevrolet', 'ford', 'honda', 'tesla', 'toyota'],
  manufacturer_models: {},
  cylinders: [4, 6, 8],
  conditions: ['excellent', 'good', 'fair'],
  fuels: ['gas', 'diesel', 'hybrid', 'electric'],
  title_statuses: ['clean', 'rebuilt', 'salvage'],
  transmissions: ['automatic', 'manual'],
  drives: ['fwd', 'rwd', '4wd'],
  types: ['sedan', 'suv', 'truck', 'coupe', 'hatchback'],
  paint_colors: ['white', 'black', 'silver', 'blue', 'red'],
  states: ['ca', 'fl', 'ny', 'tx', 'wa'],
  year_range: [2000, 2024],
};
