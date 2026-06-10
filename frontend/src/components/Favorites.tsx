import FavoritesView from './views/FavoritesView';

/** Favorites root — the user's saved cars. Parallels Marketplace.tsx; owns its
 *  own page shell so App can switch to it. Reads favourites from context. */
export default function Favorites() {
  return (
    <>
      <div className="stripes"></div>
      <div className="page">
        <header>
          <div className="masthead-left">
            <div className="kicker">Your saved cars · Favorites</div>
            <h1>
              BLUEBOOK <em>Saved</em>
            </h1>
          </div>
          <div className="masthead-right">
            Favorites · v1
            <br />
            Cars you’ve <strong>hearted</strong>
          </div>
        </header>
        <FavoritesView />
      </div>
    </>
  );
}
