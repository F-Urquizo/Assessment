import { useNavigate, useParams } from 'react-router-dom';
import ListingDetail from '../components/views/ListingDetail';

/**
 * Route wrapper for a single listing (`/listings/:id`). Making the detail its
 * own route — rather than inline state inside the marketplace — is what makes a
 * listing shareable, bookmarkable and Back-button-correct. "Back" prefers the
 * browser history (returning to the marketplace with its filters/page intact),
 * falling back to the lot for someone who deep-linked straight here.
 */
export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const onBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <>
      <div className="stripes" aria-hidden="true"></div>
      <main className="page">
        {id ? (
          <ListingDetail id={id} onBack={onBack} />
        ) : (
          <div className="rec-empty">⚠ Listing not found</div>
        )}
      </main>
    </>
  );
}
