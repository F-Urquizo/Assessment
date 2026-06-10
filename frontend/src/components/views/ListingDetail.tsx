import { useEffect, useState } from 'react';
import type { Appraisal } from '../../types';
import type {
  ListingDetail as ListingDetailData,
  PriceHistoryEntry,
} from '../../lib/marketplace-types';
import { DEAL_BADGE_META } from '../../lib/marketplace-types';
import { fetchListing } from '../../lib/api';
import { mockListingDetail } from '../../lib/marketplace-mock';
import { evaluateDeal } from '../../lib/deal';
import { fmt, fmtN } from '../../lib/format';

type DetailState =
  | { status: 'loading' }
  | { status: 'done'; listing: ListingDetailData }
  | { status: 'error'; message: string };

/**
 * Listing detail (A3). Shows the model-based over/under-valued analysis for a
 * single listing — reusing evaluateDeal + the Studio's deal-scale visual — plus
 * price history, seller contact and a favourite toggle. Built from the listing's
 * own stored valuation, so it needs no model-service call.
 */
export default function ListingDetail({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const [state, setState] = useState<DetailState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchListing(id)
      .then((listing) => {
        if (!cancelled) setState({ status: 'done', listing });
      })
      .catch(() => {
        // MOCK: Paúl — detail endpoint unreachable; fall back to a fixture.
        const mock = mockListingDetail(id);
        if (!cancelled)
          setState(
            mock
              ? { status: 'done', listing: mock }
              : { status: 'error', message: 'Listing not found' },
          );
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      <button className="linkbtn detail-back" onClick={onBack}>
        ← back to marketplace
      </button>
      {state.status === 'loading' && (
        <div className="mkt-loading">Loading listing…</div>
      )}
      {state.status === 'error' && <div className="rec-empty">⚠ {state.message}</div>}
      {state.status === 'done' && <DetailBody listing={state.listing} />}
    </>
  );
}

function DetailBody({ listing }: { listing: ListingDetailData }) {
  const [favorited, setFavorited] = useState(false);
  const title =
    `${listing.year} ${listing.manufacturer} ${listing.model}`.toUpperCase();

  return (
    <>
      <div className="view-head">
        <div className="view-kicker">Listing · detail</div>
        <div className="detail-title-row">
          <div className="view-title">{title}</div>
          {/* MOCK: A5/Fran favourites — local only; wire to /favorites later. */}
          <button
            className={'fav-btn' + (favorited ? ' on' : '')}
            aria-pressed={favorited}
            onClick={() => setFavorited((f) => !f)}
          >
            {favorited ? '♥ Saved' : '♡ Save'}
          </button>
        </div>
        <div className="subject-strip">
          <span className="veh">
            {fmtN(listing.odometer)} mi · {listing.condition} · {listing.titleStatus} ·{' '}
            {listing.state.toUpperCase()}
          </span>
          <span className="est">Asking {fmt(listing.askingPrice)}</span>
        </div>
      </div>

      <ValuationAnalysis listing={listing} />

      <div className="grid-2" style={{ marginTop: 26 }}>
        <PriceHistory entries={listing.priceHistory} />
        <SellerContact email={listing.contactEmail} phone={listing.contactPhone} />
      </div>
    </>
  );
}

function ValuationAnalysis({ listing }: { listing: ListingDetailData }) {
  const badge = listing.dealBadge ? DEAL_BADGE_META[listing.dealBadge] : null;

  if (
    listing.predictedValue === null ||
    listing.predictedLow === null ||
    listing.predictedHigh === null
  ) {
    return (
      <div className="card" style={{ marginTop: 26 }}>
        <div className="card-title">Model valuation</div>
        <div className="rec-empty">
          This listing hasn’t been valued by the model yet.
        </div>
      </div>
    );
  }

  const appraisal: Appraisal = {
    estimate: listing.predictedValue,
    low: listing.predictedLow,
    high: listing.predictedHigh,
    known_model: true,
  };
  const verdict = evaluateDeal(appraisal, listing.askingPrice, 'buyer');
  const { cls, title, sub, delta, fairPct, askPct, guide } = verdict;

  return (
    <div className="verdict show" style={{ marginTop: 26 }}>
      <div className={'verdict-banner ' + cls}>
        <div>
          <div className="vtitle">{title}</div>
          <div className="vsub">{sub}</div>
          {badge && (
            <span className={`deal-badge ${badge.cls}`} style={{ marginTop: 12 }}>
              {badge.label}
            </span>
          )}
        </div>
        <div className="vdelta">
          {delta >= 0 ? '+' : '−'}
          {fmtN(Math.abs(delta))}
          <div
            style={{
              fontSize: 11,
              letterSpacing: '.1em',
              opacity: 0.8,
              textTransform: 'uppercase',
            }}
          >
            vs model value
          </div>
        </div>
      </div>

      <div className="deal-scale">
        <div className="deal-scale-bar">
          <div className="deal-mark" style={{ left: `${fairPct}%` }}>
            <span className="cap">model value</span>
          </div>
          <div className="deal-ask" style={{ left: `${askPct}%` }}>
            <span className="pin">
              <span className="pin-top">asking {fmt(listing.askingPrice)}</span>
              <span className="pin-line"></span>
            </span>
          </div>
        </div>
        <div className="deal-scale-legend">
          <span>{fmt(appraisal.low)}</span>
          <span>← under-valued · over-valued →</span>
          <span>{fmt(appraisal.high)}</span>
        </div>
      </div>

      <div className="deal-guide">
        {guide.map((tile) => (
          <div
            className={'guide-tile' + (tile.accent ? ' accent' : '')}
            key={tile.label}
          >
            <div className="gl">{tile.label}</div>
            <div className="gv">{tile.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const REASON_LABEL: Record<PriceHistoryEntry['reason'], string> = {
  created: 'Listed',
  asking_price_change: 'Price change',
  revaluation: 'Re-valued',
};

function PriceHistory({ entries }: { entries: PriceHistoryEntry[] }) {
  if (!entries.length) {
    return (
      <div className="card">
        <div className="card-title">Price history</div>
        <div className="rec-empty">No price changes recorded yet.</div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-title">Price history</div>
      <div className="card-note">How the asking price moved since it was listed.</div>
      <ul className="price-hist">
        {[...entries].reverse().map((h) => {
          const dropped =
            h.oldAskingPrice !== null && h.oldAskingPrice !== h.newAskingPrice;
          return (
            <li key={h.id}>
              <span className="ph-date">
                {new Date(h.changedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="ph-reason">{REASON_LABEL[h.reason]}</span>
              <span className="ph-price">
                {dropped && (
                  <span className="ph-old">{fmt(h.oldAskingPrice as number)} → </span>
                )}
                {fmt(h.newAskingPrice)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SellerContact({
  email,
  phone,
}: {
  email: string;
  phone: string | null;
}) {
  return (
    <div className="card">
      <div className="card-title">Seller contact</div>
      <div className="card-note">Reach out to arrange a viewing.</div>
      <div className="contact-row">
        <span aria-hidden="true">✉</span>
        <a href={`mailto:${email}`}>{email}</a>
      </div>
      {phone && (
        <div className="contact-row">
          <span aria-hidden="true">☎</span>
          <span>{phone}</span>
        </div>
      )}
    </div>
  );
}
