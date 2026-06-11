import FavoritesView from './views/FavoritesView';

/** Favorites root — the user's saved cars. Parallels Marketplace.tsx; owns its
 *  own page shell so App can switch to it. Reads favourites from context. */
export default function Favorites() {
  return (
    <>
      <div className="stripes"></div>
      <main className="page">
        <header>
          <div className="masthead-kicker">Your saved cars · Favorites</div>
          <div className="masthead-row">
            <h1>
              BLUEBOOK <em>Saved</em>
            </h1>
            <div className="masthead-right">
              Cars you’ve <strong>hearted</strong>
            </div>
          </div>
        </header>
        <FavoritesView />
      </main>
    </>
  );
}
