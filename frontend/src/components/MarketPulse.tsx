import { Search, Bell } from 'lucide-react';
import Kbd from './Kbd';
import DeltaPill from './DeltaPill';
import { fmtMoney } from '../lib/format';

interface MarketPulseProps {
  onCmdK?: () => void;
  /** Live metrics from backend settings. Undefined = still loading. */
  btcPrice?: number;
  btcDelta?: number;
  networkHashrate?: string; // e.g. "618 EH/s"
  difficulty?: string;       // e.g. "95.7T"
  hashprice?: number;        // $/TH/day
}

/**
 * Top bar with market pulse metrics, search affordance, and notifications.
 * Fixed height (48px) to pair with the Sidebar rail.
 *
 * All values come from live backend data. Shows "—" while loading.
 */
export default function MarketPulse({
  onCmdK,
  btcPrice,
  btcDelta,
  networkHashrate,
  difficulty,
  hashprice,
}: MarketPulseProps) {
  return (
    <header className="h-12 bg-elevated border-b border-hairline flex items-center px-4 gap-6 flex-shrink-0">
      {/* Pulse metrics */}
      <div className="flex items-center gap-6 min-w-0 overflow-hidden">
        <Metric label="BTC" value={btcPrice ? fmtMoney(btcPrice, 0) : '—'} delta={btcDelta} />
        {networkHashrate && <Metric label="Network" value={networkHashrate} />}
        {difficulty && <Metric label="Difficulty" value={difficulty} />}
        {hashprice && <Metric label="Hashprice" value={`$${hashprice.toFixed(2)}`} sub="/TH/day" />}
      </div>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onCmdK}
          className="flex items-center gap-2 px-3 py-[6px] bg-subtle hover:bg-[var(--bg-row-hover)] border border-hairline rounded-sm text-[12px] text-ink-3 min-w-[240px] transition-colors"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Search tickers, sites, pages…</span>
          <span className="flex items-center gap-[2px]">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <button
          className="p-[7px] rounded-sm hover:bg-subtle text-ink-3 hover:text-ink-1 transition-colors"
          title="Notifications"
        >
          <Bell size={15} />
        </button>
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
}) {
  return (
    <div className="flex items-baseline gap-[6px] min-w-0">
      <span className="eyebrow">{label}</span>
      <span className="num text-[13px] font-medium text-ink-1 whitespace-nowrap">{value}</span>
      {sub && <span className="text-[10px] text-ink-4">{sub}</span>}
      {delta != null && <DeltaPill value={delta} size="sm" showIcon={false} />}
    </div>
  );
}
