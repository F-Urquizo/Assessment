import type { Driver } from '../../types';
import { fmt, fmtN } from '../../lib/format';
import { useStudio } from '../../context/StudioContext';

function optionLabel(driverKey: string, value: string | number): string {
  if (driverKey === 'odometer') return fmtN(Number(value)) + ' mi';
  if (driverKey === 'cylinders') return value + ' cyl';
  return String(value);
}

function deltaLabel(delta: number, isCurrent: boolean): string {
  if (isCurrent) return 'current';
  if (delta > 0) return '+' + fmtN(delta);
  if (delta < 0) return '−' + fmtN(-delta);
  return '±0';
}

export default function DriverBar({ driver, scale }: { driver: Driver; scale: number }) {
  const { applyWhatIf } = useStudio();

  const deltas = driver.options.map((o) => o.delta);
  const negW = (Math.min(0, ...deltas) / scale) * 50 * -1;
  const posW = (Math.max(0, ...deltas) / scale) * 50;

  return (
    <div className="driver">
      <div className="driver-head">
        <div className="driver-name">
          {driver.label}
          <span className="cur">now: {driver.current}</span>
        </div>
        <div className="driver-swing">swing {fmt(driver.swing)}</div>
      </div>
      <div className="tor-track">
        <div className="tor-center"></div>
        <div className="tor-bar neg" style={{ right: '50%', width: `${negW}%` }}></div>
        <div className="tor-bar pos" style={{ left: '50%', width: `${posW}%` }}></div>
      </div>
      <div className="chips">
        {driver.options.map((o) => {
          const dcls = o.delta > 0 ? 'd up' : o.delta < 0 ? 'd dn' : 'd';
          return (
            <button
              key={String(o.value)}
              className={o.is_current ? 'chip cur' : 'chip'}
              disabled={o.is_current}
              onClick={() => applyWhatIf(driver.key, String(o.value))}
            >
              {optionLabel(driver.key, o.value)}
              <span className={dcls}>{deltaLabel(o.delta, o.is_current)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
