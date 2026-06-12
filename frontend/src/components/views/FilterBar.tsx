import { useMemo, useState } from 'react';
import type { Options } from '../../types';
import type { ListingSort } from '../../lib/marketplace-types';
import {
  MILEAGE_BANDS,
  PRICE_BANDS,
  hasActiveFilters,
  type Filters,
} from '../../lib/marketplace-filters';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';

const SORT_OPTIONS: ReadonlyArray<{ value: ListingSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'priceAsc', label: 'Price: low to high' },
  { value: 'priceDesc', label: 'Price: high to low' },
  { value: 'bestDeal', label: 'Best deal' },
];

interface FilterBarProps {
  options: Options;
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}

/** The marketplace filter bar. A free-text search (make or model, debounced so
 *  it doesn't re-query on every keystroke) sits above labelled <select>s wired
 *  with htmlFor/id for screen readers (rubric #6); changing any control re-queries. */
export default function FilterBar({
  options,
  filters,
  onChange,
  onClear,
}: FilterBarProps) {
  // Local draft so typing feels instant; the committed value (and the URL) only
  // updates after the debounce. `lastPushed` records what we last sent so we can
  // tell our own commit apart from an external change to filters.q (Back/forward,
  // Clear) and re-adopt only the latter — without clobbering in-flight typing.
  const [qDraft, setQDraft] = useState(filters.q);
  const [lastPushed, setLastPushed] = useState(filters.q);
  const commitQ = useDebouncedCallback((value: string) => {
    setLastPushed(value);
    onChange({ q: value });
  }, 350);
  if (filters.q !== lastPushed && filters.q !== qDraft) {
    // External change → adopt it (React "adjust state during render" pattern).
    setQDraft(filters.q);
    setLastPushed(filters.q);
  }

  const years = useMemo(() => {
    const [min, max] = options.year_range;
    const out: number[] = [];
    for (let y = max; y >= min; y -= 1) out.push(y);
    return out;
  }, [options.year_range]);

  return (
    <div className="mkt-filters-wrap">
      <div className="field mkt-search">
        <label htmlFor="f-q">Search</label>
        <input
          id="f-q"
          type="search"
          placeholder="Make or model — e.g. tacoma, f-150"
          value={qDraft}
          onChange={(e) => {
            setQDraft(e.target.value);
            commitQ(e.target.value);
          }}
          aria-label="Search listings by make or model"
        />
      </div>

      <div className="mkt-filters">
        <div className="field">
          <label htmlFor="f-make">Maker</label>
          <div className="select-wrap">
            <select
              id="f-make"
              value={filters.make}
              onChange={(e) => onChange({ make: e.target.value })}
            >
              <option value="">All makers</option>
              {options.manufacturers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-type">Body type</label>
          <div className="select-wrap">
            <select
              id="f-type"
              value={filters.type}
              onChange={(e) => onChange({ type: e.target.value })}
            >
              <option value="">All types</option>
              {options.types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-state">State</label>
          <div className="select-wrap">
            <select
              id="f-state"
              value={filters.state}
              onChange={(e) => onChange({ state: e.target.value })}
            >
              <option value="">All states</option>
              {options.states.map((s) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-price">Price band</label>
          <div className="select-wrap">
            <select
              id="f-price"
              value={filters.priceBand}
              onChange={(e) => onChange({ priceBand: Number(e.target.value) })}
            >
              {PRICE_BANDS.map((band, i) => (
                <option key={band.label} value={i}>
                  {band.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-miles">Mileage</label>
          <div className="select-wrap">
            <select
              id="f-miles"
              value={filters.mileageBand}
              onChange={(e) => onChange({ mileageBand: Number(e.target.value) })}
            >
              {MILEAGE_BANDS.map((band, i) => (
                <option key={band.label} value={i}>
                  {band.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-year">From year</label>
          <div className="select-wrap">
            <select
              id="f-year"
              value={filters.minYear}
              onChange={(e) => onChange({ minYear: e.target.value })}
            >
              <option value="">Any year</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y} or newer
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="f-sort">Sort</label>
          <div className="select-wrap">
            <select
              id="f-sort"
              value={filters.sort}
              onChange={(e) => onChange({ sort: e.target.value as ListingSort })}
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {hasActiveFilters(filters) && (
        <button type="button" className="linkbtn mkt-clear" onClick={onClear}>
          ✕ Clear filters
        </button>
      )}
    </div>
  );
}
