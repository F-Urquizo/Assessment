import { useEffect, useState } from 'react';
import type { Options } from '../../types';
import type { BrowseQuery, BrowseResult } from '../../lib/marketplace-types';
import { fetchListings } from '../../lib/api';
import { mockBrowse } from '../../lib/marketplace-mock';
import FilterBar from './FilterBar';
import {
  DEFAULT_FILTERS,
  PRICE_BANDS,
  type Filters,
} from '../../lib/marketplace-filters';
import ListingCard from './ListingCard';
import RecommendationsRail from './RecommendationsRail';

const PAGE_SIZE = 12;

// Discriminated-union load state — the project's idiom for fetch UIs (cf.
// GarageView). `demo` flags that we fell back to fixtures (backend unreachable).
type BrowseState =
  | { status: 'loading' }
  | { status: 'done'; result: BrowseResult; demo: boolean }
  | { status: 'error'; message: string };

export default function MarketplaceView({ options }: { options: Options }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<BrowseState>({ status: 'loading' });

  // Changing a filter resets to page 1; everything else preserves the page.
  const patchFilters = (patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  useEffect(() => {
    const band = PRICE_BANDS[filters.priceBand];
    const query: BrowseQuery = {
      make: filters.make || undefined,
      type: filters.type || undefined,
      state: filters.state || undefined,
      minPrice: band.min,
      maxPrice: band.max,
      sort: filters.sort,
      page,
      pageSize: PAGE_SIZE,
    };

    let cancelled = false;
    fetchListings(query)
      .then((result) => {
        if (!cancelled) setState({ status: 'done', result, demo: false });
      })
      .catch(() => {
        // MOCK: Paúl — backend unreachable; show fixtures so the page is usable.
        if (!cancelled)
          setState({ status: 'done', result: mockBrowse(query), demo: true });
      });
    return () => {
      cancelled = true;
    };
  }, [filters.make, filters.type, filters.state, filters.priceBand, filters.sort, page]);

  const total = state.status === 'done' ? state.result.total : null;

  return (
    <>
      <div className="view-head">
        <div className="view-kicker">Marketplace · 01</div>
        <div className="view-title">The lot</div>
        <div className="view-sub">
          Every car listed by the community, each priced against the model so you can
          see at a glance whether it’s a deal. Filter the lot, then open a listing for
          the full valuation breakdown.
        </div>
      </div>

      {state.status === 'done' && state.demo && (
        <div className="mkt-demo" role="status">
          ⚠ Demo data — backend not reachable. Showing sample listings; live data loads
          automatically once the API is up.
        </div>
      )}

      <RecommendationsRail />

      <FilterBar options={options} filters={filters} onChange={patchFilters} />

      <MarketplaceBody state={state} />

      {state.status === 'done' && total !== null && total > PAGE_SIZE && (
        <Pager
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPage={setPage}
        />
      )}
    </>
  );
}

function MarketplaceBody({ state }: { state: BrowseState }) {
  if (state.status === 'loading') {
    return <div className="mkt-loading">Loading the lot…</div>;
  }
  if (state.status === 'error') {
    return <div className="rec-empty">⚠ {state.message}</div>;
  }
  if (!state.result.items.length) {
    return <div className="rec-empty">No listings match these filters.</div>;
  }
  return (
    <div className="listing-grid">
      {state.result.items.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}

function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.ceil(total / pageSize);
  return (
    <div className="mkt-pager">
      <button
        className="linkbtn"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
      >
        ← prev
      </button>
      <span>
        Page {page} of {pages} · {total} cars
      </span>
      <button
        className="linkbtn"
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
      >
        next →
      </button>
    </div>
  );
}
