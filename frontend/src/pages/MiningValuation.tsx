import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, X, Trash2, Edit2, Pickaxe, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  efficiencyJth: string | null;
  powerCostKwh: string | null;
  hostedMw: string | null;
  sourceDate: string | null;
  notes: string | null;
}

const emptyRow: Partial<MiningValuation> = {
  ticker: '',
  hashrateEh: '',
  efficiencyJth: '',
  powerCostKwh: '',
  hostedMw: '0',
  notes: '',
};

export default function MiningValuation() {
  const queryClient = useQueryClient();
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MiningValuation>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRow, setNewRow] = useState<Partial<MiningValuation>>(emptyRow);

  // Fetch global factors from centralized settings
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/api/v1/settings`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
  });

  // Get assumptions from global settings with defaults
  const assumptions = useMemo(() => ({
    dailyRevPerEh: settings?.dailyRevPerEh ?? 29400,
    ebitdaMultiple: settings?.ebitdaMultiple ?? 6,
    poolFeePct: settings?.poolFeePct ?? 0.02,
    hostedMwRate: (settings?.mwValueBtcMining ?? 0.3) * 1000, // Convert M to K
  }), [settings]);

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

  // Calculate derived values for each row
  const calculatedData = useMemo(() => {
    return valuations.map((row) => {
      const eh = parseFloat(row.hashrateEh || '0') || 0;
      const eff = parseFloat(row.efficiencyJth || '0') || 0;
      const power = parseFloat(row.powerCostKwh || '0') || 0;
      const hostedMw = parseFloat(row.hostedMw || '0') || 0;

      // Ann Rev = EH/s × DailyRev/EH × 365 / 1M
      const annRevM = (eh * assumptions.dailyRevPerEh * 365) / 1_000_000;

      // Ann Power = EH/s × Eff × $/kWh × 8.76 (8760 hrs/yr / 1000)
      const annPowerM = (eh * eff * power * 8.76);

      // Pool Fees = PoolFee% × Revenue
      const poolFeesM = assumptions.poolFeePct * annRevM;

      // EBITDA = Rev - Power - Fees
      const ebitdaM = annRevM - annPowerM - poolFeesM;

      // Margin = EBITDA / Revenue
      const margin = annRevM > 0 ? ebitdaM / annRevM : 0;

      // Self Mining Val = MAX(0, EBITDA × Multiple)
      const selfMiningValM = Math.max(0, ebitdaM * assumptions.ebitdaMultiple);

      // Hosted Val = MW × $/MW / 1000 (rate is in $K)
      const hostedValM = (hostedMw * assumptions.hostedMwRate) / 1000;

      // Total Val = Self Mining + Hosted
      const totalValM = selfMiningValM + hostedValM;

      return {
        ...row,
        annRevM,
        annPowerM,
        poolFeesM,
        ebitdaM,
        margin,
        selfMiningValM,
        hostedValM,
        totalValM,
      };
    });
  }, [valuations, assumptions]);

  // Calculate totals
  const totals = useMemo(() => {
    return calculatedData.reduce(
      (acc, row) => ({
        hashrateEh: acc.hashrateEh + (parseFloat(row.hashrateEh || '0') || 0),
        hostedMw: acc.hostedMw + (parseFloat(row.hostedMw || '0') || 0),
        annRevM: acc.annRevM + row.annRevM,
        annPowerM: acc.annPowerM + row.annPowerM,
        poolFeesM: acc.poolFeesM + row.poolFeesM,
        ebitdaM: acc.ebitdaM + row.ebitdaM,
        selfMiningValM: acc.selfMiningValM + row.selfMiningValM,
        hostedValM: acc.hostedValM + row.hostedValM,
        totalValM: acc.totalValM + row.totalValM,
      }),
      { hashrateEh: 0, hostedMw: 0, annRevM: 0, annPowerM: 0, poolFeesM: 0, ebitdaM: 0, selfMiningValM: 0, hostedValM: 0, totalValM: 0 }
    );
  }, [calculatedData]);

  const startEdit = (row: MiningValuation) => {
    setEditingTicker(row.ticker);
    setEditForm({ ...row });
  };

  const saveEdit = () => saveMutation.mutate(editForm);
  const saveNew = () => {
    if (!newRow.ticker) return;
    saveMutation.mutate(newRow);
  };

  const formatNum = (val: number | null | undefined, decimals = 2) => {
    if (val == null || isNaN(val)) return '-';
    return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatPct = (val: number | null | undefined) => {
    if (val == null || isNaN(val)) return '-';
    return `${(val * 100).toFixed(1)}%`;
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
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Pickaxe className="h-6 w-6 text-orange-500" />
            <h1 className="text-2xl font-bold">Mining Valuation</h1>
            <span className="text-sm text-gray-500">Self-Mining Profitability Model</span>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Add Company
          </button>
        </div>

        {/* Assumptions Banner - Link to Factors */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-gray-400">Using global assumptions:</span>
            <span className="text-orange-400">Daily Rev/EH: <span className="font-mono">${assumptions.dailyRevPerEh.toLocaleString()}</span></span>
            <span className="text-orange-400">EBITDA Multiple: <span className="font-mono">{assumptions.ebitdaMultiple}x</span></span>
            <span className="text-orange-400">Pool Fee: <span className="font-mono">{(assumptions.poolFeePct * 100).toFixed(1)}%</span></span>
            <span className="text-orange-400">$/MW Hosted: <span className="font-mono">${assumptions.hostedMwRate.toFixed(0)}K</span></span>
          </div>
          <Link to="/factors" className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300">
            Edit in Factors <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* Table */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-900 text-gray-400 uppercase">
                <tr>
                  <th className="px-2 py-2 text-left">Ticker</th>
                  <th className="px-2 py-2 text-right bg-blue-900/20">EH/s</th>
                  <th className="px-2 py-2 text-right bg-blue-900/20">Eff (J/TH)</th>
                  <th className="px-2 py-2 text-right bg-blue-900/20">$/kWh</th>
                  <th className="px-2 py-2 text-right">Ann Rev ($M)</th>
                  <th className="px-2 py-2 text-right">Power ($M)</th>
                  <th className="px-2 py-2 text-right">Fees ($M)</th>
                  <th className="px-2 py-2 text-right">EBITDA ($M)</th>
                  <th className="px-2 py-2 text-right">Margin</th>
                  <th className="px-2 py-2 text-right text-green-400">Self Val ($M)</th>
                  <th className="px-2 py-2 text-right bg-purple-900/20">Host MW</th>
                  <th className="px-2 py-2 text-right text-purple-400">Host Val ($M)</th>
                  <th className="px-2 py-2 text-right text-yellow-400 font-bold">Total ($M)</th>
                  <th className="px-2 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {/* Add new row */}
                {showAddForm && (
                  <tr className="bg-green-900/20">
                    <td className="px-2 py-1">
                      <input type="text" value={newRow.ticker || ''} onChange={(e) => setNewRow({ ...newRow, ticker: e.target.value.toUpperCase() })} className="w-16 bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs" placeholder="TICKER" />
                    </td>
                    <td className="px-2 py-1"><input type="number" step="0.1" value={newRow.hashrateEh || ''} onChange={(e) => setNewRow({ ...newRow, hashrateEh: e.target.value })} className="w-14 bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs text-right" /></td>
                    <td className="px-2 py-1"><input type="number" step="0.1" value={newRow.efficiencyJth || ''} onChange={(e) => setNewRow({ ...newRow, efficiencyJth: e.target.value })} className="w-14 bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs text-right" /></td>
                    <td className="px-2 py-1"><input type="number" step="0.001" value={newRow.powerCostKwh || ''} onChange={(e) => setNewRow({ ...newRow, powerCostKwh: e.target.value })} className="w-14 bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs text-right" /></td>
                    <td colSpan={5} className="px-2 py-1 text-gray-500 text-center text-[10px]">Auto-calculated</td>
                    <td className="px-2 py-1"><input type="number" value={newRow.hostedMw || ''} onChange={(e) => setNewRow({ ...newRow, hostedMw: e.target.value })} className="w-14 bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs text-right" /></td>
                    <td colSpan={2} className="px-2 py-1 text-gray-500 text-center text-[10px]">Auto</td>
                    <td className="px-2 py-1 text-center">
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
                        <td className="px-2 py-1 font-medium text-orange-400">{row.ticker}</td>
                        <td className="px-2 py-1"><input type="number" step="0.1" value={editForm.hashrateEh || ''} onChange={(e) => setEditForm({ ...editForm, hashrateEh: e.target.value })} className="w-14 bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs text-right" /></td>
                        <td className="px-2 py-1"><input type="number" step="0.1" value={editForm.efficiencyJth || ''} onChange={(e) => setEditForm({ ...editForm, efficiencyJth: e.target.value })} className="w-14 bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs text-right" /></td>
                        <td className="px-2 py-1"><input type="number" step="0.001" value={editForm.powerCostKwh || ''} onChange={(e) => setEditForm({ ...editForm, powerCostKwh: e.target.value })} className="w-14 bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs text-right" /></td>
                        <td colSpan={5} className="px-2 py-1 text-gray-500 text-center text-[10px]">Auto-calculated</td>
                        <td className="px-2 py-1"><input type="number" value={editForm.hostedMw || ''} onChange={(e) => setEditForm({ ...editForm, hostedMw: e.target.value })} className="w-14 bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs text-right" /></td>
                        <td colSpan={2} className="px-2 py-1 text-gray-500 text-center text-[10px]">Auto</td>
                        <td className="px-2 py-1 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={saveEdit} className="p-1 bg-green-600 rounded hover:bg-green-700"><Save className="h-3 w-3" /></button>
                            <button onClick={() => setEditingTicker(null)} className="p-1 bg-gray-600 rounded hover:bg-gray-500"><X className="h-3 w-3" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-1 font-medium text-orange-400">{row.ticker}</td>
                        <td className="px-2 py-1 text-right font-mono text-blue-300">{formatNum(parseFloat(row.hashrateEh || '0'), 1)}</td>
                        <td className="px-2 py-1 text-right font-mono text-blue-300">{formatNum(parseFloat(row.efficiencyJth || '0'), 1)}</td>
                        <td className="px-2 py-1 text-right font-mono text-blue-300">${formatNum(parseFloat(row.powerCostKwh || '0'), 3)}</td>
                        <td className="px-2 py-1 text-right font-mono">${formatNum(row.annRevM, 1)}</td>
                        <td className="px-2 py-1 text-right font-mono text-red-400">${formatNum(row.annPowerM, 1)}</td>
                        <td className="px-2 py-1 text-right font-mono text-red-400">${formatNum(row.poolFeesM, 1)}</td>
                        <td className={`px-2 py-1 text-right font-mono ${row.ebitdaM >= 0 ? 'text-green-400' : 'text-red-400'}`}>${formatNum(row.ebitdaM, 1)}</td>
                        <td className={`px-2 py-1 text-right font-mono ${row.margin >= 0 ? 'text-gray-400' : 'text-red-400'}`}>{formatPct(row.margin)}</td>
                        <td className="px-2 py-1 text-right font-mono text-green-400">${formatNum(row.selfMiningValM, 1)}</td>
                        <td className="px-2 py-1 text-right font-mono text-purple-300">{formatNum(parseFloat(row.hostedMw || '0'), 0)}</td>
                        <td className="px-2 py-1 text-right font-mono text-purple-400">${formatNum(row.hostedValM, 1)}</td>
                        <td className="px-2 py-1 text-right font-mono text-yellow-400 font-bold">${formatNum(row.totalValM, 1)}</td>
                        <td className="px-2 py-1 text-center">
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
                  <tr className="bg-gray-900 font-bold border-t-2 border-orange-500">
                    <td className="px-2 py-2 text-orange-400">TOTAL</td>
                    <td className="px-2 py-2 text-right font-mono">{formatNum(totals.hashrateEh, 1)}</td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2 text-right font-mono">${formatNum(totals.annRevM, 0)}</td>
                    <td className="px-2 py-2 text-right font-mono text-red-400">${formatNum(totals.annPowerM, 0)}</td>
                    <td className="px-2 py-2 text-right font-mono text-red-400">${formatNum(totals.poolFeesM, 0)}</td>
                    <td className="px-2 py-2 text-right font-mono text-green-400">${formatNum(totals.ebitdaM, 0)}</td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2 text-right font-mono text-green-400">${formatNum(totals.selfMiningValM, 0)}</td>
                    <td className="px-2 py-2 text-right font-mono">{formatNum(totals.hostedMw, 0)}</td>
                    <td className="px-2 py-2 text-right font-mono text-purple-400">${formatNum(totals.hostedValM, 0)}</td>
                    <td className="px-2 py-2 text-right font-mono text-yellow-400">${formatNum(totals.totalValM, 0)}</td>
                    <td className="px-2 py-2"></td>
                  </tr>
                )}

                {valuations.length === 0 && !showAddForm && (
                  <tr>
                    <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                      No mining valuations yet. Click "Add Company" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 text-[10px] text-gray-500 flex gap-6">
          <span><span className="text-blue-300">Blue</span> = Input fields</span>
          <span><span className="text-green-400">Green</span> = Self-mining value</span>
          <span><span className="text-purple-400">Purple</span> = Hosted value</span>
          <span><span className="text-yellow-400">Yellow</span> = Total valuation</span>
        </div>
      </div>
    </div>
  );
}
