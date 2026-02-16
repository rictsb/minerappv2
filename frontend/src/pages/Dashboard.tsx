import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';


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
}

interface Valuation {
  ticker: string;
  name: string;
  stockPrice: number | null;
  fdSharesM: number | null;
  netLiquid: number;
  totalMw: number;
  evMining: number;
  evHpcContracted: number;
  evHpcPipeline: number;
  evGpu: number;
  totalEv: number;
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

  const valuations = valData?.valuations || [];
  const factors = valData?.factors;

  // Calculate totals
  const totals = valuations.reduce(
    (acc, v) => ({
      evMining: acc.evMining + v.evMining,
      evHpcContracted: acc.evHpcContracted + v.evHpcContracted,
      evHpcPipeline: acc.evHpcPipeline + v.evHpcPipeline,
      evGpu: acc.evGpu + v.evGpu,
      totalEv: acc.totalEv + v.totalEv,
    }),
    { evMining: 0, evHpcContracted: 0, evHpcPipeline: 0, evGpu: 0, totalEv: 0 }
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Ticker</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Net Liquid</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">IT MW</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-orange-500 uppercase tracking-wider" colSpan={4}>
                  Enterprise Value ($M)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Fair Value</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Upside</th>
              </tr>
              <tr className="border-b border-gray-600 bg-gray-800/50">
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2 text-right text-xs font-normal text-orange-400/70">Mining</th>
                <th className="px-4 py-2 text-right text-xs font-normal text-purple-400/70">Contracted</th>
                <th className="px-4 py-2 text-right text-xs font-normal text-purple-300/70">Pipeline</th>
                <th className="px-4 py-2 text-right text-xs font-normal text-blue-400/70">GPU</th>
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
                      <td className="px-4 py-3 text-right font-mono text-green-400">
                        {v.stockPrice ? formatMoney(v.stockPrice) : '-'}
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
                      <td className="px-4 py-3 text-right font-mono text-blue-400">
                        {v.evGpu > 0 ? formatNumber(v.evGpu, 0) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-orange-500 font-semibold">
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
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-850">
                        <td colSpan={10} className="px-6 py-4 bg-gray-800/60">
                          {/* Summary stats */}
                          <div className="flex items-center gap-8 mb-3 text-xs">
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
                                {v.totalValueM != null ? `$${formatNumber(v.totalValueM, 0)}M` : '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Net Liquidity:</span>{' '}
                              <span className={`font-mono ${(v.netLiquid ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {v.netLiquid != null ? `$${formatNumber(v.netLiquid, 0)}M` : '-'}
                              </span>
                            </div>
                          </div>
                          {/* HPC Sites detail table */}
                          {Array.isArray(v.hpcSites) && v.hpcSites.length > 0 ? (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-700">
                                  <th className="py-1.5 text-left text-gray-500 font-medium">Site</th>
                                  <th className="py-1.5 text-left text-gray-500 font-medium">Building</th>
                                  <th className="py-1.5 text-left text-gray-500 font-medium">Tenant</th>
                                  <th className="py-1.5 text-left text-gray-500 font-medium">Phase</th>
                                  <th className="py-1.5 text-right text-gray-500 font-medium">MW</th>
                                  <th className="py-1.5 text-right text-gray-500 font-medium">Lease Value ($M)</th>
                                  <th className="py-1.5 text-right text-gray-500 font-medium">NOI ($M/yr)</th>
                                  <th className="py-1.5 text-right text-gray-500 font-medium">Valuation ($M)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-700/50">
                                {v.hpcSites.map((site, i) => (
                                  <tr key={i} className="hover:bg-gray-700/30">
                                    <td className="py-1.5 text-gray-300">{site.siteName}</td>
                                    <td className="py-1.5 text-gray-400">{site.buildingName}</td>
                                    <td className="py-1.5 text-cyan-400">{site.tenant || '-'}</td>
                                    <td className="py-1.5">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                        site.phase === 'Operating' ? 'bg-green-900/50 text-green-400' :
                                        site.phase === 'Under Construction' ? 'bg-yellow-900/50 text-yellow-400' :
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
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-xs text-gray-500 italic">No contracted HPC sites</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {valuations.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-500">
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
          <div className="w-3 h-3 rounded bg-blue-400" />
          <span>GPU Cloud</span>
        </div>
      </div>
    </div>
  );
}
