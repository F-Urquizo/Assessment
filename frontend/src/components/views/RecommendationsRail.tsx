import { useEffect, useState } from 'react';
import type { RecommendedListing } from '../../lib/recommendations-types';
import { DEAL_BADGE_META } from '../../lib/marketplace-types';
import { fetchRecommendations } from '../../lib/api';
import { mockRecommendations } from '../../lib/recommendations-mock';
import { fmt } from '../../lib/format';

const LIMIT = 8;

type RailState =
  | { status: 'loading' }
  | { status: 'done'; recs: RecommendedListing[] };

/**
 * "Recommended for you" rail (A2). Consumes GET /recommendations and shows each
 * pick's deal badge + the "why" string. Falls back to fixtures if the endpoint
 * is unreachable. Renders nothing while loading or when there are no picks, so
 * it never leaves an empty band on the page.
 */
export default function RecommendationsRail() {
  const [state, setState] = useState<RailState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchRecommendations(LIMIT)
      .then((recs) => {
        if (!cancelled) setState({ status: 'done', recs });
      })
      .catch(() => {
        // MOCK: recommendations endpoint unreachable — show fixture picks.
        if (!cancelled)
          setState({ status: 'done', recs: mockRecommendations(LIMIT) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status !== 'done' || !state.recs.length) return null;

  return (
    <section className="recs-rail-wrap" aria-label="Recommended for you">
      <div className="recs-rail-head">
        <h2 className="recs-rail-title">Recommended for you</h2>
        <span className="recs-rail-sub">Best deals against the model right now</span>
      </div>
      <div className="recs-rail">
        {state.recs.map((rec) => (
          <RecommendationCard key={rec.listing.id} rec={rec} />
        ))}
      </div>
    </section>
  );
}

function RecommendationCard({ rec }: { rec: RecommendedListing }) {
  const { listing, why } = rec;
  const title = `${listing.year} ${listing.manufacturer} ${listing.model}`.toUpperCase();
  const badge = listing.dealBadge ? DEAL_BADGE_META[listing.dealBadge] : null;

  return (
    <article className="rec-card">
      <div className="rec-card-head">
        <h3 className="rec-card-title">{title}</h3>
        {badge && <span className={`deal-badge ${badge.cls}`}>{badge.label}</span>}
      </div>
      <div className="rec-card-price">{fmt(listing.askingPrice)}</div>
      <div className="rec-card-why">{why}</div>
    </article>
  );
}
