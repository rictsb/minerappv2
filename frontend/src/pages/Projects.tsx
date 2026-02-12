import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Edit2,
  Save,
  X,
  Layers,
  Box,
  Trash2,
  MapPin,
} from 'lucide-react';

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

interface UsePeriod {
  id: string;
  useType: string;
  tenant: string | null;
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
  developmentPhase: string;
  energizationDate: string | null;
  confidence: string;
  probabilityOverride: string | null;
  regulatoryRisk: string | null;
  ownershipStatus: string | null;
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

export default function Projects() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTicker, setFilterTicker] = useState('');
  const [filterPhase, setFilterPhase] = useState('');
  const [filterUseType, setFilterUseType] = useState('');
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [expandedCampuses, setExpandedCampuses] = useState<Set<string>>(new Set());
  const [editingBuilding, setEditingBuilding] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/companies`);
      if (!res.ok) throw new Error('Failed to fetch companies');
      return res.json() as Promise<Company[]>;
    },
  });

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

  const deleteCampusMutation = useMutation({
    mutationFn: async (id: string) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/campuses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete campus');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeleteConfirm(null);
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (id: string) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/sites/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete site');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeleteConfirm(null);
    },
  });

  // Flatten data for display
  interface FlatRow {
    rowNum: number;
    type: 'site' | 'campus' | 'building';
    depth: number;
    ticker: string;
    id: string;
    name: string;
    location?: string;
    phase?: string;
    useType?: string;
    tenant?: string;
    grossMw?: number;
    itMw?: number;
    pue?: number;
    probability?: number;
    probabilityOverride?: number | null;
    regulatoryRisk?: number;
    leaseValueM?: number;
    noiAnnualM?: number;
    energizationDate?: string;
    hasChildren: boolean;
    siteId?: string;
    campusId?: string;
    building?: Building;
  }

  const flattenedRows = useMemo(() => {
    if (!companies) return [];
    const rows: FlatRow[] = [];
    let rowNum = 0;

    const sortedCompanies = [...companies].sort((a, b) => a.ticker.localeCompare(b.ticker));

    for (const company of sortedCompanies) {
      if (!company.sites) continue;
      if (filterTicker && company.ticker !== filterTicker) continue;

      const sortedSites = [...company.sites].sort((a, b) => a.name.localeCompare(b.name));

      for (const site of sortedSites) {
        rowNum++;
        const siteHasChildren = site.campuses && site.campuses.length > 0;

        // Calculate total MW for site
        let siteTotalMw = 0;
        site.campuses?.forEach(campus => {
          campus.buildings?.forEach(building => {
            siteTotalMw += parseFloat(building.grossMw || '0');
          });
        });

        rows.push({
          rowNum,
          type: 'site',
          depth: 0,
          ticker: company.ticker,
          id: site.id,
          name: site.name,
          location: `${site.country}${site.state ? `, ${site.state}` : ''}`,
          grossMw: siteTotalMw || undefined,
          hasChildren: siteHasChildren,
        });

        if (expandedSites.has(site.id)) {
          const sortedCampuses = [...(site.campuses || [])].sort((a, b) => a.name.localeCompare(b.name));

          for (const campus of sortedCampuses) {
            rowNum++;
            const campusHasChildren = campus.buildings && campus.buildings.length > 0;

            // Calculate total MW for campus
            let campusTotalMw = 0;
            campus.buildings?.forEach(building => {
              campusTotalMw += parseFloat(building.grossMw || '0');
            });

            rows.push({
              rowNum,
              type: 'campus',
              depth: 1,
              ticker: company.ticker,
              id: campus.id,
              name: campus.name,
              grossMw: campusTotalMw || undefined,
              hasChildren: campusHasChildren,
              siteId: site.id,
            });

            if (expandedCampuses.has(campus.id)) {
              const sortedBuildings = [...(campus.buildings || [])].sort((a, b) => a.name.localeCompare(b.name));

              for (const building of sortedBuildings) {
                // Apply filters
                if (filterPhase && building.developmentPhase !== filterPhase) continue;

                const currentUse = building.usePeriods?.[0];
                if (filterUseType && currentUse?.useType !== filterUseType) continue;

                rowNum++;
                const phase = building.developmentPhase || 'DILIGENCE';
                const defaultProb = phaseConfig[phase]?.prob || 0.5;
                const probOverride = building.probabilityOverride ? parseFloat(building.probabilityOverride) : null;

                rows.push({
                  rowNum,
                  type: 'building',
                  depth: 2,
                  ticker: company.ticker,
                  id: building.id,
                  name: building.name,
                  phase,
                  useType: currentUse?.useType || 'UNCONTRACTED',
                  tenant: currentUse?.tenant || undefined,
                  grossMw: building.grossMw ? parseFloat(building.grossMw) : undefined,
                  itMw: building.itMw ? parseFloat(building.itMw) : undefined,
                  pue: building.pue ? parseFloat(building.pue) : undefined,
                  probability: probOverride ?? defaultProb,
                  probabilityOverride: probOverride,
                  regulatoryRisk: building.regulatoryRisk ? parseFloat(building.regulatoryRisk) : 1.0,
                  leaseValueM: currentUse?.leaseValueM ? parseFloat(currentUse.leaseValueM) : undefined,
                  noiAnnualM: currentUse?.noiAnnualM ? parseFloat(currentUse.noiAnnualM) : undefined,
                  energizationDate: building.energizationDate || undefined,
                  hasChildren: false,
                  siteId: site.id,
                  campusId: campus.id,
                  building,
                });
              }
            }
          }
        }
      }
    }

    return rows;
  }, [companies, expandedSites, expandedCampuses, filterTicker, filterPhase, filterUseType]);

  // Filter by search term
  const filteredRows = useMemo(() => {
    if (!searchTerm) return flattenedRows;
    const search = searchTerm.toLowerCase();
    return flattenedRows.filter(row => {
      return row.name.toLowerCase().includes(search) ||
        row.ticker.toLowerCase().includes(search) ||
        row.tenant?.toLowerCase().includes(search) ||
        row.location?.toLowerCase().includes(search);
    });
  }, [flattenedRows, searchTerm]);

  const uniqueTickers = useMemo(() => {
    return [...new Set(companies?.map(c => c.ticker) || [])].sort();
  }, [companies]);

  const toggleSite = (siteId: string) => {
    setExpandedSites(prev => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  };

  const toggleCampus = (campusId: string) => {
    setExpandedCampuses(prev => {
      const next = new Set(prev);
      if (next.has(campusId)) next.delete(campusId);
      else next.add(campusId);
      return next;
    });
  };

  const expandAll = () => {
    const allSiteIds = new Set<string>();
    const allCampusIds = new Set<string>();
    companies?.forEach(company => {
      company.sites?.forEach(site => {
        allSiteIds.add(site.id);
        site.campuses?.forEach(campus => {
          allCampusIds.add(campus.id);
        });
      });
    });
    setExpandedSites(allSiteIds);
    setExpandedCampuses(allCampusIds);
  };

  const collapseAll = () => {
    setExpandedSites(new Set());
    setExpandedCampuses(new Set());
  };

  const startEditBuilding = (row: FlatRow) => {
    if (row.type !== 'building' || !row.building) return;
    setEditingBuilding(row.id);
    setEditFormData({
      developmentPhase: row.phase,
      probabilityOverride: typeof row.probabilityOverride === 'number' ? (row.probabilityOverride * 100).toString() : '',
      regulatoryRisk: typeof row.regulatoryRisk === 'number' ? (row.regulatoryRisk * 100).toString() : '100',
      grossMw: row.grossMw?.toString() || '',
      itMw: row.itMw?.toString() || '',
      pue: row.pue?.toString() || '',
    });
  };

  const saveBuilding = () => {
    if (!editingBuilding) return;
    const probOverride = editFormData.probabilityOverride
      ? parseFloat(editFormData.probabilityOverride) / 100
      : null;
    const regRisk = editFormData.regulatoryRisk
      ? parseFloat(editFormData.regulatoryRisk) / 100
      : 1.0;

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
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'building') {
      deleteBuildingMutation.mutate(deleteConfirm.id);
    } else if (deleteConfirm.type === 'campus') {
      deleteCampusMutation.mutate(deleteConfirm.id);
    } else if (deleteConfirm.type === 'site') {
      deleteSiteMutation.mutate(deleteConfirm.id);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatMoney = (value: number | undefined) => {
    if (!value) return '-';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}M`;
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-300">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">
            Site → Campus → Building hierarchy
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={expandAll} className="px-3 py-1.5 text-sm text-orange-500 hover:text-orange-400">
            Expand All
          </button>
          <button onClick={collapseAll} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-300">
            Collapse All
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search sites, campuses, buildings..."
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
            {Object.entries(useTypeConfig).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/80">
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-12">#</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-16">Ticker</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-28">Phase</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-24">Use</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-32">Tenant</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase w-16">MW</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase w-16">Prob</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-red-400 uppercase w-16" title="Regulatory Risk Factor">Reg Risk</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase w-20">NOI/Yr</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase w-24">Energized</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filteredRows.map((row) => {
                const isEditing = row.type === 'building' && editingBuilding === row.id;
                const indentPx = row.depth * 24;

                return (
                  <tr
                    key={`${row.type}-${row.id}`}
                    className={`hover:bg-gray-700/30 transition ${
                      row.type === 'site' ? 'bg-gray-800/50' :
                      row.type === 'campus' ? 'bg-gray-800/30' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-gray-500 text-xs">{row.rowNum}</td>
                    <td className="px-3 py-2">
                      <span className="text-orange-500 font-medium text-xs">{row.ticker}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center" style={{ paddingLeft: `${indentPx}px` }}>
                        {row.hasChildren && (
                          <button
                            onClick={() => row.type === 'site' ? toggleSite(row.id) : toggleCampus(row.id)}
                            className="mr-2 p-0.5 hover:bg-gray-600 rounded"
                          >
                            {(row.type === 'site' ? expandedSites.has(row.id) : expandedCampuses.has(row.id)) ? (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        )}
                        {!row.hasChildren && <span className="w-5 mr-2" />}

                        {row.type === 'site' && <MapPin className="h-4 w-4 mr-2 text-orange-500" />}
                        {row.type === 'campus' && <Layers className="h-4 w-4 mr-2 text-blue-400" />}
                        {row.type === 'building' && <Box className="h-4 w-4 mr-2 text-gray-400" />}

                        <div className="flex flex-col">
                          <span className={`${row.type === 'site' ? 'text-gray-200 font-medium' : row.type === 'campus' ? 'text-gray-300' : 'text-gray-400'}`}>
                            {row.name}
                          </span>
                          {row.type === 'site' && row.location && (
                            <span className="text-xs text-gray-500">{row.location}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {row.type === 'building' && row.phase && (
                        isEditing ? (
                          <select
                            value={editFormData.developmentPhase || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, developmentPhase: e.target.value })}
                            className="bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs"
                          >
                            {Object.entries(phaseConfig).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${phaseConfig[row.phase]?.color || 'bg-gray-700 text-gray-400'}`}>
                            {phaseConfig[row.phase]?.label || row.phase}
                          </span>
                        )
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.type === 'building' && row.useType && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${useTypeConfig[row.useType]?.color || 'bg-gray-700 text-gray-400'}`}>
                          {useTypeConfig[row.useType]?.label || row.useType}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs truncate max-w-[120px]" title={row.tenant}>
                      {row.tenant || '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editFormData.grossMw || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, grossMw: e.target.value })}
                          className="w-16 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs text-right"
                        />
                      ) : row.grossMw ? (
                        <span className="text-gray-300">{Math.round(row.grossMw)}</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {row.type === 'building' && (
                        isEditing ? (
                          <input
                            type="number"
                            placeholder={`${Math.round((phaseConfig[editFormData.developmentPhase]?.prob || 0.5) * 100)}%`}
                            value={editFormData.probabilityOverride || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, probabilityOverride: e.target.value })}
                            className="w-16 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs text-right"
                          />
                        ) : (
                          <span className={row.probabilityOverride !== null ? 'text-orange-400' : 'text-gray-400'}>
                            {Math.round((row.probability || 0) * 100)}%
                          </span>
                        )
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {row.type === 'building' && (
                        isEditing ? (
                          <input
                            type="number"
                            placeholder="100"
                            value={editFormData.regulatoryRisk || '100'}
                            onChange={(e) => setEditFormData({ ...editFormData, regulatoryRisk: e.target.value })}
                            className="w-16 bg-gray-700 border border-red-600/50 text-white rounded px-2 py-1 text-xs text-right"
                            min="0"
                            max="100"
                          />
                        ) : (
                          <span className={(row.regulatoryRisk || 1) < 1 ? 'text-red-400' : 'text-gray-500'}>
                            {Math.round((row.regulatoryRisk || 1) * 100)}%
                          </span>
                        )
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {row.type === 'building' && row.noiAnnualM ? (
                        <span className="text-green-400">{formatMoney(row.noiAnnualM)}</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-400">
                      {row.type === 'building' ? formatDate(row.energizationDate) : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
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
                            {row.type === 'building' && (
                              <button
                                onClick={() => startEditBuilding(row)}
                                className="p-1 hover:bg-gray-600 rounded"
                                title="Edit"
                              >
                                <Edit2 className="h-3 w-3 text-gray-500" />
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteConfirm({ type: row.type, id: row.id, name: row.name })}
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
                    No projects found. Import data to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="h-6 w-6 text-red-500" />
              <h2 className="text-lg font-semibold text-gray-200">Confirm Delete</h2>
            </div>
            <p className="text-sm text-gray-400 mb-2">
              Are you sure you want to delete this {deleteConfirm.type}?
            </p>
            <p className="text-sm text-white font-medium mb-4 p-2 bg-gray-700/50 rounded">
              "{deleteConfirm.name}"
            </p>
            {deleteConfirm.type === 'site' && (
              <p className="text-sm text-yellow-400 mb-4">
                This will also delete all campuses and buildings within this site.
              </p>
            )}
            {deleteConfirm.type === 'campus' && (
              <p className="text-sm text-yellow-400 mb-4">
                This will also delete all buildings within this campus.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteBuildingMutation.isPending || deleteCampusMutation.isPending || deleteSiteMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
