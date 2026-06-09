import { useLayoutEffect, useRef } from 'react';

const DIGITS = '0123456789';
const IDLE_CELLS = 5;

export default function Odometer({ value }: { value: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const count = value === null ? IDLE_CELLS : String(Math.round(value)).length;

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || value === null) return;
    const cellH = root.querySelector<HTMLElement>('.odo-cell:not(.sym)')?.offsetHeight ?? 0;
    const str = String(Math.round(value));
    root.querySelectorAll<HTMLElement>('.odo-strip').forEach((strip, i) => {
      const digit = parseInt(str[i], 10);
      strip.style.transform = 'translateY(0)';
      void strip.offsetHeight;
      strip.style.transitionDelay = `${i * 0.1}s`;
      strip.style.transform = `translateY(-${digit * cellH}px)`;
    });
  }, [value, count]);

  return (
    <div className="odometer" ref={ref}>
      <div className="odo-cell sym">$</div>
      {Array.from({ length: count }, (_, i) => (
        <div className="odo-cell" key={i}>
          <div className="odo-strip">
            {DIGITS.split('').map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
