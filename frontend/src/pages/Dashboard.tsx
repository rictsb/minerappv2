import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  return apiUrl;
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
  const navigate = useNavigate();
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

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

  const formatNumber = (num: number, decimals = 0) => {
    return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatMoney = (num: number, decimals = 2) => {
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

                return (
                  <tr
                    key={v.ticker}
                    className="hover:bg-gray-700/50 cursor-pointer transition"
                    onClick={() => navigate('/projects')}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-orange-500">{v.ticker}</span>
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
