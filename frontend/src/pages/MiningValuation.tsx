import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, X, Trash2, Edit2, Pickaxe } from 'lucide-react';

function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  return apiUrl;
}

interface MiningValuation {
  id: string;
  ticker: string;
  hashrateEh: string | null;
  hashrateType: string | null;
  hashrateNote: string | null;
  miningEvM: string | null;
  totalDebtM: string | null;
  nonMiningDebtAdjM: string | null;
  miningDebtM: string | null;
  cashM: string | null;
  sharesOutstandingM: string | null;
  fdSharesM: string | null;
  fdSharesUsedM: string | null;
  notes: string | null;
}

const emptyRow: Partial<MiningValuation> = {
  ticker: '',
  hashrateEh: '',
  hashrateType: 'Self',
  hashrateNote: '',
  miningEvM: '',
  totalDebtM: '',
  nonMiningDebtAdjM: '0',
  miningDebtM: '',
  cashM: '',
  sharesOutstandingM: '',
  fdSharesM: '',
  fdSharesUsedM: '',
  notes: '',
};

export default function MiningValuation() {
  const queryClient = useQueryClient();
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MiningValuation>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRow, setNewRow] = useState<Partial<MiningValuation>>(emptyRow);

  const { data: valuations = [], isLoading } = useQuery({
    queryKey: ['mining-valuations'],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/api/v1/mining-valuations`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<MiningValuation[]>;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<MiningValuation>) => {
      const res = await fetch(`${getApiUrl()}/api/v1/mining-valuations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mining-valuations'] });
      setEditingTicker(null);
      setShowAddForm(false);
      setNewRow(emptyRow);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ticker: string) => {
      const res = await fetch(`${getApiUrl()}/api/v1/mining-valuations/${ticker}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mining-valuations'] });
    },
  });

  const startEdit = (row: MiningValuation) => {
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
            <Pickaxe className="h-6 w-6 text-orange-500" />
            <h1 className="text-2xl font-bold">Mining Valuation</h1>
            <span className="text-sm text-gray-500">EV per EH/s methodology</span>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
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
                  <th className="px-3 py-3 text-right">Hashrate (EH/s)</th>
                  <th className="px-3 py-3 text-left">Type</th>
                  <th className="px-3 py-3 text-left">Note</th>
                  <th className="px-3 py-3 text-right">Mining EV ($M)</th>
                  <th className="px-3 py-3 text-right">Total Debt ($M)</th>
                  <th className="px-3 py-3 text-right">Mining Debt ($M)</th>
                  <th className="px-3 py-3 text-right">Cash ($M)</th>
                  <th className="px-3 py-3 text-right">Shares (M)</th>
                  <th className="px-3 py-3 text-right">FD Shares (M)</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {/* Add new row */}
                {showAddForm && (
                  <tr className="bg-green-900/20">
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
                        value={newRow.hashrateEh || ''}
                        onChange={(e) => setNewRow({ ...newRow, hashrateEh: e.target.value })}
                        className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={newRow.hashrateType || 'Self'}
                        onChange={(e) => setNewRow({ ...newRow, hashrateType: e.target.value })}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
                      >
                        <option value="Self">Self</option>
                        <option value="HUM">HUM</option>
                        <option value="Estimated">Estimated</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={newRow.hashrateNote || ''}
                        onChange={(e) => setNewRow({ ...newRow, hashrateNote: e.target.value })}
                        className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={newRow.miningEvM || ''}
                        onChange={(e) => setNewRow({ ...newRow, miningEvM: e.target.value })}
                        className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={newRow.totalDebtM || ''}
                        onChange={(e) => setNewRow({ ...newRow, totalDebtM: e.target.value })}
                        className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={newRow.miningDebtM || ''}
                        onChange={(e) => setNewRow({ ...newRow, miningDebtM: e.target.value })}
                        className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={newRow.cashM || ''}
                        onChange={(e) => setNewRow({ ...newRow, cashM: e.target.value })}
                        className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={newRow.sharesOutstandingM || ''}
                        onChange={(e) => setNewRow({ ...newRow, sharesOutstandingM: e.target.value })}
                        className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={newRow.fdSharesM || ''}
                        onChange={(e) => setNewRow({ ...newRow, fdSharesM: e.target.value })}
                        className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                      />
                    </td>
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
                {valuations.map((row) => (
                  <tr key={row.ticker} className="hover:bg-gray-700/30">
                    {editingTicker === row.ticker ? (
                      <>
                        <td className="px-3 py-2 font-medium text-orange-400">{row.ticker}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={editForm.hashrateEh || ''}
                            onChange={(e) => setEditForm({ ...editForm, hashrateEh: e.target.value })}
                            className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={editForm.hashrateType || 'Self'}
                            onChange={(e) => setEditForm({ ...editForm, hashrateType: e.target.value })}
                            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
                          >
                            <option value="Self">Self</option>
                            <option value="HUM">HUM</option>
                            <option value="Estimated">Estimated</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={editForm.hashrateNote || ''}
                            onChange={(e) => setEditForm({ ...editForm, hashrateNote: e.target.value })}
                            className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={editForm.miningEvM || ''}
                            onChange={(e) => setEditForm({ ...editForm, miningEvM: e.target.value })}
                            className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={editForm.totalDebtM || ''}
                            onChange={(e) => setEditForm({ ...editForm, totalDebtM: e.target.value })}
                            className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={editForm.miningDebtM || ''}
                            onChange={(e) => setEditForm({ ...editForm, miningDebtM: e.target.value })}
                            className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={editForm.cashM || ''}
                            onChange={(e) => setEditForm({ ...editForm, cashM: e.target.value })}
                            className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={editForm.sharesOutstandingM || ''}
                            onChange={(e) => setEditForm({ ...editForm, sharesOutstandingM: e.target.value })}
                            className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={editForm.fdSharesM || ''}
                            onChange={(e) => setEditForm({ ...editForm, fdSharesM: e.target.value })}
                            className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-right"
                          />
                        </td>
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
                        <td className="px-3 py-2 text-right font-mono">{formatNumber(row.hashrateEh, 1)}</td>
                        <td className="px-3 py-2 text-gray-400">{row.hashrateType || '-'}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{row.hashrateNote || '-'}</td>
                        <td className="px-3 py-2 text-right font-mono text-green-400">${formatNumber(row.miningEvM)}</td>
                        <td className="px-3 py-2 text-right font-mono text-red-400">${formatNumber(row.totalDebtM)}</td>
                        <td className="px-3 py-2 text-right font-mono">${formatNumber(row.miningDebtM)}</td>
                        <td className="px-3 py-2 text-right font-mono text-blue-400">${formatNumber(row.cashM)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatNumber(row.sharesOutstandingM, 1)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatNumber(row.fdSharesM, 1)}</td>
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

                {valuations.length === 0 && !showAddForm && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                      No mining valuations yet. Click "Add Company" to get started.
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
