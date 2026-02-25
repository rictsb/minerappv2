import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';

// Freshness indicator: 0 = not set, 1 = stale, 2 = kind-of, 3 = fresh
type Freshness = 0 | 1 | 2 | 3;
const FRESHNESS_CONFIG: Record<Freshness, { color: string; bg: string; label: string; icon: string }> = {
  0: { color: 'text-gray-600', bg: 'bg-gray-700', label: 'Not set', icon: '○' },
  1: { color: 'text-red-400', bg: 'bg-red-900/60', label: 'Stale', icon: '●' },
  2: { color: 'text-yellow-400', bg: 'bg-yellow-900/60', label: 'Partial', icon: '●' },
  3: { color: 'text-green-400', bg: 'bg-green-900/60', label: 'Current', icon: '●' },
};


function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  return apiUrl;
}

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
}

interface Valuation {
  ticker: string;
  name: string;
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

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(() => {
    const saved = localStorage.getItem('lastPriceRefresh');
    return saved ? new Date(saved) : null;
  });

  // Freshness state — persisted to localStorage
  const [freshness, setFreshness] = useState<Record<string, Freshness>>(() => {
    const saved = localStorage.getItem('dashboard-freshness');
    return saved ? JSON.parse(saved) : {};
  });
  const [sortKey, setSortKey] = useState<'ticker' | 'freshness' | 'upside' | 'fairValue'>('ticker');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const updateFreshness = useCallback((ticker: string) => {
    setFreshness(prev => {
      const current = prev[ticker] || 0;
      const next = ((current + 1) % 4) as Freshness;
      const updated = { ...prev, [ticker]: next };
      localStorage.setItem('dashboard-freshness', JSON.stringify(updated));
      return updated;
    });
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

  const refreshPricesMutation = useMutation({
    mutationFn: async () => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/stock-prices/refresh`, {
        method: 'POST',
      });
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
      setTimeout(() => setRefreshMessage(null), 3000);
    },
    onError: (error: Error) => {
      setRefreshMessage(`Error: ${error.message}`);
      setTimeout(() => setRefreshMessage(null), 3000);
    },
  });

  const factors = valData?.factors;

  const handleSort = useCallback((key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'ticker' ? 'asc' : 'desc');
    }
  }, [sortKey]);

  const valuations = useMemo(() => {
    const raw = valData?.valuations || [];
    return [...raw].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'ticker') {
        cmp = a.ticker.localeCompare(b.ticker);
      } else if (sortKey === 'freshness') {
        cmp = (freshness[a.ticker] || 0) - (freshness[b.ticker] || 0);
      } else if (sortKey === 'upside') {
        const uA = a.stockPrice && a.fairValuePerShare ? (a.fairValuePerShare / a.stockPrice - 1) : -999;
        const uB = b.stockPrice && b.fairValuePerShare ? (b.fairValuePerShare / b.stockPrice - 1) : -999;
        cmp = uA - uB;
      } else if (sortKey === 'fairValue') {
        cmp = (a.fairValuePerShare || 0) - (b.fairValuePerShare || 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [valData?.valuations, sortKey, sortDir, freshness]);

  // Calculate totals
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/50 text-red-400 rounded">
        Error loading data: {(error as Error).message}
      </div>
    );
  }

  const formatNumber = (num: number | null | undefined, decimals = 0) => {
    if (num == null || isNaN(num)) return '-';
    return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatMoney = (num: number | null | undefined, decimals = 2) => {
    if (num == null || isNaN(num)) return '-';
    return `$${formatNumber(num, decimals)}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-300">BTC Miner Valuation Terminal</h1>
          {factors && (
            <p className="text-xs text-gray-500 mt-1">
              BTC ${formatNumber(factors.btcPrice)} • HPC Contracted ${factors.mwValueHpcContracted}M/MW • Pipeline ${factors.mwValueHpcUncontracted}M/MW
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {refreshMessage && (
            <span className={`text-sm ${refreshMessage.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
              {refreshMessage}
            </span>
          )}
          {lastRefresh && !refreshMessage && (
            <span className="text-xs text-gray-500">
              Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' · '}
              {lastRefresh.toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          )}
          <button
            onClick={() => refreshPricesMutation.mutate()}
            disabled={refreshPricesMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshPricesMutation.isPending ? 'animate-spin' : ''}`} />
            {refreshPricesMutation.isPending ? 'Refreshing...' : 'Refresh Prices'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={`grid grid-cols-1 gap-4 mb-6 ${totals.impliedProjectDebt > 0 ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Mining EV</p>
          <p className="text-2xl font-bold text-orange-500">${formatNumber(totals.evMining)}M</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">HPC Contracted EV</p>
          <p className="text-2xl font-bold text-purple-400">${formatNumber(totals.evHpcContracted)}M</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">HPC Pipeline EV</p>
          <p className="text-2xl font-bold text-purple-300">${formatNumber(totals.evHpcPipeline)}M</p>
        </div>
        {totals.impliedProjectDebt > 0 && (
          <div className="bg-gray-800 border border-rose-900/50 rounded-lg p-4">
            <p className="text-xs text-rose-400 uppercase tracking-wider mb-1">Implied Project Debt</p>
            <p className="text-2xl font-bold text-rose-400">−${formatNumber(totals.impliedProjectDebt)}M</p>
          </div>
        )}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total EV</p>
          <p className="text-2xl font-bold text-orange-500">${formatNumber(totals.totalEv)}M</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-200" onClick={() => handleSort('ticker')}>
                  Ticker {sortKey === 'ticker' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-200" onClick={() => handleSort('freshness')} title="Data freshness">
                  {sortKey === 'freshness' ? (sortDir === 'asc' ? '▲' : '▼') : '⬤'}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Mkt Cap</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Net Liquid</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">IT MW</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-orange-500 uppercase tracking-wider" colSpan={3}>
                  Enterprise Value ($M)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-200" onClick={() => handleSort('fairValue')}>
                  Fair Value {sortKey === 'fairValue' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-200" onClick={() => handleSort('upside')}>
                  Upside {sortKey === 'upside' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">$/MW/yr</th>
              </tr>
              <tr className="border-b border-gray-600 bg-gray-800/50">
                <th className="px-4 py-2"></th>
                <th className="px-2 py-2"></th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2 text-right text-xs font-normal text-orange-400/70">Mining</th>
                <th className="px-4 py-2 text-right text-xs font-normal text-purple-400/70">Contracted</th>
                <th className="px-4 py-2 text-right text-xs font-normal text-purple-300/70">Pipeline</th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {valuations.map((v) => {
                // Calculate upside: (Fair Value Per Share / Stock Price - 1) * 100
                const upside = v.stockPrice && v.stockPrice > 0 && v.fairValuePerShare
                  ? ((v.fairValuePerShare / v.stockPrice) - 1) * 100
                  : null;
                // Market cap ($M) — uses basic shares outstanding (not FD)
                const sharesForMktCap = v.sharesOutM || v.fdSharesM;
                const marketCapM = v.stockPrice && sharesForMktCap ? v.stockPrice * sharesForMktCap : null;
                // $/MW/yr: total HPC NOI / total contracted MW
                const totalHpcNoi = v.hpcSites?.reduce((sum, s) => sum + (s.noiAnnualM || 0), 0) || 0;
                const totalHpcMw = v.hpcSites?.reduce((sum, s) => sum + (s.mw || 0), 0) || 0;
                const dollarPerMwYr = totalHpcMw > 0 ? totalHpcNoi / totalHpcMw : null;
                const isExpanded = expandedTickers.has(v.ticker);
                const toggleExpand = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setExpandedTickers(prev => {
                    const next = new Set(prev);
                    if (next.has(v.ticker)) next.delete(v.ticker);
                    else next.add(v.ticker);
                    return next;
                  });
                };

                return (
                  <React.Fragment key={v.ticker}>
                    <tr
                      className="hover:bg-gray-700/50 cursor-pointer transition"
                      onClick={toggleExpand}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                          <span className="font-medium text-orange-500">{v.ticker}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center">
                        {(() => {
                          const f = freshness[v.ticker] || 0;
                          const cfg = FRESHNESS_CONFIG[f as Freshness];
                          return (
                            <button
                              onClick={(e) => { e.stopPropagation(); updateFreshness(v.ticker); }}
                              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-sm leading-none transition-all hover:ring-2 hover:ring-gray-500 ${cfg.color}`}
                              title={`${cfg.label} — click to cycle`}
                            >
                              {cfg.icon}
                            </button>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-green-400 cursor-help" title={marketCapM != null ? `Mkt Cap: $${formatNumber(marketCapM, 0)}M` : v.stockPrice ? 'Mkt Cap: shares outstanding not set' : undefined}>
                        {v.stockPrice ? formatMoney(v.stockPrice) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-300">
                        {marketCapM ? `$${formatNumber(marketCapM, 0)}M` : '-'}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${v.netLiquid >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatNumber(v.netLiquid, 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-cyan-400">
                        {v.totalMw > 0 ? formatNumber(v.totalMw, 0) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-orange-400">
                        {v.evMining > 0 ? formatNumber(v.evMining, 0) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-purple-400">
                        {v.evHpcContracted > 0 ? formatNumber(v.evHpcContracted, 0) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-purple-300">
                        {v.evHpcPipeline > 0 ? formatNumber(v.evHpcPipeline, 0) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-orange-500 font-semibold cursor-help" title={`SOTP: $${formatNumber(v.totalValueM, 0)}M (Net Liq: ${formatNumber(v.netLiquid, 0)} + EV: ${formatNumber(v.totalEv, 0)}${(v.impliedProjectDebtM ?? 0) > 0 ? ` − Debt: ${formatNumber(v.impliedProjectDebtM, 0)}` : ''})${v.fdSharesM ? ` ÷ ${formatNumber(v.fdSharesM, 1)}M FD shares` : ''}`}>
                        {v.fairValuePerShare ? formatMoney(v.fairValuePerShare) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {upside !== null ? (
                          <div className="flex items-center justify-end gap-1">
                            {upside >= 0 ? (
                              <TrendingUp className="w-4 h-4 text-green-400" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-400" />
                            )}
                            <span className={`font-mono font-semibold ${upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {upside >= 0 ? '+' : ''}{formatNumber(upside, 0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-cyan-300">
                        {dollarPerMwYr !== null ? `$${formatNumber(dollarPerMwYr, 2)}M` : '-'}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-850">
                        <td colSpan={12} className="px-6 py-4 bg-gray-800/60">
                          {/* Summary stats */}
                          <div className="flex items-center gap-8 mb-3 text-xs">
                            <div>
                              <span className="text-gray-500">Shares Out:</span>{' '}
                              <span className="font-mono text-gray-300">
                                {v.sharesOutM ? `${formatNumber(v.sharesOutM, 1)}M` : '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">FD Shares:</span>{' '}
                              <span className="font-mono text-gray-300">
                                {v.fdSharesM ? `${formatNumber(v.fdSharesM, 1)}M` : '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Total Lease Value:</span>{' '}
                              <span className="font-mono text-purple-400">
                                {(v.totalLeaseValueM ?? 0) > 0 ? `$${formatNumber(v.totalLeaseValueM, 0)}M` : '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Total Value:</span>{' '}
                              <span className="font-mono text-orange-500">
                                ${formatNumber(v.totalValueM ?? (v.totalEv + (v.netLiquid ?? 0)), 0)}M
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Net Liquidity:</span>{' '}
                              <span className={`font-mono ${(v.netLiquid ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                ${formatNumber(v.netLiquid ?? 0, 0)}M
                              </span>
                            </div>
                            {(v.impliedProjectDebtM ?? 0) > 0 && (
                              <div className="flex items-center gap-3">
                                <div>
                                  <span className="text-gray-500">Implied Project Debt:</span>{' '}
                                  <span className="font-mono text-rose-400">
                                    −${formatNumber(v.impliedProjectDebtM ?? 0, 0)}M
                                  </span>
                                </div>
                                <button
                                  className="text-[10px] px-2 py-0.5 rounded bg-rose-900/40 text-rose-300 hover:bg-rose-800/60 transition-colors"
                                  title="Mark all buildings' capex as already in reported financials — removes implied project debt"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await fetch(`${getApiUrl()}/api/v1/companies/${v.ticker}/capex-in-financials`, {
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
                                >
                                  CapEx in Financials
                                </button>
                              </div>
                            )}
                          </div>
                          {/* Valued Sites detail table */}
                          {Array.isArray(v.hpcSites) && v.hpcSites.length > 0 ? (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-700">
                                  <th className="py-1.5 text-left text-gray-500 font-medium">Site</th>
                                  <th className="py-1.5 text-left text-gray-500 font-medium">Building</th>
                                  <th className="py-1.5 text-left text-gray-500 font-medium">Type</th>
                                  <th className="py-1.5 text-left text-gray-500 font-medium">Tenant</th>
                                  <th className="py-1.5 text-left text-gray-500 font-medium">Phase</th>
                                  <th className="py-1.5 text-right text-gray-500 font-medium">MW</th>
                                  <th className="py-1.5 text-right text-gray-500 font-medium">Lease Value ($M)</th>
                                  <th className="py-1.5 text-right text-gray-500 font-medium">NOI ($M/yr)</th>
                                  <th className="py-1.5 text-right text-gray-500 font-medium">Valuation ($M)</th>
                                  <th className="py-1.5 text-right text-gray-500 font-medium">$/MW/yr</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-700/50">
                                {v.hpcSites.map((site, i) => {
                                  const siteNoiPerMw = site.mw > 0 && site.noiAnnualM > 0 ? site.noiAnnualM / site.mw : null;
                                  const catLabel = site.category === 'MINING' ? 'Mining' :
                                    site.category === 'HPC_CONTRACTED' ? 'HPC' :
                                    site.category === 'PIPELINE' ? 'Pipeline' : '-';
                                  const catColor = site.category === 'MINING' ? 'bg-orange-900/50 text-orange-400' :
                                    site.category === 'HPC_CONTRACTED' ? 'bg-cyan-900/50 text-cyan-400' :
                                    site.category === 'PIPELINE' ? 'bg-purple-900/50 text-purple-400' :
                                    'bg-gray-700 text-gray-400';
                                  return (
                                  <tr key={i} className="hover:bg-gray-700/30">
                                    <td className="py-1.5 text-gray-300">{site.siteName}</td>
                                    <td className="py-1.5 text-gray-400">{site.buildingName}</td>
                                    <td className="py-1.5">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${catColor}`}>
                                        {catLabel}
                                      </span>
                                    </td>
                                    <td className="py-1.5 text-cyan-400">{site.tenant || '-'}</td>
                                    <td className="py-1.5">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                        site.phase === 'OPERATIONAL' ? 'bg-green-900/50 text-green-400' :
                                        site.phase === 'CONSTRUCTION' ? 'bg-yellow-900/50 text-yellow-400' :
                                        site.phase === 'DEVELOPMENT' ? 'bg-blue-900/50 text-blue-400' :
                                        'bg-gray-700 text-gray-400'
                                      }`}>
                                        {site.phase}
                                      </span>
                                    </td>
                                    <td className="py-1.5 text-right font-mono text-gray-300">{formatNumber(site.mw, 0)}</td>
                                    <td className="py-1.5 text-right font-mono text-purple-400">
                                      {site.leaseValueM > 0 ? formatNumber(site.leaseValueM, 0) : '-'}
                                    </td>
                                    <td className="py-1.5 text-right font-mono text-gray-300">
                                      {site.noiAnnualM > 0 ? formatNumber(site.noiAnnualM, 1) : '-'}
                                    </td>
                                    <td className="py-1.5 text-right font-mono text-orange-400">
                                      {formatNumber(site.valuation, 0)}
                                    </td>
                                    <td className="py-1.5 text-right font-mono text-cyan-300">
                                      {siteNoiPerMw !== null ? `$${formatNumber(siteNoiPerMw, 2)}M` : '-'}
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-xs text-gray-500 italic">No valued sites</p>
                          )}
                          <div className="mt-2">
                            <Link
                              to={`/projects?ticker=${v.ticker}`}
                              className="text-xs text-orange-400/70 hover:text-orange-400 transition"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View all sites →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {valuations.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center py-8 text-gray-500">
                    No companies found. Import data to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-orange-500" />
          <span>Mining Operations</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-400" />
          <span>HPC/AI Contracted</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-300" />
          <span>HPC/AI Pipeline</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-cyan-300" />
          <span>$/MW/yr (NOI)</span>
        </div>
      </div>
    </div>
  );
}
