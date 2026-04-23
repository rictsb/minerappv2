interface ConfidenceProps {
  /** 0 = not set, 1 = low/stale, 2 = medium/partial, 3 = high/current. */
  value: 0 | 1 | 2 | 3;
  onClick?: () => void;
  withLabel?: boolean;
}

const map = {
  0: { color: 'var(--ink-4)', label: 'Not set' },
  1: { color: 'var(--neg)', label: 'Low' },
  2: { color: 'var(--warn)', label: 'Medium' },
  3: { color: 'var(--pos)', label: 'High' },
} as const;

/**
 * Dot indicator for confidence / freshness. Optional trailing label.
 * Replaces legacy `.confidence-high` / `.confidence-low` classes.
 */
export default function Confidence({ value, onClick, withLabel = false }: ConfidenceProps) {
  const cfg = map[value];
  const dot = (
    <span
      className="inline-block w-[10px] h-[10px] rounded-full"
      style={{ background: cfg.color, opacity: value === 0 ? 0.35 : 1 }}
    />
  );

  if (withLabel) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={cfg.label}
        className="inline-flex items-center gap-[6px] text-[11px] text-ink-2 hover:text-ink-1"
      >
        {dot}
        {cfg.label}
      </button>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={cfg.label}>
        {dot}
      </button>
    );
  }

  return <span title={cfg.label}>{dot}</span>;
}
