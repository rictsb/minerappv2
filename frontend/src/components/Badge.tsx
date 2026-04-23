import { ReactNode } from 'react';

type BadgeColor =
  | 'slate'
  | 'brand'
  | 'hpc'
  | 'pipeline'
  | 'mining'
  | 'pos'
  | 'neg'
  | 'warn'
  | 'info';

interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
  variant?: 'soft' | 'outline';
  dot?: boolean;
}

const palettes: Record<BadgeColor, { bg: string; border: string; ink: string }> = {
  slate: { bg: '#f1efe9', border: '#e5e2d8', ink: '#4a4842' },
  brand: { bg: 'var(--btc-soft)', border: 'var(--btc-border)', ink: 'var(--btc-ink)' },
  hpc: { bg: 'var(--cat-hpc-soft)', border: 'var(--cat-hpc-border)', ink: 'var(--cat-hpc)' },
  pipeline: {
    bg: 'var(--cat-pipeline-soft)',
    border: 'var(--cat-pipeline-border)',
    ink: 'var(--cat-pipeline)',
  },
  mining: {
    bg: 'var(--cat-mining-soft)',
    border: 'var(--cat-mining-border)',
    ink: 'var(--cat-mining)',
  },
  pos: { bg: 'var(--pos-soft)', border: '#c3e5d5', ink: 'var(--pos)' },
  neg: { bg: 'var(--neg-soft)', border: '#efc5ce', ink: 'var(--neg)' },
  warn: { bg: 'var(--warn-soft)', border: '#e9dca6', ink: 'var(--warn)' },
  info: { bg: 'var(--info-soft)', border: '#c3cef0', ink: 'var(--info)' },
};

/**
 * Uppercase pill used for phase, category, freshness.
 * Replaces the legacy `.badge-operational` / `.badge-construction` / etc. classes.
 *
 * Migration:
 *   .badge-operational  → <Badge color="pos">Op</Badge>
 *   .badge-construction → <Badge color="warn">Con</Badge>
 *   .badge-pipeline     → <Badge color="info">Dev</Badge>
 *   .badge-contracted   → <Badge color="hpc">HPC</Badge>
 */
export default function Badge({
  children,
  color = 'slate',
  variant = 'soft',
  dot = false,
}: BadgeProps) {
  const p = palettes[color];
  const style =
    variant === 'outline'
      ? { background: 'transparent', border: `1px solid ${p.border}`, color: p.ink }
      : { background: p.bg, border: `1px solid ${p.border}`, color: p.ink };

  return (
    <span
      className="inline-flex items-center gap-1 px-[7px] py-[2px] rounded-full text-[10px] font-medium uppercase tracking-wider leading-[1.5]"
      style={style}
    >
      {dot && (
        <span
          className="inline-block w-[5px] h-[5px] rounded-full"
          style={{ background: p.ink }}
        />
      )}
      {children}
    </span>
  );
}
