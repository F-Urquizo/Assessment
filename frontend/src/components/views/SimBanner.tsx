import { useStudio } from '../../context/StudioContext';
import { fmtN } from '../../lib/format';
import type { FormField } from '../../types';

const SPEC_FIELDS: FormField[] = [
  'manufacturer', 'model', 'year', 'odometer', 'cylinders', 'condition', 'fuel',
  'title_status', 'transmission', 'drive', 'type', 'paint_color', 'state',
];

export default function SimBanner() {
  const { payload, baseline, baseEstimate, analysis, resetSim } = useStudio();
  if (!payload || !baseline || !analysis) return null;

  const changed = SPEC_FIELDS.filter(
    (k) => String(payload[k]) !== String(baseline[k]),
  );
  if (!changed.length) return null;

  let deltaTxt = '';
  if (baseEstimate != null) {
    const diff = analysis.appraisal.estimate - baseEstimate;
    deltaTxt = (diff >= 0 ? '+' : '−') + fmtN(Math.abs(diff));
  }

  return (
    <div className="sim-banner show">
      <span className="dot"></span>
      <span>
        Simulating <b>{changed.length}</b> change{changed.length > 1 ? 's' : ''} from the
        actual car · value <b>{deltaTxt}</b>
      </span>
      <button className="linkbtn" style={{ color: 'var(--amber-bright)' }} onClick={resetSim}>
        ↺ reset to actual car
      </button>
    </div>
  );
}
