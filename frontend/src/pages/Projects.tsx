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
  Zap,
  Calendar,
  GitBranch,
  Building2,
  Trash2,
} from 'lucide-react';

// Helper to get API URL
function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  return apiUrl;
}

// Status badge colors (dark theme)
const statusColors: Record<string, string> = {
  OPERATIONAL: 'bg-green-900/50 text-green-400 border border-green-700',
  PARTIALLY_ONLINE: 'bg-yellow-900/50 text-yellow-400 border border-yellow-700',
  UNDER_CONSTRUCTION: 'bg-blue-900/50 text-blue-400 border border-blue-700',
  CONTRACTED: 'bg-purple-900/50 text-purple-400 border border-purple-700',
  PIPELINE: 'bg-gray-700/50 text-gray-400 border border-gray-600',
  OPTION: 'bg-orange-900/50 text-orange-400 border border-orange-700',
  DISCUSSION: 'bg-red-900/50 text-red-400 border border-red-700',
};

const useTypeLabels: Record<string, string> = {
  BTC_MINING: 'BTC Mining',
  HPC_LEASE: 'HPC Lease',
  GPU_CLOUD: 'GPU Cloud',
  COLOCATION: 'Colocation',
  MIXED: 'Mixed',
  DEVELOPMENT: 'Development',
};

const useTypeColors: Record<string, string> = {
  BTC_MINING: 'bg-orange-900/50 text-orange-400 border border-orange-700',
  HPC_LEASE: 'bg-purple-900/50 text-purple-400 border border-purple-700',
  GPU_CLOUD: 'bg-blue-900/50 text-blue-400 border border-blue-700',
  COLOCATION: 'bg-cyan-900/50 text-cyan-400 border border-cyan-700',
  MIXED: 'bg-gray-700/50 text-gray-400 border border-gray-600',
  DEVELOPMENT: 'bg-yellow-900/50 text-yellow-400 border border-yellow-700',
};

interface Company {
  ticker: string;
  name: string;
  sites: Site[];
}

interface Site {
  id: string;
  ticker: string;
  name: string;
  country: string;
  state: string | null;
  ownershipStatus: string;
  confidence: string;
  includeInValuation: boolean;
  parentSiteId: string | null;
  phases: Phase[];
  childSites?: Site[];
}

interface Phase {
  id: string;
  siteId: string;
  name: string;
  status: string;
  grossMw: string | null;
  itMw: string | null;
  pue: string | null;
  currentUse: string;
  energizationDate: string | null;
  tenancies: Tenancy[];
}

interface Tenancy {
  id: string;
  tenant: string;
  useType: string;
  leaseValueM: string | null;
  annualRevenueM: string | null;
}

// Flattened row for display
interface FlatRow {
  rowNum: number;
  type: 'site' | 'phase' | 'tenancy';
  depth: number;
  ticker: string;
  companyName: string;
  siteId: string;
  siteName: string;
  phaseId?: string;
  phaseName?: string;
  tenancyId?: string;
  tenantName?: string;
  status?: string;
  useType?: string;
  grossMw?: number;
  itMw?: number;
  pue?: number;
  energizationDate?: string;
  valueM?: number;
  annualRevenueM?: number;
  country: string;
  state?: string;
  confidence?: string;
  isParentSite: boolean;
  hasChildren: boolean;
}

export default function Projects() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTicker, setFilterTicker] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterUseType, setFilterUseType] = useState<string>('');
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<'site' | 'phase' | 'tenancy' | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitSiteId, setSplitSiteId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);

  // Fetch all companies with sites
  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/companies`);
      if (!res.ok) throw new Error('Failed to fetch companies');
      return res.json() as Promise<Company[]>;
    },
  });

  // Update site mutation
  const updateSiteMutation = useMutation({
    mutationFn: async ({ siteId, data }: { siteId: string; data: any }) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/sites/${siteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update site');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      cancelEdit();
    },
  });

  // Update phase mutation
  const updatePhaseMutation = useMutation({
    mutationFn: async ({ phaseId, data }: { phaseId: string; data: any }) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/phases/${phaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update phase');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      cancelEdit();
    },
  });

  // Delete site mutation
  const deleteSiteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/sites/${siteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete site');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeleteConfirm(null);
    },
  });

  // Delete phase mutation
  const deletePhaseMutation = useMutation({
    mutationFn: async (phaseId: string) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/phases/${phaseId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete phase');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeleteConfirm(null);
    },
  });

  // Delete tenancy mutation
  const deleteTenancyMutation = useMutation({
    mutationFn: async (tenancyId: string) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/tenancies/${tenancyId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete tenancy');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeleteConfirm(null);
    },
  });

  // Flatten the hierarchy for display
  const flattenedRows = useMemo(() => {
    if (!companies) return [];

    const rows: FlatRow[] = [];
    let rowNum = 0;

    // Sort companies by ticker
    const sortedCompanies = [...companies].sort((a, b) => a.ticker.localeCompare(b.ticker));

    for (const company of sortedCompanies) {
      if (!company.sites) continue;

      // Build a map of parent sites and their children
      const siteMap = new Map<string, Site>();
      const rootSites: Site[] = [];

      for (const site of company.sites) {
        siteMap.set(site.id, { ...site, childSites: [] });
      }

      // Link children to parents
      for (const site of company.sites) {
        const siteWithChildren = siteMap.get(site.id)!;
        if (site.parentSiteId && siteMap.has(site.parentSiteId)) {
          siteMap.get(site.parentSiteId)!.childSites!.push(siteWithChildren);
        } else {
          rootSites.push(siteWithChildren);
        }
      }

      // Sort root sites by name
      rootSites.sort((a, b) => a.name.localeCompare(b.name));

      // Recursive function to add sites and their children
      const addSite = (site: Site, depth: number) => {
        rowNum++;
        const hasChildren = (site.childSites && site.childSites.length > 0) || (site.phases && site.phases.length > 0);

        // Calculate total value for the site
        let totalValueM = 0;
        let totalAnnualRevenueM = 0;
        site.phases?.forEach(phase => {
          phase.tenancies?.forEach(tenancy => {
            if (tenancy.leaseValueM) totalValueM += parseFloat(tenancy.leaseValueM);
            if (tenancy.annualRevenueM) totalAnnualRevenueM += parseFloat(tenancy.annualRevenueM);
          });
        });

        // Calculate total MW for the site
        let totalGrossMw = 0;
        site.phases?.forEach(phase => {
          if (phase.grossMw) totalGrossMw += parseFloat(phase.grossMw);
        });

        rows.push({
          rowNum,
          type: 'site',
          depth,
          ticker: company.ticker,
          companyName: company.name,
          siteId: site.id,
          siteName: site.name,
          country: site.country,
          state: site.state || undefined,
          confidence: site.confidence,
          isParentSite: !site.parentSiteId,
          hasChildren,
          grossMw: totalGrossMw || undefined,
          valueM: totalValueM || undefined,
          annualRevenueM: totalAnnualRevenueM || undefined,
        });

        // If site is expanded, show child sites first, then phases
        if (expandedSites.has(site.id)) {
          // Child sites
          if (site.childSites && site.childSites.length > 0) {
            site.childSites.sort((a, b) => a.name.localeCompare(b.name));
            for (const childSite of site.childSites) {
              addSite(childSite, depth + 1);
            }
          }

          // Phases
          if (site.phases && site.phases.length > 0) {
            const sortedPhases = [...site.phases].sort((a, b) => a.name.localeCompare(b.name));
            for (const phase of sortedPhases) {
              rowNum++;

              // Calculate phase value
              let phaseValueM = 0;
              let phaseAnnualRevenueM = 0;
              phase.tenancies?.forEach(tenancy => {
                if (tenancy.leaseValueM) phaseValueM += parseFloat(tenancy.leaseValueM);
                if (tenancy.annualRevenueM) phaseAnnualRevenueM += parseFloat(tenancy.annualRevenueM);
              });

              rows.push({
                rowNum,
                type: 'phase',
                depth: depth + 1,
                ticker: company.ticker,
                companyName: company.name,
                siteId: site.id,
                siteName: site.name,
                phaseId: phase.id,
                phaseName: phase.name,
                status: phase.status,
                useType: phase.currentUse,
                grossMw: phase.grossMw ? parseFloat(phase.grossMw) : undefined,
                itMw: phase.itMw ? parseFloat(phase.itMw) : undefined,
                pue: phase.pue ? parseFloat(phase.pue) : undefined,
                energizationDate: phase.energizationDate || undefined,
                valueM: phaseValueM || undefined,
                annualRevenueM: phaseAnnualRevenueM || undefined,
                country: site.country,
                state: site.state || undefined,
                isParentSite: false,
                hasChildren: phase.tenancies && phase.tenancies.length > 0,
              });

              // If phase is expanded, show tenancies
              if (expandedPhases.has(phase.id) && phase.tenancies && phase.tenancies.length > 0) {
                for (const tenancy of phase.tenancies) {
                  rowNum++;
                  rows.push({
                    rowNum,
                    type: 'tenancy',
                    depth: depth + 2,
                    ticker: company.ticker,
                    companyName: company.name,
                    siteId: site.id,
                    siteName: site.name,
                    phaseId: phase.id,
                    phaseName: phase.name,
                    tenancyId: tenancy.id,
                    tenantName: tenancy.tenant,
                    useType: tenancy.useType,
                    valueM: tenancy.leaseValueM ? parseFloat(tenancy.leaseValueM) : undefined,
                    annualRevenueM: tenancy.annualRevenueM ? parseFloat(tenancy.annualRevenueM) : undefined,
                    country: site.country,
                    isParentSite: false,
                    hasChildren: false,
                  });
                }
              }
            }
          }
        }
      };

      // Add all root sites
      for (const site of rootSites) {
        addSite(site, 0);
      }
    }

    return rows;
  }, [companies, expandedSites, expandedPhases]);

  // Filter rows
  const filteredRows = useMemo(() => {
    return flattenedRows.filter(row => {
      // Ticker filter
      if (filterTicker && row.ticker !== filterTicker) return false;

      // Status filter (only applies to phases)
      if (filterStatus && row.type === 'phase' && row.status !== filterStatus) return false;

      // Use type filter
      if (filterUseType && row.useType !== filterUseType) return false;

      // Search term
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSite = row.siteName.toLowerCase().includes(search);
        const matchesPhase = row.phaseName?.toLowerCase().includes(search);
        const matchesTenant = row.tenantName?.toLowerCase().includes(search);
        const matchesTicker = row.ticker.toLowerCase().includes(search);
        const matchesCompany = row.companyName.toLowerCase().includes(search);
        if (!matchesSite && !matchesPhase && !matchesTenant && !matchesTicker && !matchesCompany) return false;
      }

      return true;
    });
  }, [flattenedRows, filterTicker, filterStatus, filterUseType, searchTerm]);

  // Get unique values for filters
  const uniqueTickers = useMemo(() => {
    return [...new Set(companies?.map(c => c.ticker) || [])].sort();
  }, [companies]);

  const toggleSite = (siteId: string) => {
    setExpandedSites(prev => {
      const next = new Set(prev);
      if (next.has(siteId)) {
        next.delete(siteId);
      } else {
        next.add(siteId);
      }
      return next;
    });
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allSiteIds = new Set<string>();
    const allPhaseIds = new Set<string>();
    companies?.forEach(company => {
      company.sites?.forEach(site => {
        allSiteIds.add(site.id);
        site.phases?.forEach(phase => {
          allPhaseIds.add(phase.id);
        });
      });
    });
    setExpandedSites(allSiteIds);
    setExpandedPhases(allPhaseIds);
  };

  const collapseAll = () => {
    setExpandedSites(new Set());
    setExpandedPhases(new Set());
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditingType(null);
    setEditFormData({});
  };

  const startEditSite = (row: FlatRow) => {
    if (row.type !== 'site') return;
    setEditingRow(row.siteId);
    setEditingType('site');
    setEditFormData({
      name: row.siteName,
      country: row.country,
      state: row.state || '',
    });
  };

  const startEditPhase = (row: FlatRow) => {
    if (row.type !== 'phase' || !row.phaseId) return;
    setEditingRow(row.phaseId);
    setEditingType('phase');
    setEditFormData({
      name: row.phaseName,
      status: row.status,
      grossMw: row.grossMw || '',
      itMw: row.itMw || '',
      pue: row.pue || '',
      currentUse: row.useType,
      energizationDate: row.energizationDate ? row.energizationDate.split('T')[0] : '',
    });
  };

  const startEditTenancy = (row: FlatRow) => {
    if (row.type !== 'tenancy' || !row.tenancyId) return;
    setEditingRow(row.tenancyId);
    setEditingType('tenancy');
    setEditFormData({
      tenant: row.tenantName,
      useType: row.useType,
      leaseValueM: row.valueM || '',
      annualRevenueM: row.annualRevenueM || '',
    });
  };

  const saveEdit = () => {
    if (!editingRow || !editingType) return;

    if (editingType === 'site') {
      updateSiteMutation.mutate({
        siteId: editingRow,
        data: editFormData,
      });
    } else if (editingType === 'phase') {
      updatePhaseMutation.mutate({
        phaseId: editingRow,
        data: {
          ...editFormData,
          grossMw: editFormData.grossMw ? parseFloat(editFormData.grossMw) : null,
          itMw: editFormData.itMw ? parseFloat(editFormData.itMw) : null,
          pue: editFormData.pue ? parseFloat(editFormData.pue) : null,
          energizationDate: editFormData.energizationDate || null,
        },
      });
    } else if (editingType === 'tenancy') {
      // TODO: Add tenancy update mutation
      alert('Tenancy update coming soon!');
      cancelEdit();
    }
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'site') {
      deleteSiteMutation.mutate(deleteConfirm.id);
    } else if (deleteConfirm.type === 'phase') {
      deletePhaseMutation.mutate(deleteConfirm.id);
    } else if (deleteConfirm.type === 'tenancy') {
      deleteTenancyMutation.mutate(deleteConfirm.id);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatMoney = (value: number | undefined) => {
    if (!value) return '-';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
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
            {filteredRows.length} items • {companies?.length || 0} companies
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-sm text-orange-500 hover:text-orange-400"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-300"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px] max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search sites, phases, tenants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Ticker Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={filterTicker}
              onChange={(e) => setFilterTicker(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Companies</option>
              {uniqueTickers.map(ticker => (
                <option key={ticker} value={ticker}>{ticker}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All Statuses</option>
            <option value="OPERATIONAL">Operational</option>
            <option value="PARTIALLY_ONLINE">Partially Online</option>
            <option value="UNDER_CONSTRUCTION">Under Construction</option>
            <option value="CONTRACTED">Contracted</option>
            <option value="PIPELINE">Pipeline</option>
            <option value="OPTION">Option</option>
            <option value="DISCUSSION">Discussion</option>
          </select>

          {/* Use Type Filter */}
          <select
            value={filterUseType}
            onChange={(e) => setFilterUseType(e.target.value)}
            className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All Use Types</option>
            <option value="BTC_MINING">BTC Mining</option>
            <option value="HPC_LEASE">HPC Lease</option>
            <option value="GPU_CLOUD">GPU Cloud</option>
            <option value="COLOCATION">Colocation</option>
            <option value="MIXED">Mixed</option>
            <option value="DEVELOPMENT">Development</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/80">
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-12">#</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-16">Ticker</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Site / Phase / Tenant</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-28">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-24">Use Type</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider w-20">MW</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider w-16">PUE</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider w-28">Energization</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider w-24">Value</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filteredRows.map((row) => {
                const isEditing = (
                  (row.type === 'site' && editingRow === row.siteId && editingType === 'site') ||
                  (row.type === 'phase' && editingRow === row.phaseId && editingType === 'phase') ||
                  (row.type === 'tenancy' && editingRow === row.tenancyId && editingType === 'tenancy')
                );
                const indentPx = row.depth * 24;

                return (
                  <tr
                    key={`${row.type}-${row.siteId}-${row.phaseId || ''}-${row.tenancyId || ''}`}
                    className={`hover:bg-gray-700/30 transition ${
                      row.type === 'site' ? 'bg-gray-800/50' :
                      row.type === 'phase' ? '' :
                      'bg-gray-900/30'
                    }`}
                  >
                    {/* Row Number */}
                    <td className="px-3 py-2 text-gray-500 text-xs">{row.rowNum}</td>

                    {/* Ticker */}
                    <td className="px-3 py-2">
                      <span className="text-orange-500 font-medium text-xs">{row.ticker}</span>
                    </td>

                    {/* Name with hierarchy */}
                    <td className="px-3 py-2">
                      <div className="flex items-center" style={{ paddingLeft: `${indentPx}px` }}>
                        {/* Expand/Collapse */}
                        {row.type === 'site' && row.hasChildren && (
                          <button
                            onClick={() => toggleSite(row.siteId)}
                            className="mr-2 p-0.5 hover:bg-gray-600 rounded"
                          >
                            {expandedSites.has(row.siteId) ? (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        )}
                        {row.type === 'phase' && row.hasChildren && (
                          <button
                            onClick={() => togglePhase(row.phaseId!)}
                            className="mr-2 p-0.5 hover:bg-gray-600 rounded"
                          >
                            {expandedPhases.has(row.phaseId!) ? (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        )}
                        {!row.hasChildren && row.type !== 'tenancy' && (
                          <span className="w-5 mr-2" />
                        )}

                        {/* Icon */}
                        {row.type === 'site' && (
                          <Building2 className={`h-4 w-4 mr-2 ${row.isParentSite ? 'text-orange-500' : 'text-gray-500'}`} />
                        )}
                        {row.type === 'phase' && (
                          <Zap className="h-4 w-4 mr-2 text-yellow-500" />
                        )}
                        {row.type === 'tenancy' && (
                          <span className="w-4 h-4 mr-2 rounded-full bg-purple-900/50 border border-purple-700 flex items-center justify-center text-[10px] text-purple-400">T</span>
                        )}

                        {/* Name */}
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              value={row.type === 'tenancy' ? (editFormData.tenant || '') : (editFormData.name || '')}
                              onChange={(e) => setEditFormData({
                                ...editFormData,
                                [row.type === 'tenancy' ? 'tenant' : 'name']: e.target.value
                              })}
                              className="bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-sm max-w-xs"
                              placeholder={row.type === 'site' ? 'Site name' : row.type === 'phase' ? 'Phase name' : 'Tenant name'}
                            />
                            {row.type === 'site' && (
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={editFormData.country || ''}
                                  onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                                  className="w-20 bg-gray-700 border border-gray-600 text-white rounded px-2 py-0.5 text-xs"
                                  placeholder="Country"
                                />
                                <input
                                  type="text"
                                  value={editFormData.state || ''}
                                  onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                                  className="w-16 bg-gray-700 border border-gray-600 text-white rounded px-2 py-0.5 text-xs"
                                  placeholder="State"
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className={`${row.type === 'site' ? 'text-gray-200 font-medium' : row.type === 'phase' ? 'text-gray-300' : 'text-gray-400'}`}>
                              {row.type === 'site' ? row.siteName : row.type === 'phase' ? row.phaseName : row.tenantName}
                            </span>
                            {row.type === 'site' && (
                              <span className="text-xs text-gray-500">
                                {row.country}{row.state ? `, ${row.state}` : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2">
                      {row.type === 'phase' && row.status && (
                        isEditing ? (
                          <select
                            value={editFormData.status || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                            className="bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs"
                          >
                            <option value="OPERATIONAL">Operational</option>
                            <option value="PARTIALLY_ONLINE">Partially Online</option>
                            <option value="UNDER_CONSTRUCTION">Under Construction</option>
                            <option value="CONTRACTED">Contracted</option>
                            <option value="PIPELINE">Pipeline</option>
                            <option value="OPTION">Option</option>
                            <option value="DISCUSSION">Discussion</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[row.status] || 'bg-gray-700 text-gray-400'}`}>
                            {row.status.replace(/_/g, ' ')}
                          </span>
                        )
                      )}
                    </td>

                    {/* Use Type */}
                    <td className="px-3 py-2">
                      {row.useType && (
                        isEditing && (row.type === 'phase' || row.type === 'tenancy') ? (
                          <select
                            value={row.type === 'phase' ? (editFormData.currentUse || '') : (editFormData.useType || '')}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              [row.type === 'phase' ? 'currentUse' : 'useType']: e.target.value
                            })}
                            className="bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs"
                          >
                            <option value="BTC_MINING">BTC Mining</option>
                            <option value="HPC_LEASE">HPC Lease</option>
                            <option value="GPU_CLOUD">GPU Cloud</option>
                            <option value="COLOCATION">Colocation</option>
                            <option value="MIXED">Mixed</option>
                            <option value="DEVELOPMENT">Development</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${useTypeColors[row.useType] || 'bg-gray-700 text-gray-400'}`}>
                            {useTypeLabels[row.useType] || row.useType}
                          </span>
                        )
                      )}
                    </td>

                    {/* MW */}
                    <td className="px-3 py-2 text-right font-mono">
                      {row.type === 'phase' && isEditing ? (
                        <input
                          type="number"
                          value={editFormData.grossMw || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, grossMw: e.target.value })}
                          className="w-16 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs text-right"
                        />
                      ) : row.grossMw ? (
                        <span className="text-gray-300">{row.grossMw.toFixed(0)}</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>

                    {/* PUE */}
                    <td className="px-3 py-2 text-right font-mono">
                      {row.type === 'phase' && isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.pue || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, pue: e.target.value })}
                          className="w-14 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs text-right"
                        />
                      ) : row.pue ? (
                        <span className="text-gray-400">{row.pue.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>

                    {/* Energization Date */}
                    <td className="px-3 py-2 text-right">
                      {row.type === 'phase' && isEditing ? (
                        <input
                          type="date"
                          value={editFormData.energizationDate || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, energizationDate: e.target.value })}
                          className="bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs"
                        />
                      ) : row.type === 'phase' && row.energizationDate ? (
                        <span className="text-gray-400 text-xs">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {formatDate(row.energizationDate)}
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>

                    {/* Value */}
                    <td className="px-3 py-2 text-right font-mono">
                      {row.type === 'tenancy' && isEditing ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editFormData.leaseValueM || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, leaseValueM: e.target.value })}
                          className="w-20 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs text-right"
                          placeholder="$M"
                        />
                      ) : row.valueM ? (
                        <span className="text-green-400">{formatMoney(row.valueM)}</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveEdit}
                              disabled={updatePhaseMutation.isPending || updateSiteMutation.isPending}
                              className="p-1 bg-green-600 text-white rounded hover:bg-green-700"
                              title="Save"
                            >
                              <Save className="h-3 w-3" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 bg-gray-600 text-white rounded hover:bg-gray-500"
                              title="Cancel"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Edit button for all types */}
                            <button
                              onClick={() => {
                                if (row.type === 'site') startEditSite(row);
                                else if (row.type === 'phase') startEditPhase(row);
                                else if (row.type === 'tenancy') startEditTenancy(row);
                              }}
                              className="p-1 hover:bg-gray-600 rounded"
                              title="Edit"
                            >
                              <Edit2 className="h-3 w-3 text-gray-500" />
                            </button>

                            {/* Delete button for all types */}
                            <button
                              onClick={() => setDeleteConfirm({
                                type: row.type,
                                id: row.type === 'site' ? row.siteId : row.type === 'phase' ? row.phaseId! : row.tenancyId!,
                                name: row.type === 'site' ? row.siteName : row.type === 'phase' ? row.phaseName! : row.tenantName!,
                              })}
                              className="p-1 hover:bg-red-900/50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3 text-red-500/70 hover:text-red-400" />
                            </button>

                            {/* Split button for parent sites only */}
                            {row.type === 'site' && row.isParentSite && (
                              <button
                                onClick={() => { setSplitSiteId(row.siteId); setShowSplitModal(true); }}
                                className="p-1 hover:bg-gray-600 rounded"
                                title="Split Site"
                              >
                                <GitBranch className="h-3 w-3 text-gray-500" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    No projects found. {searchTerm || filterTicker || filterStatus || filterUseType ? 'Try adjusting your filters.' : 'Import data to get started.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Split/Merge Modal */}
      {showSplitModal && splitSiteId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <GitBranch className="h-6 w-6 text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-200">Split Site</h2>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Split this site into multiple child sites. This creates a parent-child relationship
              and tracks the lineage for audit purposes.
            </p>
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-1">New Child Site Name</label>
                <input
                  type="text"
                  placeholder="e.g., Building 1"
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Allocation (%)</label>
                <input
                  type="number"
                  placeholder="50"
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSplitModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // TODO: Implement split functionality
                  alert('Split functionality coming soon!');
                  setShowSplitModal(false);
                }}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                Create Split
              </button>
            </div>
          </div>
        </div>
      )}

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
                ⚠️ This will also delete all phases and tenancies within this site.
              </p>
            )}
            {deleteConfirm.type === 'phase' && (
              <p className="text-sm text-yellow-400 mb-4">
                ⚠️ This will also delete all tenancies within this phase.
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
                disabled={deleteSiteMutation.isPending || deletePhaseMutation.isPending || deleteTenancyMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {(deleteSiteMutation.isPending || deletePhaseMutation.isPending || deleteTenancyMutation.isPending)
                  ? 'Deleting...'
                  : 'Delete'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
