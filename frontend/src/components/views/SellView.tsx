import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGarage } from '../../context/GarageContext';
import { useMyListings } from '../../context/MyListingsContext';
import { useToast } from '../../context/ToastContext';
import type { GarageCard as GarageCardData } from '../../types';
import type { Listing, ListingStatus } from '../../lib/marketplace-types';
import { DEAL_BADGE_META, STATUS_COLOR } from '../../lib/marketplace-types';
import { fmt } from '../../lib/format';
import SellForm from './SellForm';

const STATUSES: ListingStatus[] = ['draft', 'active', 'sold'];

function SellHead() {
  return (
    <div className="view-head">
      <div className="view-kicker">Workspace · 07</div>
      <div className="view-title">Sell a car</div>
      <div className="view-sub">
        List a car for sale and manage your listings. Saved an appraisal? Start
        from your garage below to prefill the spec sheet in one click.
      </div>
    </div>
  );
}

/** Pick a saved appraisal to prefill the sell form — the same bridge as the
 *  Garage's "List this car →", surfaced right where you list. */
function GaragePicker({
  cards,
  onPick,
}: {
  cards: GarageCardData[];
  onPick: (card: GarageCardData) => void;
}) {
  return (
    <div className="sell-garage">
      <div className="form-title">Start from your garage</div>
      <div className="form-note">
        Pick a saved appraisal to prefill the form below — then set a price and
        publish.
      </div>
      <div className="sell-garage-row">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className="sell-garage-card"
            onClick={() => onPick(card)}
          >
            <span className="sgc-veh">{card.label}</span>
            <span className="sgc-meta">{card.meta}</span>
            <span className="sgc-est">{fmt(card.estimate)}</span>
            <span className="sgc-cta">Use this car →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SellView() {
  const { isAuthenticated, loading } = useAuth();
  const { cards } = useGarage();
  const { myListings, startEdit, remove, setStatus, startFromGarage } =
    useMyListings();
  const { toast } = useToast();

  const pickGarageCar = (card: GarageCardData) => {
    startFromGarage(card);
    toast('Loaded from garage — set a price and publish');
    document
      .getElementById('sell-manufacturer')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Silent refresh still in flight — render nothing rather than flashing the
  // logged-out prompt at a user whose session is about to be restored.
  if (loading) return <SellHead />;

  // Listing is an account action — the backend rejects an unauthenticated POST
  // with 401. Gate the form here so logged-out users see why, not a dead form
  // that silently fails on submit.
  if (!isAuthenticated) {
    return (
      <>
        <SellHead />
        <div className="garage-empty" style={{ marginTop: 28 }}>
          <div className="big">Log in to list a car</div>
          Selling needs an account so buyers can reach you and your listings stay
          tied to you.
          <br />
          <NavLink to="/login" className="appraise" style={{ marginTop: 18, display: 'inline-block' }}>
            Log in →
          </NavLink>
        </div>
      </>
    );
  }

  return (
    <>
      <SellHead />

      {cards.length > 0 && <GaragePicker cards={cards} onPick={pickGarageCar} />}

      <SellForm />

      <div className="form-title" style={{ marginTop: 48 }}>
        My listings
      </div>
      <div className="form-note">
        {myListings.length
          ? `${myListings.length} listing${myListings.length === 1 ? '' : 's'}.`
          : 'Nothing listed yet — publish one above.'}
      </div>

      {myListings.length > 0 && (
        <div className="listing-grid" style={{ marginTop: 18 }}>
          {myListings.map((l) => (
            <MyListingCard
              key={l.id}
              listing={l}
              onEdit={() => startEdit(l)}
              onRemove={() => remove(l.id)}
              onStatus={(s) => setStatus(l.id, s)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function MyListingCard({
  listing,
  onEdit,
  onRemove,
  onStatus,
}: {
  listing: Listing;
  onEdit: () => void;
  onRemove: () => void;
  onStatus: (status: ListingStatus) => void;
}) {
  const { toast } = useToast();
  // Two-step delete: the first click arms an inline confirm rather than deleting
  // immediately, so an accidental click can't wipe a listing with no undo.
  const [confirming, setConfirming] = useState(false);
  const title =
    `${listing.year} ${listing.manufacturer} ${listing.model}`.toUpperCase();
  const badge = listing.dealBadge ? DEAL_BADGE_META[listing.dealBadge] : null;

  const confirmDelete = () => {
    onRemove();
    setConfirming(false);
    toast('Listing deleted');
  };

  return (
    <article className="listing-card">
      <div className="listing-card-head">
        <h3 className="listing-title">{title}</h3>
        {badge && (
          <span className={`deal-badge ${badge.cls}`}>
            <span className="badge-sym" aria-hidden="true">
              {badge.symbol}
            </span>
            {badge.label}
          </span>
        )}
      </div>
      <div className="listing-meta">{fmt(listing.askingPrice)} · asking</div>

      {confirming ? (
        <div className="mylisting-foot mylisting-confirm" role="alertdialog" aria-label="Confirm delete">
          <span className="mylisting-confirm-q">Delete this listing?</span>
          <button className="linkbtn mylisting-del" onClick={confirmDelete}>
            yes, delete
          </button>
          <button className="linkbtn" onClick={() => setConfirming(false)} autoFocus>
            cancel
          </button>
        </div>
      ) : (
        <div className="mylisting-foot">
          <div className="select-wrap mylisting-status">
            <label className="sr-only" htmlFor={`status-${listing.id}`}>
              Status
            </label>
            <select
              id={`status-${listing.id}`}
              value={listing.status}
              style={{ color: STATUS_COLOR[listing.status], fontWeight: 700 }}
              onChange={(e) => onStatus(e.target.value as ListingStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button className="linkbtn" onClick={onEdit}>
            edit
          </button>
          <button className="linkbtn mylisting-del" onClick={() => setConfirming(true)}>
            delete
          </button>
        </div>
      )}
    </article>
  );
}
