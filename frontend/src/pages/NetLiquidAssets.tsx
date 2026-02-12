import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, X, Trash2, Edit2, Wallet } from 'lucide-react';

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
  mcapM: string | null;
  btcHoldings: string | null;
  ethHoldings: string | null;
  totalHodlM: string | null;
  hodlMcapRatio: string | null;
  cashEquivM: string | null;
  hodlPlusCashM: string | null;
  hodlCashMcapRatio: string | null;
  notes: string | null;
}

const emptyRow: Partial<NetLiquidAsset> = {
  ticker: '',
  mcapM: '',
  btcHoldings: '',
  ethHoldings: '0',
  totalHodlM: '',
  hodlMcapRatio: '',
  cashEquivM: '',
  hodlPlusCashM: '',
  hodlCashMcapRatio: '',
  notes: '',
};

export default function NetLiquidAssets() {
  const queryClient = useQueryClient();
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<NetLiquidAsset>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRow, setNewRow] = useState<Partial<NetLiquidAsset>>(emptyRow);

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

  const startEdit = (row: NetLiquidAsset) => {
    setEditingTicker(row.ticker);
    setEditForm({ ...row });
  };

  const saveEdit = () => {
    saveMutation.mutate(editForm);
  };

  const saveNew = () => {
    if (!newRow.ticker) return;
    saveMutation.mutate(newRow);
  };

  const formatNumber = (val: string | null, decimals = 2) => {
    if (!val) return '-';
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatBtc = (val: string | null) => {
    if (!val) return '-';
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const formatPercent = (val: string | null) => {
    if (!val) return '-';
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    return `${(num * 100).toFixed(1)}%`;
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Wallet className="h-6 w-6 text-blue-500" />
            <h1 className="text-2xl font-bold">Net Liquid Assets</h1>
            <span className="text-sm text-gray-500">BTC/ETH Holdings + Cash</span>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Company
          </button>
        </div>

        {/* Table */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-3 py-3 text-left">Ticker</th>
                  <th className="px-3 py-3 text-right">MCAP ($M)</th>
                  <th className="px-3 py-3 text-right">BTC Holdings</th>
                  <th className="px-3 py-3 text-right">ETH Holdings</th>
                  <th className="px-3 py-3 text-right">Total HODL ($M)</th>
                  <th className="px-3 py-3 text-right">HODL/MCAP</th>
                  <th className="px-3 py-3 text-right">Cash ($M)</th>
                  <th className="px-3 py-3 text-right">HODL+Cash ($M)</th>
                  <th className="px-3 py-3 text-right">(H+C)/MCAP</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {/* Add new row */}
                {showAddForm && (
                  <tr className="bg-blue-900/20">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={newRow.ticker || ''}
                        onChange={(e) => setNewRow({ ...newRow, ticker: e.target.value.toUpperCase() })}
                        className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
                        placeholder="TICKER"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={newRow.mcapM || ''}
                        onChange={(e) => setNewRow({ ...newRow, mcapM: e.target.value })}
                        className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={newRow.btcHoldings || ''}
                        onChange={(e) => setNewRow({ ...newRow, btcHoldings: e.target.value })}
                        className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={newRow.ethHoldings || ''}
                        onChange={(e) => setNewRow({ ...newRow, ethHoldings: e.target.value })}
                        className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={newRow.totalHodlM || ''}
                        onChange={(e) => setNewRow({ ...newRow, totalHodlM: e.target.value })}
                        className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-center">-</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={newRow.cashEquivM || ''}
                        onChange={(e) => setNewRow({ ...newRow, cashEquivM: e.target.value })}
                        className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-center">-</td>
                    <td className="px-3 py-2 text-gray-500 text-center">-</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={saveNew} className="p-1 bg-green-600 rounded hover:bg-green-700">
                          <Save className="h-3 w-3" />
                        </button>
                        <button onClick={() => { setShowAddForm(false); setNewRow(emptyRow); }} className="p-1 bg-gray-600 rounded hover:bg-gray-500">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Data rows */}
                {assets.map((row) => (
                  <tr key={row.ticker} className="hover:bg-gray-700/30">
                    {editingTicker === row.ticker ? (
                      <>
                        <td className="px-3 py-2 font-medium text-orange-400">{row.ticker}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={editForm.mcapM || ''}
                            onChange={(e) => setEditForm({ ...editForm, mcapM: e.target.value })}
                            className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={editForm.btcHoldings || ''}
                            onChange={(e) => setEditForm({ ...editForm, btcHoldings: e.target.value })}
                            className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={editForm.ethHoldings || ''}
                            onChange={(e) => setEditForm({ ...editForm, ethHoldings: e.target.value })}
                            className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={editForm.totalHodlM || ''}
                            onChange={(e) => setEditForm({ ...editForm, totalHodlM: e.target.value })}
                            className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-center">-</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={editForm.cashEquivM || ''}
                            onChange={(e) => setEditForm({ ...editForm, cashEquivM: e.target.value })}
                            className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-center">-</td>
                        <td className="px-3 py-2 text-gray-500 text-center">-</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={saveEdit} className="p-1 bg-green-600 rounded hover:bg-green-700">
                              <Save className="h-3 w-3" />
                            </button>
                            <button onClick={() => setEditingTicker(null)} className="p-1 bg-gray-600 rounded hover:bg-gray-500">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 font-medium text-orange-400">{row.ticker}</td>
                        <td className="px-3 py-2 text-right font-mono">${formatNumber(row.mcapM, 0)}</td>
                        <td className="px-3 py-2 text-right font-mono text-orange-400">{formatBtc(row.btcHoldings)}</td>
                        <td className="px-3 py-2 text-right font-mono text-purple-400">{formatBtc(row.ethHoldings)}</td>
                        <td className="px-3 py-2 text-right font-mono text-yellow-400">${formatNumber(row.totalHodlM, 0)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-400">{formatPercent(row.hodlMcapRatio)}</td>
                        <td className="px-3 py-2 text-right font-mono text-blue-400">${formatNumber(row.cashEquivM, 0)}</td>
                        <td className="px-3 py-2 text-right font-mono text-green-400">${formatNumber(row.hodlPlusCashM, 0)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-400">{formatPercent(row.hodlCashMcapRatio)}</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => startEdit(row)} className="p-1 hover:bg-gray-600 rounded">
                              <Edit2 className="h-3 w-3 text-gray-500" />
                            </button>
                            <button onClick={() => deleteMutation.mutate(row.ticker)} className="p-1 hover:bg-red-900/50 rounded">
                              <Trash2 className="h-3 w-3 text-red-500/70" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

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
      </div>
    </div>
  );
}
