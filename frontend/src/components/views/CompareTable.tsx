import type { ReactNode } from 'react';
import type { CompareResult } from '../../types';
import { fmt, fmtN } from '../../lib/format';

interface Row {
  label: string;
  cell: (r: CompareResult) => ReactNode;
}

const ROWS: Row[] = [
  {
    label: 'Estimated value',
    cell: (r) => (
      <>
        <div className="big">{fmt(r.estimate)}</div>
        {r.award_cheapest && <span className="cmp-win">cheapest</span>}
      </>
    ),
  },
  { label: 'Confidence band', cell: (r) => `${fmt(r.low)} – ${fmt(r.high)}` },
  { label: 'Value in 3 yrs', cell: (r) => fmt(r.value_in_3yr) },
  {
    label: 'Holds value (3 yr)',
    cell: (r) => (
      <>
        {r.retained_3yr_pct}%
        {r.award_holds_value && <span className="cmp-win amber"> best</span>}
      </>
    ),
  },
  { label: 'Avg loss / year', cell: (r) => `−${fmt(r.avg_annual_loss)}` },
  { label: 'Segment median', cell: (r) => fmt(r.segment_median) },
  { label: 'Priced higher than', cell: (r) => `${r.percentile}% of comps` },
  {
    label: 'Biggest price lever',
    cell: (r) =>
      r.top_driver ? `${r.top_driver.label} · ${fmt(r.top_driver.swing)} swing` : '—',
  },
  {
    label: 'Top seller move',
    cell: (r) => (r.top_rec ? `${r.top_rec.label} · +${fmtN(r.top_rec.delta)}` : '—'),
  },
];

export default function CompareTable({ results }: { results: CompareResult[] }) {
  return (
    <div style={{ marginTop: 6 }}>
      <table className="cmp-table">
        <thead>
          <tr>
            <th></th>
            {results.map((r, i) => (
              <th key={i}>{r.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label}>
              <th>{row.label}</th>
              {results.map((r, i) => (
                <td key={i}>{row.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
