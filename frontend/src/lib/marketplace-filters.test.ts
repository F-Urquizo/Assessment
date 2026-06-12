import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FILTERS,
  filtersFromSearchParams,
  filtersToBrowseQuery,
  filtersToSearchParams,
  hasActiveFilters,
  type Filters,
} from './marketplace-filters';

const filters = (over: Partial<Filters> = {}): Filters => ({
  ...DEFAULT_FILTERS,
  ...over,
});

describe('filtersToBrowseQuery', () => {
  it('drops "any" selections and maps bands to min/max ints', () => {
    const q = filtersToBrowseQuery(DEFAULT_FILTERS, 1, 12);
    expect(q).toEqual({
      q: undefined,
      make: undefined,
      type: undefined,
      state: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      minMiles: undefined,
      maxMiles: undefined,
      minYear: undefined,
      sort: 'newest',
      page: 1,
      pageSize: 12,
    });
  });

  it('translates active filters into the backend query', () => {
    const q = filtersToBrowseQuery(
      filters({ q: ' tacoma ', make: 'toyota', priceBand: 2, mileageBand: 1, minYear: '2018' }),
      3,
      12,
    );
    expect(q.q).toBe('tacoma'); // trimmed
    expect(q.make).toBe('toyota');
    expect(q.minPrice).toBe(10000);
    expect(q.maxPrice).toBe(20000);
    expect(q.maxMiles).toBe(30000);
    expect(q.minYear).toBe(2018);
    expect(q.page).toBe(3);
  });
});

describe('URL round-trip', () => {
  it('serialises only non-default values', () => {
    const p = filtersToSearchParams(DEFAULT_FILTERS, 1);
    expect(p.toString()).toBe('');
  });

  it('round-trips a populated filter set through the URL', () => {
    const original = filters({
      q: 'civic',
      make: 'honda',
      type: 'sedan',
      state: 'ca',
      priceBand: 3,
      mileageBand: 2,
      minYear: '2019',
      sort: 'bestDeal',
    });
    const params = filtersToSearchParams(original, 4);
    const back = filtersFromSearchParams(params);
    expect(back.filters).toEqual(original);
    expect(back.page).toBe(4);
  });

  it('falls back to defaults for out-of-range or garbage params', () => {
    const params = new URLSearchParams(
      'price=99&miles=-1&sort=bogus&page=0',
    );
    const { filters: f, page } = filtersFromSearchParams(params);
    expect(f.priceBand).toBe(0);
    expect(f.mileageBand).toBe(0);
    expect(f.sort).toBe('newest');
    expect(page).toBe(1);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the defaults and true once anything changes', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters(filters({ make: 'ford' }))).toBe(true);
    expect(hasActiveFilters(filters({ q: '  ' }))).toBe(false); // whitespace only
    expect(hasActiveFilters(filters({ sort: 'priceAsc' }))).toBe(true);
  });
});
