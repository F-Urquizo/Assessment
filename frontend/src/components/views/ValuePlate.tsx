import { useStudio } from '../../context/StudioContext';
import { useGarage } from '../../context/GarageContext';
import { useToast } from '../../context/ToastContext';
import { fmt } from '../../lib/format';
import Odometer from '../Odometer';

export default function ValuePlate() {
  const { analysis, payload, baseline, appraising, appraised, setActiveTab } = useStudio();
  const garage = useGarage();
  const { toast } = useToast();

  const showResult = appraised && analysis !== null && !appraising;
  const appraisal = analysis?.appraisal ?? null;

  let status = 'awaiting specs';
  if (appraising) status = 'estimating…';
  else if (showResult && appraisal)
    status = appraisal.known_model
      ? 'estimate ready'
      : 'estimate ready · based on similar cars';

  const save = () => {
    if (!analysis || !payload) {
      toast('Run a report first');
      return;
    }
    garage.add(baseline ?? payload, analysis.appraisal);
    toast('Saved to garage');
  };

  return (
    <aside className="plate-wrap">
      <div className="plate">
        <div className={'stamp' + (showResult ? ' show' : '')}>
          Bluebook
          <br />
          certified
        </div>
        <div className="plate-head">
          <span>Appraised value</span>
          <span className="live">{status}</span>
        </div>

        <Odometer value={showResult && appraisal ? appraisal.estimate : null} />
        <div className="plate-caption">United States Dollars</div>

        {!showResult && !appraising && (
          <div className="plate-empty">
            <p className="plate-empty-lead">
              Fill in the spec sheet to get an instant estimate.
            </p>
            <ul className="plate-empty-list">
              <li>Estimated value &amp; likely range</li>
              <li>Depreciation &amp; resale timing</li>
              <li>What moves the price most</li>
              <li>How it compares on the market</li>
            </ul>
          </div>
        )}

        <div className={'range' + (showResult ? ' show' : '')}>
          <div className="range-label">
            <span>Low estimate</span>
            <span>likely range</span>
            <span>High estimate</span>
          </div>
          <div className="range-bar">
            <div className="range-fill"></div>
          </div>
          <div className="range-values">
            <span>{appraisal ? fmt(appraisal.low) : '—'}</span>
            <span>{appraisal ? fmt(appraisal.high) : '—'}</span>
          </div>
        </div>

        <div className="plate-actions" style={{ display: showResult ? 'flex' : 'none' }}>
          <button className="plate-btn primary" onClick={() => setActiveTab('drivers')}>
            Open full report →
          </button>
          <button className="plate-btn" onClick={save}>
            ＋ Save to garage
          </button>
        </div>

        <div className="plate-foot">
          Estimate based on 20,000 real used-car listings. These are asking
          prices, not final sale prices.
        </div>
      </div>
    </aside>
  );
}
