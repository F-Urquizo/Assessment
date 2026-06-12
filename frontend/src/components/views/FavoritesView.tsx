import { useNavigate } from 'react-router-dom';
import { useFavorites } from '../../context/FavoritesContext';
import ListingCard from './ListingCard';

export default function FavoritesView() {
  const { favorites } = useFavorites();
  const navigate = useNavigate();
  // Route to the shared listing page so a favourite opens a shareable,
  // Back-correct URL — same as the marketplace.
  const openListing = (id: string) => navigate(`/listings/${id}`);

  return (
    <>
      <div className="view-head">
        <div className="view-kicker">Favorites · 01</div>
        <div className="view-title">
          Saved cars{favorites.length ? ` · ${favorites.length}` : ''}
        </div>
        <div className="view-sub">
          Listings you’ve hearted. Open one to see the full valuation breakdown.
        </div>
      </div>

      {favorites.length ? (
        <div className="listing-grid">
          {favorites.map((listing) => (
            <ListingCard key={listing.id} listing={listing} onOpen={openListing} />
          ))}
        </div>
      ) : (
        <div className="rec-empty" style={{ marginTop: 28 }}>
          You haven’t saved any cars yet. Tap ♡ on a listing to save it here.
        </div>
      )}
    </>
  );
}
