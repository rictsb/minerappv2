import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Filter,
  Search,
  Edit2,
  Save,
  X,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Eye,
  EyeOff,
} from 'lucide-react';
import BuildingDetailPanel from '../components/BuildingDetailPanel';

function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  return apiUrl;
}

// Development phase colors and labels
const phaseConfig: Record<string, { label: string; color: string; prob: number }> = {
  OPERATIONAL: { label: 'Operational', color: 'bg-green-900/50 text-green-400 border-green-700', prob: 1.0 },
  CONSTRUCTION: { label: 'Construction', color: 'bg-blue-900/50 text-blue-400 border-blue-700', prob: 0.9 },
  DEVELOPMENT: { label: 'Development', color: 'bg-yellow-900/50 text-yellow-400 border-yellow-700', prob: 0.7 },
  EXCLUSIVITY: { label: 'Exclusivity', color: 'bg-purple-900/50 text-purple-400 border-purple-700', prob: 0.5 },
  DILIGENCE: { label: 'Diligence', color: 'bg-gray-700/50 text-gray-400 border-gray-600', prob: 0.3 },
};

const useTypeConfig: Record<string, { label: string; color: string }> = {
  BTC_MINING: { label: 'BTC Mining', color: 'bg-orange-900/50 text-orange-400 border-orange-700' },
  BTC_MINING_HOSTING: { label: 'BTC Hosting', color: 'bg-orange-900/50 text-orange-400 border-orange-700' },
  HPC_AI_HOSTING: { label: 'HPC/AI', color: 'bg-purple-900/50 text-purple-400 border-purple-700' },
  HPC_AI_PLANNED: { label: 'HPC Planned', color: 'bg-purple-800/30 text-purple-300 border-purple-600' },
  GPU_CLOUD: { label: 'GPU Cloud', color: 'bg-blue-900/50 text-blue-400 border-blue-700' },
  COLOCATION: { label: 'Colocation', color: 'bg-cyan-900/50 text-cyan-400 border-cyan-700' },
  MIXED: { label: 'Mixed', color: 'bg-gray-700/50 text-gray-400 border-gray-600' },
  UNCONTRACTED: { label: 'Uncontracted', color: 'bg-gray-800/50 text-gray-500 border-gray-700' },
  UNCONTRACTED_ROFR: { label: 'ROFR', color: 'bg-gray-800/50 text-gray-500 border-gray-700' },
};

// Simplified options for editing - the 3 main use types
const editableUseTypes = [
  { value: 'BTC_MINING', label: 'BTC' },
  { value: 'HPC_AI_HOSTING', label: 'HPC/AI' },
  { value: 'GPU_CLOUD', label: 'GPU Cloud' },
];

interface UsePeriod {
  id: string;
  isCurrent: boolean;
  useType: string;
  tenant: string | null;
  mwAllocation: string | null;
  leaseValueM: string | null;
  annualRevM: string | null;
  noiAnnualM: string | null;
  noiPct: string | null;
  leaseYears: string | null;
}

interface Building {
  id: string;
  name: string;
  grossMw: string | null;
  itMw: string | null;
  pue: string | null;
  grid: string | null;
  developmentPhase: string;
  energizationDate: string | null;
  confidence: string;
  probabilityOverride: string | null;
  regulatoryRisk: string | null;
  ownershipStatus: string | null;
  includeInValuation: boolean;
  notes: string | null;
  usePeriods: UsePeriod[];
}

interface Campus {
  id: string;
  name: string;
  buildings: Building[];
}

interface Site {
  id: string;
  name: string;
  country: string;
  state: string | null;
  latitude: string | null;
  longitude: string | null;
  campuses: Campus[];
}

interface Company {
  ticker: string;
  name: string;
  sites: Site[];
}

interface FlatBuilding {
  rowNum: number;
  ticker: string;
  companyName: string;
  siteName: string;
  campusName: string;
  buildingId: string;
  buildingName: string;
  phase: string;
  useType: string;
  usePeriodId: string | null;
  tenant: string | null;
  grossMw: number | null;
  itMw: number | null;
  pue: number | null;
  grid: string | null;
  probability: number;
  probabilityOverride: number | null;
  regulatoryRisk: number;
  leaseValueM: number | null;
  noiAnnualM: number | null;
  energizationDate: string | null;
  ownershipStatus: string | null;
  includeInValuation: boolean;
  building: Building;
}

type SortKey = 'ticker' | 'siteName' | 'buildingName' | 'phase' | 'useType' | 'tenant' | 'itMw' | 'noiAnnualM' | 'energizationDate';
type SortDir = 'asc' | 'desc';

interface ColumnDef {
  key: SortKey | 'rowNum' | 'actions' | 'includeEv';
  label: string;
  sortable: boolean;
  width: string;
  minWidth: string;
  align: 'left' | 'right' | 'center';
  headerClass?: string;
}

const columns: ColumnDef[] = [
  { key: 'rowNum', label: '#', sortable: false, width: '40px', minWidth: '40px', align: 'left' },
  { key: 'includeEv', label: 'EV', sortable: false, width: '32px', minWidth: '32px', align: 'center' },
  { key: 'ticker', label: 'Ticker', sortable: true, width: '70px', minWidth: '50px', align: 'left', headerClass: 'text-orange-400' },
  { key: 'siteName', label: 'Site', sortable: true, width: '140px', minWidth: '80px', align: 'left' },
  { key: 'buildingName', label: 'Building', sortable: true, width: '140px', minWidth: '80px', align: 'left' },
  { key: 'phase', label: 'Phase', sortable: true, width: '100px', minWidth: '80px', align: 'left' },
  { key: 'useType', label: 'Use', sortable: true, width: '90px', minWidth: '70px', align: 'left' },
  { key: 'tenant', label: 'Tenant', sortable: true, width: '120px', minWidth: '80px', align: 'left' },
  { key: 'itMw', label: 'IT MW', sortable: true, width: '65px', minWidth: '55px', align: 'right' },
  { key: 'noiAnnualM', label: 'Value', sortable: true, width: '80px', minWidth: '70px', align: 'right' },
  { key: 'energizationDate', label: 'Energized', sortable: true, width: '85px', minWidth: '70px', align: 'right' },
  { key: 'actions', label: 'Edit', sortable: false, width: '60px', minWidth: '60px', align: 'center' },
];

// Helper to persist filter state in localStorage
function usePersistedState<T>(key: string, defaultValue: T): [T, (val: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? JSON.parse(saved) : defaultValue;
    } catch { return defaultValue; }
  });
  const setPersistedValue = useCallback((val: T) => {
    setValue(val);
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key]);
  return [value, setPersistedValue];
}

export default function Projects() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = usePersistedState('projects-search', '');
  const [filterTicker, setFilterTicker] = usePersistedState('projects-ticker', '');
  const [filterPhase, setFilterPhase] = usePersistedState('projects-phase', '');
  const [filterUseType, setFilterUseType] = usePersistedState('projects-useType', '');
  const [filterTenant, setFilterTenant] = usePersistedState('projects-tenant', '');
  const [filterEv, setFilterEv] = usePersistedState<'' | 'included' | 'excluded'>('projects-ev', '');
  const [editingBuilding, setEditingBuilding] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = usePersistedState<SortKey>('projects-sortKey', 'ticker');
  const [sortDir, setSortDir] = usePersistedState<SortDir>('projects-sortDir', 'asc');

  const hasActiveFilters = searchTerm || filterTicker || filterPhase || filterUseType || filterTenant || filterEv;

  const clearAllFilters = useCallback(() => {
    setSearchTerm('');
    setFilterTicker('');
    setFilterPhase('');
    setFilterUseType('');
    setFilterTenant('');
    setFilterEv('');
  }, [setSearchTerm, setFilterTicker, setFilterPhase, setFilterUseType, setFilterTenant, setFilterEv]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('projects-column-widths');
    return saved ? JSON.parse(saved) : {};
  });

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/companies`);
      if (!res.ok) throw new Error('Failed to fetch companies');
      return res.json() as Promise<Company[]>;
    },
  });

  // Fetch settings for valuation factors
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/settings`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
  });

  // Valuation factors with defaults
  const factors = useMemo(() => ({
    noiMultiple: settings?.noiMultiple ?? 10,
    mwValueHpcContracted: settings?.mwValueHpcContracted ?? 25,
    mwValueHpcUncontracted: settings?.mwValueHpcUncontracted ?? 8,
    mwValueBtcMining: settings?.mwValueBtcMining ?? 0.3,
  }), [settings]);

  // Calculate building valuation
  const calcValuation = useCallback((row: FlatBuilding) => {
    const itMw = row.itMw || 0;
    const prob = row.probability;
    const useType = row.useType;

    // If has NOI, use NOI × multiple
    if (row.noiAnnualM && row.noiAnnualM > 0) {
      return row.noiAnnualM * factors.noiMultiple * prob;
    }

    // HPC/AI contracted with lease value but no NOI
    if ((useType === 'HPC_AI_HOSTING' || useType === 'GPU_CLOUD') && row.leaseValueM) {
      return row.leaseValueM * prob;
    }

    // Pipeline / uncontracted HPC
    if (useType === 'HPC_AI_PLANNED' || useType === 'UNCONTRACTED' || useType === 'UNCONTRACTED_ROFR' ||
        ((useType === 'HPC_AI_HOSTING' || useType === 'GPU_CLOUD') && !row.leaseValueM && !row.noiAnnualM)) {
      return itMw * factors.mwValueHpcUncontracted * prob;
    }

    // BTC Mining
    if (useType === 'BTC_MINING' || useType === 'BTC_MINING_HOSTING') {
      return itMw * factors.mwValueBtcMining * prob;
    }

    return null;
  }, [factors]);

  const updateBuildingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/buildings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update building');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
      setEditingBuilding(null);
      setEditFormData({});
    },
  });

  const toggleIncludeMutation = useMutation({
    mutationFn: async ({ id, include }: { id: string; include: boolean }) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/buildings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeInValuation: include }),
      });
      if (!res.ok) throw new Error('Failed to toggle');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
    },
  });

  const deleteBuildingMutation = useMutation({
    mutationFn: async (id: string) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/buildings/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete building');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeleteConfirm(null);
    },
  });

  const updateUsePeriodMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/use-periods/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update use period');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
    },
  });

  const createUsePeriodMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/use-periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create use period');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
    },
  });

  // Flatten all buildings into a single list
  const flatBuildings = useMemo(() => {
    if (!companies) return [];
    const rows: FlatBuilding[] = [];
    let rowNum = 0;

    for (const company of companies) {
      if (!company.sites) continue;
      if (filterTicker && company.ticker !== filterTicker) continue;

      for (const site of company.sites) {
        for (const campus of site.campuses || []) {
          for (const building of campus.buildings || []) {
            if (filterPhase && building.developmentPhase !== filterPhase) continue;
            if (filterEv === 'included' && !building.includeInValuation) continue;
            if (filterEv === 'excluded' && building.includeInValuation) continue;

            const phase = building.developmentPhase || 'DILIGENCE';
            const defaultProb = phaseConfig[phase]?.prob || 0.5;
            const probOverride = building.probabilityOverride ? parseFloat(building.probabilityOverride) : null;

            // Get current use periods (supports splits)
            const currentUses = (building.usePeriods || []).filter(up => up.isCurrent);

            // Create one row per use period for split buildings
            const periods = currentUses.length > 0 ? currentUses : [null];
            for (const currentUse of periods) {
              const useType = currentUse?.useType || 'UNCONTRACTED';
              const tenant = currentUse?.tenant || null;

              if (filterUseType && useType !== filterUseType) continue;
              if (filterTenant && (tenant || '') !== filterTenant) continue;

              rowNum++;
              // For split buildings use mwAllocation; for unsplit use building itMw
              const periodMw = currentUse?.mwAllocation
                ? parseFloat(currentUse.mwAllocation)
                : building.itMw ? parseFloat(building.itMw) : null;

              rows.push({
                rowNum,
                ticker: company.ticker,
                companyName: company.name,
                siteName: site.name,
                campusName: campus.name,
                buildingId: building.id,
                buildingName: building.name,
                phase,
                useType,
                usePeriodId: currentUse?.id || null,
                tenant,
                grossMw: building.grossMw ? parseFloat(building.grossMw) : null,
                itMw: periodMw,
                pue: building.pue ? parseFloat(building.pue) : null,
                grid: building.grid || null,
                probability: probOverride ?? defaultProb,
                probabilityOverride: probOverride,
                regulatoryRisk: building.regulatoryRisk ? parseFloat(building.regulatoryRisk) : 1.0,
                leaseValueM: currentUse?.leaseValueM ? parseFloat(currentUse.leaseValueM) : null,
                noiAnnualM: currentUse?.noiAnnualM ? parseFloat(currentUse.noiAnnualM) : null,
                energizationDate: building.energizationDate || null,
                ownershipStatus: building.ownershipStatus || null,
                includeInValuation: building.includeInValuation ?? true,
                building,
              });
            }
          }
        }
      }
    }

    return rows;
  }, [companies, filterTicker, filterPhase, filterUseType, filterTenant, filterEv]);

  // Filter by search term
  const filteredRows = useMemo(() => {
    let rows = flatBuildings;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      rows = rows.filter(row => {
        return row.buildingName.toLowerCase().includes(search) ||
          row.ticker.toLowerCase().includes(search) ||
          row.companyName.toLowerCase().includes(search) ||
          row.siteName.toLowerCase().includes(search) ||
          row.campusName.toLowerCase().includes(search) ||
          row.tenant?.toLowerCase().includes(search);
      });
    }

    // Sort
    rows = [...rows].sort((a, b) => {
      let aVal: any = a[sortKey];
      let bVal: any = b[sortKey];

      // Handle nulls
      if (aVal === null || aVal === undefined) aVal = sortDir === 'asc' ? Infinity : -Infinity;
      if (bVal === null || bVal === undefined) bVal = sortDir === 'asc' ? Infinity : -Infinity;

      // Handle strings
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      // Handle dates
      if (sortKey === 'energizationDate') {
        aVal = aVal === Infinity || aVal === -Infinity ? aVal : new Date(aVal).getTime();
        bVal = bVal === Infinity || bVal === -Infinity ? bVal : new Date(bVal).getTime();
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [flatBuildings, searchTerm, sortKey, sortDir]);

  const uniqueTickers = useMemo(() => {
    return [...new Set(companies?.map(c => c.ticker) || [])].sort();
  }, [companies]);

  const uniqueTenants = useMemo(() => {
    if (!companies) return [];
    const tenants = new Set<string>();
    for (const company of companies) {
      for (const site of company.sites || []) {
        for (const campus of site.campuses || []) {
          for (const building of campus.buildings || []) {
            const tenant = building.usePeriods?.[0]?.tenant;
            if (tenant) tenants.add(tenant);
          }
        }
      }
    }
    return [...tenants].sort();
  }, [companies]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleColumnResize = useCallback((key: string, width: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [key]: width };
      localStorage.setItem('projects-column-widths', JSON.stringify(next));
      return next;
    });
  }, []);

  const startEditBuilding = (row: FlatBuilding) => {
    setEditingBuilding(row.buildingId);
    setEditFormData({
      developmentPhase: row.phase,
      probabilityOverride: row.probabilityOverride !== null ? (row.probabilityOverride * 100).toString() : '',
      regulatoryRisk: (row.regulatoryRisk * 100).toString(),
      grossMw: row.grossMw?.toString() || '',
      itMw: row.itMw?.toString() || '',
      pue: row.pue?.toString() || '',
      useType: row.useType,
      usePeriodId: row.usePeriodId,
      originalUseType: row.useType,
    });
  };

  const saveBuilding = async () => {
    if (!editingBuilding) return;
    const probOverride = editFormData.probabilityOverride
      ? parseFloat(editFormData.probabilityOverride) / 100
      : null;
    const regRisk = editFormData.regulatoryRisk
      ? parseFloat(editFormData.regulatoryRisk) / 100
      : 1.0;

    // Update building data
    updateBuildingMutation.mutate({
      id: editingBuilding,
      data: {
        developmentPhase: editFormData.developmentPhase,
        probabilityOverride: probOverride,
        regulatoryRisk: regRisk,
        grossMw: editFormData.grossMw ? parseFloat(editFormData.grossMw) : null,
        itMw: editFormData.itMw ? parseFloat(editFormData.itMw) : null,
        pue: editFormData.pue ? parseFloat(editFormData.pue) : null,
      },
    });

    // Update use type if changed
    if (editFormData.useType !== editFormData.originalUseType) {
      if (editFormData.usePeriodId) {
        // Update existing use period
        updateUsePeriodMutation.mutate({
          id: editFormData.usePeriodId,
          data: { useType: editFormData.useType },
        });
      } else {
        // Create new use period
        createUsePeriodMutation.mutate({
          buildingId: editingBuilding,
          useType: editFormData.useType,
          isCurrent: true,
        });
      }
    }
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deleteBuildingMutation.mutate(deleteConfirm.id);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatMoney = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}M`;
  };

  const getColumnWidth = (col: ColumnDef) => {
    return columnWidths[col.key] ? `${columnWidths[col.key]}px` : col.width;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-300">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filteredRows.length} buildings
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 pb-3 flex-shrink-0">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search ticker, site, building, tenant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={filterTicker}
                onChange={(e) => setFilterTicker(e.target.value)}
                className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Companies</option>
                {uniqueTickers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <select
              value={filterPhase}
              onChange={(e) => setFilterPhase(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Phases</option>
              {Object.entries(phaseConfig).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            <select
              value={filterUseType}
              onChange={(e) => setFilterUseType(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Use Types</option>
              <option value="BTC_MINING">BTC Mining</option>
              <option value="HPC_AI_HOSTING">HPC/AI</option>
              <option value="GPU_CLOUD">GPU Cloud</option>
            </select>

            <select
              value={filterTenant}
              onChange={(e) => setFilterTenant(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Tenants</option>
              {uniqueTenants.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <select
              value={filterEv}
              onChange={(e) => setFilterEv(e.target.value as '' | 'included' | 'excluded')}
              className={`border rounded-lg px-3 py-2 text-sm ${
                filterEv === 'included' ? 'bg-green-900/30 border-green-600 text-green-400' :
                filterEv === 'excluded' ? 'bg-gray-700 border-gray-600 text-gray-400' :
                'bg-gray-700 border-gray-600 text-white'
              }`}
            >
              <option value="">All (EV)</option>
              <option value="included">In EV</option>
              <option value="excluded">Not in EV</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-orange-400 hover:text-orange-300 underline underline-offset-2 px-2 py-2 whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table with sticky header */}
      <div className="flex-1 overflow-hidden px-4 pb-4">
        <div className="h-full bg-gray-800 border border-gray-700 rounded-lg overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm table-fixed">
              <thead className="sticky top-0 z-10 bg-gray-800">
                <tr className="border-b border-gray-700">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={{ width: getColumnWidth(col), minWidth: col.minWidth }}
                      className={`px-2 py-2 text-xs font-medium uppercase ${col.headerClass || 'text-gray-400'} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.sortable ? 'cursor-pointer hover:bg-gray-700/50 select-none' : ''} relative group`}
                      onClick={() => col.sortable && handleSort(col.key as SortKey)}
                    >
                      <div className="flex items-center gap-1" style={{ justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start' }}>
                        <span>{col.label}</span>
                        {col.sortable && (
                          <span className="text-gray-600">
                            {sortKey === col.key ? (
                              sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                            )}
                          </span>
                        )}
                      </div>
                      {/* Resize handle */}
                      {col.key !== 'actions' && (
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-orange-500/50 opacity-0 group-hover:opacity-100"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const startX = e.clientX;
                            const startWidth = (e.target as HTMLElement).parentElement?.offsetWidth || 100;

                            const onMouseMove = (moveEvent: MouseEvent) => {
                              const diff = moveEvent.clientX - startX;
                              const newWidth = Math.max(parseInt(col.minWidth), startWidth + diff);
                              handleColumnResize(col.key, newWidth);
                            };

                            const onMouseUp = () => {
                              document.removeEventListener('mousemove', onMouseMove);
                              document.removeEventListener('mouseup', onMouseUp);
                            };

                            document.addEventListener('mousemove', onMouseMove);
                            document.addEventListener('mouseup', onMouseUp);
                          }}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredRows.map((row, idx) => {
                  const isEditing = editingBuilding === row.buildingId;

                  return (
                    <tr
                      key={row.buildingId}
                      className={`hover:bg-gray-700/30 transition cursor-pointer ${
                        selectedBuildingId === row.buildingId ? 'bg-orange-900/20 border-l-2 border-orange-500' : ''
                      } ${!row.includeInValuation ? 'opacity-40' : ''}`}
                      onClick={() => !isEditing && setSelectedBuildingId(row.buildingId)}
                    >
                      <td className="px-2 py-1.5 text-gray-500 text-xs">{idx + 1}</td>
                      <td className="px-1 py-1.5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleIncludeMutation.mutate({ id: row.buildingId, include: !row.includeInValuation });
                          }}
                          className={`p-0.5 rounded transition-colors ${
                            row.includeInValuation
                              ? 'text-green-400 hover:text-green-300 hover:bg-green-900/30'
                              : 'text-gray-600 hover:text-gray-400 hover:bg-gray-700/50'
                          }`}
                          title={row.includeInValuation ? 'Included in EV — click to exclude' : 'Excluded from EV — click to include'}
                        >
                          {row.includeInValuation ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-orange-500 font-medium text-xs">{row.ticker}</span>
                      </td>
                      <td className="px-2 py-1.5 text-gray-300 text-xs truncate" title={`${row.siteName} / ${row.campusName}`}>
                        {row.siteName}
                      </td>
                      <td className="px-2 py-1.5 text-gray-200 text-xs truncate" title={row.buildingName}>
                        {row.buildingName}
                      </td>
                      <td className="px-2 py-1.5">
                        {isEditing ? (
                          <select
                            value={editFormData.developmentPhase || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, developmentPhase: e.target.value })}
                            className="bg-gray-700 border border-gray-600 text-white rounded px-1 py-0.5 text-xs w-full"
                          >
                            {Object.entries(phaseConfig).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border ${phaseConfig[row.phase]?.color || 'bg-gray-700 text-gray-400'}`}>
                            {phaseConfig[row.phase]?.label || row.phase}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {isEditing ? (
                          <select
                            value={editFormData.useType || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, useType: e.target.value })}
                            className="bg-gray-700 border border-gray-600 text-white rounded px-1 py-0.5 text-xs w-full"
                          >
                            {editableUseTypes.map(({ value, label }) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border ${useTypeConfig[row.useType]?.color || 'bg-gray-700 text-gray-400'}`}>
                            {useTypeConfig[row.useType]?.label || row.useType}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-gray-400 text-xs truncate" title={row.tenant || ''}>
                        {row.tenant || '-'}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editFormData.itMw || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, itMw: e.target.value })}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded px-1 py-0.5 text-xs text-right"
                          />
                        ) : row.itMw !== null ? (
                          <span className="text-gray-300 text-xs">{Math.round(row.itMw)}</span>
                        ) : (
                          <span className="text-gray-600 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {(() => {
                          const val = calcValuation(row);
                          if (val !== null && val > 0) {
                            return <span className="text-green-400 text-xs">{formatMoney(Math.round(val))}</span>;
                          }
                          return <span className="text-gray-600 text-xs">-</span>;
                        })()}
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs text-gray-400">
                        {formatDate(row.energizationDate)}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={saveBuilding}
                                disabled={updateBuildingMutation.isPending}
                                className="p-1 bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                <Save className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => { setEditingBuilding(null); setEditFormData({}); }}
                                className="p-1 bg-gray-600 text-white rounded hover:bg-gray-500"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditBuilding(row)}
                                className="p-1 hover:bg-gray-600 rounded"
                                title="Edit"
                              >
                                <Edit2 className="h-3 w-3 text-gray-500" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ id: row.buildingId, name: row.buildingName })}
                                className="p-1 hover:bg-red-900/50 rounded"
                                title="Delete"
                              >
                                <Trash2 className="h-3 w-3 text-red-500/70 hover:text-red-400" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                      No buildings found. Import data to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="h-6 w-6 text-red-500" />
              <h2 className="text-lg font-semibold text-gray-200">Delete Building</h2>
            </div>
            <p className="text-sm text-gray-400 mb-2">
              Are you sure you want to delete this building?
            </p>
            <p className="text-sm text-white font-medium mb-4 p-2 bg-gray-700/50 rounded">
              "{deleteConfirm.name}"
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteBuildingMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Building Detail Panel */}
      {selectedBuildingId && (
        <BuildingDetailPanel
          buildingId={selectedBuildingId}
          onClose={() => setSelectedBuildingId(null)}
        />
      )}
    </div>
  );
}
