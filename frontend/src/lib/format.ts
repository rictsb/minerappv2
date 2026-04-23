/**
 * Shared formatters for financial figures.
 * Matches the conventions used throughout the terminal: "—" for null/NaN,
 * Unicode minus sign for negatives, tabular numerals assumed at the CSS layer.
 */

const nf = (n: number, d = 0): string =>
  Number(n).toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

export function fmt(n: number | null | undefined, d = 0): string {
  if (n == null || Number.isNaN(n)) return '—';
  return nf(n, d);
}

/** Millions: `$123M`, always unsigned (use fmtMSigned if you need the sign). */
export function fmtM(n: number | null | undefined, d = 0): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `$${nf(Math.abs(n), d)}M`;
}

/** Millions with explicit sign: `−$12M`. */
export function fmtMSigned(n: number | null | undefined, d = 0): string {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n < 0 ? '−' : '';
  return `${sign}$${nf(Math.abs(n), d)}M`;
}

/** Dollars, default 2dp: `$12.34`. */
export function fmtMoney(n: number | null | undefined, d = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `$${nf(n, d)}`;
}

/** Percent with sign: `+2.4%` / `−1.1%`. */
export function fmtPct(n: number | null | undefined, d = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n >= 0 ? '' : '−'}${nf(Math.abs(n), d)}%`;
}

/** Percent without sign: `2.4%`. */
export function fmtPctBare(n: number | null | undefined, d = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${nf(n, d)}%`;
}

/** Megawatts: `250 MW`. */
export function fmtMW(n: number | null | undefined, d = 0): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${nf(n, d)} MW`;
}

/** BTC: `₿ 12,345.67`. */
export function fmtBTC(n: number | null | undefined, d = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `₿ ${nf(n, d)}`;
}
