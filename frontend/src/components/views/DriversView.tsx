import { useStudio } from '../../context/StudioContext';
import SubjectStrip from '../SubjectStrip';
import SimBanner from './SimBanner';
import DriverBar from './DriverBar';
import RecsList from './RecsList';

export default function DriversView() {
  const { analysis, payload } = useStudio();
  if (!analysis || !payload) return null;

  const maxSwing = Math.max(...analysis.drivers.map((d) => d.swing), 1);

  return (
    <>
      <div className="view-head">
        <div className="view-kicker">Report · 02</div>
        <div className="view-title">What moves this price</div>
        <div className="view-sub">
          Every factor below was re-run through the forest while holding the rest of
          the car fixed. The bar shows how far each one swings the value. Click any chip
          to simulate a change — the whole report updates live.
        </div>
        <SubjectStrip payload={payload} appraisal={analysis.appraisal} />
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
            Actionable, correctly-directioned levers and what the model says each is worth
            on this exact vehicle.
          </div>
          <RecsList recs={analysis.recommendations} />
        </div>
      </div>
    </>
  );
}
