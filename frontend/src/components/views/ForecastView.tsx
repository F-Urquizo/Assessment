import { useStudio } from '../../context/StudioContext';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';
import { fmtK, fmtN } from '../../lib/format';
import SubjectStrip from '../SubjectStrip';
import LineChart from '../LineChart';

function nearestIndex(curve: { odometer: number }[], odometer: number): number {
  let best = Infinity;
  let idx = 0;
  curve.forEach((m, i) => {
    const d = Math.abs(m.odometer - odometer);
    if (d < best) {
      best = d;
      idx = i;
    }
  });
  return idx;
}

export default function ForecastView() {
  const { analysis, payload, annualMiles, setAnnualMiles, reforecast } = useStudio();
  const debouncedReforecast = useDebouncedCallback(reforecast, 50);
  if (!analysis || !payload) return null;

  const { forecast, market, mileage_curve } = analysis;
  const depr = market.depreciation?.pct_per_year;

  const forecastPoints = forecast.points.map((p, i) => ({
    x: i,
    y: p.value,
    xlabel: '+' + p.year_offset + 'y',
  }));
  const mileagePoints = mileage_curve.map((m) => ({
    x: m.odometer,
    y: m.value,
    xlabel: fmtN(Math.round(m.odometer / 1000)) + 'k',
  }));
  const nowIdx = nearestIndex(mileage_curve, Number(payload.odometer));

  return (
    <>
      <div className="view-head">
        <div className="view-kicker">Report · 03</div>
        <div className="view-title">Depreciation &amp; timing</div>
        <div className="view-sub">
          Projecting this vehicle forward — each year it ages and accrues your expected
          mileage, re-valued at each step. Use it to decide whether to sell now or hold.
        </div>
        <SubjectStrip payload={payload} appraisal={analysis.appraisal} />
      </div>

      <div className="grid-3" style={{ marginTop: 30 }}>
        <div className="card tight">
          <div className="stat">
            <div className="v amber">−{fmtK(forecast.avg_annual_loss)}</div>
            <div className="l">Avg loss / year</div>
          </div>
        </div>
        <div className="card tight">
          <div className="stat">
            <div className="v">{forecast.retained_pct != null ? forecast.retained_pct : '—'}%</div>
            <div className="l">Value kept in 5 yrs</div>
          </div>
        </div>
        <div className="card tight">
          <div className="stat">
            <div className="v">{depr != null ? `${depr}%/yr` : '—'}</div>
            <div className="l">Segment depreciation</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 26 }}>
        <div className="card-title">Projected value</div>
        <div className="card-note">
          Drag to set how many miles you drive per year — the curve re-forecasts instantly.
        </div>
        <div className="slider-row">
          <label>Annual mileage</label>
          <input
            type="range"
            min={0}
            max={30000}
            step={1000}
            value={annualMiles}
            onChange={(e) => {
              setAnnualMiles(Number(e.target.value));
              debouncedReforecast();
            }}
          />
          <span className="slider-val">{fmtN(annualMiles)}</span>
        </div>
        <LineChart points={forecastPoints} nowIndex={0} valueFmt={fmtK} />
      </div>

      <div className="card" style={{ marginTop: 26 }}>
        <div className="card-title">Value vs odometer — this exact car</div>
        <div className="card-note">
          How Bluebook prices this vehicle across a range of mileages. The amber dot is
          where it sits today.
        </div>
        <LineChart points={mileagePoints} nowIndex={nowIdx} valueFmt={fmtK} />
      </div>
    </>
  );
}
