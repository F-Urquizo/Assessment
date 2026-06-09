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
  if (appraising) status = 'trees voting…';
  else if (showResult && appraisal)
    status = appraisal.known_model ? 'estimate ready' : 'ready · model unseen, generic group';

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
          forest
          <br />
          certified
        </div>
        <div className="plate-head">
          <span>Appraised value</span>
          <span className="live">{status}</span>
        </div>

        <Odometer value={showResult && appraisal ? appraisal.estimate : null} />
        <div className="plate-caption">United States Dollars</div>

        <div className={'range' + (showResult ? ' show' : '')}>
          <div className="range-label">
            <span>Pessimistic</span>
            <span>tree consensus · 10–90 pct</span>
            <span>Optimistic</span>
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
          Estimate by a 400-tree random forest trained on 20,000 cleaned Craigslist
          listings (April 2021). Asking prices, not sale prices.
        </div>
      </div>
    </aside>
  );
}
