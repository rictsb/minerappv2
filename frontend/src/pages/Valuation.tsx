import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Scatter, Legend,
} from 'recharts';

function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
  return apiUrl;
}

// ── Formatting helpers ──────────────────────────────
const fmt = (n: number | null | undefined, d = 0) => {
  if (n == null || isNaN(n)) return '-';
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
};
const fmtM = (n: number | null | undefined, d = 0) => n != null && !isNaN(n) ? `$${fmt(n, d)}M` : '-';
const fmtPct = (n: number | null | undefined) => n != null ? `${fmt(n * 100, 1)}%` : '-';

// ── Phase colors ────────────────────────────────────
const phaseColor: Record<string, string> = {
  OPERATIONAL: 'bg-green-900/50 text-green-400',
  CONSTRUCTION: 'bg-yellow-900/50 text-yellow-400',
  DEVELOPMENT: 'bg-blue-900/50 text-blue-400',
  EXCLUSIVITY: 'bg-indigo-900/50 text-indigo-400',
  DILIGENCE: 'bg-gray-700 text-gray-400',
};

const phaseDotColor: Record<string, string> = {
  OPERATIONAL: '#4ade80',
  CONSTRUCTION: '#facc15',
  DEVELOPMENT: '#60a5fa',
  EXCLUSIVITY: '#818cf8',
  DILIGENCE: '#9ca3af',
};

const catLabel: Record<string, string> = {
  MINING: 'Mining',
  HPC_CONTRACTED: 'Contracted',
  PIPELINE: 'Pipeline',
};
const catColor: Record<string, string> = {
  MINING: 'bg-orange-900/50 text-orange-400',
  HPC_CONTRACTED: 'bg-cyan-900/50 text-cyan-400',
  PIPELINE: 'bg-purple-900/50 text-purple-400',
};

// ── Freshness config ────────────────────────────────
type Freshness = 0 | 1 | 2 | 3;
const FRESHNESS: Record<Freshness, { color: string; icon: string; label: string }> = {
  0: { color: 'text-gray-600', icon: '○', label: 'Not set' },
  1: { color: 'text-red-400', icon: '●', label: 'Stale' },
  2: { color: 'text-yellow-400', icon: '●', label: 'Partial' },
  3: { color: 'text-green-400', icon: '●', label: 'Current' },
};

// ── Factor row ──────────────────────────────────────
function FactorRow({ label, value, note }: { label: string; value: number; note?: string }) {
  const color = value > 1.001 ? 'text-green-400' : value < 0.999 ? 'text-red-400' : 'text-gray-400';
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-gray-500 text-xs">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-mono text-xs ${color}`}>{value.toFixed(3)}x</span>
        {note && <span className="text-[10px] text-gray-600">{note}</span>}
      </div>
    </div>
  );
}

// ── Collapsible section ─────────────────────────────
function Section({ title, defaultOpen = false, children, badge }: { title: string; defaultOpen?: boolean; children: React.ReactNode; badge?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-700/50 transition">
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="text-sm font-medium text-gray-300">{title}</span>
        </div>
        {badge}
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-700">{children}</div>}
    </div>
  );
}

// ── SOTP Bar custom tooltip ─────────────────────────
function SOTPTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs">
      <p className="text-gray-300 font-medium">{d.name}</p>
      <p className="font-mono text-white">{fmtM(d.value)}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════
export default function Valuation() {
  const { ticker } = useParams<{ ticker: string }>();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const { data: valData, isLoading, error } = useQuery({
    queryKey: ['valuation'],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/api/v1/valuation`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const freshness = useMemo(() => {
    const saved = localStorage.getItem('dashboard-freshness');
    if (!saved || !ticker) return 0;
    return (JSON.parse(saved)[ticker] || 0) as Freshness;
  }, [ticker]);

  const v = useMemo(() => {
    if (!valData?.valuations || !ticker) return null;
    return valData.valuations.find((x: any) => x.ticker === ticker);
  }, [valData, ticker]);

  const factors = valData?.factors;

  if (isLoading) return <div className="flex items-center justify-center h-64 bg-gray-900"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;
  if (error) return <div className="p-4 bg-red-900/50 text-red-400 rounded">Error: {(error as Error).message}</div>;
  if (!v) return <div className="p-6 bg-gray-900 text-gray-400">Ticker "{ticker}" not found</div>;

  const upside = v.stockPrice && v.fairValuePerShare ? ((v.fairValuePerShare / v.stockPrice) - 1) * 100 : null;
  const sites: any[] = v.hpcSites || [];

  // ── SOTP bar data ─────────────────────────────────
  const sotpData = [
    { name: 'Net Liquid', value: v.netLiquid, fill: '#10b981' },
    { name: 'Mining EV', value: v.evMining, fill: '#f97316' },
    { name: 'HPC Contracted', value: v.evHpcContracted, fill: '#a78bfa' },
    { name: 'HPC Pipeline', value: v.evHpcPipeline, fill: '#c4b5fd' },
    ...(v.impliedProjectDebtM > 0 ? [{ name: 'Project Debt', value: -v.impliedProjectDebtM, fill: '#f87171' }] : []),
  ].filter(d => d.value !== 0);

  // ── Timeline data ─────────────────────────────────
  const timelineData = useMemo(() => {
    const points = sites
      .filter((s: any) => s.energizationDate)
      .map((s: any) => ({
        date: new Date(s.energizationDate).getTime(),
        dateLabel: new Date(s.energizationDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        mw: s.mw,
        name: `${s.siteName} — ${s.buildingName}`,
        phase: s.phase,
        tenant: s.tenant,
        fill: phaseDotColor[s.phase] || '#9ca3af',
        valuation: s.valuation,
      }))
      .sort((a: any, b: any) => a.date - b.date);

    // Build cumulative MW step
    let cumMw = 0;
    const steps = points.map((p: any) => {
      cumMw += p.mw;
      return { ...p, cumulativeMw: cumMw };
    });

    // Add current point for already-operational sites without energization date
    const opMwNoDate = sites.filter((s: any) => s.phase === 'OPERATIONAL' && !s.energizationDate).reduce((s: any, x: any) => s + x.mw, 0);
    if (opMwNoDate > 0 && steps.length > 0) {
      steps.forEach((s: any) => { s.cumulativeMw += opMwNoDate; });
    }

    return steps;
  }, [sites]);

  // ── Sense-check metrics ───────────────────────────
  const metrics = useMemo(() => {
    const totalMw = v.totalMw || 1;
    const evPerMw = v.totalEv / totalMw;

    const contractedMw = sites.filter((s: any) => s.category === 'HPC_CONTRACTED').reduce((a: number, s: any) => a + s.mw, 0);
    const pipelineMw = sites.filter((s: any) => s.category === 'PIPELINE').reduce((a: number, s: any) => a + s.mw, 0);
    const impliedContracted = contractedMw > 0 ? v.evHpcContracted / contractedMw : 0;
    const impliedPipeline = pipelineMw > 0 ? v.evHpcPipeline / pipelineMw : 0;

    const opMw = sites.filter((s: any) => s.phase === 'OPERATIONAL').reduce((a: number, s: any) => a + s.mw, 0);
    const conMw = sites.filter((s: any) => s.phase === 'CONSTRUCTION').reduce((a: number, s: any) => a + s.mw, 0);
    const devMw = sites.filter((s: any) => ['DEVELOPMENT', 'EXCLUSIVITY', 'DILIGENCE'].includes(s.phase)).reduce((a: number, s: any) => a + s.mw, 0);
    const totalSiteMw = opMw + conMw + devMw || 1;

    // Weighted avg energization
    const withDates = sites.filter((s: any) => s.energizationDate);
    const now = Date.now();
    let wtdAvgYears = 0;
    const totalDateMw = withDates.reduce((a: number, s: any) => a + s.mw, 0);
    if (totalDateMw > 0) {
      wtdAvgYears = withDates.reduce((a: number, s: any) => {
        const yrs = (new Date(s.energizationDate).getTime() - now) / (365.25 * 86400000);
        return a + yrs * s.mw;
      }, 0) / totalDateMw;
    }

    // Gross vs net value (time value haircut)
    const grossSum = sites.reduce((a: number, s: any) => a + (s.grossValue || 0), 0);
    const netSum = sites.reduce((a: number, s: any) => a + (s.valuation || 0), 0);
    const haircut = grossSum > 0 ? (grossSum - netSum) / grossSum : 0;

    // Capex & debt
    const totalCapex = sites.reduce((a: number, s: any) => a + (s.capexDeductionM || 0), 0);
    const capexPerMw = totalMw > 0 ? totalCapex / totalMw : 0;
    const debtPct = v.totalEv > 0 ? (v.impliedProjectDebtM || 0) / v.totalEv : 0;
    const netLiqPct = v.totalValueM > 0 ? v.netLiquid / v.totalValueM : 0;

    return {
      evPerMw, impliedContracted, impliedPipeline,
      opPct: opMw / totalSiteMw, conPct: conMw / totalSiteMw, devPct: devMw / totalSiteMw,
      wtdAvgYears, haircut, capexPerMw, debtPct, netLiqPct,
    };
  }, [v, sites]);

  const toggleRow = (i: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const freshCfg = FRESHNESS[freshness];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 max-w-7xl mx-auto space-y-4">
      {/* ── HEADER ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-gray-500 hover:text-gray-300 transition"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-orange-500">{v.ticker}</h1>
              <span className="text-lg text-gray-400">{v.name}</span>
              <span className={`text-lg ${freshCfg.color}`} title={freshCfg.label}>{freshCfg.icon}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div>
            <p className="text-xs text-gray-500">Stock Price</p>
            <p className="text-lg font-mono text-green-400">{v.stockPrice ? `$${fmt(v.stockPrice, 2)}` : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Fair Value</p>
            <p className="text-lg font-mono text-orange-500 font-bold">{v.fairValuePerShare ? `$${fmt(v.fairValuePerShare, 2)}` : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Upside</p>
            {upside !== null ? (
              <div className="flex items-center gap-1">
                {upside >= 0 ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                <span className={`text-lg font-mono font-bold ${upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {upside >= 0 ? '+' : ''}{fmt(upside, 0)}%
                </span>
              </div>
            ) : <span className="text-gray-600 text-lg">-</span>}
          </div>
        </div>
      </div>

      {/* ── SOTP SUMMARY BAR ────────────────────────── */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-400 uppercase tracking-wider">SOTP Waterfall</p>
          <p className="text-sm font-mono text-orange-500 font-bold">Total: {fmtM(v.totalValueM)}</p>
        </div>
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={[{ name: 'SOTP', ...Object.fromEntries(sotpData.map(d => [d.name, d.value])) }]} layout="vertical" stackOffset="sign">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip content={<SOTPTooltip />} />
            {sotpData.map(d => (
              <Bar key={d.name} dataKey={d.name} stackId="sotp" fill={d.fill} radius={2} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-4 mt-2 text-xs">
          {sotpData.map(d => (
            <div key={d.name} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: d.fill }} />
              <span className="text-gray-400">{d.name}:</span>
              <span className="font-mono text-gray-300">{fmtM(d.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── NET LIQUID ASSETS ───────────────────────── */}
      <Section title="Net Liquid Assets" badge={<span className={`text-sm font-mono ${v.netLiquid >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtM(v.netLiquid)}</span>}>
        {v.netLiquidBreakdown ? (
          <table className="w-full text-sm mt-3">
            <tbody className="divide-y divide-gray-700/50">
              <tr><td className="py-1.5 text-gray-400">Cash</td><td className="py-1.5 text-right font-mono text-gray-300">{fmtM(v.netLiquidBreakdown.cashM)}</td></tr>
              <tr>
                <td className="py-1.5 text-gray-400">BTC Holdings</td>
                <td className="py-1.5 text-right font-mono text-gray-300">
                  {fmt(v.netLiquidBreakdown.btcCount, 0)} × ${fmt(factors?.btcPrice)} = {fmtM(v.netLiquidBreakdown.btcCount * (factors?.btcPrice || 0) / 1_000_000, 1)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 text-gray-400">ETH Holdings</td>
                <td className="py-1.5 text-right font-mono text-gray-300">
                  {fmt(v.netLiquidBreakdown.ethCount, 0)} × ${fmt(factors?.ethPrice)} = {fmtM(v.netLiquidBreakdown.ethCount * (factors?.ethPrice || 0) / 1_000_000, 1)}
                </td>
              </tr>
              <tr><td className="py-1.5 text-gray-400">Total Debt</td><td className="py-1.5 text-right font-mono text-red-400">−{fmtM(v.netLiquidBreakdown.totalDebtM)}</td></tr>
              <tr className="border-t-2 border-gray-600"><td className="py-2 text-gray-300 font-medium">Net Liquid Assets</td><td className={`py-2 text-right font-mono font-bold ${v.netLiquid >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtM(v.netLiquid)}</td></tr>
            </tbody>
          </table>
        ) : <p className="text-xs text-gray-500 italic mt-2">No net liquid data entered</p>}
      </Section>

      {/* ── MINING EV ───────────────────────────────── */}
      <Section title="Mining EV" badge={<span className="text-sm font-mono text-orange-400">{v.evMining > 0 ? fmtM(v.evMining) : '-'}</span>}>
        {v.miningBreakdown ? (() => {
          const m = v.miningBreakdown;
          return (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div><span className="text-gray-500 text-xs block">Hashrate</span><span className="font-mono text-gray-300">{fmt(m.hashrateEh, 1)} EH/s</span></div>
                <div><span className="text-gray-500 text-xs block">Efficiency</span><span className="font-mono text-gray-300">{fmt(m.efficiencyJth, 0)} J/TH</span></div>
                <div><span className="text-gray-500 text-xs block">Power Cost</span><span className="font-mono text-gray-300">${fmt(m.powerCostKwh, 3)}/kWh</span></div>
                <div><span className="text-gray-500 text-xs block">Hosted MW</span><span className="font-mono text-gray-300">{fmt(m.hostedMw, 0)} MW</span></div>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-700/50">
                  <tr><td className="py-1.5 text-gray-400">Annual Revenue</td><td className="py-1.5 text-right font-mono text-green-400">{fmtM(m.annualRevM, 1)}</td></tr>
                  <tr><td className="py-1.5 text-gray-400">Power Cost</td><td className="py-1.5 text-right font-mono text-red-400">−{fmtM(m.annualPowerCostM, 1)}</td></tr>
                  <tr><td className="py-1.5 text-gray-400">Pool Fees ({fmtPct(factors?.poolFeePct)})</td><td className="py-1.5 text-right font-mono text-red-400">−{fmtM(m.poolFeesM, 1)}</td></tr>
                  <tr className="border-t-2 border-gray-600"><td className="py-1.5 text-gray-300 font-medium">EBITDA</td><td className="py-1.5 text-right font-mono text-gray-300">{fmtM(m.ebitdaM, 1)}</td></tr>
                  <tr><td className="py-2 text-gray-300 font-medium">× {fmt(m.ebitdaMultiple, 1)}x Multiple</td><td className="py-2 text-right font-mono font-bold text-orange-400">{fmtM(v.evMining)}</td></tr>
                </tbody>
              </table>
            </div>
          );
        })() : <p className="text-xs text-gray-500 italic mt-2">No mining data entered</p>}
      </Section>

      {/* ── HPC SITES TABLE ─────────────────────────── */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">Valued Sites</span>
          <div className="flex gap-4 text-xs">
            <span className="text-purple-400">Contracted: {fmtM(v.evHpcContracted)}</span>
            <span className="text-purple-300">Pipeline: {fmtM(v.evHpcPipeline)}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-3 py-2 text-left text-gray-500 font-medium"></th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Site</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Building</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Phase</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Type</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Tenant</th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium">MW</th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium">Gross Value</th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium">Factor</th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium">CapEx Ded.</th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium">Net Value</th>
                <th className="px-3 py-2 text-left text-gray-500 font-medium">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {sites.map((s: any, i: number) => {
                const expanded = expandedRows.has(i);
                const f = s.factors;
                return (
                  <tr key={i} className="group">
                    <td colSpan={12} className="p-0">
                      {/* Main row */}
                      <div className="flex items-center cursor-pointer hover:bg-gray-700/30 transition" onClick={() => toggleRow(i)}>
                        <div className="px-3 py-2 w-8">
                          {expanded ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
                        </div>
                        <div className="px-3 py-2 flex-1 min-w-[100px] text-gray-300">{s.siteName}</div>
                        <div className="px-3 py-2 flex-1 min-w-[120px] text-gray-400">{s.buildingName}</div>
                        <div className="px-3 py-2 w-24">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${phaseColor[s.phase] || 'bg-gray-700 text-gray-400'}`}>{s.phase}</span>
                        </div>
                        <div className="px-3 py-2 w-20">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${catColor[s.category] || 'bg-gray-700 text-gray-400'}`}>{catLabel[s.category] || s.category}</span>
                        </div>
                        <div className="px-3 py-2 w-28 text-cyan-400">{s.tenant || '-'}</div>
                        <div className="px-3 py-2 w-16 text-right font-mono text-gray-300">{fmt(s.mw)}</div>
                        <div className="px-3 py-2 w-24 text-right font-mono text-gray-400">{fmtM(s.grossValue)}</div>
                        <div className="px-3 py-2 w-16 text-right font-mono text-gray-400">{f ? `${f.combinedFactor.toFixed(2)}x` : '-'}</div>
                        <div className="px-3 py-2 w-20 text-right font-mono text-red-400">{s.capexDeductionM > 0 ? `−${fmtM(s.capexDeductionM)}` : '-'}</div>
                        <div className="px-3 py-2 w-24 text-right font-mono text-orange-400 font-medium">{fmtM(s.valuation)}</div>
                        <div className="px-3 py-2 w-24 text-[10px] text-gray-500">{s.method?.replace('_', '/') || '-'}</div>
                      </div>

                      {/* Expanded factor waterfall */}
                      {expanded && f && (
                        <div className="bg-gray-850 border-t border-gray-700/50 px-6 py-3">
                          <div className="grid grid-cols-2 gap-8">
                            {/* Left: Factor waterfall */}
                            <div>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Factor Waterfall</p>
                              <div className="space-y-0.5">
                                <FactorRow label="Phase Probability" value={f.phaseProb} note={s.phase} />
                                <FactorRow label="Regulatory Risk" value={f.regRisk} />
                                <FactorRow label="Size Multiplier" value={f.sizeMult} />
                                <FactorRow label="Power Authority" value={f.powerAuthMult} />
                                <FactorRow label="Ownership" value={f.ownershipMult} />
                                <FactorRow label="Datacenter Tier" value={f.tierMult} />
                                {f.fidoodleOverride !== null && (
                                  <FactorRow label="Fidoodle Override" value={f.fidoodleOverride} note="manual" />
                                )}
                                <div className="border-t border-gray-700 my-1" />
                                <FactorRow label="Building Factor" value={f.buildingFactor} />
                                <div className="border-t border-gray-700/50 my-1" />
                                <FactorRow label="Tenant Credit" value={f.tenantMult} note={s.tenant || 'none'} />
                                <FactorRow label="Lease Structure" value={f.leaseStructMult} />
                                <FactorRow label="Time Value" value={f.timeValueMult} note={s.energizationDate ? new Date(s.energizationDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''} />
                                <div className="border-t border-gray-600 my-1" />
                                <div className="flex justify-between items-center py-1">
                                  <span className="text-gray-300 text-xs font-medium">Combined Factor</span>
                                  <span className="font-mono text-xs text-white font-bold">{f.combinedFactor.toFixed(4)}x</span>
                                </div>
                              </div>
                            </div>
                            {/* Right: Valuation math */}
                            <div>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Valuation</p>
                              <div className="space-y-1 text-xs">
                                {s.method === 'NOI_CAP_RATE' && s.noiAnnualM > 0 && (
                                  <>
                                    <div className="flex justify-between"><span className="text-gray-500">NOI Annual</span><span className="font-mono text-gray-300">{fmtM(s.noiAnnualM, 1)}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">÷ Cap Rate</span><span className="font-mono text-gray-300">{fmtPct(factors?.hpcCapRate)}</span></div>
                                  </>
                                )}
                                {(s.method === 'MW_PIPELINE' || s.method === 'MINING_HASHRATE') && (
                                  <div className="flex justify-between"><span className="text-gray-500">{fmt(s.mw)} MW × ${fmt(factors?.mwValueHpcUncontracted)}M/MW</span><span className="font-mono text-gray-300">{fmtM(s.mw * (factors?.mwValueHpcUncontracted || 8))}</span></div>
                                )}
                                <div className="flex justify-between"><span className="text-gray-500">Gross Value</span><span className="font-mono text-gray-300">{fmtM(s.grossValue)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">× Combined Factor</span><span className="font-mono text-gray-300">{f.combinedFactor.toFixed(3)}x</span></div>
                                {s.capexDeductionM > 0 && (
                                  <div className="flex justify-between"><span className="text-gray-500">− CapEx (equity)</span><span className="font-mono text-red-400">−{fmtM(s.capexDeductionM)}</span></div>
                                )}
                                <div className="border-t border-gray-600 my-1" />
                                <div className="flex justify-between"><span className="text-gray-300 font-medium">Net Valuation</span><span className="font-mono text-orange-400 font-bold">{fmtM(s.valuation)}</span></div>
                                {s.impliedDebtM > 0 && (
                                  <div className="flex justify-between mt-1"><span className="text-gray-500 text-[10px]">Implied project debt</span><span className="font-mono text-rose-400 text-[10px]">{fmtM(s.impliedDebtM)}</span></div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sites.length === 0 && (
                <tr><td colSpan={12} className="text-center py-6 text-gray-500 italic">No valued sites</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TIMELINE ────────────────────────────────── */}
      {timelineData.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Energization Timeline</p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={timelineData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
              <XAxis
                dataKey="date"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                axisLine={{ stroke: '#374151' }}
              />
              <YAxis
                yAxisId="mw"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                axisLine={{ stroke: '#374151' }}
                label={{ value: 'Cumulative MW', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }}
              />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs max-w-xs">
                      <p className="text-gray-300 font-medium">{d.name}</p>
                      <p className="text-gray-400">{d.dateLabel} · {fmt(d.mw)} MW · {d.phase}</p>
                      {d.tenant && <p className="text-cyan-400">{d.tenant}</p>}
                      <p className="text-orange-400 font-mono">{fmtM(d.valuation)}</p>
                      <p className="text-gray-500 mt-1">Cumulative: {fmt(d.cumulativeMw)} MW</p>
                    </div>
                  );
                }}
              />
              <Line yAxisId="mw" dataKey="cumulativeMw" type="stepAfter" stroke="#f97316" strokeWidth={2} dot={false} />
              <Scatter yAxisId="mw" dataKey="mw" shape={(props: any) => {
                const { cx, cy, payload } = props;
                const r = Math.max(4, Math.min(16, Math.sqrt(payload.mw) * 1.5));
                return <circle cx={cx} cy={cy} r={r} fill={payload.fill} fillOpacity={0.7} stroke={payload.fill} strokeWidth={1} />;
              }} />
              <Legend content={() => (
                <div className="flex gap-4 justify-center mt-2 text-[10px]">
                  {Object.entries(phaseDotColor).map(([phase, color]) => (
                    <div key={phase} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-gray-500">{phase}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-0.5 bg-orange-500" />
                    <span className="text-gray-500">Cumulative MW</span>
                  </div>
                </div>
              )} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── SENSE-CHECK METRICS ─────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'EV / MW', value: fmtM(metrics.evPerMw, 1), sub: 'total EV ÷ total MW' },
          { label: 'Contracted $/MW', value: fmtM(metrics.impliedContracted, 1), sub: 'contracted EV ÷ MW' },
          { label: 'Pipeline $/MW', value: fmtM(metrics.impliedPipeline, 1), sub: 'pipeline EV ÷ MW' },
          { label: 'MW by Phase', value: `${fmt(metrics.opPct * 100, 0)}% / ${fmt(metrics.conPct * 100, 0)}% / ${fmt(metrics.devPct * 100, 0)}%`, sub: 'op / const / dev' },
          { label: 'Wtd Avg Energization', value: metrics.wtdAvgYears <= 0 ? 'Now' : `+${fmt(metrics.wtdAvgYears, 1)} yrs`, sub: 'MW-weighted' },
          { label: 'Factor Haircut', value: fmtPct(metrics.haircut), sub: 'gross → net discount' },
          { label: 'Project Debt / EV', value: fmtPct(metrics.debtPct), sub: 'implied leverage' },
          { label: 'Net Liquid / Value', value: fmtPct(metrics.netLiqPct), sub: 'hard asset support' },
        ].map(m => (
          <div key={m.label} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{m.label}</p>
            <p className="text-lg font-mono text-gray-200 mt-1">{m.value}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* ── FOOTER: VALUATION ARITHMETIC ────────────── */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Fair Value Calculation</p>
        <div className="flex flex-wrap items-center gap-2 text-sm font-mono">
          <span className="text-green-400">{fmtM(v.netLiquid)}</span>
          <span className="text-gray-500">+</span>
          <span className="text-orange-400">{fmtM(v.evMining)}</span>
          <span className="text-gray-500">+</span>
          <span className="text-purple-400">{fmtM(v.evHpcContracted)}</span>
          <span className="text-gray-500">+</span>
          <span className="text-purple-300">{fmtM(v.evHpcPipeline)}</span>
          {(v.impliedProjectDebtM || 0) > 0 && (
            <>
              <span className="text-gray-500">−</span>
              <span className="text-red-400">{fmtM(v.impliedProjectDebtM)}</span>
            </>
          )}
          <span className="text-gray-500">=</span>
          <span className="text-orange-500 font-bold">{fmtM(v.totalValueM)}</span>
        </div>
        <div className="flex items-center gap-2 mt-2 text-sm font-mono">
          <span className="text-orange-500">{fmtM(v.totalValueM)}</span>
          <span className="text-gray-500">÷</span>
          <span className="text-gray-300">{v.fdSharesM ? `${fmt(v.fdSharesM, 1)}M FD shares` : '-'}</span>
          <span className="text-gray-500">=</span>
          <span className="text-orange-500 font-bold text-lg">${v.fairValuePerShare ? fmt(v.fairValuePerShare, 2) : '-'}/share</span>
        </div>
        <div className="flex gap-6 mt-3 text-xs text-gray-500">
          <span>Net Liquid</span>
          <span>Mining EV</span>
          <span>HPC Contracted</span>
          <span>HPC Pipeline</span>
          {(v.impliedProjectDebtM || 0) > 0 && <span>Project Debt</span>}
        </div>
      </div>
    </div>
  );
}
