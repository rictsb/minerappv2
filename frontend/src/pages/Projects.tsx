/**
 * Miner Terminal — Projects (redesigned)
 *
 * Enhanced Projects page with:
 *   - KPI summary cards (SITES, CAPACITY, GROSS VALUE, VALUATION)
 *   - New filter bar: category, phase, state, tenant dropdowns
 *   - Redesigned table columns matching the design spec
 *   - CATEGORY, PHASE, METHOD, NOI, CAPEX DED., GROSS, VALUATION columns
 *   - Integration with /api/v1/valuation for category and valuation method
 *
 * Preserves 1:1 from the original:
 *   - Flat-row expansion: Company → Site → Campus → Building → UsePeriods
 *   - Filter state in localStorage
 *   - Sort state in localStorage
 *   - Excel export of filtered rows
 *   - Include-in-valuation toggle (eye / eye-off)
 *   - Delete building confirmation
 *   - Unallocated-pipeline synthetic row
 *   - ?ticker=XXX URL param → filter
 *   - BuildingDetailPanel slideout
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Filter,
  Search,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Eye,
  EyeOff,
  Download,
  Pencil,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import BuildingDetailPanel from '../components/BuildingDetailPanel';
import Card from '../components/Card';
import Badge from '../components/Badge';
import TickerMark from '../components/TickerMark';
import { fmt, fmtM, fmtMSigned } from '../lib/format';

function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
  return apiUrl;
}

// Phase config → Badge color mapping + label abbreviation
const phaseConfig: Record<string, { label: string; abbr: string; color: 'pos' | 'info' | 'warn' | 'pipeline' | 'slate'; prob: number }> = {
  OPERATIONAL:  { label: 'Operational',  abbr: 'OP', color: 'pos',      prob: 1.0 },
  CONSTRUCTION: { label: 'Construction', abbr: 'CON', color: 'warn',     prob: 0.9 },
  DEVELOPMENT: { label: 'Development',  abbr: 'DEV', color: 'info',     prob: 0.7 },
  EXCLUSIVITY: { label: 'Exclusivity',  abbr: 'EXC', color: 'pipeline', prob: 0.5 },
  DILIGENCE:    { label: 'Diligence',    abbr: 'DIL', color: 'slate',    prob: 0.3 },
};

// Category mapping: HPC_CONTRACTED → HPC (teal), PIPELINE → PIPELINE (purple), MINING → MINING (amber)
const categoryConfig: Record<string, { label: string; color: 'hpc' | 'pipeline' | 'mining' }> = {
  HPC_CONTRACTED: { label: 'HPC', color: 'hpc' },
  PIPELINE: { label: 'PIPELINE', color: 'pipeline' },
  MINING: { label: 'MINING', color: 'mining' },
};

interface HpcSite {
  siteName: string;
  buildingName: string;
  category?: 'HPC_CONTRACTED' | 'PIPELINE' | 'MINING';
  phase?: string;
  mw?: number;
  grossMw?: number;
  capexDeductionM?: number;
  valuationM?: number;
  noiAnnualM?: number;
  method?: string;
}

interface ValuationData {
  hpcSites?: HpcSite[];
}

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
  leaseStart: string | null;
  leaseStructure: string | null;
  startDate: string | null;
  endDate: string | null;
  computedValuationM?: number;
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
  computedValuationM?: number;
}

interface Campus { id: string; name: string; buildings: Building[]; }
interface Site { id: string; name: string; country: string; state: string | null; campuses: Campus[]; }
interface Company { ticker: string; name: string; sites: Site[]; }

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
  leaseValueM: number | null;
  leaseYears: number | null;
  noiPct: number | null;
  noiAnnualM: number | null;
  energizationDate: string | null;
  includeInValuation: boolean;
  computedValuationM: number | null;
  dollarPerMwYr: number | null;
  building: Building;
  // New fields from valuation API
  state: string | null;
  grid: string | null;
  category?: 'HPC_CONTRACTED' | 'PIPELINE' | 'MINING';
  grossValue: number | null;
  capexDeduction: number | null;
  valuationMethod?: 'MW PIPELINE' | 'NOI CAP RATE' | 'MINING HASHRATE';
}

type SortKey = 'ticker' | 'siteName' | 'buildingName' | 'phase' | 'category' | 'state' | 'grid' | 'useType' | 'tenant' | 'itMw' | 'computedValuationM' | 'grossValue' | 'noiAnnualM' | 'dollarPerMwYr' | 'energizationDate';
type SortDir = 'asc' | 'desc';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = usePersistedState('projects-search', '');
  const [filterTicker, setFilterTicker] = usePersistedState('projects-ticker', '');
  const [filterPhase, setFilterPhase] = usePersistedState('projects-phase', '');
  const [filterUseType, setFilterUseType] = usePersistedState('projects-useType', '');
  const [filterTenant, setFilterTenant] = usePersistedState('projects-tenant', '');
  const [filterCategory, setFilterCategory] = usePersistedState('projects-category', '');
  const [filterState, setFilterState] = usePersistedState('projects-state', '');
  const [filterEv, setFilterEv] = usePersistedState<'' | 'included' | 'excluded'>('projects-ev', '');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = usePersistedState<SortKey>('projects-sortKey', 'ticker');
  const [sortDir, setSortDir] = usePersistedState<SortDir>('projects-sortDir', 'asc');

  // ?ticker=XXX param
  useEffect(() => {
    const urlTicker = searchParams.get('ticker');
    if (urlTicker) {
      setFilterTicker(urlTicker.toUpperCase());
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setFilterTicker, setSearchParams]);

  const hasActiveFilters = searchTerm || filterTicker || filterPhase || filterUseType || filterTenant || filterCategory || filterState || filterEv;
  const clearAllFilters = useCallback(() => {
    setSearchTerm(''); setFilterTicker(''); setFilterPhase(''); setFilterUseType(''); setFilterTenant(''); setFilterCategory(''); setFilterState(''); setFilterEv('');
  }, [setSearchTerm, setFilterTicker, setFilterPhase, setFilterUseType, setFilterTenant, setFilterCategory, setFilterState, setFilterEv]);

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/api/v1/companies`);
      if (!res.ok) throw new Error('Failed to fetch companies');
      return res.json() as Promise<Company[]>;
    },
  });

  const { data: valuationData } = useQuery({
    queryKey: ['valuation'],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/api/v1/valuation`);
      if (!res.ok) throw new Error('Failed to fetch valuation');
      return res.json() as Promise<ValuationData>;
    },
  });

  const toggleIncludeMutation = useMutation({
    mutationFn: async ({ id, include }: { id: string; include: boolean }) => {
      const res = await fetch(`${getApiUrl()}/api/v1/buildings/${id}`, {
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
      const res = await fetch(`${getApiUrl()}/api/v1/buildings/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete building');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeleteConfirm(null);
    },
  });

  // Build a map from (siteName, buildingName) to HpcSite data for quick lookup
  const hpcSiteMap = useMemo(() => {
    const map = new Map<string, HpcSite>();
    if (!valuationData?.hpcSites) return map;
    for (const site of valuationData.hpcSites) {
      map.set(`${site.siteName}|${site.buildingName}`, site);
    }
    return map;
  }, [valuationData]);

  // Determine valuation method based on use type and NOI
  const getValuationMethod = (useType: string, noiAnnualM: number | null): 'MW PIPELINE' | 'NOI CAP RATE' | 'MINING HASHRATE' => {
    if (useType === 'BTC_MINING' || useType === 'BTC_MINING_HOSTING') {
      return 'MINING HASHRATE';
    }
    if (noiAnnualM && noiAnnualM > 0) {
      return 'NOI CAP RATE';
    }
    return 'MW PIPELINE';
  };

  // Flatten all companies → buildings → use-period rows
  const flatBuildings = useMemo<FlatBuilding[]>(() => {
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
            const currentUses = (building.usePeriods || []).filter(up => up.isCurrent || (!up.isCurrent && !up.endDate));

            const buildingItMw = building.itMw ? parseFloat(building.itMw) : 0;
            const buildingGrossMw = building.grossMw ? parseFloat(building.grossMw) : null;
            const explicitlyAllocated = currentUses.reduce((sum, up) => sum + (up.mwAllocation ? parseFloat(up.mwAllocation) : 0), 0);
            let effectiveAllocated = 0;
            for (const up of currentUses) {
              const mw = up.mwAllocation ? parseFloat(up.mwAllocation) : 0;
              effectiveAllocated += mw || (currentUses.length === 1 ? buildingItMw : Math.max(buildingItMw - explicitlyAllocated, 0));
            }

            // Lookup HPC site data
            const hpcKey = `${site.name}|${building.name}`;
            const hpcData = hpcSiteMap.get(hpcKey);

            for (const currentUse of currentUses) {
              const useType = currentUse.useType || 'UNCONTRACTED';
              const tenant = currentUse.tenant || null;
              if (filterUseType && useType !== filterUseType) continue;
              if (filterTenant && (tenant || '') !== filterTenant) continue;

              // Category from HPC data or derived from useType
              let category: 'HPC_CONTRACTED' | 'PIPELINE' | 'MINING' | undefined = hpcData?.category;
              if (!category) {
                if (useType === 'BTC_MINING' || useType === 'BTC_MINING_HOSTING') {
                  category = 'MINING';
                } else if (useType === 'HPC_AI_HOSTING' || useType === 'HPC_AI_PLANNED' || useType === 'GPU_CLOUD' || useType === 'COLOCATION') {
                  category = useType === 'HPC_AI_PLANNED' ? 'PIPELINE' : 'HPC_CONTRACTED';
                }
              }

              if (filterCategory && category !== filterCategory) continue;
              if (filterState && site.state !== filterState) continue;

              rowNum++;
              let periodMw: number | null;
              if (currentUse.mwAllocation) periodMw = parseFloat(currentUse.mwAllocation);
              else if (currentUses.length > 1) periodMw = Math.max(buildingItMw - explicitlyAllocated, 0);
              else periodMw = buildingItMw || null;

              let noiAnnualM = currentUse.noiAnnualM ? parseFloat(currentUse.noiAnnualM) : null;
              if (!noiAnnualM && currentUse.leaseValueM && currentUse.noiPct) {
                const leaseVal = parseFloat(currentUse.leaseValueM) || 0;
                const leaseYrs = currentUse.leaseYears ? parseFloat(currentUse.leaseYears) : 10;
                const npRaw = parseFloat(currentUse.noiPct) || 0;
                const np = npRaw <= 1 ? npRaw : npRaw / 100;
                noiAnnualM = (leaseVal / Math.max(leaseYrs, 0.1)) * np;
              }

              const grossValue = hpcData?.valuationM ?? currentUse.computedValuationM ?? building.computedValuationM ?? null;
              const capexDeduction = hpcData?.capexDeductionM ?? null;
              const valuationMethod = getValuationMethod(useType, noiAnnualM);

              rows.push({
                rowNum, ticker: company.ticker, companyName: company.name,
                siteName: site.name, campusName: campus.name,
                buildingId: building.id, buildingName: building.name,
                phase, useType, usePeriodId: currentUse.id, tenant,
                grossMw: buildingGrossMw,
                itMw: periodMw,
                leaseValueM: currentUse.leaseValueM ? parseFloat(currentUse.leaseValueM) : null,
                leaseYears: currentUse.leaseYears ? parseFloat(currentUse.leaseYears) : null,
                noiPct: currentUse.noiPct ? parseFloat(currentUse.noiPct) : null,
                noiAnnualM,
                energizationDate: building.energizationDate || null,
                includeInValuation: building.includeInValuation ?? true,
                computedValuationM: currentUse.computedValuationM ?? building.computedValuationM ?? null,
                dollarPerMwYr: (periodMw && periodMw > 0 && noiAnnualM && noiAnnualM > 0) ? noiAnnualM / periodMw : null,
                building,
                state: site.state || null,
                grid: building.grid || null,
                category,
                grossValue,
                capexDeduction,
                valuationMethod,
              });
            }

            // Unallocated-pipeline synthetic row
            const unallocMw = currentUses.length > 0 ? Math.max(0, buildingItMw - effectiveAllocated) : 0;
            if (unallocMw > 0) {
              const primaryUseType = currentUses[0]?.useType || 'HPC_AI_HOSTING';
              if (!(filterUseType && filterUseType !== primaryUseType) && !(filterTenant && filterTenant !== 'Unallocated Pipeline')) {
                const category: 'HPC_CONTRACTED' | 'PIPELINE' | 'MINING' | undefined =
                  primaryUseType === 'BTC_MINING' || primaryUseType === 'BTC_MINING_HOSTING' ? 'MINING' : 'PIPELINE';
                if (filterCategory && category !== filterCategory) {
                  // skip if category filter doesn't match
                } else if (filterState && site.state !== filterState) {
                  // skip if state filter doesn't match
                } else {
                  rowNum++;
                  rows.push({
                    rowNum, ticker: company.ticker, companyName: company.name,
                    siteName: site.name, campusName: campus.name,
                    buildingId: building.id, buildingName: building.name,
                    phase, useType: primaryUseType, usePeriodId: null,
                    tenant: 'Unallocated Pipeline',
                    grossMw: buildingGrossMw,
                    itMw: unallocMw, leaseValueM: null, leaseYears: null, noiPct: null, noiAnnualM: null,
                    energizationDate: building.energizationDate || null,
                    includeInValuation: building.includeInValuation ?? true,
                    computedValuationM: (building as any).unallocatedValuationM ?? null,
                    dollarPerMwYr: null, building,
                    state: site.state || null,
                    grid: building.grid || null,
                    category,
                    grossValue: (building as any).unallocatedValuationM ?? null,
                    capexDeduction: null,
                    valuationMethod: 'MW PIPELINE',
                  });
                }
              }
            }

            // Building with no use periods
            if (currentUses.length === 0) {
              const useType = 'UNCONTRACTED';
              const category: 'HPC_CONTRACTED' | 'PIPELINE' | 'MINING' | undefined = undefined;
              if (!(filterUseType && filterUseType !== useType) && !(filterCategory && category !== filterCategory) && !(filterState && site.state !== filterState)) {
                rowNum++;
                rows.push({
                  rowNum, ticker: company.ticker, companyName: company.name,
                  siteName: site.name, campusName: campus.name,
                  buildingId: building.id, buildingName: building.name,
                  phase, useType, usePeriodId: null, tenant: null,
                  grossMw: buildingGrossMw,
                  itMw: buildingItMw || null,
                  leaseValueM: null, leaseYears: null, noiPct: null, noiAnnualM: null,
                  energizationDate: building.energizationDate || null,
                  includeInValuation: building.includeInValuation ?? true,
                  computedValuationM: building.computedValuationM ?? null,
                  dollarPerMwYr: null, building,
                  state: site.state || null,
                  grid: building.grid || null,
                  category,
                  grossValue: null,
                  capexDeduction: null,
                  valuationMethod: 'MW PIPELINE',
                });
              }
            }
          }
        }
      }
    }
    return rows;
  }, [companies, filterTicker, filterPhase, filterUseType, filterTenant, filterCategory, filterState, filterEv, hpcSiteMap]);

  // Search filter + sort
  const filteredRows = useMemo(() => {
    let rows = flatBuildings;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      rows = rows.filter(r =>
        r.buildingName.toLowerCase().includes(s) ||
        r.ticker.toLowerCase().includes(s) ||
        r.companyName.toLowerCase().includes(s) ||
        r.siteName.toLowerCase().includes(s) ||
        r.campusName.toLowerCase().includes(s) ||
        r.tenant?.toLowerCase().includes(s) ||
        r.state?.toLowerCase().includes(s) ||
        r.grid?.toLowerCase().includes(s)
      );
    }
    const nullVal = sortDir === 'asc' ? Infinity : -Infinity;
    rows = [...rows].sort((a, b) => {
      let aVal: any = a[sortKey]; let bVal: any = b[sortKey];
      if (sortKey === 'energizationDate') {
        aVal = aVal ? new Date(aVal).getTime() : nullVal;
        bVal = bVal ? new Date(bVal).getTime() : nullVal;
      } else {
        if (aVal === null || aVal === undefined || aVal === '') aVal = nullVal;
        if (bVal === null || bVal === undefined || bVal === '') bVal = nullVal;
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [flatBuildings, searchTerm, sortKey, sortDir]);

  const uniqueStates = useMemo(() => {
    if (!companies) return [];
    const states = new Set<string>();
    for (const c of companies) for (const s of c.sites || []) {
      if (s.state) states.add(s.state);
    }
    return [...states].sort();
  }, [companies]);
  const uniqueTenants = useMemo(() => {
    if (!companies) return [];
    const tenants = new Set<string>();
    for (const c of companies) for (const s of c.sites || []) for (const cp of s.campuses || []) for (const b of cp.buildings || []) {
      const t = b.usePeriods?.[0]?.tenant; if (t) tenants.add(t);
    }
    return [...tenants].sort();
  }, [companies]);

  // KPI computations from filtered rows
  const kpiStats = useMemo(() => {
    const uniqueSites = new Set<string>();
    let totalMw = 0;
    let totalGross = 0;
    let totalValuation = 0;

    for (const row of filteredRows) {
      uniqueSites.add(row.siteName);
      if (row.itMw) totalMw += row.itMw;
      if (row.grossValue) totalGross += row.grossValue;
      if (row.computedValuationM) totalValuation += row.computedValuationM;
    }

    return {
      sites: uniqueSites.size,
      totalMw,
      totalGross,
      totalValuation,
    };
  }, [filteredRows]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleExportExcel = useCallback(() => {
    const data = filteredRows.map((r, i) => ({
      '#': i + 1, 'Ticker': r.ticker, 'Site': r.siteName, 'Building': r.buildingName,
      'Phase': r.phase, 'Use Type': r.useType, 'Tenant': r.tenant || '',
      'IT MW': r.itMw, 'Lease Value ($M)': r.leaseValueM, 'Lease Term (yr)': r.leaseYears,
      'NOI %': r.noiPct ? (r.noiPct <= 1 ? r.noiPct * 100 : r.noiPct) : null,
      'NOI Annual ($M)': r.noiAnnualM ? Math.round(r.noiAnnualM * 100) / 100 : null,
      '$/MW/yr ($M)': r.dollarPerMwYr ? Math.round(r.dollarPerMwYr * 100) / 100 : null,
      'Energization': r.energizationDate ? r.energizationDate.split('T')[0] : '',
      'In EV': r.includeInValuation ? 'Yes' : 'No',
      'Valuation ($M)': r.computedValuationM ? Math.round(r.computedValuationM) : null,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    if (data.length > 0) {
      ws['!cols'] = Object.keys(data[0]).map(k => ({ wch: Math.max(k.length, ...data.map(r => String((r as any)[k] ?? '').length)) + 2 }));
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Projects');
    const tag = [filterTicker, filterPhase, filterUseType, filterTenant, filterEv, searchTerm].filter(Boolean).join('_') || 'all';
    XLSX.writeFile(wb, `projects_${tag}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [filteredRows, filterTicker, filterPhase, filterUseType, filterTenant, filterEv, searchTerm]);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--btc)]" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className={`flex-1 min-w-0 overflow-auto transition-all duration-200 ${selectedBuildingId ? 'mr-[520px]' : ''}`}>
        <div className="p-6 max-w-[1500px] mx-auto">
          {/* Header with title and subtitle */}
          <div className="mb-6">
            <h1 className="text-[28px] font-medium text-ink-1 mb-1">Projects</h1>
            <p className="text-[13px] text-ink-3">
              All datacenter sites across coverage · {flatBuildings.length} total
            </p>
          </div>

          {/* KPI Cards Row */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-elevated border border-hairline rounded-md shadow-xs p-4 border-t-2" style={{ borderTopColor: 'var(--btc)' }}>
              <div className="text-[11px] text-ink-3 font-medium uppercase tracking-wider mb-2">Sites</div>
              <div className="text-[24px] font-medium text-ink-1">{kpiStats.sites}</div>
            </div>
            <div className="bg-elevated border border-hairline rounded-md shadow-xs p-4 border-t-2" style={{ borderTopColor: 'var(--info)' }}>
              <div className="text-[11px] text-ink-3 font-medium uppercase tracking-wider mb-2">Capacity</div>
              <div className="text-[24px] font-medium text-ink-1">{fmt(kpiStats.totalMw, 0)} MW</div>
            </div>
            <div className="bg-elevated border border-hairline rounded-md shadow-xs p-4 border-t-2" style={{ borderTopColor: 'var(--warn)' }}>
              <div className="text-[11px] text-ink-3 font-medium uppercase tracking-wider mb-2">Gross Value</div>
              <div className="text-[24px] font-medium text-ink-1">{fmtM(kpiStats.totalGross, 0)}</div>
            </div>
            <div className="bg-elevated border border-hairline rounded-md shadow-xs p-4 border-t-2" style={{ borderTopColor: 'var(--btc)' }}>
              <div className="text-[11px] text-ink-3 font-medium uppercase tracking-wider mb-2">Valuation</div>
              <div className="text-[24px] font-medium text-ink-1">{fmtM(kpiStats.totalValuation, 0)}</div>
            </div>
          </div>

          {/* Filter bar */}
          <Card padding="sm" className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[220px] max-w-md relative">
                <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 w-[13px] h-[13px] text-ink-3" />
                <input
                  type="text" placeholder="Search ticker, site, building, tenant…"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="input" style={{ paddingLeft: 30 }}
                />
              </div>
              <Filter className="w-[14px] h-[14px] text-ink-3 ml-1" />
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="input" style={{ width: 'auto' }}>
                <option value="">All categorys</option>
                {Object.entries(categoryConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={filterPhase} onChange={e => setFilterPhase(e.target.value)} className="input" style={{ width: 'auto' }}>
                <option value="">All phases</option>
                {Object.entries(phaseConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={filterState} onChange={e => setFilterState(e.target.value)} className="input" style={{ width: 'auto' }}>
                <option value="">All states</option>
                {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)} className="input" style={{ width: 'auto' }}>
                <option value="">All tenants</option>
                {uniqueTenants.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1 px-3 py-[6px] rounded-sm border border-[var(--border-strong)] bg-elevated hover:bg-subtle text-[12px] text-ink-1"
                title="Export filtered view to Excel"
              >
                <Download className="w-[13px] h-[13px]" /> Export CSV
              </button>
              {hasActiveFilters && (
                <button onClick={clearAllFilters} className="text-[11px] text-[var(--btc)] hover:underline px-2">
                  Clear
                </button>
              )}
            </div>
          </Card>

          <Card padding="none">
            <div className="overflow-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th className="center" style={{ width: 36 }}>EV</th>
                    <ProjectsSortTh sortKey="ticker" current={sortKey} dir={sortDir} onSort={handleSort}>TICKER</ProjectsSortTh>
                    <ProjectsSortTh sortKey="siteName" current={sortKey} dir={sortDir} onSort={handleSort}>SITE · BUILDING</ProjectsSortTh>
                    <ProjectsSortTh sortKey="category" current={sortKey} dir={sortDir} onSort={handleSort}>CATEGORY</ProjectsSortTh>
                    <ProjectsSortTh sortKey="phase" current={sortKey} dir={sortDir} onSort={handleSort}>PHASE</ProjectsSortTh>
                    <ProjectsSortTh sortKey="tenant" current={sortKey} dir={sortDir} onSort={handleSort}>TENANT</ProjectsSortTh>
                    <ProjectsSortTh sortKey="state" current={sortKey} dir={sortDir} onSort={handleSort}>STATE</ProjectsSortTh>
                    <ProjectsSortTh sortKey="grid" current={sortKey} dir={sortDir} onSort={handleSort}>POWER AUTH.</ProjectsSortTh>
                    <ProjectsSortTh sortKey="itMw" current={sortKey} dir={sortDir} onSort={handleSort} className="num-col">MW</ProjectsSortTh>
                    <ProjectsSortTh sortKey="energizationDate" current={sortKey} dir={sortDir} onSort={handleSort} className="num-col">ENERGIZATION</ProjectsSortTh>
                    <ProjectsSortTh sortKey="grossValue" current={sortKey} dir={sortDir} onSort={handleSort} className="num-col">METHOD</ProjectsSortTh>
                    <ProjectsSortTh sortKey="noiAnnualM" current={sortKey} dir={sortDir} onSort={handleSort} className="num-col">NOI</ProjectsSortTh>
                    <th className="num-col">CAPEX DED.</th>
                    <ProjectsSortTh sortKey="grossValue" current={sortKey} dir={sortDir} onSort={handleSort} className="num-col">GROSS</ProjectsSortTh>
                    <ProjectsSortTh sortKey="computedValuationM" current={sortKey} dir={sortDir} onSort={handleSort} className="num-col">VALUATION</ProjectsSortTh>
                    <th className="center" style={{ width: 60 }}>Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => {
                    const isSelected = selectedBuildingId === row.buildingId;
                    const phaseCfg = phaseConfig[row.phase];
                    const rowKey = row.usePeriodId ? `${row.buildingId}-${row.usePeriodId}` : `${row.buildingId}-${row.tenant || 'default'}`;

                    return (
                      <tr
                        key={rowKey}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => setSelectedBuildingId(row.buildingId)}
                        style={{ cursor: 'pointer', opacity: row.includeInValuation ? 1 : 0.5 }}
                      >
                        <td className="text-ink-3 text-[10.5px]">{idx + 1}</td>
                        <td className="center">
                          <button
                            onClick={e => { e.stopPropagation(); toggleIncludeMutation.mutate({ id: row.buildingId, include: !row.includeInValuation }); }}
                            className={row.includeInValuation ? 'text-[var(--pos)]' : 'text-ink-4'}
                            title={row.includeInValuation ? 'In EV — click to exclude' : 'Excluded — click to include'}
                          >
                            {row.includeInValuation ? <Eye className="w-[13px] h-[13px]" /> : <EyeOff className="w-[13px] h-[13px]" />}
                          </button>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <TickerMark ticker={row.ticker} size={18} />
                            <span className="text-[12px] font-medium text-ink-1">{row.ticker}</span>
                          </div>
                        </td>
                        <td>
                          <div>
                            <div className="text-[11.5px] text-ink-1 truncate" title={row.siteName}>{row.siteName}</div>
                            <div className="text-[10.5px] text-ink-4 truncate" title={row.buildingName}>{row.buildingName}</div>
                          </div>
                        </td>
                        <td>
                          {row.category ? (
                            <Badge color={categoryConfig[row.category]?.color}>{categoryConfig[row.category]?.label}</Badge>
                          ) : (
                            <span className="text-ink-4 text-[11px]">—</span>
                          )}
                        </td>
                        <td>
                          {phaseCfg ? (
                            <Badge color={phaseCfg.color} dot>
                              {phaseCfg.abbr}
                            </Badge>
                          ) : (
                            <span className="text-ink-4 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="text-[11px] text-ink-2 truncate max-w-[120px]" title={row.tenant || ''}>{row.tenant || '—'}</td>
                        <td className="text-[11px] text-ink-1 font-medium">{row.state || '—'}</td>
                        <td className="text-[11px] text-ink-2">{row.grid || '—'}</td>
                        <td className="num-col text-ink-2">{row.itMw !== null ? fmt(row.itMw, 0) : '—'}</td>
                        <td className="num-col text-ink-3 text-[11px]">{formatDate(row.energizationDate)}</td>
                        <td className="text-[11px] text-ink-2">{row.valuationMethod || '—'}</td>
                        <td className="num-col text-ink-2">{row.noiAnnualM !== null ? fmtM(row.noiAnnualM, 1) : '—'}</td>
                        <td className="num-col">
                          {row.capexDeduction !== null ? (
                            <span className="text-[var(--neg)]">{fmtMSigned(row.capexDeduction, 0)}</span>
                          ) : (
                            <span className="text-ink-4">—</span>
                          )}
                        </td>
                        <td className="num-col">
                          {row.grossValue !== null ? (
                            <span className="text-ink-1 font-medium">{fmtM(row.grossValue, 0)}</span>
                          ) : (
                            <span className="text-ink-4">—</span>
                          )}
                        </td>
                        <td className="num-col">
                          {row.computedValuationM !== null && row.computedValuationM !== undefined
                            ? <span className="text-ink-1 font-medium">{fmtM(row.computedValuationM, 0)}</span>
                            : <span className="text-ink-4">—</span>}
                        </td>
                        <td className="center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedBuildingId(row.buildingId); }}
                              className="text-ink-4 hover:text-[var(--btc)] p-1"
                              title="Edit building"
                            >
                              <Pencil className="w-[12px] h-[12px]" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteConfirm({ id: row.buildingId, name: row.buildingName }); }}
                              className="text-ink-4 hover:text-[var(--neg)] p-1"
                              title="Delete building"
                            >
                              <Trash2 className="w-[12px] h-[12px]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Slideout: existing BuildingDetailPanel ─────────────────────── */}
      {selectedBuildingId && (
        <BuildingDetailPanel
          buildingId={selectedBuildingId}
          onClose={() => setSelectedBuildingId(null)}
        />
      )}

      {/* ── Delete confirm ─────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: 'rgba(20,19,15,0.35)' }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-elevated border border-hairline-strong rounded-md shadow-pop p-5 w-96"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-[14px] font-medium text-ink-1 mb-2">Delete building?</h3>
            <p className="text-[12px] text-ink-3 mb-4">
              This will permanently delete <strong className="text-ink-1">{deleteConfirm.name}</strong> and all its use periods.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-[6px] text-[12px] text-ink-3 hover:text-ink-1">Cancel</button>
              <button
                onClick={() => deleteBuildingMutation.mutate(deleteConfirm.id)}
                className="px-3 py-[6px] text-[12px] bg-[var(--neg)] hover:opacity-90 text-white rounded-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .input {
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 6px 10px;
          font-size: 12px;
          color: var(--ink-1);
          outline: none;
        }
        .input:focus { border-color: var(--btc); box-shadow: 0 0 0 2px var(--btc-soft); }
      `}</style>
    </div>
  );
}

function ProjectsSortTh({
  children, sortKey, current, dir, onSort, className = '',
}: {
  children: React.ReactNode;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer select-none hover:text-ink-1 group ${className}`}
    >
      <span className="inline-flex items-center gap-1" style={{ justifyContent: className.includes('num-col') ? 'flex-end' : 'flex-start', width: '100%' }}>
        {children}
        {active ? (
          dir === 'asc' ? <ArrowUp className="w-[10px] h-[10px]" /> : <ArrowDown className="w-[10px] h-[10px]" />
        ) : (
          <ArrowUpDown className="w-[10px] h-[10px] opacity-0 group-hover:opacity-40" />
        )}
      </span>
    </th>
  );
}
