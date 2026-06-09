import { fmtK, fmtN } from '../lib/format';

export interface ChartPoint {
  x: number;
  y: number;
  xlabel?: string;
}

interface LineChartProps {
  points: ChartPoint[];
  nowIndex?: number;
  valueFmt?: (n: number) => string;
}

const W = 560;
const H = 240;
const P = { t: 24, r: 24, b: 38, l: 30 };

export default function LineChart({ points, nowIndex, valueFmt = fmtN }: LineChartProps) {
  if (points.length === 0) return <div className="chart-wrap" />;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const ymin = Math.min(...ys) * 0.92;
  const ymax = Math.max(...ys) * 1.05;
  const X = (x: number) => P.l + ((x - xmin) / (xmax - xmin || 1)) * (W - P.l - P.r);
  const Y = (y: number) => H - P.b - ((y - ymin) / (ymax - ymin || 1)) * (H - P.t - P.b);

  const line = points
    .map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1))
    .join(' ');
  const area =
    `M${X(points[0].x).toFixed(1)} ${(H - P.b).toFixed(1)} ` +
    points.map((p) => 'L' + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ') +
    ` L${X(points[points.length - 1].x).toFixed(1)} ${H - P.b} Z`;

  const gridlines = Array.from({ length: 4 }, (_, g) => {
    const yy = P.t + (g * (H - P.t - P.b)) / 3;
    const val = ymax - (g / 3) * (ymax - ymin);
    return { yy, label: fmtK(val) };
  });

  return (
    <div className="chart-wrap">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {gridlines.map(({ yy, label }, i) => (
          <g key={i}>
            <line className="gridline" x1={P.l} y1={yy} x2={W - P.r} y2={yy} />
            <text className="lbl" x={P.l - 6} y={yy + 3} textAnchor="end">
              {label}
            </text>
          </g>
        ))}
        <path className="area" d={area} />
        <path className="line" d={line} />
        {points.map((p, i) => {
          const isNow = i === nowIndex;
          const showValue = isNow || i === 0 || i === points.length - 1;
          return (
            <g key={i}>
              <circle
                className={isNow ? 'dot-now' : 'dot'}
                cx={X(p.x)}
                cy={Y(p.y)}
                r={isNow ? 5 : 3}
              />
              {showValue && (
                <text className="vlbl" x={X(p.x)} y={Y(p.y) - 10} textAnchor="middle">
                  {valueFmt(p.y)}
                </text>
              )}
              {p.xlabel && (
                <text className="lbl" x={X(p.x)} y={H - P.b + 16} textAnchor="middle">
                  {p.xlabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
