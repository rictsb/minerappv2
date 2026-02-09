import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Helper to get API URL
function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  return apiUrl;
}

// Placeholder BTC price - will be from factors later
const BTC_PRICE = 97000;

interface Company {
  ticker: string;
  name: string;
  stockPrice: string | null;
  btcHoldings: string | null;
  cashM: string | null;
  debtM: string | null;
  fdSharesM: string | null;
  hashrateEh: string | null;
  sites: Site[];
}

interface Site {
  id: string;
  name: string;
  phases: Phase[];
}

interface Phase {
  id: string;
  name: string;
  status: string;
  grossMw: string | null;
  currentUse: string;
  tenancies: Tenancy[];
}

interface Tenancy {
  id: string;
  useType: string;
  leaseValueM: string | null;
  miningEbitdaAnnualM: string | null;
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const { data: companies, isLoading, error } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/companies`);
      if (!res.ok) throw new Error('Failed to fetch companies');
      return res.json() as Promise<Company[]>;
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
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setTimeout(() => setRefreshMessage(null), 3000);
    },
    onError: (error: Error) => {
      setRefreshMessage(`Error: ${error.message}`);
      setTimeout(() => setRefreshMessage(null), 3000);
    },
  });

  // Calculate company metrics
  const calculateMetrics = (company: Company) => {
    const stockPrice = company.stockPrice ? parseFloat(company.stockPrice) : 0;
    const btcHoldings = company.btcHoldings ? parseFloat(company.btcHoldings) : 0;
    const cashM = company.cashM ? parseFloat(company.cashM) : 0;
    const debtM = company.debtM ? parseFloat(company.debtM) : 0;
    const fdSharesM = company.fdSharesM ? parseFloat(company.fdSharesM) : 0;

    // Net Liquid = Cash + BTC Value - Debt
    const btcValueM = (btcHoldings * BTC_PRICE) / 1_000_000;
    const netLiquidM = cashM + btcValueM - debtM;

    // MW Capacity by type
    let miningMw = 0;
    let hpcMw = 0;
    let miningEvM = 0;
    let contractedEvM = 0;
    let pipelineEvM = 0;
    let gpuEvM = 0;

    company.sites?.forEach((site) => {
      site.phases?.forEach((phase) => {
        const grossMw = phase.grossMw ? parseFloat(phase.grossMw) : 0;
        const isOperational = phase.status === 'OPERATIONAL' || phase.status === 'PARTIALLY_ONLINE';
        const isContracted = phase.status === 'CONTRACTED' || phase.status === 'UNDER_CONSTRUCTION';
        const isPipeline = phase.status === 'PIPELINE' || phase.status === 'OPTION' || phase.status === 'DISCUSSION';

        // Categorize MW by use type
        if (phase.currentUse === 'BTC_MINING') {
          miningMw += grossMw;
          // Simple EV estimate: $1M per MW for mining (placeholder)
          if (isOperational) miningEvM += grossMw * 1;
          else if (isContracted) contractedEvM += grossMw * 0.8;
          else if (isPipeline) pipelineEvM += grossMw * 0.5;
        } else if (phase.currentUse === 'HPC_LEASE' || phase.currentUse === 'COLOCATION') {
          hpcMw += grossMw;
          // HPC valued higher: $3M per MW (placeholder)
          if (isOperational) contractedEvM += grossMw * 3;
          else if (isContracted) contractedEvM += grossMw * 2.5;
          else if (isPipeline) pipelineEvM += grossMw * 1.5;
        } else if (phase.currentUse === 'GPU_CLOUD') {
          hpcMw += grossMw;
          // GPU Cloud: $4M per MW (placeholder)
          if (isOperational) gpuEvM += grossMw * 4;
          else if (isContracted) gpuEvM += grossMw * 3;
          else if (isPipeline) pipelineEvM += grossMw * 2;
        } else {
          // Mixed/Development
          if (isOperational) miningEvM += grossMw * 0.5;
          else if (isPipeline) pipelineEvM += grossMw * 0.3;
        }
      });
    });

    // Total EV and Fair Value
    const totalEvM = miningEvM + contractedEvM + pipelineEvM + gpuEvM + netLiquidM;
    const fairValue = fdSharesM > 0 ? totalEvM / fdSharesM : 0;
    const upside = stockPrice > 0 ? ((fairValue - stockPrice) / stockPrice) * 100 : 0;

    return {
      stockPrice,
      btcHoldings,
      netLiquidM,
      miningMw,
      hpcMw,
      miningEvM,
      contractedEvM,
      pipelineEvM,
      gpuEvM,
      totalEvM,
      fairValue,
      upside,
    };
  };

  // Calculate totals
  const totals = companies?.reduce(
    (acc, company) => {
      const metrics = calculateMetrics(company);
      return {
        btcHoldings: acc.btcHoldings + metrics.btcHoldings,
        miningEvM: acc.miningEvM + metrics.miningEvM,
        contractedEvM: acc.contractedEvM + metrics.contractedEvM,
        pipelineEvM: acc.pipelineEvM + metrics.pipelineEvM,
        gpuEvM: acc.gpuEvM + metrics.gpuEvM,
      };
    },
    { btcHoldings: 0, miningEvM: 0, contractedEvM: 0, pipelineEvM: 0, gpuEvM: 0 }
  ) || { btcHoldings: 0, miningEvM: 0, contractedEvM: 0, pipelineEvM: 0, gpuEvM: 0 };

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
        <h1 className="text-xl font-semibold text-gray-300">BTC Miner Valuation Terminal</h1>
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
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total BTC Holdings</p>
          <p className="text-2xl font-bold text-orange-500">{formatNumber(totals.btcHoldings)}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Mining EV</p>
          <p className="text-2xl font-bold text-orange-500">${formatNumber(totals.miningEvM)}M</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">HPC Contracted EV</p>
          <p className="text-2xl font-bold text-orange-500">${formatNumber(totals.contractedEvM)}M</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Pipeline EV</p>
          <p className="text-2xl font-bold text-orange-500">${formatNumber(totals.pipelineEvM)}M</p>
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
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider" colSpan={2}>
                  MW Capacity
                </th>
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
                <th className="px-4 py-2 text-right text-xs font-normal text-gray-500">Mining</th>
                <th className="px-4 py-2 text-right text-xs font-normal text-gray-500">HPC</th>
                <th className="px-4 py-2 text-right text-xs font-normal text-orange-400/70">Mining</th>
                <th className="px-4 py-2 text-right text-xs font-normal text-orange-400/70">Contracted</th>
                <th className="px-4 py-2 text-right text-xs font-normal text-orange-400/70">Pipeline</th>
                <th className="px-4 py-2 text-right text-xs font-normal text-orange-400/70">GPU</th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {companies?.map((company) => {
                const metrics = calculateMetrics(company);

                return (
                  <tr
                    key={company.ticker}
                    className={`hover:bg-gray-700/50 cursor-pointer transition ${selectedTicker === company.ticker ? 'bg-gray-700/30' : ''}`}
                    onClick={() => setSelectedTicker(company.ticker === selectedTicker ? null : company.ticker)}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${company.ticker}`);
                        }}
                        className="font-medium text-orange-500 hover:text-orange-400 hover:underline"
                      >
                        {company.ticker}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-green-400">
                      {metrics.stockPrice > 0 ? formatMoney(metrics.stockPrice) : '-'}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${metrics.netLiquidM >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatNumber(metrics.netLiquidM, 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-300">
                      {metrics.miningMw > 0 ? formatNumber(metrics.miningMw, 0) : '0'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-300">
                      {metrics.hpcMw > 0 ? formatNumber(metrics.hpcMw, 0) : '0'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-orange-400">
                      {metrics.miningEvM > 0 ? formatNumber(metrics.miningEvM, 0) : '0'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-orange-400">
                      {metrics.contractedEvM > 0 ? formatNumber(metrics.contractedEvM, 0) : '0'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-orange-400">
                      {metrics.pipelineEvM > 0 ? formatNumber(metrics.pipelineEvM, 0) : '0'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-orange-400">
                      {metrics.gpuEvM > 0 ? formatNumber(metrics.gpuEvM, 0) : '0'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-orange-500 font-semibold">
                      {metrics.fairValue > 0 ? formatMoney(metrics.fairValue) : '-'}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${metrics.upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {metrics.stockPrice > 0 ? `${metrics.upside >= 0 ? '+' : ''}${formatNumber(metrics.upside, 0)}%` : '-'}
                    </td>
                  </tr>
                );
              })}
              {(!companies || companies.length === 0) && (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-gray-500">
                    No companies found. Import data to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Company Detail Panel */}
      {selectedTicker && (
        <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center gap-4 mb-4">
            <BarChart3 className="text-orange-500" size={24} />
            <h2 className="text-lg font-semibold text-gray-200">
              {companies?.find(c => c.ticker === selectedTicker)?.name || selectedTicker}
            </h2>
          </div>
          <p className="text-gray-400 text-sm">
            Click a ticker to view company details in the Projects page.
          </p>
        </div>
      )}
    </div>
  );
}
