import { useMyListings } from '../../context/MyListingsContext';
import type { Listing, ListingStatus } from '../../lib/marketplace-types';
import { DEAL_BADGE_META } from '../../lib/marketplace-types';
import { fmt } from '../../lib/format';
import SellForm from './SellForm';

const STATUSES: ListingStatus[] = ['draft', 'active', 'sold'];

export default function SellView() {
  const { myListings, startEdit, remove, setStatus } = useMyListings();

  return (
    <>
      <div className="view-head">
        <div className="view-kicker">Workspace · 07</div>
        <div className="view-title">Sell a car</div>
        <div className="view-sub">
          List a car for sale and manage your listings. Tip: from the Garage, press
          “List this car →” on any saved car to prefill this form.
        </div>
      </div>

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
  const title =
    `${listing.year} ${listing.manufacturer} ${listing.model}`.toUpperCase();
  const badge = listing.dealBadge ? DEAL_BADGE_META[listing.dealBadge] : null;

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

      <div className="mylisting-foot">
        <div className="select-wrap mylisting-status">
          <label className="sr-only" htmlFor={`status-${listing.id}`}>
            Status
          </label>
          <select
            id={`status-${listing.id}`}
            value={listing.status}
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
        <button className="linkbtn mylisting-del" onClick={onRemove}>
          delete
        </button>
      </div>
    </article>
  );
}
