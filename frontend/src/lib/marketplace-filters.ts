import type { ListingSort } from './marketplace-types';

// Filter UI state + the price-band table, kept out of FilterBar.tsx so that
// component file only exports a component (react-refresh rule).

/** UI filter state. `priceBand` indexes PRICE_BANDS; `make/type/state` use ''
 *  for "any". The view maps these to the backend BrowseQuery. */
export interface Filters {
  make: string;
  type: string;
  state: string;
  priceBand: number;
  sort: ListingSort;
}

export const DEFAULT_FILTERS: Filters = {
  make: '',
  type: '',
  state: '',
  priceBand: 0,
  sort: 'newest',
};

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
