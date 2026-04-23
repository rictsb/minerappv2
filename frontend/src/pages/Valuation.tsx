/**
 * Miner Terminal — Valuation (per-ticker deep dive)
 *
 * Drop-in replacement for frontend/src/pages/Valuation.tsx.
 * Reads `:ticker` from the route and fetches the same `/api/v1/valuation`
 * feed as the Dashboard (filtered client-side).
 *
 * For wiring notes see handoff/CLAUDE_CODE.md § "Page replacement notes".
 */

import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import DeltaPill from '../components/DeltaPill';
import SOTPBar from '../components/SOTPBar';
import TickerMark from '../components/TickerMark';
import SectionHeader from '../components/SectionHeader';
import { fmt, fmtM, fmtMoney } from '../lib/format';
import { COLORS } from '../lib/colors';

function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
  return apiUrl;
}

export default function Valuation() {
  const { ticker } = useParams<{ ticker: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['valuation'],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/api/v1/valuation`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const v = data?.valuations?.find((x: any) => x.ticker === ticker);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--btc)]" />
      </div>
    );
  }

  if (!v) {
    return (
      <div className="p-6">
        <Card>Ticker {ticker} not found.</Card>
      </div>
    );
  }

  const sotpItems = [
    { value: Math.max(0, v.netLiquid), fill: COLORS.netLiquid, label: 'Net Liquid' },
    { value: v.evMining, fill: COLORS.mining, label: 'Mining' },
    { value: v.evHpcContracted, fill: COLORS.hpc, label: 'HPC Contracted' },
    { value: v.evHpcPipeline, fill: COLORS.pipeline, label: 'HPC Pipeline' },
  ];

  const upside =
    v.stockPrice && v.fairValuePerShare ? (v.fairValuePerShare / v.stockPrice - 1) * 100 : null;

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink-1 mb-4"
      >
        <ArrowLeft className="w-3 h-3" /> Dashboard
      </Link>

      <SectionHeader
        eyebrow="Valuation"
        title={`${v.ticker} — ${v.name}`}
        right={
          <>
            {v.hasOverride && <Badge color="warn">Override</Badge>}
            {v.fairValueOverrideUrl && (
              <a
                href={v.fairValueOverrideUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-[var(--info)] hover:underline"
              >
                {v.fairValueOverrideLabel || 'Source'} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </>
        }
      />

      <div className="flex items-center gap-5 mb-6">
        <TickerMark ticker={v.ticker} size={48} />
        <div>
          <div className="eyebrow">Price</div>
          <div className="num text-[28px] text-ink-1 font-medium">
            {v.stockPrice ? fmtMoney(v.stockPrice) : '—'}
          </div>
        </div>
        <div>
          <div className="eyebrow">Fair Value</div>
          <div
            className="num text-[28px] font-medium"
            style={{ color: v.hasOverride ? COLORS.warn : COLORS.ink1 }}
          >
            {v.fairValuePerShare ? fmtMoney(v.fairValuePerShare) : '—'}
          </div>
        </div>
        {upside !== null && (
          <div>
            <div className="eyebrow">Upside</div>
            <DeltaPill value={upside} size="lg" precision={0} />
          </div>
        )}
      </div>

      <Card padding="md" className="mb-5">
        <div className="eyebrow mb-3">Sum-of-the-Parts</div>
        <SOTPBar items={sotpItems} width={1140} height={16} />
        <div className="grid grid-cols-4 gap-4 mt-5">
          <SOTPBreakdown label="Net Liquid" value={v.netLiquid} color={COLORS.netLiquid} />
          <SOTPBreakdown label="Mining EV" value={v.evMining} color={COLORS.mining} />
          <SOTPBreakdown label="HPC Contracted" value={v.evHpcContracted} color={COLORS.hpc} />
          <SOTPBreakdown label="HPC Pipeline" value={v.evHpcPipeline} color={COLORS.pipeline} />
        </div>
        <div className="mt-4 pt-4 border-t border-hairline flex items-center justify-between">
          <span className="text-[13px] font-medium text-ink-1">Total Enterprise Value</span>
          <span className="num text-[18px] font-medium text-ink-1">{fmtM(v.totalEv)}</span>
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <Stat label="Shares Out" value={v.sharesOutM ? `${fmt(v.sharesOutM, 1)}M` : '—'} />
        <Stat label="FD Shares" value={v.fdSharesM ? `${fmt(v.fdSharesM, 1)}M` : '—'} />
        <Stat label="Total MW" value={v.totalMw > 0 ? `${fmt(v.totalMw, 0)} MW` : '—'} />
        <Stat
          label="Implied Debt"
          value={(v.impliedProjectDebtM ?? 0) > 0 ? `−${fmtM(v.impliedProjectDebtM)}` : '—'}
          negative={(v.impliedProjectDebtM ?? 0) > 0}
        />
      </div>

      {Array.isArray(v.hpcSites) && v.hpcSites.length > 0 && (
        <Card padding="none">
          <div className="px-4 py-3 border-b border-hairline">
            <div className="eyebrow">Valued Sites</div>
          </div>
          <div className="overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Building</th>
                  <th>Tenant</th>
                  <th>Phase</th>
                  <th className="num-col">MW</th>
                  <th className="num-col">Lease $M</th>
                  <th className="num-col">NOI $M</th>
                  <th className="num-col">Valuation $M</th>
                </tr>
              </thead>
              <tbody>
                {v.hpcSites.map((s: any, i: number) => (
                  <tr key={i} style={{ cursor: 'default' }}>
                    <td className="text-[12px] text-ink-1">{s.siteName}</td>
                    <td className="text-[12px] text-ink-2">{s.buildingName}</td>
                    <td className="text-[12px] text-ink-2">{s.tenant || '—'}</td>
                    <td>{s.phase && <Badge color="hpc">{s.phase}</Badge>}</td>
                    <td className="num-col">{fmt(s.mw, 0)}</td>
                    <td className="num-col">{fmt(s.leaseValueM, 0)}</td>
                    <td className="num-col">{fmt(s.noiAnnualM, 1)}</td>
                    <td className="num-col font-medium">{fmt(s.valuation, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  negative = false,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <Card padding="sm">
      <div className="eyebrow mb-1">{label}</div>
      <div
        className="num text-[18px] font-medium"
        style={{ color: negative ? COLORS.neg : COLORS.ink1 }}
      >
        {value}
      </div>
    </Card>
  );
}

function SOTPBreakdown({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-[6px] h-[6px] rounded-full"
          style={{ background: color }}
        />
        <span className="eyebrow">{label}</span>
      </div>
      <div className="num text-[17px] text-ink-1 font-medium">{fmtM(value)}</div>
    </div>
  );
}
