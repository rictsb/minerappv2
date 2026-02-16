import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, X, Trash2, Edit2, Landmark, ChevronDown, ChevronRight, ExternalLink, Plus } from 'lucide-react';

function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  return apiUrl;
}

interface DebtInstrument {
  id: string;
  ticker: string;
  instrument: string;
  debtType: string | null;
  issuer: string | null;
  principalM: string | null;
  originalM: string | null;
  maturity: string | null;
  couponPct: string | null;
  annualInterestM: string | null;
  secured: boolean;
  collateral: string | null;
  level: string | null;
  linkedSite: string | null;
  convertible: boolean;
  conversionPrice: string | null;
  status: string | null;
  confidence: string;
  source: string | null;
  sourceDate: string | null;
  company?: { name: string };
}

interface CompanySummary {
  ticker: string;
  companyName: string;
  instruments: DebtInstrument[];
  totalPrincipal: number;
  totalAnnualInterest: number;
  instrumentCount: number;
}

const DEBT_TYPES = ['Convertible Note', 'Sr Secured Note', 'Term Loan', 'Equipment Fin', 'Project Fin', 'Revolver', 'Exchangeable Note', 'Assumed Debt', 'Other'];
const LEVELS = ['Corporate', 'Project', 'Asset'];

const emptyDebt: Partial<DebtInstrument> = {
  ticker: '',
  instrument: '',
  debtType: 'Convertible Note',
  issuer: '',
  principalM: '',
  originalM: '',
  maturity: '',
  couponPct: '',
  annualInterestM: '',
  secured: false,
  collateral: '',
  level: 'Corporate',
  linkedSite: '',
  convertible: false,
  conversionPrice: '',
  status: 'Outstanding',
  confidence: 'MEDIUM',
  source: '',
  sourceDate: '',
};

export default function DebtTracker() {
  const queryClient = useQueryClient();
  const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DebtInstrument>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDebt, setNewDebt] = useState<Partial<DebtInstrument>>(emptyDebt);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSecured, setFilterSecured] = useState<string>('all');

  const { data: debts = [], isLoading } = useQuery({
    queryKey: ['debts'],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/api/v1/debts`);
      if (!res.ok) throw new Error('Failed to fetch debts');
      return res.json() as Promise<DebtInstrument[]>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<DebtInstrument>) => {
      const res = await fetch(`${getApiUrl()}/api/v1/debts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          principalM: data.principalM ? parseFloat(data.principalM as string) : null,
          originalM: data.originalM ? parseFloat(data.originalM as string) : null,
          couponPct: data.couponPct ? parseFloat(data.couponPct as string) : null,
          annualInterestM: data.annualInterestM ? parseFloat(data.annualInterestM as string) : null,
          conversionPrice: data.conversionPrice ? parseFloat(data.conversionPrice as string) : null,
          confidence: (data.confidence || 'MEDIUM').toUpperCase(),
        }),
      });
      if (!res.ok) throw new Error('Failed to create debt');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      setShowAddForm(false);
      setNewDebt(emptyDebt);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DebtInstrument> }) => {
      const res = await fetch(`${getApiUrl()}/api/v1/debts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          principalM: data.principalM ? parseFloat(data.principalM as string) : null,
          originalM: data.originalM ? parseFloat(data.originalM as string) : null,
          couponPct: data.couponPct ? parseFloat(data.couponPct as string) : null,
          annualInterestM: data.annualInterestM ? parseFloat(data.annualInterestM as string) : null,
          conversionPrice: data.conversionPrice ? parseFloat(data.conversionPrice as string) : null,
          confidence: (data.confidence || 'MEDIUM').toUpperCase(),
        }),
      });
      if (!res.ok) throw new Error('Failed to update debt');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${getApiUrl()}/api/v1/debts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['debts'] }),
  });

  // Filter debts
  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      if (filterType !== 'all' && d.debtType !== filterType) return false;
      if (filterSecured === 'secured' && !d.secured) return false;
      if (filterSecured === 'unsecured' && d.secured) return false;
      return true;
    });
  }, [debts, filterType, filterSecured]);

  // Group by company
  const companySummaries = useMemo((): CompanySummary[] => {
    const map = new Map<string, CompanySummary>();
    filteredDebts.forEach((d) => {
      if (!map.has(d.ticker)) {
        map.set(d.ticker, {
          ticker: d.ticker,
          companyName: d.company?.name || d.ticker,
          instruments: [],
          totalPrincipal: 0,
          totalAnnualInterest: 0,
          instrumentCount: 0,
        });
      }
      const summary = map.get(d.ticker)!;
      summary.instruments.push(d);
      summary.totalPrincipal += parseFloat(d.principalM || '0') || 0;
      summary.totalAnnualInterest += parseFloat(d.annualInterestM || '0') || 0;
      summary.instrumentCount += 1;
    });
    // Sort by total principal descending
    return Array.from(map.values()).sort((a, b) => b.totalPrincipal - a.totalPrincipal);
  }, [filteredDebts]);

  // Grand totals
  const grandTotals = useMemo(() => {
    return companySummaries.reduce(
      (acc, s) => ({
        principal: acc.principal + s.totalPrincipal,
        interest: acc.interest + s.totalAnnualInterest,
        instruments: acc.instruments + s.instrumentCount,
        companies: acc.companies + 1,
      }),
      { principal: 0, interest: 0, instruments: 0, companies: 0 }
    );
  }, [companySummaries]);

  const toggleTicker = (ticker: string) => {
    setExpandedTickers((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedTickers(new Set(companySummaries.map((s) => s.ticker)));
  };

  const collapseAll = () => {
    setExpandedTickers(new Set());
  };

  const formatNum = (val: number | string | null | undefined, decimals = 1) => {
    if (val == null) return '-';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '-';
    return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatPct = (val: string | null | undefined) => {
    if (val == null) return '-';
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    return `${(num * 100).toFixed(2)}%`;
  };

  const getTypeColor = (type: string | null) => {
    switch (type) {
      case 'Convertible Note': return 'text-purple-400';
      case 'Sr Secured Note': return 'text-blue-400';
      case 'Term Loan': return 'text-cyan-400';
      case 'Equipment Fin': return 'text-yellow-400';
      case 'Project Fin': return 'text-green-400';
      case 'Revolver': return 'text-pink-400';
      case 'Exchangeable Note': return 'text-indigo-400';
      default: return 'text-gray-400';
    }
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
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Landmark className="h-6 w-6 text-red-500" />
            <h1 className="text-2xl font-bold">Debt Tracker</h1>
            <span className="text-sm text-gray-500">Corporate & Project Debt Instruments</span>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Plus className="h-4 w-4" /> Add Instrument
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase mb-1">Total Outstanding</div>
            <div className="text-2xl font-bold text-red-400">${formatNum(grandTotals.principal, 0)}<span className="text-sm text-gray-500 ml-1">M</span></div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase mb-1">Annual Interest</div>
            <div className="text-2xl font-bold text-yellow-400">${formatNum(grandTotals.interest, 1)}<span className="text-sm text-gray-500 ml-1">M</span></div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase mb-1">Instruments</div>
            <div className="text-2xl font-bold text-blue-400">{grandTotals.instruments}</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase mb-1">Companies</div>
            <div className="text-2xl font-bold text-green-400">{grandTotals.companies}</div>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Type:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
              >
                <option value="all">All Types</option>
                {DEBT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Security:</span>
              <select
                value={filterSecured}
                onChange={(e) => setFilterSecured(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
              >
                <option value="all">All</option>
                <option value="secured">Secured</option>
                <option value="unsecured">Unsecured</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={expandAll} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1">
              Expand All
            </button>
            <span className="text-gray-600">|</span>
            <button onClick={collapseAll} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1">
              Collapse All
            </button>
          </div>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-gray-800 border border-blue-500/50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-bold text-blue-400 mb-3">Add New Debt Instrument</h3>
            <div className="grid grid-cols-6 gap-3 text-xs">
              <div>
                <label className="text-gray-500 block mb-1">Ticker *</label>
                <input type="text" value={newDebt.ticker || ''} onChange={(e) => setNewDebt({ ...newDebt, ticker: e.target.value.toUpperCase() })} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5" placeholder="TICKER" />
              </div>
              <div className="col-span-2">
                <label className="text-gray-500 block mb-1">Instrument *</label>
                <input type="text" value={newDebt.instrument || ''} onChange={(e) => setNewDebt({ ...newDebt, instrument: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5" placeholder="e.g., 2.75% Conv Notes due 2030" />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Type</label>
                <select value={newDebt.debtType || ''} onChange={(e) => setNewDebt({ ...newDebt, debtType: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5">
                  {DEBT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Principal ($M)</label>
                <input type="number" value={newDebt.principalM || ''} onChange={(e) => setNewDebt({ ...newDebt, principalM: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5" />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Coupon (%)</label>
                <input type="number" step="0.001" value={newDebt.couponPct || ''} onChange={(e) => setNewDebt({ ...newDebt, couponPct: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5" placeholder="e.g., 0.0275" />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Maturity</label>
                <input type="text" value={(newDebt as any).maturity || ''} onChange={(e) => setNewDebt({ ...newDebt, maturity: e.target.value } as any)} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5" placeholder="e.g., Jun-2030" />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Issuer</label>
                <input type="text" value={newDebt.issuer || ''} onChange={(e) => setNewDebt({ ...newDebt, issuer: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5" />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Level</label>
                <select value={newDebt.level || 'Corporate'} onChange={(e) => setNewDebt({ ...newDebt, level: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5">
                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={newDebt.secured || false} onChange={(e) => setNewDebt({ ...newDebt, secured: e.target.checked })} className="rounded" />
                  <span className="text-gray-400">Secured</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={newDebt.convertible || false} onChange={(e) => setNewDebt({ ...newDebt, convertible: e.target.checked })} className="rounded" />
                  <span className="text-gray-400">Convertible</span>
                </label>
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Conv. Price ($)</label>
                <input type="number" step="0.01" value={newDebt.conversionPrice || ''} onChange={(e) => setNewDebt({ ...newDebt, conversionPrice: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => { setShowAddForm(false); setNewDebt(emptyDebt); }} className="px-3 py-1.5 bg-gray-600 rounded text-xs hover:bg-gray-500">Cancel</button>
              <button onClick={() => createMutation.mutate(newDebt)} className="px-3 py-1.5 bg-blue-600 rounded text-xs hover:bg-blue-700" disabled={!newDebt.ticker || !newDebt.instrument}>
                <Save className="h-3 w-3 inline mr-1" /> Save
              </button>
            </div>
          </div>
        )}

        {/* Company Groups */}
        <div className="space-y-2">
          {companySummaries.map((summary) => {
            const isExpanded = expandedTickers.has(summary.ticker);
            return (
              <div key={summary.ticker} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                {/* Company Header Row */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-750"
                  onClick={() => toggleTicker(summary.ticker)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="font-bold text-orange-400 w-16">{summary.ticker}</span>
                    <span className="text-sm text-gray-400">{summary.companyName}</span>
                    <span className="text-xs text-gray-600 ml-2">({summary.instrumentCount} instrument{summary.instrumentCount !== 1 ? 's' : ''})</span>
                  </div>
                  <div className="flex items-center gap-8 text-sm">
                    <div className="text-right">
                      <span className="text-gray-500 text-xs mr-2">Outstanding:</span>
                      <span className="font-mono font-bold text-red-400">${formatNum(summary.totalPrincipal, 0)}M</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 text-xs mr-2">Ann. Interest:</span>
                      <span className="font-mono text-yellow-400">${formatNum(summary.totalAnnualInterest, 1)}M</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Instruments Table */}
                {isExpanded && (
                  <div className="border-t border-gray-700">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-900/50 text-gray-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left w-[280px]">Instrument</th>
                          <th className="px-3 py-2 text-left w-[110px]">Type</th>
                          <th className="px-3 py-2 text-right w-[90px]">Principal ($M)</th>
                          <th className="px-3 py-2 text-right w-[80px]">Original ($M)</th>
                          <th className="px-3 py-2 text-center w-[80px]">Maturity</th>
                          <th className="px-3 py-2 text-right w-[70px]">Coupon</th>
                          <th className="px-3 py-2 text-right w-[80px]">Ann. Int ($M)</th>
                          <th className="px-3 py-2 text-center w-[60px]">Secured</th>
                          <th className="px-3 py-2 text-center w-[50px]">Conv</th>
                          <th className="px-3 py-2 text-right w-[70px]">Conv $</th>
                          <th className="px-3 py-2 text-left w-[60px]">Level</th>
                          <th className="px-3 py-2 text-left w-[120px]">Status</th>
                          <th className="px-3 py-2 text-center w-[60px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700/50">
                        {summary.instruments.map((debt) => (
                          <tr key={debt.id} className="hover:bg-gray-700/20 group">
                            {editingId === debt.id ? (
                              <>
                                <td className="px-3 py-1.5">
                                  <input type="text" value={editForm.instrument || ''} onChange={(e) => setEditForm({ ...editForm, instrument: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs" />
                                </td>
                                <td className="px-3 py-1.5">
                                  <select value={editForm.debtType || ''} onChange={(e) => setEditForm({ ...editForm, debtType: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs">
                                    {DEBT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </td>
                                <td className="px-3 py-1.5">
                                  <input type="number" value={editForm.principalM || ''} onChange={(e) => setEditForm({ ...editForm, principalM: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-right" />
                                </td>
                                <td className="px-3 py-1.5">
                                  <input type="number" value={editForm.originalM || ''} onChange={(e) => setEditForm({ ...editForm, originalM: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-right" />
                                </td>
                                <td className="px-3 py-1.5 text-center text-gray-400">{debt.maturity ? new Date(debt.maturity).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : (debt as any).maturity || '-'}</td>
                                <td className="px-3 py-1.5">
                                  <input type="number" step="0.001" value={editForm.couponPct || ''} onChange={(e) => setEditForm({ ...editForm, couponPct: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-right" />
                                </td>
                                <td className="px-3 py-1.5">
                                  <input type="number" value={editForm.annualInterestM || ''} onChange={(e) => setEditForm({ ...editForm, annualInterestM: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-right" />
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  <input type="checkbox" checked={editForm.secured || false} onChange={(e) => setEditForm({ ...editForm, secured: e.target.checked })} />
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  <input type="checkbox" checked={editForm.convertible || false} onChange={(e) => setEditForm({ ...editForm, convertible: e.target.checked })} />
                                </td>
                                <td className="px-3 py-1.5">
                                  <input type="number" step="0.01" value={editForm.conversionPrice || ''} onChange={(e) => setEditForm({ ...editForm, conversionPrice: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-right" />
                                </td>
                                <td className="px-3 py-1.5">
                                  <select value={editForm.level || ''} onChange={(e) => setEditForm({ ...editForm, level: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs">
                                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                                  </select>
                                </td>
                                <td className="px-3 py-1.5">
                                  <input type="text" value={editForm.status || ''} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs" />
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => updateMutation.mutate({ id: debt.id, data: editForm })} className="p-1 bg-green-600 rounded hover:bg-green-700"><Save className="h-3 w-3" /></button>
                                    <button onClick={() => setEditingId(null)} className="p-1 bg-gray-600 rounded hover:bg-gray-500"><X className="h-3 w-3" /></button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-1.5">
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-200 truncate" title={debt.instrument}>{debt.instrument}</span>
                                    {debt.source && (
                                      <a href={debt.source} target="_blank" rel="noopener noreferrer" className="text-blue-500/50 hover:text-blue-400 flex-shrink-0">
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                  {debt.issuer && debt.issuer !== summary.companyName && (
                                    <div className="text-[10px] text-gray-600 truncate">{debt.issuer}</div>
                                  )}
                                </td>
                                <td className={`px-3 py-1.5 ${getTypeColor(debt.debtType)}`}>
                                  <span className="text-[10px]">{debt.debtType || '-'}</span>
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-red-400 font-bold">{formatNum(debt.principalM, 1)}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-gray-500">{formatNum(debt.originalM, 0)}</td>
                                <td className="px-3 py-1.5 text-center text-gray-300">
                                  {debt.maturity ? (
                                    (() => {
                                      try {
                                        const d = new Date(debt.maturity);
                                        if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                                      } catch {}
                                      return String(debt.maturity);
                                    })()
                                  ) : '-'}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-cyan-400">{formatPct(debt.couponPct)}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-yellow-400">{formatNum(debt.annualInterestM, 1)}</td>
                                <td className="px-3 py-1.5 text-center">
                                  {debt.secured ? <span className="text-green-400 text-[10px] font-bold">YES</span> : <span className="text-gray-600 text-[10px]">No</span>}
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  {debt.convertible ? <span className="text-purple-400 text-[10px] font-bold">YES</span> : <span className="text-gray-600 text-[10px]">No</span>}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-purple-300">
                                  {debt.conversionPrice ? `$${formatNum(debt.conversionPrice, 2)}` : '-'}
                                </td>
                                <td className="px-3 py-1.5 text-gray-400 text-[10px]">{debt.level || '-'}</td>
                                <td className="px-3 py-1.5">
                                  <span className="text-[10px] text-gray-400 truncate block" title={debt.status || ''}>{debt.status || '-'}</span>
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); setEditingId(debt.id); setEditForm({ ...debt }); }} className="p-1 hover:bg-gray-600 rounded">
                                      <Edit2 className="h-3 w-3 text-gray-500" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(debt.id); }} className="p-1 hover:bg-red-900/50 rounded">
                                      <Trash2 className="h-3 w-3 text-red-500/70" />
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                        {/* Collateral details row for expanded secured instruments */}
                        {summary.instruments.filter((d) => d.secured && d.collateral).length > 0 && (
                          <tr className="bg-gray-900/30">
                            <td colSpan={13} className="px-3 py-2">
                              <div className="text-[10px] text-gray-600">
                                <span className="font-bold text-gray-500">Collateral Notes: </span>
                                {summary.instruments.filter((d) => d.secured && d.collateral).map((d, i) => (
                                  <span key={d.id}>
                                    {i > 0 && ' | '}
                                    <span className="text-gray-500">{d.debtType}:</span> {d.collateral}
                                    {d.linkedSite && <span className="text-blue-400"> [{d.linkedSite}]</span>}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Grand Totals Bar */}
        {companySummaries.length > 0 && (
          <div className="bg-gray-800 border-2 border-red-500/30 rounded-lg p-4 mt-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg text-red-400">TOTAL</span>
              <div className="flex items-center gap-10 text-sm">
                <div>
                  <span className="text-gray-500 text-xs mr-2">Outstanding Debt:</span>
                  <span className="font-mono font-bold text-red-400 text-lg">${formatNum(grandTotals.principal, 0)}M</span>
                </div>
                <div>
                  <span className="text-gray-500 text-xs mr-2">Annual Interest:</span>
                  <span className="font-mono font-bold text-yellow-400 text-lg">${formatNum(grandTotals.interest, 1)}M</span>
                </div>
                <div>
                  <span className="text-gray-500 text-xs mr-2">Avg. Cost:</span>
                  <span className="font-mono font-bold text-cyan-400 text-lg">
                    {grandTotals.principal > 0 ? ((grandTotals.interest / grandTotals.principal) * 100).toFixed(2) : '0.00'}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 text-xs mr-2">Instruments:</span>
                  <span className="font-mono text-blue-400">{grandTotals.instruments}</span>
                  <span className="text-gray-600 text-xs ml-1">across {grandTotals.companies} cos</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {debts.length === 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center text-gray-500">
            No debt instruments yet. Click "Add Instrument" to get started, or import from the spreadsheet seed data.
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 text-[10px] text-gray-500 flex gap-4 flex-wrap">
          <span><span className="text-purple-400">Purple</span> = Convertible</span>
          <span><span className="text-blue-400">Blue</span> = Sr Secured</span>
          <span><span className="text-cyan-400">Cyan</span> = Term Loan</span>
          <span><span className="text-yellow-400">Yellow</span> = Equipment Fin</span>
          <span><span className="text-green-400">Green</span> = Project Fin</span>
          <span><span className="text-pink-400">Pink</span> = Revolver</span>
        </div>
      </div>
    </div>
  );
}
