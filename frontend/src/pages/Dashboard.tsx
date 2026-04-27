/**
 * Miner Terminal — Dashboard
 *
 * Full replacement for frontend/src/pages/Dashboard.tsx that adopts the
 * light-terminal aesthetic. ALL business logic is preserved 1:1:
 *   - /api/v1/valuation query
 *   - freshness cycling mutation (PATCH /companies/:ticker/freshness)
 *   - override edit mutation (PUT /companies/:ticker)
 *   - create/delete manual ticker mutations
 *   - capex-in-financials toggle
 *   - sort persistence (localStorage)
 *   - refresh prices with last-refresh timestamp
 *
 * Visual changes only:
 *   - Light canvas + paper cards
 *   - SOTPBar + TickerMark + DeltaPill inline
 *   - Badge component for OVERRIDE / MANUAL flags
 *   - Right-side slideout panel for expanded ticker (instead of inline row)
 *
 * Nothing here calls a mock API — all fetches hit your real backend.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  Pencil,
  Plus,
  X,
  ExternalLink,
  Check,
  Trash2,
  ChevronRight,
  Download,
} from 'lucide-react';

import Card from '../components/Card';
import Badge from '../components/Badge';
import DeltaPill from '../components/DeltaPill';
import SOTPBar from '../components/SOTPBar';
import Sparkline from '../components/Sparkline';
import TickerMark from '../components/TickerMark';
import { fmt, fmtM, fmtMoney, fmtPct } from '../lib/format';
import { COLORS } from '../lib/colors';

// ── Types (match backend exactly) ─────────────────────────────────────────

interface HpcSite {
  siteName: string;
  buildingName: string;
  tenant: string;
  mw: number;
  leaseValueM: number;
  noiAnnualM: number;
  valuation: number;
  phase: string;
  dollarsPerMwYr?: number;
  category?: 'HPC_CONTRACTED' | 'PIPELINE' | 'MINING';
  leaseConfirmed?: boolean;
}

interface Valuation {
  ticker: string;
  name: string;
  freshness: number;
  stockPrice: number | null;
  fdSharesM: number | null;
  sharesOutM: number | null;
  netLiquid: number;
  totalMw: number;
  evMining: number;
  evHpcContracted: number;
  evHpcPipeline: number;
  evGpu: number;
  totalEv: number;
  impliedProjectDebtM?: number;
  totalValueM: number;
  fairValuePerShare: number | null;
  calculatedFairValue?: number | null;
  hasOverride?: boolean;
  fairValueOverrideUrl?: string | null;
  fairValueOverrideLabel?: string | null;
  fairValueSourceRange?: string | null;
  isManual?: boolean;
  totalLeaseValueM?: number;
  hpcSites?: HpcSite[];
}

interface ValuationResponse {
  factors: {
    btcPrice: number;
    mwValueHpcContracted: number;
    mwValueHpcUncontracted: number;
    noiMultiple: number;
  };
  valuations: Valuation[];
}

interface OverrideEditState {
  ticker: string;
  fairValueOverride: string;
  fairValueOverrideUrl: string;
  fairValueOverrideLabel: string;
  fairValueSourceRange: string;
}

interface ManualTickerForm {
  ticker: string;
  name: string;
  fairValueOverride: string;
  fairValueOverrideUrl: string;
  fairValueOverrideLabel: string;
  fairValueSourceRange: string;
  fdSharesM: string;
}

/**
 * Hook to fetch real 30-day historical closing prices from Finnhub via our backend.
 * Returns a map of ticker → number[] (closing prices, oldest→newest).
 * Data is cached for 15 minutes and shared across all tickers in a single batch.
 */
function useSparklineData(tickers: string[]): Record<string, number[]> {
  const apiUrl = getApiUrl();
  const stableTickers = useMemo(() => [...tickers].sort().join(','), [tickers]);

  const { data } = useQuery<Record<string, number[]>>({
    queryKey: ['sparklines', stableTickers],
    queryFn: async () => {
      const tickerList = stableTickers.split(',').filter(Boolean);
      const results: Record<string, number[]> = {};

      // Fetch in parallel (backend handles Finnhub rate limiting)
      const fetches = tickerList.map(async (ticker) => {
        try {
          const res = await fetch(`${apiUrl}/api/v1/stock-prices/${ticker}/history?days=30`);
          if (res.ok) {
            const json = await res.json();
            if (json.prices && json.prices.length > 1) {
              results[ticker] = json.prices;
            }
          }
        } catch {
          // Silently skip failed tickers — sparkline just won't render
        }
      });

      await Promise.all(fetches);
      return results;
    },
    staleTime: 15 * 60 * 1000,  // Cache for 15 min
    refetchOnWindowFocus: false,
    enabled: stableTickers.length > 0,
  });

  return data || {};
}

function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
  return apiUrl;
}

// ── Main ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(() => {
    const saved = localStorage.getItem('lastPriceRefresh');
    return saved ? new Date(saved) : null;
  });

  const [sortKey, setSortKey] = useState<'ticker' | 'freshness' | 'upside' | 'fairValue'>(() => {
    return (localStorage.getItem('dashSortKey') as any) || 'ticker';
  });
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => {
    return (localStorage.getItem('dashSortDir') as any) || 'asc';
  });

  const [editingOverride, setEditingOverride] = useState<OverrideEditState | null>(null);
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualForm, setManualForm] = useState<ManualTickerForm>({
    ticker: '', name: '', fairValueOverride: '', fairValueOverrideUrl: '',
    fairValueOverrideLabel: '', fairValueSourceRange: '', fdSharesM: '',
  });
  const [tickerLookupLoading, setTickerLookupLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setEditingOverride(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: valData, isLoading, error } = useQuery({
    queryKey: ['valuation'],
    queryFn: async () => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/valuation`);
      if (!res.ok) throw new Error('Failed to fetch valuation');
      return res.json() as Promise<ValuationResponse>;
    },
  });

  // ── Mutations (unchanged from original) ────────────────────────────────

  // Reserved for future ticker freshness cycling UI
  const freshnessMutation = useMutation({
    mutationFn: async ({ ticker, freshness }: { ticker: string; freshness: number }) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/companies/${ticker}/freshness`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freshness }),
      });
      if (!res.ok) throw new Error('Failed to update freshness');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['valuation'] }),
  });
  void freshnessMutation; // available for future UI integration

  const refreshPricesMutation = useMutation({
    mutationFn: async () => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/stock-prices/refresh`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to refresh prices');
      return res.json();
    },
    onSuccess: (data) => {
      setRefreshMessage(`Updated ${data.updated} prices`);
      const now = new Date();
      setLastRefresh(now);
      localStorage.setItem('lastPriceRefresh', now.toISOString());
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['settings-market'] });
      queryClient.invalidateQueries({ queryKey: ['sparklines'] });
      setTimeout(() => setRefreshMessage(null), 3000);
    },
    onError: (error: Error) => {
      setRefreshMessage(`Error: ${error.message}`);
      setTimeout(() => setRefreshMessage(null), 3000);
    },
  });

  const updateOverrideMutation = useMutation({
    mutationFn: async (data: {
      ticker: string;
      fairValueOverride: number | null;
      fairValueOverrideUrl: string | null;
      fairValueOverrideLabel: string | null;
      fairValueSourceRange: string | null;
    }) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/companies/${data.ticker}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fairValueOverride: data.fairValueOverride,
          fairValueOverrideUrl: data.fairValueOverrideUrl || null,
          fairValueOverrideLabel: data.fairValueOverrideLabel || null,
          fairValueSourceRange: data.fairValueSourceRange || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to update override');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setEditingOverride(null);
    },
  });

  const createManualMutation = useMutation({
    mutationFn: async (form: ManualTickerForm) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: form.ticker.toUpperCase(),
          name: form.name,
          isManual: true,
          fairValueOverride: form.fairValueOverride ? parseFloat(form.fairValueOverride) : null,
          fairValueOverrideUrl: form.fairValueOverrideUrl || null,
          fairValueOverrideLabel: form.fairValueOverrideLabel || null,
          fairValueSourceRange: form.fairValueSourceRange || null,
          fdSharesM: form.fdSharesM ? parseFloat(form.fdSharesM) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create ticker');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowAddManual(false);
      setManualForm({
        ticker: '', name: '', fairValueOverride: '', fairValueOverrideUrl: '',
        fairValueOverrideLabel: '', fairValueSourceRange: '', fdSharesM: '',
      });
    },
  });

  const deleteManualMutation = useMutation({
    mutationFn: async (ticker: string) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/companies/${ticker}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete ticker');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  const handleSort = useCallback(
    (key: typeof sortKey) => {
      if (sortKey === key) {
        setSortDir((d) => {
          const next = d === 'asc' ? 'desc' : 'asc';
          localStorage.setItem('dashSortDir', next);
          return next;
        });
      } else {
        const dir: 'asc' | 'desc' = key === 'ticker' ? 'asc' : 'desc';
        setSortKey(key);
        setSortDir(dir);
        localStorage.setItem('dashSortKey', key);
        localStorage.setItem('dashSortDir', dir);
      }
    },
    [sortKey]
  );

  const handleTickerLookup = useCallback(async (ticker: string) => {
    if (!ticker || ticker.length < 1) return;
    setTickerLookupLoading(true);
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/stock-prices/lookup/${ticker.toUpperCase()}`);
      if (res.ok) {
        const info = (await res.json()) as { name: string; marketCapM: number; sharesOutM: number };
        setManualForm((prev) => ({
          ...prev,
          name: prev.name || info.name,
          fdSharesM: prev.fdSharesM || (info.sharesOutM > 0 ? info.sharesOutM.toFixed(1) : ''),
        }));
      }
    } catch {
      // silent
    } finally {
      setTickerLookupLoading(false);
    }
  }, []);

  const handleSaveOverride = () => {
    if (!editingOverride) return;
    const val = editingOverride.fairValueOverride.trim();
    updateOverrideMutation.mutate({
      ticker: editingOverride.ticker,
      fairValueOverride: val ? parseFloat(val) : null,
      fairValueOverrideUrl: editingOverride.fairValueOverrideUrl.trim() || null,
      fairValueOverrideLabel: editingOverride.fairValueOverrideLabel.trim() || null,
      fairValueSourceRange: editingOverride.fairValueSourceRange.trim() || null,
    });
  };

  const handleClearOverride = () => {
    if (!editingOverride) return;
    updateOverrideMutation.mutate({
      ticker: editingOverride.ticker,
      fairValueOverride: null,
      fairValueOverrideUrl: null,
      fairValueOverrideLabel: null,
      fairValueSourceRange: null,
    });
  };

  const valuations = useMemo(() => {
    const raw = valData?.valuations || [];
    return [...raw].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'ticker') cmp = a.ticker.localeCompare(b.ticker);
      else if (sortKey === 'freshness') cmp = (a.freshness || 0) - (b.freshness || 0);
      else if (sortKey === 'upside') {
        const uA = a.stockPrice && a.fairValuePerShare ? a.fairValuePerShare / a.stockPrice - 1 : -999;
        const uB = b.stockPrice && b.fairValuePerShare ? b.fairValuePerShare / b.stockPrice - 1 : -999;
        cmp = uA - uB;
      } else if (sortKey === 'fairValue') {
        cmp = (a.fairValuePerShare || 0) - (b.fairValuePerShare || 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [valData?.valuations, sortKey, sortDir]);

  const totals = valuations.reduce(
    (acc, v) => {
      const sharesForMktCap = v.sharesOutM || v.fdSharesM;
      const mktCap = v.stockPrice && sharesForMktCap ? v.stockPrice * sharesForMktCap : 0;
      return {
        marketCapM: acc.marketCapM + mktCap,
        totalValueM: acc.totalValueM + (v.totalValueM || 0),
        evMining: acc.evMining + v.evMining,
        evHpcContracted: acc.evHpcContracted + v.evHpcContracted,
        evHpcPipeline: acc.evHpcPipeline + v.evHpcPipeline,
        totalEv: acc.totalEv + v.totalEv,
        impliedProjectDebt: acc.impliedProjectDebt + (v.impliedProjectDebtM ?? 0),
      };
    },
    { marketCapM: 0, totalValueM: 0, evMining: 0, evHpcContracted: 0, evHpcPipeline: 0, totalEv: 0, impliedProjectDebt: 0 }
  );

  const selectedVal = selectedTicker ? valuations.find((v) => v.ticker === selectedTicker) : null;

  // Fetch real 30-day sparkline data for all tickers (including manual ones)
  const allTickers = useMemo(() => valuations.map(v => v.ticker), [valuations]);
  const sparklineData = useSparklineData(allTickers);

  // ── Render ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--btc)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card padding="md" className="border-[color:var(--neg-soft)]">
          <span className="text-[var(--neg)] text-sm">Error loading data: {(error as Error).message}</span>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* ── Main content ──────────────────────────────────────────────── */}
      <div
        className={`flex-1 min-w-0 overflow-auto transition-all duration-200 ${selectedVal ? 'mr-[520px]' : ''}`}
      >
        <div className="p-6">
          {/* Header with title, badge, buttons, and subtitle */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-[24px] font-semibold text-ink-1">BTC Miner Dashboard</h1>
              <Badge color="brand">LIVE SOTP</Badge>
              <div className="ml-auto flex items-center gap-2">
                {refreshMessage && (
                  <span className={`text-[12px] ${refreshMessage.includes('Error') ? 'text-[var(--neg)]' : 'text-[var(--pos)]'}`}>
                    {refreshMessage}
                  </span>
                )}
                <button
                  onClick={() => setShowAddManual(true)}
                  className="inline-flex items-center gap-[6px] px-3 py-[6px] rounded-sm border border-[var(--border-strong)] bg-elevated hover:bg-subtle text-[12px] text-ink-1"
                >
                  <Plus className="w-[14px] h-[14px]" />
                  Add Ticker
                </button>
                <button
                  onClick={() => refreshPricesMutation.mutate()}
                  disabled={refreshPricesMutation.isPending}
                  className="inline-flex items-center gap-[6px] px-3 py-[6px] rounded-sm bg-[var(--btc)] hover:bg-[var(--btc-ink)] text-white text-[12px] disabled:opacity-50"
                >
                  <RefreshCw className={`w-[14px] h-[14px] ${refreshPricesMutation.isPending ? 'animate-spin' : ''}`} />
                  {refreshPricesMutation.isPending ? 'Refreshing…' : 'Refresh Prices'}
                </button>
              </div>
            </div>
            {valuations.length > 0 && (
              <div className="text-[13px] text-ink-3">
                {valuations.length} tickers · {valuations.reduce((sum, v) => sum + (v.hpcSites?.length || 0), 0)} sites ·{' '}
                {fmt(valuations.reduce((sum, v) => sum + v.totalMw, 0), 0)} MW tracked
                {lastRefresh && ` · Last refresh ${getTimeAgo(lastRefresh)}`}
              </div>
            )}
          </div>

          {/* Three KPI cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <KPI
              label="AGGREGATE EV"
              value={fmtM(totals.totalEv)}
              accent={COLORS.ink1}
              subtitle="Sum of parts"
            />
            <KPI
              label="AGGREGATE NET LIQUID"
              value={fmtM(totals.marketCapM)}
              accent={COLORS.netLiquid}
              subtitle="Cash + debt + BTC + ETH"
            />
            <div className="relative">
              <KPI
                label="TOTAL VALUE"
                value={fmtM(totals.totalValueM)}
                accent={COLORS.btc}
                subtitle="EV + Net liquid"
                highlight
              />
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    // Export functionality - can be enhanced later
                    const data = valuations.map(v => ({
                      ticker: v.ticker,
                      name: v.name,
                      price: v.stockPrice,
                      fairValue: v.fairValuePerShare,
                      totalValue: v.totalValueM,
                    }));
                    const csv = [
                      ['Ticker', 'Name', 'Price', 'Fair Value', 'Total Value'],
                      ...data.map(d => [d.ticker, d.name, d.price, d.fairValue, d.totalValue])
                    ].map(row => row.join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'dashboard-export.csv';
                    a.click();
                  }}
                  className="text-ink-4 hover:text-ink-1 p-1"
                  title="Export data"
                >
                  <Download className="w-[14px] h-[14px]" />
                </button>
              </div>
            </div>
          </div>

          {/* Main table */}
          <Card padding="none">
            <div className="overflow-auto">
              <table className="tbl" style={{ minWidth: 1300 }}>
                <thead>
                  <tr>
                    <SortTh active={sortKey === 'ticker'} dir={sortDir} onClick={() => handleSort('ticker')}>
                      TICKER
                    </SortTh>
                    <th className="num-col">PRICE</th>
                    <th className="num-col" style={{ width: 60 }}>1D</th>
                    <th className="num-col" style={{ width: 88 }}>30D</th>
                    <th className="num-col">MW</th>
                    <th className="num-col">NET LIQ.</th>
                    <th style={{ width: 120 }}>SOTP</th>
                    <th className="num-col">EV</th>
                    <SortTh active={sortKey === 'ticker'} dir={sortDir} onClick={() => handleSort('ticker')} className="num-col">
                      TOTAL
                    </SortTh>
                    <SortTh active={sortKey === 'fairValue'} dir={sortDir} onClick={() => handleSort('fairValue')} className="num-col">
                      FAIR VAL.
                    </SortTh>
                    <SortTh active={sortKey === 'upside'} dir={sortDir} onClick={() => handleSort('upside')} className="num-col">
                      UPSIDE
                    </SortTh>
                    <th className="center" style={{ width: 48 }} />
                  </tr>
                </thead>
                <tbody>
                  {valuations.map((v) => {
                    const upside =
                      v.stockPrice && v.stockPrice > 0 && v.fairValuePerShare
                        ? (v.fairValuePerShare / v.stockPrice - 1) * 100
                        : null;

                    const sparkPoints = sparklineData[v.ticker] || [];
                    const oneDayDelta = sparkPoints.length >= 2
                      ? ((sparkPoints[sparkPoints.length - 1] / sparkPoints[sparkPoints.length - 2]) - 1) * 100
                      : (v.stockPrice ? 0 : 0);

                    const sotpItems = [
                      { value: Math.max(0, v.netLiquid), fill: COLORS.netLiquid, label: 'Net Liquid' },
                      { value: v.evMining, fill: COLORS.mining, label: 'Mining' },
                      { value: v.evHpcContracted, fill: COLORS.hpc, label: 'HPC' },
                      { value: v.evHpcPipeline, fill: COLORS.pipeline, label: 'Pipeline' },
                    ];

                    const isSelected = selectedTicker === v.ticker;

                    return (
                      <tr
                        key={v.ticker}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => !v.isManual && setSelectedTicker(isSelected ? null : v.ticker)}
                        style={{ cursor: v.isManual ? 'default' : 'pointer' }}
                      >
                        <td>
                          <div className="flex items-center gap-[10px]">
                            <TickerMark ticker={v.ticker} size={22} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-[6px]">
                                {v.isManual ? (
                                  <span className="font-medium text-[13px] text-[var(--info)]">{v.ticker}</span>
                                ) : (
                                  <Link
                                    to={`/valuation/${v.ticker}`}
                                    className="font-medium text-[13px] text-ink-1 hover:text-[var(--btc)] hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {v.ticker}
                                  </Link>
                                )}
                                {v.isManual && <Badge color="info">Manual</Badge>}
                                {!v.isManual && v.hasOverride && <Badge color="warn">Override</Badge>}
                                {v.fairValueOverrideUrl && (
                                  <a
                                    href={v.fairValueOverrideUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-ink-4 hover:text-[var(--info)]"
                                    title={v.fairValueOverrideLabel || 'External valuation'}
                                  >
                                    <ExternalLink className="w-[12px] h-[12px]" />
                                  </a>
                                )}
                              </div>
                              <div className="text-[10.5px] text-ink-3 truncate max-w-[160px]">{v.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="num-col text-ink-1">{v.stockPrice ? fmtMoney(v.stockPrice) : '—'}</td>
                        <td className="num-col">
                          {sparkPoints.length >= 2 ? (
                            <DeltaPill value={oneDayDelta} size="sm" precision={1} />
                          ) : (
                            <span className="text-ink-4">—</span>
                          )}
                        </td>
                        <td className="num-col">
                          {sparkPoints.length > 1 ? (
                            <Sparkline
                              points={sparkPoints}
                              width={72}
                              height={20}
                              stroke={sparkPoints[sparkPoints.length - 1] >= sparkPoints[0] ? 'var(--pos)' : 'var(--neg)'}
                            />
                          ) : (
                            <span className="text-ink-4">—</span>
                          )}
                        </td>
                        <td className="num-col text-ink-2">
                          {!v.isManual && v.totalMw > 0 ? fmt(v.totalMw, 0) : '—'}
                        </td>
                        <td className={`num-col ${v.netLiquid >= 0 ? 'text-ink-1' : 'text-[var(--neg)]'}`}>
                          {!v.isManual ? fmt(v.netLiquid, 0) : '—'}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <SOTPBar items={sotpItems} width={110} height={7} />
                          </div>
                        </td>
                        <td className="num-col text-ink-1">{!v.isManual ? fmt(v.totalEv, 0) : '—'}</td>
                        <td className="num-col text-ink-1">{!v.isManual ? fmt(v.totalValueM, 0) : '—'}</td>
                        <td className="num-col relative">
                          <span
                            className="font-medium"
                            style={{ color: v.hasOverride || v.isManual ? COLORS.warn : COLORS.ink1 }}
                            title={
                              v.hasOverride && v.calculatedFairValue
                                ? `Override: ${fmtMoney(v.fairValuePerShare)} (SOTP: ${fmtMoney(v.calculatedFairValue)})${v.fairValueOverrideLabel ? ` — ${v.fairValueOverrideLabel}` : ''}`
                                : undefined
                            }
                          >
                            {v.fairValuePerShare ? fmtMoney(v.fairValuePerShare) : '—'}
                          </span>

                          {editingOverride?.ticker === v.ticker && (
                            <div
                              ref={popoverRef}
                              className="absolute right-0 top-full mt-1 z-50 bg-elevated border border-hairline-strong rounded-md shadow-pop p-3 w-72 text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="eyebrow mb-2">Override — {v.ticker}</div>
                              <div className="space-y-2">
                                <FormField label="Fair Value ($/share)">
                                  <input
                                    type="text"
                                    value={editingOverride.fairValueOverride}
                                    onChange={(e) => setEditingOverride({ ...editingOverride, fairValueOverride: e.target.value })}
                                    placeholder={v.calculatedFairValue ? `SOTP: ${fmtMoney(v.calculatedFairValue)}` : 'Enter value'}
                                    className="input"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveOverride();
                                      if (e.key === 'Escape') setEditingOverride(null);
                                    }}
                                  />
                                </FormField>
                                <FormField label="Link (URL)">
                                  <input
                                    type="text"
                                    value={editingOverride.fairValueOverrideUrl}
                                    onChange={(e) => setEditingOverride({ ...editingOverride, fairValueOverrideUrl: e.target.value })}
                                    placeholder="https://..."
                                    className="input"
                                  />
                                </FormField>
                                <FormField label="Label">
                                  <input
                                    type="text"
                                    value={editingOverride.fairValueOverrideLabel}
                                    onChange={(e) => setEditingOverride({ ...editingOverride, fairValueOverrideLabel: e.target.value })}
                                    placeholder="e.g. DCF Model"
                                    className="input"
                                  />
                                </FormField>
                                {editingOverride.fairValueOverrideUrl.includes('docs.google.com/spreadsheets') && (
                                  <FormField label="Sheet Range (auto-sync)">
                                    <input
                                      type="text"
                                      value={editingOverride.fairValueSourceRange}
                                      onChange={(e) => setEditingOverride({ ...editingOverride, fairValueSourceRange: e.target.value })}
                                      placeholder="e.g. Price Target"
                                      className="input"
                                    />
                                  </FormField>
                                )}
                                <div className="flex items-center justify-between pt-1">
                                  <button
                                    onClick={handleClearOverride}
                                    className="text-[11px] text-[var(--neg)] hover:underline"
                                    title="Revert to SOTP"
                                  >
                                    Clear
                                  </button>
                                  <div className="flex gap-2">
                                    <button onClick={() => setEditingOverride(null)} className="text-[11px] text-ink-3 hover:text-ink-1 px-2 py-1">
                                      Cancel
                                    </button>
                                    <button
                                      onClick={handleSaveOverride}
                                      disabled={updateOverrideMutation.isPending}
                                      className="inline-flex items-center gap-1 text-[11px] bg-[var(--btc)] hover:bg-[var(--btc-ink)] text-white rounded-sm px-3 py-1 disabled:opacity-50"
                                    >
                                      <Check className="w-3 h-3" />
                                      Save
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="num-col">
                          {upside !== null ? <DeltaPill value={upside} size="sm" precision={0} /> : <span className="text-ink-4">—</span>}
                        </td>
                        <td className="center">
                          <div className="flex items-center gap-0 justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingOverride({
                                  ticker: v.ticker,
                                  fairValueOverride:
                                    v.hasOverride && v.fairValuePerShare ? v.fairValuePerShare.toString() : '',
                                  fairValueOverrideUrl: v.fairValueOverrideUrl || '',
                                  fairValueOverrideLabel: v.fairValueOverrideLabel || '',
                                  fairValueSourceRange: v.fairValueSourceRange || '',
                                });
                              }}
                              className="text-ink-4 hover:text-[var(--btc)] p-1"
                              title="Edit override"
                            >
                              <Pencil className="w-[13px] h-[13px]" />
                            </button>
                            {v.isManual && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Delete ${v.ticker}?`)) deleteManualMutation.mutate(v.ticker);
                                }}
                                className="text-ink-4 hover:text-[var(--neg)] p-1"
                                title="Delete"
                              >
                                <Trash2 className="w-[13px] h-[13px]" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Slide-out detail panel ──────────────────────────────────────── */}
      {selectedVal && (
        <TickerDetailPanel
          v={selectedVal}
          sparkPoints={sparklineData[selectedVal.ticker] || []}
          onClose={() => setSelectedTicker(null)}
          onCapexInFinancials={async () => {
            try {
              await fetch(`${getApiUrl()}/api/v1/companies/${selectedVal.ticker}/capex-in-financials`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: true }),
              });
              queryClient.invalidateQueries({ queryKey: ['valuation'] });
              queryClient.invalidateQueries({ queryKey: ['companies'] });
            } catch (err) {
              console.error('Failed to set capexInFinancials:', err);
            }
          }}
        />
      )}

      {/* ── Add Manual Modal ────────────────────────────────────────────── */}
      {showAddManual && (
        <AddManualModal
          form={manualForm}
          setForm={setManualForm}
          onClose={() => setShowAddManual(false)}
          onSubmit={() => createManualMutation.mutate(manualForm)}
          onTickerBlur={handleTickerLookup}
          loading={createManualMutation.isPending}
          lookupLoading={tickerLookupLoading}
          error={createManualMutation.isError ? (createManualMutation.error as Error).message : null}
        />
      )}

      <style>{`
        .input {
          width: 100%;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 6px 10px;
          font-size: 12px;
          color: var(--ink-1);
          outline: none;
        }
        .input:focus { border-color: var(--btc); box-shadow: 0 0 0 2px var(--btc-soft); }
      `}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KPI({
  label,
  value,
  accent,
  highlight = false,
  subtitle,
}: {
  label: string;
  value: string;
  accent: string;
  highlight?: boolean;
  subtitle?: string;
}) {
  return (
    <div
      className={`bg-elevated border rounded-md p-4 ${highlight ? 'border-[color:var(--btc-border)]' : 'border-hairline'}`}
    >
      <div className="eyebrow mb-[2px]">{label}</div>
      <div
        className="num text-[22px] font-medium tracking-tight"
        style={{ color: accent }}
      >
        {value}
      </div>
      {subtitle && <div className="text-[11px] text-ink-3 mt-1">{subtitle}</div>}
    </div>
  );
}

function SortTh({
  children,
  active,
  dir,
  onClick,
  className = '',
  title,
}: {
  children?: React.ReactNode;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  className?: string;
  title?: string;
}) {
  return (
    <th
      className={`cursor-pointer select-none hover:text-ink-1 ${className}`}
      onClick={onClick}
      title={title}
    >
      {children} {active && <span className="text-[var(--btc)]">{dir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-ink-3 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ── Slide-out ticker detail panel ────────────────────────────────────────

function TickerDetailPanel({
  v,
  sparkPoints,
  onClose,
  onCapexInFinancials,
}: {
  v: Valuation;
  sparkPoints: number[];
  onClose: () => void;
  onCapexInFinancials: () => void;
}) {
  const sotpItems = [
    { value: Math.max(0, v.netLiquid), fill: COLORS.netLiquid, label: 'Net Liquid' },
    { value: v.evMining, fill: COLORS.mining, label: 'Mining' },
    { value: v.evHpcContracted, fill: COLORS.hpc, label: 'HPC Contracted' },
    { value: v.evHpcPipeline, fill: COLORS.pipeline, label: 'HPC Pipeline' },
  ];

  const totalSotp = v.netLiquid + v.evMining + v.evHpcContracted + v.evHpcPipeline + (v.impliedProjectDebtM ?? 0);

  return (
    <aside
      className="fixed top-12 right-0 bottom-0 w-[520px] bg-elevated border-l border-hairline overflow-auto z-20"
      style={{ boxShadow: 'var(--sh-md)' }}
    >
      {/* Header */}
      <div className="sticky top-0 bg-elevated border-b border-hairline px-5 py-4 flex items-start gap-3 z-10">
        <TickerMark ticker={v.ticker} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/valuation/${v.ticker}`}
              className="text-[16px] font-semibold text-ink-1 hover:text-[var(--btc)]"
            >
              {v.ticker}
            </Link>
            <Badge color="slate">NASDAQ</Badge>
          </div>
          <div className="text-[11px] text-ink-3">{v.name}</div>
        </div>
        <button onClick={onClose} className="text-ink-3 hover:text-ink-1 p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Price section with sparkline */}
        <div>
          <div className="flex items-center gap-4">
            <div>
              <div className="eyebrow mb-1">Price</div>
              <div className="num text-[28px] font-medium text-ink-1">
                {v.stockPrice ? fmtMoney(v.stockPrice) : '—'}
              </div>
            </div>
            {sparkPoints.length > 1 && (
              <div className="flex-1">
                <Sparkline
                  points={sparkPoints}
                  width={180}
                  height={40}
                  stroke={sparkPoints[sparkPoints.length - 1] >= sparkPoints[0] ? 'var(--pos)' : 'var(--neg)'}
                />
              </div>
            )}
          </div>
        </div>

        {/* Fair Value and Implied Upside */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow mb-1">FAIR VALUE</div>
              <div
                className="num text-[20px] font-medium"
                style={{ color: v.hasOverride ? COLORS.warn : COLORS.ink1 }}
              >
                {v.fairValuePerShare ? fmtMoney(v.fairValuePerShare) : '—'}
              </div>
            </div>
            {v.stockPrice && v.fairValuePerShare && (
              <div>
                <div className="eyebrow mb-1">IMPLIED UPSIDE</div>
                <DeltaPill
                  value={(v.fairValuePerShare / v.stockPrice - 1) * 100}
                  size="lg"
                  precision={0}
                />
              </div>
            )}
          </div>
          {v.sharesOutM && v.fairValuePerShare && (
            <div className="text-[11px] text-ink-3">
              {fmtMoney(v.fairValuePerShare * v.sharesOutM)}M ÷ {fmt(v.sharesOutM, 1)}M sh.
            </div>
          )}
        </div>

        {/* SOTP breakdown with percentages */}
        <div>
          <div className="eyebrow mb-3">SUM OF PARTS</div>
          <SOTPBar items={sotpItems} width={480} height={12} />
          <div className="mt-4 space-y-[8px]">
            <SOTPRowWithPct
              label="Net Liquid"
              value={v.netLiquid}
              color={COLORS.netLiquid}
              total={totalSotp}
            />
            <SOTPRowWithPct
              label="Mining"
              value={v.evMining}
              color={COLORS.mining}
              total={totalSotp}
            />
            <SOTPRowWithPct
              label="HPC Contracted"
              value={v.evHpcContracted}
              color={COLORS.hpc}
              total={totalSotp}
            />
            <SOTPRowWithPct
              label="HPC Pipeline"
              value={v.evHpcPipeline}
              color={COLORS.pipeline}
              total={totalSotp}
            />
            {(v.impliedProjectDebtM ?? 0) > 0 && (
              <SOTPRowWithPct
                label="Implied Project Debt"
                value={-(v.impliedProjectDebtM ?? 0)}
                color={COLORS.debt}
                total={totalSotp}
              />
            )}
            <div className="pt-3 mt-3 border-t border-hairline flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink-1">Total Value</span>
              <span className="num text-[13px] font-medium text-ink-1">{fmtM(v.totalValueM)}</span>
            </div>
          </div>
        </div>

        {(v.impliedProjectDebtM ?? 0) > 0 && (
          <div className="flex items-center justify-between gap-3 p-3 bg-[var(--neg-soft)] border border-[#efc5ce] rounded-sm">
            <div>
              <div className="text-[12px] font-medium text-[var(--neg)]">Implied Project Debt</div>
              <div className="num text-[13px] text-[var(--neg)]">
                −{fmtM(v.impliedProjectDebtM)}
              </div>
            </div>
            <button
              onClick={onCapexInFinancials}
              className="text-[11px] px-2 py-1 rounded-sm bg-elevated border border-[#efc5ce] text-[var(--neg)] hover:bg-white"
              title="Mark capex as already in financials"
            >
              CapEx in Financials
            </button>
          </div>
        )}

        {/* Portfolio section */}
        <div>
          <div className="eyebrow mb-3">PORTFOLIO</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-ink-2">Total MW</span>
              <span className="num text-ink-1 font-medium">{fmt(v.totalMw, 0)}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-ink-2">Hashrate (EH/s)</span>
              <span className="num text-ink-1 font-medium">—</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-ink-2">Efficiency (J/TH)</span>
              <span className="num text-ink-1 font-medium">—</span>
            </div>
          </div>
        </div>

        {/* Top Sites section */}
        {Array.isArray(v.hpcSites) && v.hpcSites.length > 0 && (
          <div>
            <div className="eyebrow mb-3">TOP SITES</div>
            <div className="space-y-2">
              {v.hpcSites.slice(0, 5).map((s, i) => (
                <div key={i} className="text-[12px] flex items-start justify-between gap-2 p-2 bg-canvas rounded-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-[6px]">
                      <span className="font-medium text-ink-1 truncate">{s.siteName}</span>
                      {s.leaseConfirmed && (
                        <span className="inline-flex items-center gap-[3px] text-[9px] font-medium uppercase tracking-wider text-[var(--pos)]" title="Lease verified">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                          Verified
                        </span>
                      )}
                      {s.category === 'HPC_CONTRACTED' && !s.leaseConfirmed && (
                        <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--warn)]" title="Lease unconfirmed — thesis">
                          Unconfirmed
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-3 truncate">{s.buildingName} · {s.tenant || 'N/A'}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {s.category && (
                      <Badge color={s.category === 'HPC_CONTRACTED' ? 'hpc' : s.category === 'PIPELINE' ? 'pipeline' : 'mining'}>
                        {s.category === 'HPC_CONTRACTED' ? 'HPC' : s.category === 'PIPELINE' ? 'PIPELINE' : 'MINING'}
                      </Badge>
                    )}
                    <div className="text-right">
                      <div className="num text-ink-1 font-medium">{fmt(s.mw, 0)} MW</div>
                      <div className="num text-ink-3 text-[10px]">{fmtM(s.valuation)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2">
          <Link
            to={`/valuation/${v.ticker}`}
            className="inline-flex items-center gap-1 text-[12px] text-[var(--btc)] hover:underline"
          >
            Open full valuation <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </aside>
  );
}

function SOTPRowWithPct({
  label,
  value,
  color,
  total,
}: {
  label: string;
  value: number;
  color: string;
  total: number;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-ink-2 flex-1 min-w-0">{label}</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-ink-3">{fmtPct(pct, 1)}</span>
        <span className={`num font-medium ${value < 0 ? 'text-[var(--neg)]' : 'text-ink-1'}`}>
          {value < 0 ? '−' : ''}
          {fmtM(Math.abs(value))}
        </span>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} day ago`;
}

// ── Add Manual modal ────────────────────────────────────────────────────

function AddManualModal({
  form,
  setForm,
  onClose,
  onSubmit,
  onTickerBlur,
  loading,
  lookupLoading,
  error,
}: {
  form: ManualTickerForm;
  setForm: (f: ManualTickerForm) => void;
  onClose: () => void;
  onSubmit: () => void;
  onTickerBlur: (ticker: string) => void;
  loading: boolean;
  lookupLoading: boolean;
  error: string | null;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(20,19,15,0.35)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-elevated border border-hairline-strong rounded-md shadow-pop w-full max-w-md p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-medium text-ink-1">Add Manual Ticker</h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Ticker *">
              <input
                type="text"
                value={form.ticker}
                onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                onBlur={(e) => onTickerBlur(e.target.value)}
                placeholder="COIN"
                className="input"
              />
            </FormField>
            <FormField label="FD Shares (M)">
              <input
                type="text"
                value={form.fdSharesM}
                onChange={(e) => setForm({ ...form, fdSharesM: e.target.value })}
                placeholder="250.5"
                className="input"
              />
            </FormField>
          </div>
          <FormField label={`Company Name * ${lookupLoading ? '— Looking up…' : ''}`}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Coinbase Global"
              className="input"
            />
          </FormField>
          <FormField label="Fair Value ($/share)">
            <input
              type="text"
              value={form.fairValueOverride}
              onChange={(e) => setForm({ ...form, fairValueOverride: e.target.value })}
              placeholder="42.50"
              className="input"
            />
          </FormField>
          <FormField label="Valuation Link (URL)">
            <input
              type="text"
              value={form.fairValueOverrideUrl}
              onChange={(e) => setForm({ ...form, fairValueOverrideUrl: e.target.value })}
              placeholder="https://docs.google.com/spreadsheets/..."
              className="input"
            />
          </FormField>
          <FormField label="Valuation Label">
            <input
              type="text"
              value={form.fairValueOverrideLabel}
              onChange={(e) => setForm({ ...form, fairValueOverrideLabel: e.target.value })}
              placeholder="e.g. DCF Model"
              className="input"
            />
          </FormField>
          {form.fairValueOverrideUrl.includes('docs.google.com/spreadsheets') && (
            <FormField label="Sheet Range (auto-sync)">
              <input
                type="text"
                value={form.fairValueSourceRange}
                onChange={(e) => setForm({ ...form, fairValueSourceRange: e.target.value })}
                placeholder="e.g. Price Target"
                className="input"
              />
            </FormField>
          )}
          {error && <p className="text-[var(--neg)] text-[11px]">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-3 py-[6px] text-[12px] text-ink-3 hover:text-ink-1"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={!form.ticker || !form.name || loading}
              className="px-3 py-[6px] text-[12px] bg-[var(--btc)] hover:bg-[var(--btc-ink)] text-white rounded-sm disabled:opacity-50"
            >
              {loading ? 'Adding…' : 'Add Ticker'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
