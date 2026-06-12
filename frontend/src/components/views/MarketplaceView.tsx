import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Options } from '../../types';
import type { BrowseResult } from '../../lib/marketplace-types';
import { fetchListings } from '../../lib/api';
import { mockBrowse } from '../../lib/marketplace-mock';
import FilterBar from './FilterBar';
import {
  DEFAULT_FILTERS,
  filtersFromSearchParams,
  filtersToBrowseQuery,
  filtersToSearchParams,
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
  const navigate = useNavigate();
  // The URL is the source of truth for filters + page, so a search is shareable,
  // bookmarkable and survives Back/refresh.
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, page } = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  );

  const [state, setState] = useState<BrowseState>({ status: 'loading' });
  const resultsRef = useRef<HTMLDivElement>(null);

  // Changing a filter resets to page 1; changing the page preserves filters.
  const patchFilters = (patch: Partial<Filters>) => {
    setSearchParams(filtersToSearchParams({ ...filters, ...patch }, 1), {
      replace: true,
    });
  };
  const clearFilters = () =>
    setSearchParams(filtersToSearchParams(DEFAULT_FILTERS, 1), { replace: true });
  const goToPage = (next: number) =>
    setSearchParams(filtersToSearchParams(filters, next));

  const query = useMemo(
    () => filtersToBrowseQuery(filters, page, PAGE_SIZE),
    [filters, page],
  );
  // Stable key so the fetch effect fires only when the effective query changes.
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    let cancelled = false;
    // Note: we intentionally keep the previous results on screen while the next
    // query loads (no loading flash on a filter change); the skeletons show only
    // on first paint, when state starts as 'loading'.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  // Bring the results into view when the query changes (new filter or page) so
  // paginated/ filtered users aren't left staring at a mid-scroll position.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [queryKey]);

  const openListing = (id: string) => navigate(`/listings/${id}`);
  const total = state.status === 'done' ? state.result.total : null;

  return (
    <>
      <div className="view-head">
        <div className="view-kicker">Marketplace · 01</div>
        <div className="view-title">The lot</div>
        <div className="view-sub">
          Every car listed by the community, each priced against its Bluebook value so
          you can see at a glance whether it’s a deal. Search or filter the lot, then
          open a listing for the full valuation breakdown.
        </div>
      </div>

      {state.status === 'done' && state.demo && (
        <div className="mkt-demo" role="status">
          ⚠ Demo data — backend not reachable. Showing sample listings; live data loads
          automatically once the API is up.
        </div>
      )}

      <RecommendationsRail onOpen={openListing} />

      <FilterBar
        options={options}
        filters={filters}
        onChange={patchFilters}
        onClear={clearFilters}
      />

      <div ref={resultsRef}>
        <ResultCount state={state} />
        <MarketplaceBody state={state} onOpen={openListing} />
      </div>

      {state.status === 'done' && total !== null && total > PAGE_SIZE && (
        <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={goToPage} />
      )}
    </>
  );
}

/** A small live-region count so users know how many cars matched their search. */
function ResultCount({ state }: { state: BrowseState }) {
  if (state.status !== 'done') return null;
  const n = state.result.total;
  return (
    <div className="mkt-count" role="status" aria-live="polite">
      {n === 0 ? 'No matches' : `${n} car${n === 1 ? '' : 's'}`}
    </div>
  );
}

function MarketplaceBody({
  state,
  onOpen,
}: {
  state: BrowseState;
  onOpen: (id: string) => void;
}) {
  if (state.status === 'loading') {
    return (
      <div className="listing-grid" aria-busy="true" aria-label="Loading listings">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="listing-card skel-card skeleton" />
        ))}
      </div>
    );
  }
  if (state.status === 'error') {
    return <div className="rec-empty">⚠ {state.message}</div>;
  }
  if (!state.result.items.length) {
    return (
      <div className="rec-empty">
        No listings match these filters. Try widening your search or clearing a
        filter.
      </div>
    );
  }
  return (
    <div className="listing-grid">
      {state.result.items.map((listing) => (
        <ListingCard key={listing.id} listing={listing} onOpen={onOpen} />
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
