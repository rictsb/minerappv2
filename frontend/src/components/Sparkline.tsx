interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
}

/**
 * Minimal inline sparkline. Renders nothing if `points` is empty.
 * Last-point dot for emphasis. Use `stroke="currentColor"` to inherit.
 */
export default function Sparkline({
  points,
  width = 72,
  height = 22,
  stroke = 'currentColor',
  fill = 'none',
}: SparklineProps) {
  if (!points || points.length === 0) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);

  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const last = points[points.length - 1];
  const lastY = height - ((last - min) / range) * height;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', verticalAlign: 'middle' }}>
      {fill !== 'none' && (
        <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill={fill} opacity={0.14} />
      )}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width} cy={lastY} r={1.8} fill={stroke} />
    </svg>
  );
}
