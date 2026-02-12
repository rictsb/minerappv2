import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, X, Trash2, Edit2, Wallet, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  return apiUrl;
}

interface NetLiquidAsset {
  id: string;
  ticker: string;
  cashM: string | null;
  btcCount: string | null;
  ethCount: string | null;
  totalDebtM: string | null;
  sourceDate: string | null;
  notes: string | null;
}

const emptyRow: Partial<NetLiquidAsset> = {
  ticker: '',
  cashM: '',
  btcCount: '',
  ethCount: '0',
  totalDebtM: '',
  notes: '',
};

export default function NetLiquidAssets() {
  const queryClient = useQueryClient();
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<NetLiquidAsset>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRow, setNewRow] = useState<Partial<NetLiquidAsset>>(emptyRow);

  // Fetch global factors from centralized settings
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/api/v1/settings`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
  });

  // Get prices from global settings with defaults
  const prices = useMemo(() => ({
    btcPrice: settings?.btcPrice ?? 97000,
    ethPrice: settings?.ethPrice ?? 2500,
  }), [settings]);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['net-liquid-assets'],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/api/v1/net-liquid-assets`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<NetLiquidAsset[]>;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<NetLiquidAsset>) => {
      const res = await fetch(`${getApiUrl()}/api/v1/net-liquid-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['net-liquid-assets'] });
      setEditingTicker(null);
      setShowAddForm(false);
      setNewRow(emptyRow);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ticker: string) => {
      const res = await fetch(`${getApiUrl()}/api/v1/net-liquid-assets/${ticker}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['net-liquid-assets'] });
    },
  });

  // Calculate derived values for each row
  const calculatedData = useMemo(() => {
    return assets.map((row) => {
      const cash = parseFloat(row.cashM || '0') || 0;
      const btcCount = parseFloat(row.btcCount || '0') || 0;
      const ethCount = parseFloat(row.ethCount || '0') || 0;
      const totalDebt = parseFloat(row.totalDebtM || '0') || 0;

      // BTC Value = BTC_Count × BTC Price / 1M
      const btcValueM = (btcCount * prices.btcPrice) / 1_000_000;

      // ETH Value = ETH_Count × ETH Price / 1M
      const ethValueM = (ethCount * prices.ethPrice) / 1_000_000;

      // Total Liquid = Cash + BTC + ETH
      const totalLiquidM = cash + btcValueM + ethValueM;

      // Net Liquid = Total Liquid − Total Debt
      const netLiquidM = totalLiquidM - totalDebt;

      return {
        ...row,
        btcValueM,
        ethValueM,
        totalLiquidM,
        netLiquidM,
      };
    });
  }, [assets, prices]);

  // Calculate totals
  const totals = useMemo(() => {
    return calculatedData.reduce(
      (acc, row) => ({
        cashM: acc.cashM + (parseFloat(row.cashM || '0') || 0),
        btcCount: acc.btcCount + (parseFloat(row.btcCount || '0') || 0),
        btcValueM: acc.btcValueM + row.btcValueM,
        ethCount: acc.ethCount + (parseFloat(row.ethCount || '0') || 0),
        ethValueM: acc.ethValueM + row.ethValueM,
        totalLiquidM: acc.totalLiquidM + row.totalLiquidM,
        totalDebtM: acc.totalDebtM + (parseFloat(row.totalDebtM || '0') || 0),
        netLiquidM: acc.netLiquidM + row.netLiquidM,
      }),
      { cashM: 0, btcCount: 0, btcValueM: 0, ethCount: 0, ethValueM: 0, totalLiquidM: 0, totalDebtM: 0, netLiquidM: 0 }
    );
  }, [calculatedData]);

  const startEdit = (row: NetLiquidAsset) => {
    setEditingTicker(row.ticker);
    setEditForm({ ...row });
  };

  const saveEdit = () => saveMutation.mutate(editForm);
  const saveNew = () => {
    if (!newRow.ticker) return;
    saveMutation.mutate(newRow);
  };

  const formatNum = (val: number | string | null | undefined, decimals = 0) => {
    if (val == null) return '-';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '-';
    return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-6 w-6 text-blue-500" />
            <h1 className="text-2xl font-bold">Net Liquid Assets</h1>
            <span className="text-sm text-gray-500">Cash + Crypto Holdings - Debt</span>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Company
          </button>
        </div>

        {/* Price Banner - Link to Factors */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-gray-400">Using global prices:</span>
            <span className="text-orange-400">BTC: <span className="font-mono">${prices.btcPrice.toLocaleString()}</span></span>
            <span className="text-purple-400">ETH: <span className="font-mono">${prices.ethPrice.toLocaleString()}</span></span>
          </div>
          <Link to="/factors" className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300">
            Edit in Factors <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* Table */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-3 py-3 text-left">Ticker</th>
                  <th className="px-3 py-3 text-right bg-blue-900/20">Cash ($M)</th>
                  <th className="px-3 py-3 text-right bg-orange-900/20">BTC Count</th>
                  <th className="px-3 py-3 text-right">BTC Value ($M)</th>
                  <th className="px-3 py-3 text-right bg-purple-900/20">ETH Count</th>
                  <th className="px-3 py-3 text-right">ETH Value ($M)</th>
                  <th className="px-3 py-3 text-right text-cyan-400">Total Liquid ($M)</th>
                  <th className="px-3 py-3 text-right bg-red-900/20">Total Debt ($M)</th>
                  <th className="px-3 py-3 text-right text-yellow-400 font-bold">Net Liquid ($M)</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {/* Add new row */}
                {showAddForm && (
                  <tr className="bg-blue-900/20">
                    <td className="px-3 py-2">
                      <input type="text" value={newRow.ticker || ''} onChange={(e) => setNewRow({ ...newRow, ticker: e.target.value.toUpperCase() })} className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs" placeholder="TICKER" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={newRow.cashM || ''} onChange={(e) => setNewRow({ ...newRow, cashM: e.target.value })} className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={newRow.btcCount || ''} onChange={(e) => setNewRow({ ...newRow, btcCount: e.target.value })} className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right" />
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-center text-xs">Auto</td>
                    <td className="px-3 py-2">
                      <input type="number" value={newRow.ethCount || ''} onChange={(e) => setNewRow({ ...newRow, ethCount: e.target.value })} className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right" />
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-center text-xs">Auto</td>
                    <td className="px-3 py-2 text-gray-500 text-center text-xs">Auto</td>
                    <td className="px-3 py-2">
                      <input type="number" value={newRow.totalDebtM || ''} onChange={(e) => setNewRow({ ...newRow, totalDebtM: e.target.value })} className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right" />
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-center text-xs">Auto</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={saveNew} className="p-1 bg-green-600 rounded hover:bg-green-700"><Save className="h-3 w-3" /></button>
                        <button onClick={() => { setShowAddForm(false); setNewRow(emptyRow); }} className="p-1 bg-gray-600 rounded hover:bg-gray-500"><X className="h-3 w-3" /></button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Data rows */}
                {calculatedData.map((row) => (
                  <tr key={row.ticker} className="hover:bg-gray-700/30">
                    {editingTicker === row.ticker ? (
                      <>
                        <td className="px-3 py-2 font-medium text-orange-400">{row.ticker}</td>
                        <td className="px-3 py-2">
                          <input type="number" value={editForm.cashM || ''} onChange={(e) => setEditForm({ ...editForm, cashM: e.target.value })} className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={editForm.btcCount || ''} onChange={(e) => setEditForm({ ...editForm, btcCount: e.target.value })} className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right" />
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-center text-xs">Auto</td>
                        <td className="px-3 py-2">
                          <input type="number" value={editForm.ethCount || ''} onChange={(e) => setEditForm({ ...editForm, ethCount: e.target.value })} className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right" />
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-center text-xs">Auto</td>
                        <td className="px-3 py-2 text-gray-500 text-center text-xs">Auto</td>
                        <td className="px-3 py-2">
                          <input type="number" value={editForm.totalDebtM || ''} onChange={(e) => setEditForm({ ...editForm, totalDebtM: e.target.value })} className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right" />
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-center text-xs">Auto</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={saveEdit} className="p-1 bg-green-600 rounded hover:bg-green-700"><Save className="h-3 w-3" /></button>
                            <button onClick={() => setEditingTicker(null)} className="p-1 bg-gray-600 rounded hover:bg-gray-500"><X className="h-3 w-3" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 font-medium text-orange-400">{row.ticker}</td>
                        <td className="px-3 py-2 text-right font-mono text-blue-300">${formatNum(row.cashM)}</td>
                        <td className="px-3 py-2 text-right font-mono text-orange-400">{formatNum(row.btcCount)}</td>
                        <td className="px-3 py-2 text-right font-mono text-orange-300">${formatNum(row.btcValueM, 1)}</td>
                        <td className="px-3 py-2 text-right font-mono text-purple-400">{formatNum(row.ethCount)}</td>
                        <td className="px-3 py-2 text-right font-mono text-purple-300">${formatNum(row.ethValueM, 1)}</td>
                        <td className="px-3 py-2 text-right font-mono text-cyan-400">${formatNum(row.totalLiquidM, 1)}</td>
                        <td className="px-3 py-2 text-right font-mono text-red-400">${formatNum(row.totalDebtM)}</td>
                        <td className={`px-3 py-2 text-right font-mono font-bold ${row.netLiquidM >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${formatNum(row.netLiquidM, 1)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => startEdit(row)} className="p-1 hover:bg-gray-600 rounded"><Edit2 className="h-3 w-3 text-gray-500" /></button>
                            <button onClick={() => deleteMutation.mutate(row.ticker)} className="p-1 hover:bg-red-900/50 rounded"><Trash2 className="h-3 w-3 text-red-500/70" /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {/* Totals row */}
                {calculatedData.length > 0 && (
                  <tr className="bg-gray-900 font-bold border-t-2 border-blue-500">
                    <td className="px-3 py-3 text-blue-400">TOTAL</td>
                    <td className="px-3 py-3 text-right font-mono">${formatNum(totals.cashM)}</td>
                    <td className="px-3 py-3 text-right font-mono text-orange-400">{formatNum(totals.btcCount)}</td>
                    <td className="px-3 py-3 text-right font-mono text-orange-300">${formatNum(totals.btcValueM, 0)}</td>
                    <td className="px-3 py-3 text-right font-mono text-purple-400">{formatNum(totals.ethCount)}</td>
                    <td className="px-3 py-3 text-right font-mono text-purple-300">${formatNum(totals.ethValueM, 0)}</td>
                    <td className="px-3 py-3 text-right font-mono text-cyan-400">${formatNum(totals.totalLiquidM, 0)}</td>
                    <td className="px-3 py-3 text-right font-mono text-red-400">${formatNum(totals.totalDebtM)}</td>
                    <td className={`px-3 py-3 text-right font-mono font-bold ${totals.netLiquidM >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${formatNum(totals.netLiquidM, 0)}
                    </td>
                    <td className="px-3 py-3"></td>
                  </tr>
                )}

                {assets.length === 0 && !showAddForm && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                      No net liquid assets yet. Click "Add Company" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 text-[10px] text-gray-500 flex gap-6">
          <span><span className="text-blue-300">Blue</span> = Cash input</span>
          <span><span className="text-orange-400">Orange</span> = BTC holdings</span>
          <span><span className="text-purple-400">Purple</span> = ETH holdings</span>
          <span><span className="text-red-400">Red</span> = Debt</span>
          <span><span className="text-green-400">Green</span> / <span className="text-red-400">Red</span> = Net Liquid (positive/negative)</span>
        </div>
      </div>
    </div>
  );
}
