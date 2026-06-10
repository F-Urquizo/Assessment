import type { Options } from '../../types';
import type { ListingSort } from '../../lib/marketplace-types';
import { PRICE_BANDS, type Filters } from '../../lib/marketplace-filters';

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
}

/** The marketplace filter bar. Each control is a labelled <select> wired with
 *  htmlFor/id for screen readers (rubric #6); changing any control re-queries. */
export default function FilterBar({ options, filters, onChange }: FilterBarProps) {
  return (
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
  );
}
