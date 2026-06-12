import { useStudio } from '../../context/StudioContext';
import { fmt, fmtN } from '../../lib/format';
import SubjectStrip from '../SubjectStrip';

export default function MarketView() {
  const { analysis, payload } = useStudio();
  if (!analysis || !payload) return null;

  const m = analysis.market;
  const estimate = analysis.appraisal.estimate;
  const { segment_low: low, segment_high: high, segment_median: med } = m;

  const lo = Math.min(low, estimate) * 0.96;
  const hi = Math.max(high, estimate) * 1.04;
  const pct = (x: number) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo || 1)) * 100));

  const popular = m.popular_models ?? [];

  return (
    <>
      <div className="view-head">
        <div className="view-kicker">Report · 05</div>
        <div className="view-title">Market context</div>
        <div className="view-sub">
          Where this vehicle sits inside its real comparable set — drawn from 20,000
          real used-car listings.
        </div>
        <SubjectStrip payload={payload} appraisal={analysis.appraisal} />
      </div>

      <div className="grid-3" style={{ marginTop: 30 }}>
        <div className="card tight">
          <div className="stat">
            <div className="v">{fmtN(m.comparable_count)}</div>
            <div className="l">Comparable listings</div>
          </div>
        </div>
        <div className="card tight">
          <div className="stat">
            <div className="v">{fmt(m.segment_median)}</div>
            <div className="l">{m.segment_label.toUpperCase()} median</div>
          </div>
        </div>
        <div className="card tight">
          <div className="stat">
            <div className="v amber">{m.percentile}%</div>
            <div className="l">Priced higher than</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 26 }}>
        <div className="card-title">Position among {m.segment_label} listings</div>
        <div className="card-note">
          This estimate of <b>{fmt(estimate)}</b> is{' '}
          <b>
            {fmt(Math.abs(m.vs_median))} {m.vs_median >= 0 ? 'above' : 'below'}
          </b>{' '}
          the segment median, pricing higher than about <b>{m.percentile}%</b> of comparable
          listings ({fmtN(m.comparable_count)} in the reference set).
        </div>
        <div className="posbar">
          <div
            className="fillrange"
            style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }}
          ></div>
          <div className="medline" style={{ left: `${pct(med)}%` }}>
            <span className="cap">median {fmt(med)}</span>
          </div>
          <div className="you" style={{ left: `${pct(estimate)}%` }}>
            <span className="cap">this car {fmt(estimate)}</span>
          </div>
        </div>
        <div className="deal-scale-legend" style={{ marginTop: 10 }}>
          <span>{fmt(low)}</span>
          <span>price distribution</span>
          <span>{fmt(high)}</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 26 }}>
        <div className="card-title">Most-listed comparables</div>
        <div className="card-note">
          The models that show up most in this manufacturer’s listings — useful shopping
          alternatives.
        </div>
        <div className="poplist">
          {popular.length ? (
            popular.map((p) => (
              <span className="poppill" key={p.model}>
                {p.model}
                <b>{fmtN(p.count)}</b>
              </span>
            ))
          ) : (
            <span className="rec-empty">
              No comparable model breakdown available for this manufacturer.
            </span>
          )}
        </div>
      </div>
    </>
  );
}
