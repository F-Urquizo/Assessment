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
      <div className="stripes"></div>
      <div className="page">
        <header>
          <div className="masthead-left">
            <div className="kicker">Used-Car Marketplace · Community Listings</div>
            <h1>
              BLUEBOOK <em>Market</em>
            </h1>
          </div>
          <div className="masthead-right">
            Marketplace · v1
            <br />
            Every car valued by the <strong>model</strong>
          </div>
        </header>
        <MarketplaceView options={options} />
      </div>
    </>
  );
}
