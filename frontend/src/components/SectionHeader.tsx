import { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  right?: ReactNode;
}

/**
 * Consistent header for page sections — eyebrow on top, title, optional subtitle,
 * and a right-aligned slot for actions (buttons, filters, tabs).
 */
export default function SectionHeader({
  title,
  eyebrow,
  subtitle,
  right,
}: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-[6px]">{eyebrow}</div>}
        <h2 className="text-[20px] leading-tight font-medium text-ink-1 tracking-[-0.01em]">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[12px] text-ink-3 mt-[4px] max-w-prose">{subtitle}</p>
        )}
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </div>
  );
}
