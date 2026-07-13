import { HistoryPoint } from '../api/types';

export function Sparkline(props: { points: HistoryPoint[]; height?: number; max?: number }) {
  const height = props.height ?? 36;
  const width = 120;
  const points = props.points;
  if (points.length < 2) {
    return <div style={{ height, fontSize: 12, color: 'var(--hint)' }}>нет данных</div>;
  }
  const max = props.max ?? Math.max(...points.map((p) => p.v), 1);
  const step = width / (points.length - 1);
  const path = points
    .map((p, i) => `${(i * step).toFixed(1)},${(height - (p.v / max) * (height - 4) - 2).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        points={path}
        fill="none"
        stroke="var(--link)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
