import { fmt } from '../lib/format';

export interface SOTPItem {
  /** Value in $M. Negative values (e.g. project debt) are ignored for bar widths. */
  value: number;
  fill: string;
  label: string;
}

interface SOTPBarProps {
  items: SOTPItem[];
  width?: number;
  height?: number;
}

/**
 * Stacked horizontal bar for sum-of-the-parts breakdowns.
 * Table-cell friendly. Hover each segment for its label + $M value.
 */
export default function SOTPBar({ items, width = 140, height = 8 }: SOTPBarProps) {
  const positives = items.filter((d) => d.value > 0);
  const total = positives.reduce((a, b) => a + b.value, 0);
  if (!total) return <div style={{ width, height }} />;

  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        borderRadius: 3,
        overflow: 'hidden',
        background: 'var(--hairline)',
      }}
    >
      {positives.map((d, i) => (
        <div
          key={i}
          title={`${d.label}: $${fmt(d.value, 0)}M`}
          style={{
            width: `${(d.value / total) * 100}%`,
            background: d.fill,
            height: '100%',
          }}
        />
      ))}
    </div>
  );
}
