import { useStudio } from '../../context/StudioContext';
import SimBanner from './SimBanner';
import DriverBar from './DriverBar';
import RecsList from './RecsList';
import { fmt, fmtN } from '../../lib/format';
import { vehLabel } from '../../lib/labels';

export default function DriversView() {
  const { analysis, payload, baseEstimate } = useStudio();
  if (!analysis || !payload) return null;

  const maxSwing = Math.max(...analysis.drivers.map((d) => d.swing), 1);
  const { estimate, low, high } = analysis.appraisal;
  // Live delta vs the actual car, so each simulated chip click reads as a price move.
  const diff = baseEstimate != null ? estimate - baseEstimate : 0;

  return (
    <>
      <div className="view-head">
        <div className="view-kicker">Report · 02</div>
        <div className="view-title">What moves this price</div>
        <div className="view-sub">
          Every factor below was re-checked on its own while holding the rest of the
          car fixed. The bar shows how far each one swings the value. Click any chip
          to simulate a change — the price below updates live.
        </div>
      </div>

      {/* Sticky so the (live) price stays on screen while you click chips and
          scroll the sensitivity list — watching the price move is the whole point. */}
      <div className="drivers-price-bar">
        <div className="dpb-main">
          <span className="dpb-veh">
            {vehLabel(payload)} · {fmtN(Number(payload.odometer))} mi · {payload.condition}
          </span>
          <span className="dpb-row">
            <span className="dpb-est">{fmt(estimate)}</span>
            {diff !== 0 && (
              <span className={'dpb-delta ' + (diff > 0 ? 'up' : 'down')}>
                {diff > 0 ? '+' : '−'}
                {fmtN(Math.abs(diff))} vs actual
              </span>
            )}
          </span>
        </div>
        <span className="dpb-band">
          band {fmt(low)}–{fmt(high)}
        </span>
      </div>

      <SimBanner />

      <div className="grid-2" style={{ marginTop: 30, alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">Sensitivity ranking</div>
          <div className="card-note">Sorted by total price swing. ◆ marks the current spec.</div>
          {analysis.drivers.map((d) => (
            <DriverBar key={d.key} driver={d} scale={maxSwing} />
          ))}
        </div>
        <div className="card">
          <div className="card-title">If you’re selling — highest-ROI moves</div>
          <div className="card-note">
            Actionable, correctly-directioned levers and what each one is worth on this
            exact vehicle.
          </div>
          <RecsList recs={analysis.recommendations} />
        </div>
      </div>
    </>
  );
}
