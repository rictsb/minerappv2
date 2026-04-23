import { fmt } from '../lib/format';

interface DeltaPillProps {
  /** Value in percentage points (e.g. 2.4 = +2.4%). */
  value: number | null | undefined;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  precision?: number;
}

/**
 * Signed percent delta, colored pos/neg, with a tiny up/down glyph.
 * Use inside tables, cards, KPIs.
 */
export default function DeltaPill({
  value,
  showIcon = true,
  size = 'sm',
  precision = 2,
}: DeltaPillProps) {
  if (value == null) return <span className="text-ink-4">—</span>;

  const isPos = value >= 0;
  const fs = size === 'lg' ? 'text-sm' : size === 'md' ? 'text-[13px]' : 'text-[12px]';
  const colorStyle = { color: isPos ? 'var(--pos)' : 'var(--neg)' };
  const iconPath = isPos ? 'm3 17 6-6 4 4 8-8M14 7h7v7' : 'm3 7 6 6 4-4 8 8M14 17h7v-7';

  return (
    <span
      className={`num inline-flex items-center gap-[2px] font-medium ${fs}`}
      style={colorStyle}
    >
      {showIcon && (
        <svg
          width={11}
          height={11}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={iconPath} />
        </svg>
      )}
      {isPos ? '+' : '−'}
      {fmt(Math.abs(value), precision)}%
    </span>
  );
}
