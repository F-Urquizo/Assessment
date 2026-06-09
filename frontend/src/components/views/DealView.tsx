import { useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { useToast } from '../../context/ToastContext';
import { evaluateDeal, type DealMode, type DealVerdict } from '../../lib/deal';
import { fmt, fmtN } from '../../lib/format';
import SubjectStrip from '../SubjectStrip';

interface CheckedDeal {
  ask: number;
  verdict: DealVerdict;
}

export default function DealView() {
  const { analysis, payload } = useStudio();
  const { toast } = useToast();
  const [mode, setMode] = useState<DealMode>('buyer');
  const [ask, setAsk] = useState('');
  const [result, setResult] = useState<CheckedDeal | null>(null);

  if (!analysis || !payload) return null;
  const appraisal = analysis.appraisal;

  const evaluate = (value: string, m: DealMode): CheckedDeal | null => {
    const n = Number(value);
    if (!n) return null;
    return { ask: n, verdict: evaluateDeal(appraisal, n, m) };
  };

  const check = () => {
    const next = evaluate(ask, mode);
    if (!next) {
      toast('Enter a price first');
      return;
    }
    setResult(next);
  };

  const switchMode = (m: DealMode) => {
    setMode(m);
    if (ask) setResult(evaluate(ask, m));
  };

  return (
    <>
      <div className="view-head">
        <div className="view-kicker">Report · 04</div>
        <div className="view-title">Is it a good deal?</div>
        <div className="view-sub">
          Drop in an asking price and get a verdict against fair value, plus the offer and
          walk-away numbers to negotiate with.
        </div>
        <SubjectStrip payload={payload} appraisal={appraisal} />
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="deal-toggle">
          <button className={mode === 'buyer' ? 'active' : ''} onClick={() => switchMode('buyer')}>
            I’m buying
          </button>
          <button className={mode === 'seller' ? 'active' : ''} onClick={() => switchMode('seller')}>
            I’m selling
          </button>
        </div>

        <div className="deal-input-row">
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: 'var(--green)',
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              {mode === 'buyer' ? 'Asking price' : 'Your list price (optional)'}
            </div>
            <span className="pfx">$</span>
            <input
              className="big-input"
              type="number"
              placeholder="0"
              inputMode="numeric"
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') check();
              }}
            />
          </div>
          <button className="appraise" style={{ padding: '15px 30px' }} onClick={check}>
            Check →
          </button>
        </div>

        {result && <Verdict ask={result.ask} verdict={result.verdict} appraisal={appraisal} />}
      </div>
    </>
  );
}

function Verdict({
  ask,
  verdict,
  appraisal,
}: {
  ask: number;
  verdict: DealVerdict;
  appraisal: { low: number; high: number };
}) {
  const { cls, title, sub, delta, fairPct, askPct, guide } = verdict;
  return (
    <div className="verdict show">
      <div className={'verdict-banner ' + cls}>
        <div>
          <div className="vtitle">{title}</div>
          <div className="vsub">{sub}</div>
        </div>
        <div className="vdelta">
          {delta >= 0 ? '+' : '−'}
          {fmtN(Math.abs(delta))}
          <div
            style={{
              fontSize: 11,
              letterSpacing: '.1em',
              opacity: 0.8,
              textTransform: 'uppercase',
            }}
          >
            vs fair value
          </div>
        </div>
      </div>

      <div className="deal-scale">
        <div className="deal-scale-bar">
          <div className="deal-mark" style={{ left: `${fairPct}%` }}>
            <span className="cap">fair value</span>
          </div>
          <div className="deal-ask" style={{ left: `${askPct}%` }}>
            <span className="pin">
              <span className="pin-top">asking {fmt(ask)}</span>
              <span className="pin-line"></span>
            </span>
          </div>
        </div>
        <div className="deal-scale-legend">
          <span>{fmt(appraisal.low)}</span>
          <span>← better for buyer · better for seller →</span>
          <span>{fmt(appraisal.high)}</span>
        </div>
      </div>

      <div className="deal-guide">
        {guide.map((tile) => (
          <div className={'guide-tile' + (tile.accent ? ' accent' : '')} key={tile.label}>
            <div className="gl">{tile.label}</div>
            <div className="gv">{tile.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
