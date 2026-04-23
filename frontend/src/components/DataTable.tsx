import { ReactNode, ThHTMLAttributes } from 'react';

interface DataTableProps {
  children: ReactNode;
  compact?: boolean;
  minWidth?: number;
  className?: string;
}

/**
 * Thin wrapper that applies the `.tbl` styles (see terminal.css).
 * Use normal <thead> / <tbody> / <tr> / <td> inside.
 *
 * Use `<th className="num-col">` on numeric columns to get tabular-nums + right-align.
 */
export default function DataTable({
  children,
  compact = false,
  minWidth,
  className = '',
}: DataTableProps) {
  return (
    <div className="overflow-auto">
      <table
        className={`tbl ${compact ? 'compact' : ''} ${className}`}
        style={minWidth ? { minWidth } : undefined}
      >
        {children}
      </table>
    </div>
  );
}

/** Convenience for numeric column headers. */
export function NumTh(props: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th {...props} className={`num-col ${props.className ?? ''}`} />;
}
