import type { Recommendation } from '../../types';
import { fmtN } from '../../lib/format';

const ICONS: Record<string, string> = { condition: '✦', title: '§', mileage: '⌀' };

export default function RecsList({ recs }: { recs: Recommendation[] }) {
  if (!recs.length) {
    return (
      <div className="rec-empty">
        This car is already configured at the top of its value range — no high-ROI
        improvements found.
      </div>
    );
  }

  return (
    <>
      {recs.map((r, i) => (
        <div className="rec" key={i}>
          <div className="rec-ico">{ICONS[r.kind] || '＋'}</div>
          <div className="rec-body">
            <div className="rec-label">{r.label}</div>
            <div className="rec-detail">{r.detail}</div>
          </div>
          <div className="rec-delta">+{fmtN(r.delta)}</div>
        </div>
      ))}
    </>
  );
}
