import { useState } from 'react';
import { useFavorites } from '../../context/FavoritesContext';
import ListingCard from './ListingCard';
import ListingDetail from './ListingDetail';

export default function FavoritesView() {
  const { favorites } = useFavorites();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return <ListingDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

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
            <ListingCard key={listing.id} listing={listing} onOpen={setSelectedId} />
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
