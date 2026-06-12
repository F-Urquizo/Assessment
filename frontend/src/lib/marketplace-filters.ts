import type { BrowseQuery, ListingSort } from './marketplace-types';

// Filter UI state + the band tables, kept out of FilterBar.tsx so that
// component file only exports a component (react-refresh rule). The URL is the
// single source of truth for filters/page, so a search is shareable, bookmarkable
// and survives Back/refresh — the (de)serialisers below are the seam.

/** UI filter state. `priceBand`/`mileageBand` index the band tables; `make/type/
 *  state` use '' for "any"; `q` is the free-text keyword; `minYear` is '' or a
 *  year string. The view maps these to the backend BrowseQuery. */
export interface Filters {
  q: string;
  make: string;
  type: string;
  state: string;
  priceBand: number;
  mileageBand: number;
  minYear: string;
  sort: ListingSort;
}

export const DEFAULT_FILTERS: Filters = {
  q: '',
  make: '',
  type: '',
  state: '',
  priceBand: 0,
  mileageBand: 0,
  minYear: '',
  sort: 'newest',
};

const SORTS: readonly ListingSort[] = [
  'newest',
  'priceAsc',
  'priceDesc',
  'bestDeal',
];

/** Price bands map to the backend's min/max ints. Index 0 = any price. */
export const PRICE_BANDS: ReadonlyArray<{
  label: string;
  min?: number;
  max?: number;
}> = [
  { label: 'Any price' },
  { label: 'Under $10k', max: 10000 },
  { label: '$10k – $20k', min: 10000, max: 20000 },
  { label: '$20k – $35k', min: 20000, max: 35000 },
  { label: '$35k – $50k', min: 35000, max: 50000 },
  { label: '$50k+', min: 50000 },
];

/** Mileage bands map to the backend's min/max ints. Index 0 = any mileage. */
export const MILEAGE_BANDS: ReadonlyArray<{
  label: string;
  min?: number;
  max?: number;
}> = [
  { label: 'Any mileage' },
  { label: 'Under 30k mi', max: 30000 },
  { label: '30k – 60k mi', min: 30000, max: 60000 },
  { label: '60k – 100k mi', min: 60000, max: 100000 },
  { label: '100k+ mi', min: 100000 },
];

/** Maps the filter UI state + page to the backend browse query, dropping
 *  "any" selections so the request carries only the active constraints. */
export function filtersToBrowseQuery(
  filters: Filters,
  page: number,
  pageSize: number,
): BrowseQuery {
  const price = PRICE_BANDS[filters.priceBand] ?? PRICE_BANDS[0];
  const miles = MILEAGE_BANDS[filters.mileageBand] ?? MILEAGE_BANDS[0];
  return {
    q: filters.q.trim() || undefined,
    make: filters.make || undefined,
    type: filters.type || undefined,
    state: filters.state || undefined,
    minPrice: price.min,
    maxPrice: price.max,
    minMiles: miles.min,
    maxMiles: miles.max,
    minYear: filters.minYear ? Number(filters.minYear) : undefined,
    sort: filters.sort,
    page,
    pageSize,
  };
}

/** Serialises filters + page into URL search params — only non-default values
 *  appear, keeping shared links clean (`/?make=toyota&miles=2`). */
export function filtersToSearchParams(
  filters: Filters,
  page: number,
): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.q.trim()) p.set('q', filters.q.trim());
  if (filters.make) p.set('make', filters.make);
  if (filters.type) p.set('type', filters.type);
  if (filters.state) p.set('state', filters.state);
  if (filters.priceBand) p.set('price', String(filters.priceBand));
  if (filters.mileageBand) p.set('miles', String(filters.mileageBand));
  if (filters.minYear) p.set('year', filters.minYear);
  if (filters.sort !== 'newest') p.set('sort', filters.sort);
  if (page > 1) p.set('page', String(page));
  return p;
}

/** Inverse of {@link filtersToSearchParams}. Out-of-range band indices and
 *  unknown sorts fall back to defaults, so a hand-edited URL can't crash the UI. */
export function filtersFromSearchParams(p: URLSearchParams): {
  filters: Filters;
  page: number;
} {
  const bandIndex = (raw: string | null, len: number): number => {
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 && n < len ? n : 0;
  };
  const rawSort = p.get('sort') as ListingSort | null;
  const sort: ListingSort =
    rawSort && SORTS.includes(rawSort) ? rawSort : 'newest';
  const page = Math.max(1, Math.trunc(Number(p.get('page'))) || 1);

  return {
    filters: {
      q: p.get('q') ?? '',
      make: p.get('make') ?? '',
      type: p.get('type') ?? '',
      state: p.get('state') ?? '',
      priceBand: bandIndex(p.get('price'), PRICE_BANDS.length),
      mileageBand: bandIndex(p.get('miles'), MILEAGE_BANDS.length),
      minYear: p.get('year') ?? '',
      sort,
    },
    page,
  };
}

/** True when any filter differs from the default (drives the "Clear" affordance). */
export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.q.trim() !== '' ||
    filters.make !== '' ||
    filters.type !== '' ||
    filters.state !== '' ||
    filters.priceBand !== 0 ||
    filters.mileageBand !== 0 ||
    filters.minYear !== '' ||
    filters.sort !== 'newest'
  );
}
