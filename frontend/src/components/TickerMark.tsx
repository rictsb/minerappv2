interface TickerMarkProps {
  ticker: string;
  size?: number;
}

/**
 * Deterministic colored monogram for a ticker symbol. Same ticker → same hue.
 * Lightweight fallback when you don't have a real logo.
 */
export default function TickerMark({ ticker, size = 24 }: TickerMarkProps) {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) {
    h = (h * 31 + ticker.charCodeAt(i)) % 360;
  }
  const bg = `oklch(62% 0.11 ${h})`;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 5,
        background: bg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: size * 0.44,
        fontWeight: 600,
        letterSpacing: '0.02em',
        flexShrink: 0,
      }}
    >
      {ticker.slice(0, 2)}
    </div>
  );
}
