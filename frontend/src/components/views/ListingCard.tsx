import type { Listing } from '../../lib/marketplace-types';
import { DEAL_BADGE_META } from '../../lib/marketplace-types';
import { fmt, fmtN } from '../../lib/format';

/** One marketplace listing tile: vehicle, asking price, model valuation and the
 *  Under/Fair/Over deal badge. The badge carries a text label (not color alone)
 *  for accessibility (rubric #6). Detail + full visual analysis arrive in A3. */
export default function ListingCard({ listing }: { listing: Listing }) {
  const title = `${listing.year} ${listing.manufacturer} ${listing.model}`.toUpperCase();
  const badge = listing.dealBadge ? DEAL_BADGE_META[listing.dealBadge] : null;
  const delta = listing.dealDeltaPct;
  const valued = listing.predictedValue !== null;

  return (
    <article className="listing-card">
      <div className="listing-card-head">
        <h3 className="listing-title">{title}</h3>
        {badge && (
          <span
            className={`deal-badge ${badge.cls}`}
            aria-label={
              delta !== null
                ? `${badge.label}, ${Math.round(delta)} percent versus model value`
                : badge.label
            }
          >
            {badge.label}
            {delta !== null && (
              <b>
                {delta > 0 ? '+' : ''}
                {Math.round(delta)}%
              </b>
            )}
          </span>
        )}
      </div>

      <div className="listing-meta">
        {fmtN(listing.odometer)} mi · {listing.condition} · {listing.titleStatus} ·{' '}
        {listing.state.toUpperCase()}
      </div>

      <div className="listing-price-row">
        <div className="listing-ask">
          <div className="listing-ask-v">{fmt(listing.askingPrice)}</div>
          <div className="listing-ask-l">Asking price</div>
        </div>
        <div className="listing-model">
          {valued ? (
            <>
              <div className="listing-model-v">{fmt(listing.predictedValue!)}</div>
              <div className="listing-model-l">
                Model value
                {listing.predictedLow !== null && listing.predictedHigh !== null && (
                  <>
                    {' · '}
                    {fmt(listing.predictedLow)}–{fmt(listing.predictedHigh)}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="listing-model-l">Not valued yet</div>
          )}
        </div>
      </div>
    </article>
  );
}
