import type { Options } from '../types';
import MarketplaceView from './views/MarketplaceView';

/**
 * Marketplace root — the public catalogue of community car listings. Parallels
 * Studio.tsx: owns its own page shell so App can switch between the two. Stays
 * independent of StudioContext (no vehicle appraisal in scope here).
 */
export default function Marketplace({ options }: { options: Options }) {
  return (
    <>
      <div className="stripes" aria-hidden="true"></div>
      <main className="page">
        <header>
          <div className="masthead-kicker">Used-Car Marketplace · Community Listings</div>
          <div className="masthead-row">
            <h1>
              BLUEBOOK <em>Market</em>
            </h1>
            <div className="masthead-right">
              Every car valued by <strong>Bluebook</strong>
            </div>
          </div>
        </header>
        <MarketplaceView options={options} />
      </main>
    </>
  );
}
