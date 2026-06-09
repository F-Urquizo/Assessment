import type { Appraisal, Payload } from '../types';
import { fmt, fmtN } from '../lib/format';
import { vehLabel } from '../lib/labels';

export default function SubjectStrip({
  payload,
  appraisal,
}: {
  payload: Payload;
  appraisal: Appraisal;
}) {
  return (
    <div className="subject-strip">
      <span className="veh">{vehLabel(payload)}</span>
      <span className="muted">
        {fmtN(Number(payload.odometer))} mi · {payload.condition} · {payload.title_status}
      </span>
      <span className="est">{fmt(appraisal.estimate)}</span>
      <span className="muted">
        band {fmt(appraisal.low)}–{fmt(appraisal.high)}
      </span>
    </div>
  );
}
