import { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Building2,
  MapPin,
  DollarSign,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
  AlertTriangle,
  Split,
  Calendar,
  Trash2,
  Edit2,
} from 'lucide-react';

// Error Boundary
interface ErrorBoundaryProps {
  children: ReactNode;
  onClose: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class PanelErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('BuildingDetailPanel error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-y-0 right-0 w-[520px] bg-gray-900 border-l border-gray-700 shadow-2xl z-50 p-4 translate-x-0 transition-transform duration-300">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Render Error
            </h2>
            <button onClick={this.props.onClose} className="p-1 hover:bg-gray-700 rounded">
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
          <p className="text-gray-400 mb-2">Something went wrong rendering this panel.</p>
          <pre className="text-red-400 text-xs bg-gray-800 p-2 rounded overflow-auto max-h-60">
            {this.state.error?.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  return apiUrl;
}

interface BuildingDetailPanelProps {
  buildingId: string;
  onClose: () => void;
}

// Editable field component
interface EditableFieldProps {
  label: string;
  value: string | number | null;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'select' | 'date';
  options?: { value: string; label: string }[];
  suffix?: string;
  prefix?: string;
  placeholder?: string;
  step?: string;
}

function EditableField({
  label,
  value,
  onChange,
  type = 'text',
  options,
  suffix,
  prefix,
  placeholder,
  step,
}: EditableFieldProps) {
  const displayValue = value === null || value === undefined ? '' : String(value);

  return (
    <div>
      <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
      <div className="flex items-center">
        {prefix && <span className="text-gray-400 text-xs mr-1">{prefix}</span>}
        {type === 'select' && options ? (
          <select
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-orange-500 focus:outline-none"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            step={step}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-orange-500 focus:outline-none"
          />
        )}
        {suffix && <span className="text-gray-400 text-xs ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

// Slider row component
interface SliderRowProps {
  label: string;
  autoValue: number;
  currentValue: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  description?: string;
  variant?: 'default' | 'green';
}

function SliderRow({
  label,
  autoValue,
  currentValue,
  onChange,
  min,
  max,
  step,
  format,
  description,
  variant = 'default',
}: SliderRowProps) {
  const isOverridden = Math.abs(currentValue - autoValue) > 0.0001;
  const accentColor = variant === 'green' ? 'accent-green-500' : 'accent-orange-500';
  const textColor = variant === 'green' ? 'text-green-400' : 'text-orange-400';

  return (
    <div className="py-2 border-b border-gray-800 last:border-b-0">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${variant === 'green' ? 'text-green-300' : 'text-gray-300'}`}>{label}</span>
          {description && (
            <span className="text-[10px] text-gray-500">({description})</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500 w-16 text-right">Auto: {format(autoValue)}</span>
          <span className={`font-mono w-16 text-right ${isOverridden ? `${textColor} font-medium` : 'text-white'}`}>
            {format(currentValue)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={`flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer ${accentColor}`}
        />
        <button
          onClick={() => onChange(autoValue)}
          className={`text-[10px] px-1.5 py-0.5 rounded ${isOverridden ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-800 text-gray-600'}`}
          disabled={!isOverridden}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// Safe number formatting
const safeToFixed = (val: any, digits: number): string => {
  const num = Number(val);
  if (isNaN(num) || !isFinite(num)) return '0';
  return num.toFixed(digits);
};

const formatMoney = (value: number | null | undefined): string => {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return '$0M';
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
};

const formatPercent = (value: number): string => {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return '0%';
  return `${(num * 100).toFixed(1)}%`;
};

const formatMultiplier = (value: number): string => {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return '1.00x';
  return `${num.toFixed(2)}x`;
};

// Reusable capex breakdown block — used in single-period and multi-period waterfalls
interface CapexBreakdownProps {
  p: any; // period valuation object
  variant?: 'single' | 'multi'; // single shows full spacing, multi is compact with mt-0.5
  showImpliedDebt?: boolean; // show "→ implied debt" suffix on debt line
}

function CapexBreakdown({ p, variant = 'single', showImpliedDebt = false }: CapexBreakdownProps) {
  if ((p.totalCapexM ?? 0) <= 0) return null;
  const hasDeduction = (p.capexDeductionM ?? 0) > 0;
  const skipReason = p.capexSkipReason === 'operational' ? 'operational — not deducted'
    : p.capexSkipReason === 'in_financials' ? 'in financials'
    : p.capexSkipReason === 'no_lease' ? 'no lease'
    : 'not deducted';
  const debtPct = safeToFixed((p.debtCapexM || 0) / Math.max(p.totalCapexM || 1, 1) * 100, 0);
  const showImpliedSuffix = showImpliedDebt && p.capexSkipReason !== 'operational' && p.capexSkipReason !== 'in_financials' && p.capexSkipReason !== 'no_lease';

  return (
    <div className={`space-y-0.5 ${variant === 'multi' ? 'mt-0.5' : ''}`}>
      <div className="flex justify-between text-gray-600 text-[10px]">
        <span>Total CapEx ({safeToFixed(p.mw, 0)} MW × ${safeToFixed((p.totalCapexM || 0) / Math.max(p.mw, 1), 1)}M/MW)</span>
        <span>{formatMoney(p.totalCapexM)}</span>
      </div>
      {hasDeduction ? (
        variant === 'multi' ? (
          <div className="flex justify-between text-rose-400">
            <span>− Equity CapEx (deducted)</span>
            <span>−{formatMoney(p.capexDeductionM)} → <span className="text-orange-400 font-medium">{formatMoney(p.valuationM)}</span></span>
          </div>
        ) : (
          <div className="flex justify-between text-rose-400">
            <span>− Equity CapEx (deducted)</span>
            <span>−{formatMoney(p.capexDeductionM)}</span>
          </div>
        )
      ) : (
        variant === 'multi' ? (
          <div className="flex justify-between text-rose-400">
            <span>  Equity ({p.capexSkipReason === 'operational' ? 'operational' : p.capexSkipReason === 'in_financials' ? 'in financials' : 'not deducted'})</span>
            <span className="text-gray-600">{formatMoney(p.equityCapexM)}</span>
          </div>
        ) : (
          <div className="flex justify-between text-gray-600 text-[10px]">
            <span>  Equity ({skipReason})</span>
            <span>{formatMoney(p.equityCapexM)}</span>
          </div>
        )
      )}
      <div className="flex justify-between text-gray-600 text-[10px]">
        <span>  Debt Financing ({debtPct}%){showImpliedSuffix ? ' → implied debt' : ''}</span>
        <span>{formatMoney(p.debtCapexM)}</span>
      </div>
    </div>
  );
}

function BuildingDetailPanelInner({ buildingId, onClose }: BuildingDetailPanelProps) {
  const queryClient = useQueryClient();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    splits: true,
    lease: true,
    valInputs: true,
    factors: true,
  });
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitType, setSplitType] = useState<'split' | 'transition'>('split');
  const [newUsePeriod, setNewUsePeriod] = useState<Record<string, any>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Editable lease details
  const [leaseEdits, setLeaseEdits] = useState<Record<string, any>>({});
  // Per-split lease edits: keyed by usePeriodId
  const [splitLeaseEdits, setSplitLeaseEdits] = useState<Record<string, Record<string, any>>>({});
  // Factor overrides
  const [factorOverrides, setFactorOverrides] = useState<Record<string, number>>({});
  const [capexInFinancials, setCapexInFinancials] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['building-valuation', buildingId],
    queryFn: async () => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/buildings/${buildingId}/valuation`);
      if (!res.ok) throw new Error('Failed to fetch building valuation');
      return res.json();
    },
  });

  // Fetch tenant list for dropdown
  const { data: tenantList } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/tenants`);
      if (!res.ok) throw new Error('Failed to fetch tenants');
      return res.json() as Promise<{ key: string; name: string; spread: number; isDefault: boolean }[]>;
    },
  });

  const tenantOptions = [
    { value: '', label: 'None' },
    ...(tenantList || [])
      .filter(t => t.key !== 'tcSelf' && t.key !== 'tcOther')
      .map(t => ({ value: t.name, label: t.name })),
    ...(tenantList || [])
      .filter(t => t.key === 'tcOther' || t.key === 'tcSelf')
      .map(t => ({ value: t.name, label: t.name })),
  ];

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/buildings/${buildingId}/valuation-details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to save changes');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['building-valuation', buildingId] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
      setHasChanges(false);
    },
  });

  // Create new use period (split or transition)
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
      queryClient.invalidateQueries({ queryKey: ['building-valuation', buildingId] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowSplitModal(false);
      setNewUsePeriod({});
    },
  });

  // Delete use period
  const deleteUsePeriodMutation = useMutation({
    mutationFn: async (usePeriodId: string) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/use-periods/${usePeriodId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete use period');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['building-valuation', buildingId] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setConfirmDelete(null);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete');
      setConfirmDelete(null);
    },
  });

  // Activate a planned transition — ends current periods and makes this one current
  const activateTransitionMutation = useMutation({
    mutationFn: async (usePeriodId: string) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/use-periods/${usePeriodId}/activate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to activate transition');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['building-valuation', buildingId] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
      setConfirmActivate(null);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to activate transition');
      setConfirmActivate(null);
    },
  });

  // Track which transition is being confirmed for activation
  const [confirmActivate, setConfirmActivate] = useState<string | null>(null);

  // Slide-in animation state
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    // Trigger slide-in after mount
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for slide-out animation
  };

  // Initialize state from data
  useEffect(() => {
    if (data) {
      const ld = data.leaseDetails || {};
      const fd = data.factorDetails || {};
      const bld = data.building || {};

      setCapexInFinancials(!!bld.capexInFinancials);

      setLeaseEdits({
        tenant: ld.tenant || '',
        leaseStructure: ld.leaseStructure || 'NNN',
        leaseYears: ld.leaseYears || '',
        leaseValueM: ld.leaseValueM || '',
        annualRevM: ld.annualRevM || '',
        noiPct: ld.noiPct ? (ld.noiPct * 100).toFixed(1) : '',
      });

      // Initialize per-split lease edits
      const periodVals: any[] = data.periodValuations || [];
      if (periodVals.length > 1) {
        const edits: Record<string, Record<string, any>> = {};
        for (const pv of periodVals) {
          if (pv.usePeriodId) {
            edits[pv.usePeriodId] = {
              tenant: pv.tenant || '',
              leaseValueM: pv.leaseValueM?.toString() || '',
              leaseYears: pv.leaseYears?.toString() || '',
              noiPct: pv.noiPct ? (pv.noiPct <= 1 ? (pv.noiPct * 100).toFixed(0) : pv.noiPct.toFixed(0)) : '',
              leaseStart: pv.leaseStart ? pv.leaseStart.split('T')[0] : '',
              mwAllocation: pv.mw?.toString() || '',
              useType: pv.useType || 'HPC_AI_HOSTING',
              capexPerMw: pv.capexPerMwOverride?.toString() || '',
            };
          }
        }
        setSplitLeaseEdits(edits);
      }

      setFactorOverrides({
        phaseProbability: fd.phaseProbability?.final ?? fd.phaseProbability?.auto ?? 0.5,
        regulatoryRisk: fd.regulatoryRisk?.value ?? 1.0,
        sizeMultiplier: fd.sizeMultiplier?.final ?? fd.sizeMultiplier?.auto ?? 1.0,
        powerAuthority: fd.powerAuthority?.final ?? fd.powerAuthority?.auto ?? 1.0,
        ownership: fd.ownership?.final ?? fd.ownership?.auto ?? 1.0,
        datacenterTier: fd.datacenterTier?.final ?? fd.datacenterTier?.auto ?? 1.0,
        leaseStructure: fd.leaseStructure?.final ?? fd.leaseStructure?.auto ?? 1.0,
        tenantCredit: fd.tenantCredit?.mult ?? fd.tenantCredit?.final ?? fd.tenantCredit?.auto ?? 1.0,
        timeValue: fd.timeValue?.final ?? fd.timeValue?.auto ?? 1.0,
        // If fidoodle is at DB default (1.0), show auto value; otherwise show the override
        fidoodleFactor: (bld.fidoodleFactor && Math.abs(Number(bld.fidoodleFactor) - 1.0) > 0.001)
          ? Number(bld.fidoodleFactor)
          : (fd.fidoodleFactor?.auto ?? 1.0),
        capexPerMw: fd.capexPerMw?.resolved ?? fd.capexPerMw?.global ?? 10,
      });
    }
  }, [data]);

  const handleLeaseChange = (key: string, value: string) => {
    setLeaseEdits((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleFactorChange = (key: string, value: number) => {
    setFactorOverrides((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    // If split building, save per-split lease edits first
    if (isSplitBuilding && Object.keys(splitLeaseEdits).length > 0) {
      await handleSaveSplitLeases();
    }

    const fd = data?.factorDetails || {};

    // Calculate Annual Rev from Lease Value / Term
    const leaseVal = parseFloat(leaseEdits.leaseValueM) || 0;
    const years = parseFloat(leaseEdits.leaseYears) || 1;
    const annualRev = leaseVal / Math.max(years, 0.1);

    // Calculate NOI from Annual Rev × NOI %
    const noiPct = parseFloat(leaseEdits.noiPct) || 0;
    const calculatedNoi = annualRev * (noiPct / 100);

    updateMutation.mutate({
      // Lease details (only for single-period buildings)
      lease: isSplitBuilding ? undefined : {
        tenant: leaseEdits.tenant || null,
        leaseStructure: leaseEdits.leaseStructure,
        leaseYears: leaseEdits.leaseYears ? parseFloat(leaseEdits.leaseYears) : null,
        leaseValueM: leaseEdits.leaseValueM ? parseFloat(leaseEdits.leaseValueM) : null,
        annualRevM: annualRev || null,
        noiPct: noiPct ? noiPct / 100 : null,
        noiAnnualM: calculatedNoi || null,
      },
      // Factor overrides
      factors: {
        // If fidoodle matches auto (product of all other factors), save as 1.0 (DB default = not overridden)
        fidoodleFactor: Math.abs((factorOverrides.fidoodleFactor ?? 1.0) - (fd.fidoodleFactor?.auto ?? 1.0)) < 0.005
          ? 1.0
          : factorOverrides.fidoodleFactor,
        probabilityOverride: factorOverrides.phaseProbability !== (fd.phaseProbability?.auto ?? 0.5) ? factorOverrides.phaseProbability : null,
        regulatoryRisk: factorOverrides.regulatoryRisk,
        sizeMultOverride: factorOverrides.sizeMultiplier !== (fd.sizeMultiplier?.auto ?? 1) ? factorOverrides.sizeMultiplier : null,
        powerAuthMultOverride: factorOverrides.powerAuthority !== (fd.powerAuthority?.auto ?? 1) ? factorOverrides.powerAuthority : null,
        ownershipMultOverride: factorOverrides.ownership !== (fd.ownership?.auto ?? 1) ? factorOverrides.ownership : null,
        tierMultOverride: factorOverrides.datacenterTier !== (fd.datacenterTier?.auto ?? 1) ? factorOverrides.datacenterTier : null,
        capexPerMwOverride: factorOverrides.capexPerMw !== (fd.capexPerMw?.global ?? 10) ? factorOverrides.capexPerMw : null,
        capexInFinancials,
      },
    });
  };

  const handleResetAll = () => {
    if (data) {
      const ld = data.leaseDetails || {};
      const fd = data.factorDetails || {};

      setLeaseEdits({
        tenant: ld.tenant || '',
        leaseStructure: ld.leaseStructure || 'NNN',
        leaseYears: ld.leaseYears || '',
        leaseValueM: ld.leaseValueM || '',
        annualRevM: ld.annualRevM || '',
        noiPct: ld.noiPct ? (ld.noiPct * 100).toFixed(1) : '',
      });

      setFactorOverrides({
        phaseProbability: fd.phaseProbability?.auto ?? 0.5,
        regulatoryRisk: 1.0,
        sizeMultiplier: fd.sizeMultiplier?.auto ?? 1.0,
        powerAuthority: fd.powerAuthority?.auto ?? 1.0,
        ownership: fd.ownership?.auto ?? 1.0,
        datacenterTier: fd.datacenterTier?.auto ?? 1.0,
        leaseStructure: fd.leaseStructure?.auto ?? 1.0,
        tenantCredit: fd.tenantCredit?.auto ?? 1.0,
        timeValue: fd.timeValue?.auto ?? 1.0,
        fidoodleFactor: fd.fidoodleFactor?.auto ?? 1.0,
        capexPerMw: fd.capexPerMw?.global ?? 10,
      });

      setHasChanges(true);
    }
  };

  // Save per-split lease edits
  const handleSaveSplitLeases = async () => {
    const apiUrl = getApiUrl();
    const energizationDate = data?.building?.energizationDate;

    for (const [usePeriodId, edits] of Object.entries(splitLeaseEdits)) {
      // Validate lease start date
      if (edits.leaseStart && energizationDate) {
        const energDate = energizationDate.split('T')[0];
        if (edits.leaseStart < energDate) {
          alert(`Lease start date for ${edits.tenant || 'split'} cannot be before energization date (${energDate})`);
          return;
        }
      }

      const noiPctVal = edits.noiPct ? parseFloat(edits.noiPct) : null;
      const payload: Record<string, any> = {
        tenant: edits.tenant || null,
        leaseValueM: edits.leaseValueM ? parseFloat(edits.leaseValueM) : null,
        leaseYears: edits.leaseYears ? parseFloat(edits.leaseYears) : null,
        noiPct: noiPctVal != null ? (noiPctVal > 1 ? noiPctVal / 100 : noiPctVal) : null,
        leaseStart: edits.leaseStart || null,
        startDate: edits.leaseStart || null,
        mwAllocation: edits.mwAllocation ? parseFloat(edits.mwAllocation) : null,
        useType: edits.useType || undefined,
        capexPerMwOverride: edits.capexPerMw !== '' && edits.capexPerMw != null ? parseFloat(edits.capexPerMw) : null,
      };

      try {
        const res = await fetch(`${apiUrl}/api/v1/use-periods/${usePeriodId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          alert(body.error || `Failed to save split ${edits.tenant || usePeriodId}`);
          return;
        }
      } catch (err) {
        console.error('Error saving split lease:', err);
        alert('Error saving split lease data');
        return;
      }
    }

    // Refresh all data
    queryClient.invalidateQueries({ queryKey: ['building-valuation', buildingId] });
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    queryClient.invalidateQueries({ queryKey: ['valuation'] });
    setHasChanges(false);
  };

  const handleSplitLeaseChange = (usePeriodId: string, key: string, value: string) => {
    setSplitLeaseEdits(prev => ({
      ...prev,
      [usePeriodId]: { ...prev[usePeriodId], [key]: value },
    }));
    setHasChanges(true);
  };

  // ── Live client-side valuation preview ──
  // Mirrors the server's computePeriodValuation so the waterfall updates as you type
  const liveValuation = useMemo(() => {
    if (!data) return null;
    const building = data.building || {};
    const fd = data.factorDetails || {};
    const itMw = Number(building.itMw) || 0;
    const hpcCapRate = data.valuation?.inputs?.capRate ?? 0.075;
    const debtFundingPct = fd.capexPerMw?.debtFundingPct ?? 0.80;

    // Build building factor from current overrides
    // autoFidoodle = product of individual building-level factors
    const autoFidoodle =
      (factorOverrides.phaseProbability ?? 0.5) *
      (factorOverrides.regulatoryRisk ?? 1.0) *
      (factorOverrides.sizeMultiplier ?? 1.0) *
      (factorOverrides.powerAuthority ?? 1.0) *
      (factorOverrides.ownership ?? 1.0) *
      (factorOverrides.datacenterTier ?? 1.0);
    // buildingFactor is always the auto product; fidoodle override controls the FULL combined factor
    const bldFactor = autoFidoodle;
    const fidoodleVal = factorOverrides.fidoodleFactor ?? autoFidoodle;
    const fidoodleIsOverridden = Math.abs(fidoodleVal - 1.0) > 0.001 && Math.abs(fidoodleVal - autoFidoodle) > 0.005;

    // Tenant credit: adjusts cap rate, NOT a separate multiplier
    const sofrRate = 4.3; // TODO: pull from settings
    const tenantSpread = fd.tenantCredit?.spread ?? 0;
    const tenantAdjCapRate = tenantSpread === 0 ? hpcCapRate : hpcCapRate * (sofrRate + tenantSpread) / sofrRate;

    const phase = building.developmentPhase || 'DILIGENCE';
    const isOperational = phase === 'OPERATIONAL';
    const capexInFin = capexInFinancials;
    const resolvedCapexGlobal = factorOverrides.capexPerMw ?? fd.capexPerMw?.resolved ?? 10;

    const serverPeriods: any[] = data.periodValuations || [];
    const isSplit = serverPeriods.length > 1;

    if (!isSplit) {
      // Single-period building — use leaseEdits
      const tenant = leaseEdits.tenant || null;
      const leaseValM = parseFloat(leaseEdits.leaseValueM) || 0;
      const leaseYrs = parseFloat(leaseEdits.leaseYears) || 0;
      const noiPctVal = parseFloat(leaseEdits.noiPct) || 0;
      const annualRev = leaseValM > 0 && leaseYrs > 0 ? leaseValM / Math.max(leaseYrs, 0.1) : 0;
      const noiAnnual = annualRev * (noiPctVal / 100);
      const hasLease = !!tenant && leaseValM > 0;
      const mw = itMw;

      // Time/lease structure multipliers — tenant credit is in the cap rate, not here
      const tenantMult = factorOverrides.tenantCredit ?? fd.tenantCredit?.mult ?? 1.0; // informational only
      const leaseStructMult = factorOverrides.leaseStructure ?? fd.leaseStructure?.auto ?? 1.0;
      const timeValueMult = factorOverrides.timeValue ?? fd.timeValue?.auto ?? 1.0;
      // Fidoodle override: when set (≠ 1.0 and ≠ auto), it IS the entire combined factor
      const periodFactor = fidoodleIsOverridden ? fidoodleVal : bldFactor * timeValueMult * leaseStructMult;

      // CapEx
      const resolvedCapex = resolvedCapexGlobal;
      const totalCapexM = resolvedCapex * mw;
      const equityCapexM = resolvedCapex * (1 - debtFundingPct) * mw;
      const debtCapexM = resolvedCapex * debtFundingPct * mw;

      // Determine method + valuation
      let method = 'MW_PIPELINE';
      let grossValue = 0;
      let valuationM = 0;

      const currentUse = (data.usePeriods || [])[0];
      const useType = currentUse?.useType || 'UNCONTRACTED';

      if ((useType === 'BTC_MINING' || useType === 'BTC_MINING_HOSTING') && !hasLease) {
        method = 'MW_VALUE';
        grossValue = mw * 0.3;
        const adj = grossValue * periodFactor;
        valuationM = adj;
      } else if (hasLease && noiAnnual > 0) {
        method = 'NOI_CAP_RATE';
        grossValue = noiAnnual / tenantAdjCapRate;
        const adj = grossValue * periodFactor;
        const skipCapex = isOperational || capexInFin || !hasLease;
        const eqDeducted = skipCapex ? 0 : equityCapexM;
        valuationM = Math.max(0, adj - eqDeducted);
      } else if (hasLease) {
        method = 'NOI_CAP_RATE';
        grossValue = 0;
        valuationM = 0;
      } else {
        method = 'MW_PIPELINE';
        const pipelineMwVal = factorOverrides.pipelineMwValue ?? fd.pipelineMwValue?.global ?? 8;
        grossValue = mw * pipelineMwVal;
        valuationM = grossValue * periodFactor;
      }

      const skipCapex = isOperational || capexInFin || !hasLease;
      const capexSkipReason = isOperational ? 'operational' : capexInFin ? 'in_financials' : !hasLease ? 'no_lease' : null;
      const capexDeductionM = skipCapex ? 0 : equityCapexM;

      const periods = [{
        usePeriodId: currentUse?.id || null,
        isCurrent: true,
        tenant,
        useType,
        mw,
        method,
        grossValue,
        noiAnnual,
        noiPct: noiPctVal / 100,
        capRate: tenantAdjCapRate,
        periodFactor,
        tenantMult,
        leaseStructMult,
        timeValueMult,
        totalCapexM,
        equityCapexM,
        debtCapexM,
        capexDeductionM,
        capexSkipReason,
        valuationM,
        leaseValueM: leaseValM,
        leaseYears: leaseYrs,
        annualRev,
        leaseStart: currentUse?.leaseStart || currentUse?.startDate || null,
      }];

      return {
        periods,
        totalValuation: valuationM,
        dollarsPerMwPerYr: mw > 0 && leaseValM > 0 && leaseYrs > 0 ? annualRev / mw : null,
        noiPerMwPerYr: mw > 0 && noiAnnual > 0 ? noiAnnual / mw : null,
      };
    }

    // Multi-period (split) building — use splitLeaseEdits
    const livePeriods: any[] = [];
    let totalVal = 0;
    let totalLeaseRevPerYr = 0;
    let totalMw = 0;
    let totalNoi = 0;

    for (const sp of serverPeriods) {
      const upId = sp.usePeriodId;
      const edits = upId ? splitLeaseEdits[upId] : null;

      // Use edits if available, otherwise server values
      const tenant = edits ? (edits.tenant || null) : (sp.tenant || null);
      const leaseValM = edits ? (parseFloat(edits.leaseValueM) || 0) : (sp.leaseValueM || 0);
      const leaseYrs = edits ? (parseFloat(edits.leaseYears) || 0) : (sp.leaseYears || 0);
      const noiPctVal = edits ? (parseFloat(edits.noiPct) || 0) : ((sp.noiPct || 0) * 100);
      const mw = edits ? (parseFloat(edits.mwAllocation) || sp.mw || 0) : (sp.mw || 0);
      const useType = edits ? (edits.useType || sp.useType) : (sp.useType || 'UNCONTRACTED');
      const capexPerMwOvr = edits ? (parseFloat(edits.capexPerMw) || 0) : (sp.capexPerMwOverride || 0);
      const isPeriodCurrent = sp.isCurrent !== false;

      const annualRev = leaseValM > 0 && leaseYrs > 0 ? leaseValM / Math.max(leaseYrs, 0.1) : 0;
      const noiPctFrac = noiPctVal / 100;
      const noiAnnual = annualRev * noiPctFrac;
      const hasLease = !!tenant && leaseValM > 0;

      // Use server factors for per-period multipliers — tenant credit is in cap rate, not factor
      const tenantMult = sp.tenantMult ?? 1; // informational only
      const leaseStructMult = sp.leaseStructMult ?? 1;
      const timeValueMult = sp.timeValueMult ?? 1;
      // Fidoodle override: when set, it IS the entire combined factor
      const periodFactor = fidoodleIsOverridden ? fidoodleVal : bldFactor * timeValueMult * leaseStructMult;

      // CapEx
      const resolvedCapex = capexPerMwOvr || resolvedCapexGlobal;
      const totalCapexM = resolvedCapex * mw;
      const equityCapexM = resolvedCapex * (1 - debtFundingPct) * mw;
      const debtCapexM = resolvedCapex * debtFundingPct * mw;

      const hasPerPeriodCapex = !!capexPerMwOvr;
      const isPlannedTransition = !isPeriodCurrent;
      const skipCapex = hasPerPeriodCapex ? false : (isPlannedTransition && hasLease) ? false : (isOperational || capexInFin || !hasLease);
      const capexSkipReason = hasPerPeriodCapex ? null : (isPlannedTransition && hasLease) ? null : (isOperational ? 'operational' : capexInFin ? 'in_financials' : !hasLease ? 'no_lease' : null);
      const capexDeductionM = skipCapex ? 0 : equityCapexM;

      let method = 'MW_PIPELINE';
      let grossValue = 0;
      let valuationM = 0;

      if ((useType === 'BTC_MINING' || useType === 'BTC_MINING_HOSTING') && !hasLease) {
        method = 'MW_VALUE';
        grossValue = mw * 0.3;
        valuationM = Math.max(0, grossValue * periodFactor - capexDeductionM);
      } else if (hasLease && noiAnnual > 0) {
        method = 'NOI_CAP_RATE';
        grossValue = noiAnnual / tenantAdjCapRate;
        valuationM = Math.max(0, grossValue * periodFactor - capexDeductionM);
      } else {
        method = 'MW_PIPELINE';
        const pipelineMwVal = factorOverrides.pipelineMwValue ?? fd.pipelineMwValue?.global ?? 8;
        grossValue = mw * pipelineMwVal;
        valuationM = Math.max(0, grossValue * periodFactor);
      }

      totalVal += valuationM;
      totalLeaseRevPerYr += annualRev;
      totalMw += mw;
      totalNoi += noiAnnual;

      livePeriods.push({
        ...sp,
        tenant,
        useType,
        mw,
        method,
        grossValue,
        noiAnnual,
        noiPct: noiPctFrac,
        capRate: tenantAdjCapRate,
        periodFactor,
        tenantMult,
        leaseStructMult,
        timeValueMult,
        totalCapexM,
        equityCapexM,
        debtCapexM,
        capexDeductionM,
        capexSkipReason,
        valuationM,
        leaseValueM: leaseValM,
        leaseYears: leaseYrs,
        annualRev,
      });
    }

    return {
      periods: livePeriods,
      totalValuation: totalVal,
      dollarsPerMwPerYr: totalMw > 0 && totalLeaseRevPerYr > 0 ? totalLeaseRevPerYr / totalMw : null,
      noiPerMwPerYr: totalMw > 0 && totalNoi > 0 ? totalNoi / totalMw : null,
    };
  }, [data, leaseEdits, splitLeaseEdits, factorOverrides, capexInFinancials]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (isLoading) {
    return (
      <div className={`fixed inset-y-0 right-0 w-[520px] bg-gray-900 border-l border-gray-700 shadow-2xl flex items-center justify-center z-50 transition-transform duration-300 ease-in-out ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`fixed inset-y-0 right-0 w-[520px] bg-gray-900 border-l border-gray-700 shadow-2xl z-50 p-4 transition-transform duration-300 ease-in-out ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-red-400">Error Loading</h2>
          <button onClick={handleClose} className="p-1 hover:bg-gray-700 rounded">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        <p className="text-gray-400">Failed to load building valuation details.</p>
        {error && <p className="text-red-400 text-xs mt-2">{String(error)}</p>}
      </div>
    );
  }

  const building = data.building || {};
  const site = data.site || {};
  const campus = data.campus || {};
  const factorDetails = data.factorDetails || {};

  // Use live client-side valuations (update as you type) with server data as fallback
  const serverPeriodValuations: any[] = data.periodValuations || [];
  const periodValuations = liveValuation?.periods ?? serverPeriodValuations;
  const totalValuation = liveValuation?.totalValuation ?? (data.totalValuation || 0);
  const dollarsPerMwPerYr = liveValuation?.dollarsPerMwPerYr ?? null;
  const noiPerMwPerYr = liveValuation?.noiPerMwPerYr ?? null;
  const currentUses = (data.usePeriods || []).filter((up: any) => up.isCurrent);
  const isSplitBuilding = periodValuations.length > 1;

  return (
    <div className={`fixed inset-y-0 right-0 w-[520px] bg-gray-900 border-l border-gray-700 shadow-2xl z-50 flex flex-col overflow-hidden transition-transform duration-300 ease-in-out ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}>
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-gray-700 bg-gray-800">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Building2 className="h-4 w-4 text-orange-500" />
              {building.name || 'Building'}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
              <MapPin className="h-3 w-3" />
              <span>{site.name || 'Site'}</span>
              <span className="text-gray-600">•</span>
              <span>{campus.name || 'Campus'}</span>
            </div>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-gray-700 rounded">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Sticky Valuation Summary + Waterfall */}
      <div className="flex-shrink-0 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
        {/* Headline */}
        <div className="flex items-center justify-between p-3 pb-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-300">Valuation</span>
            {hasChanges && <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-400 animate-pulse">Live Preview</span>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-orange-400">
              {formatMoney(totalValuation)}
            </div>
            {(dollarsPerMwPerYr !== null || noiPerMwPerYr !== null) && (
              <div className="flex items-center gap-2 justify-end mt-0.5">
                {dollarsPerMwPerYr !== null && (
                  <span className="text-[10px] text-blue-400 font-mono">
                    ${safeToFixed(dollarsPerMwPerYr, 2)}M/MW/yr rev
                  </span>
                )}
                {noiPerMwPerYr !== null && (
                  <span className="text-[10px] text-green-400 font-mono">
                    ${safeToFixed(noiPerMwPerYr, 2)}M/MW/yr NOI
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Waterfall — display server-computed period valuations */}
        <div className="px-3 pb-3 pt-2">
          {periodValuations.length === 0 ? (
            <div className="text-[11px] text-gray-600 italic">No valuation — add lease details or set a use type</div>
          ) : periodValuations.length === 1 ? (
            // Single-period waterfall
            (() => {
              const p = periodValuations[0];
              if (p.method === 'NOI_CAP_RATE') {
                return (
                  <div className="text-[11px] font-mono space-y-0.5">
                    <div className="flex justify-between text-gray-500">
                      <span>Lease Value ÷ Term</span>
                      <span>{formatMoney(p.leaseValueM)} ÷ {safeToFixed(p.leaseYears, 1)}yr = <span className="text-gray-400">{formatMoney(p.annualRev)}/yr</span></span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>× NOI Margin</span>
                      <span>× {safeToFixed((p.noiPct || 0) * 100, 0)}% = <span className="text-green-400 font-medium">{formatMoney(p.noiAnnual)}/yr NOI</span></span>
                    </div>
                    <div className="border-t border-gray-700 my-1" />
                    <div className="flex justify-between">
                      <span className="text-gray-500">Capitalized Value (NOI ÷ {safeToFixed(p.capRate * 100, 1)}%)</span>
                      <span className="text-blue-400">{formatMoney(p.grossValue)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>× Adj Factor</span>
                      <span className="text-orange-400 font-medium">× {safeToFixed(p.periodFactor, 3)}x</span>
                    </div>
                    <CapexBreakdown p={p} variant="single" />
                    <div className="border-t border-dashed border-orange-500/30 my-1" />
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-400 font-bold">{(p.capexDeductionM ?? 0) > 0 ? 'Net Value' : 'Adjusted Value'}</span>
                      <span className="text-orange-400 font-bold">{formatMoney(p.valuationM)}</span>
                    </div>
                  </div>
                );
              } else if (p.method === 'MW_VALUE') {
                return (
                  <div className="text-[11px] font-mono space-y-0.5">
                    <div className="flex justify-between text-gray-500">
                      <span>BTC Mining $/MW</span>
                      <span>{safeToFixed(p.mw, 0)} MW × $0.3M = <span className="text-white">{formatMoney(p.grossValue)}</span></span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>× Adj Factor</span>
                      <span className="text-orange-400 font-medium">× {safeToFixed(p.periodFactor, 3)}x</span>
                    </div>
                    <CapexBreakdown p={p} variant="single" />
                    <div className="border-t border-dashed border-orange-500/30 my-1" />
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-400 font-bold">{(p.capexDeductionM ?? 0) > 0 ? 'Net Value' : 'Adjusted Value'}</span>
                      <span className="text-orange-400 font-bold">{formatMoney(p.valuationM)}</span>
                    </div>
                  </div>
                );
              } else {
                // MW_PIPELINE or LEASE_VALUE
                return (
                  <div className="text-[11px] font-mono space-y-0.5">
                    <div className="flex justify-between text-gray-500">
                      <span>Pipeline $/MW (uncontracted)</span>
                      <span>{safeToFixed(p.mw, 0)} MW × $8M = <span className="text-white">{formatMoney(p.grossValue)}</span></span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>× Adj Factor</span>
                      <span className="text-orange-400 font-medium">× {safeToFixed(p.periodFactor, 3)}x</span>
                    </div>
                    <CapexBreakdown p={p} variant="single" />
                    <div className="border-t border-dashed border-orange-500/30 my-1" />
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-400 font-bold">{(p.capexDeductionM ?? 0) > 0 ? 'Net Value' : 'Adjusted Value'}</span>
                      <span className="text-orange-400 font-bold">{formatMoney(p.valuationM)}</span>
                    </div>
                  </div>
                );
              }
            })()
          ) : (
            // Multi-period (split) waterfall
            <div className="text-[11px] font-mono space-y-1.5">
              {periodValuations.map((p: any, i: number) => (
                <div key={p.usePeriodId || i} className={`rounded px-2 py-1.5 ${p.isCurrent === false ? 'bg-blue-950/30 border border-blue-800/30' : 'bg-gray-800/50'}`}>
                  {/* Period header */}
                  <div className="flex justify-between text-gray-400 mb-1">
                    <span className="flex items-center gap-1.5">
                      {p.isCurrent === false && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-900/50 text-blue-400">Planned</span>}
                      <span className="text-cyan-400 font-medium">{p.tenant || 'Uncontracted'}</span>
                    </span>
                    <span className="text-gray-500">{safeToFixed(p.mw, 0)} MW · {p.useType?.replace(/_/g, ' ')}</span>
                  </div>
                  {p.leaseStart && (
                    <div className="flex justify-between text-gray-600 mb-0.5">
                      <span>Lease Start</span>
                      <span className="text-gray-400">{new Date(p.leaseStart).toLocaleDateString()}</span>
                    </div>
                  )}
                  {p.method === 'NOI_CAP_RATE' ? (
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-gray-500">
                        <span>Lease ÷ Term</span>
                        <span>{formatMoney(p.leaseValueM)} ÷ {safeToFixed(p.leaseYears, 1)}yr = <span className="text-gray-400">{formatMoney(p.annualRev)}/yr</span></span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>× NOI Margin</span>
                        <span>× {safeToFixed((p.noiPct || 0) * 100, 0)}% = <span className="text-green-400">{formatMoney(p.noiAnnual)}/yr</span></span>
                      </div>
                      <div className="border-t border-gray-700/50 my-0.5" />
                      <div className="flex justify-between text-gray-500">
                        <span>Cap Value</span>
                        <span>NOI ÷ {safeToFixed((p.capRate || 0) * 100, 1)}% = <span className="text-blue-400">{formatMoney(p.grossValue)}</span></span>
                      </div>
                      <div className="border-t border-gray-700/50 my-0.5" />
                      <div className="flex justify-between">
                        <span className="text-gray-500" title={`Bldg: ${safeToFixed(p.periodFactor / ((p.timeValueMult || 1) * (p.tenantMult || 1) * (p.leaseStructMult || 1)), 3)}x × Time: ${safeToFixed(p.timeValueMult || 1, 3)}x × Tenant: ${safeToFixed(p.tenantMult || 1, 3)}x × Lease: ${safeToFixed(p.leaseStructMult || 1, 3)}x`}>
                          × {safeToFixed(p.periodFactor, 3)}x → Adj
                        </span>
                        <span className="text-orange-400 font-medium">{formatMoney((p.capexDeductionM ?? 0) > 0 ? p.valuationM + p.capexDeductionM : p.valuationM)}</span>
                      </div>
                      <CapexBreakdown p={p} variant="multi" showImpliedDebt />
                      {(p.timeValueMult ?? 1) < 0.99 && (
                        <div className="flex justify-between text-gray-600 text-[10px]">
                          <span>⤷ incl. time discount {safeToFixed(p.timeValueMult, 3)}x</span>
                        </div>
                      )}
                    </div>
                  ) : p.method === 'MW_PIPELINE' ? (
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-gray-500">
                        <span>Pipeline $/MW</span>
                        <span>{safeToFixed(p.mw, 0)} MW × $8M = <span className="text-white">{formatMoney(p.grossValue)}</span></span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">× {safeToFixed(p.periodFactor, 3)}x → Adj</span>
                        <span className="text-orange-400 font-medium">{formatMoney((p.capexDeductionM ?? 0) > 0 ? p.valuationM + p.capexDeductionM : p.valuationM)}</span>
                      </div>
                      <CapexBreakdown p={p} variant="multi" />
                      {(p.timeValueMult ?? 1) < 0.99 && (
                        <div className="flex justify-between text-gray-600 text-[10px]">
                          <span>⤷ incl. time discount {safeToFixed(p.timeValueMult, 3)}x</span>
                        </div>
                      )}
                    </div>
                  ) : p.method === 'MW_VALUE' ? (
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-gray-500">
                        <span>BTC $/MW</span>
                        <span>{safeToFixed(p.mw, 0)} MW × $0.3M = <span className="text-white">{formatMoney(p.grossValue)}</span></span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">× {safeToFixed(p.periodFactor, 3)}x → Adj</span>
                        <span className="text-orange-400 font-medium">{formatMoney((p.capexDeductionM ?? 0) > 0 ? p.valuationM + p.capexDeductionM : p.valuationM)}</span>
                      </div>
                      <CapexBreakdown p={p} variant="multi" />
                      {(p.timeValueMult ?? 1) < 0.99 && (
                        <div className="flex justify-between text-gray-600 text-[10px]">
                          <span>⤷ incl. time discount {safeToFixed(p.timeValueMult, 3)}x</span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
              <div className="border-t border-dashed border-orange-500/30 my-1" />
              <div className="flex justify-between text-sm">
                <span className="text-orange-400 font-bold">Total Value</span>
                <span className="text-orange-400 font-bold">{formatMoney(totalValuation)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Capacity Allocation Section (Splits & Transitions) */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection('splits')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-2">
              {expandedSections.splits ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
              <Split className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-200">Capacity Allocation</span>
              {currentUses.length > 1 && (
                <span className="text-xs bg-purple-900/50 text-purple-400 px-1.5 py-0.5 rounded">
                  {currentUses.length} splits
                </span>
              )}
            </div>
          </button>
          {expandedSections.splits && (
            <div className="px-4 pb-4">
              {/* Capacity Summary */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-gray-800/50 rounded p-2 text-center">
                  <div className="text-[10px] text-gray-500">Total IT MW</div>
                  <div className="text-sm font-bold text-white">{data?.capacityAllocation?.totalItMw || data?.building?.itMw || 0}</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2 text-center">
                  <div className="text-[10px] text-gray-500">Allocated</div>
                  <div className="text-sm font-bold text-purple-400">{data?.capacityAllocation?.allocatedMw || 0} MW</div>
                </div>
                <div className="bg-gray-800/50 rounded p-2 text-center">
                  <div className="text-[10px] text-gray-500">Unallocated</div>
                  <div className="text-sm font-bold text-gray-400">{data?.capacityAllocation?.unallocatedMw || data?.building?.itMw || 0} MW</div>
                </div>
              </div>

              {/* Use Periods List — only show current periods */}
              <div className="space-y-2 mb-3">
                {(data?.usePeriods || []).filter((up: any) => up.isCurrent).map((up: any) => {
                  const upId = up.id;
                  const edits = splitLeaseEdits[upId];
                  const isEditing = !!edits;
                  return (
                  <div
                    key={up.id}
                    className="bg-gray-800/30 border rounded p-2 border-purple-600/50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/50 text-green-400">
                          Current
                        </span>
                        <span className="text-sm font-medium text-white">{isEditing ? (edits.tenant || 'Uncontracted') : (up.tenant || 'Uncontracted')}</span>
                        {(isEditing ? edits.mwAllocation : up.mwAllocation) && (
                          <span className="text-xs text-purple-400">{isEditing ? edits.mwAllocation : up.mwAllocation} MW</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          (isEditing ? edits.useType : up.useType) === 'HPC_AI_HOSTING' ? 'bg-purple-900/50 text-purple-400' :
                          (isEditing ? edits.useType : up.useType) === 'BTC_MINING' ? 'bg-orange-900/50 text-orange-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {(() => { const ut = isEditing ? edits.useType : up.useType; return ut === 'HPC_AI_HOSTING' ? 'HPC/AI' : ut === 'BTC_MINING' ? 'BTC' : ut; })()}
                        </span>
                        {/* Edit button */}
                        {!isEditing ? (
                          <button
                            onClick={() => {
                              setSplitLeaseEdits(prev => ({
                                ...prev,
                                [upId]: {
                                  tenant: up.tenant || '',
                                  leaseValueM: up.leaseValueM?.toString() || '',
                                  leaseYears: up.leaseYears?.toString() || '',
                                  noiPct: up.noiPct ? (Number(up.noiPct) * 100).toString() : '',
                                  mwAllocation: up.mwAllocation?.toString() || '',
                                  useType: up.useType || 'HPC_AI_HOSTING',
                                  capexPerMw: up.capexPerMwOverride?.toString() || '',
                                  leaseStart: up.startDate ? new Date(up.startDate).toISOString().split('T')[0] : '',
                                },
                              }));
                              setHasChanges(true);
                            }}
                            className="p-1 hover:bg-purple-900/30 rounded text-purple-400/70 hover:text-purple-300"
                            title="Edit period"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSplitLeaseEdits(prev => {
                                const next = { ...prev };
                                delete next[upId];
                                return next;
                              });
                            }}
                            className="p-1 hover:bg-gray-700 rounded text-gray-400"
                            title="Cancel edit"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                        {/* Delete button */}
                        {currentUses.length >= 1 && (
                          confirmDelete === up.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteUsePeriodMutation.mutate(up.id)}
                                className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="text-[10px] px-1.5 py-0.5 bg-gray-600 text-gray-200 rounded hover:bg-gray-500"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(up.id)}
                              className="p-1 hover:bg-red-900/30 rounded text-red-500/70 hover:text-red-400"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                    {/* Inline edit form */}
                    {isEditing && edits && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] text-gray-500">Tenant</label>
                          <input type="text" value={edits.tenant} onChange={(e) => handleSplitLeaseChange(upId, 'tenant', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white" />
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-500">Use Type</label>
                          <select value={edits.useType} onChange={(e) => handleSplitLeaseChange(upId, 'useType', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white">
                            <option value="HPC_AI_HOSTING">HPC/AI Hosting</option>
                            <option value="BTC_MINING">BTC Mining</option>
                            <option value="BTC_MINING_HOSTING">BTC Hosting</option>
                            <option value="GPU_CLOUD">GPU Cloud</option>
                            <option value="UNCONTRACTED">Uncontracted</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-500">MW Allocation</label>
                          <input type="number" value={edits.mwAllocation ?? ''} onChange={(e) => handleSplitLeaseChange(upId, 'mwAllocation', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white" />
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-500">Lease Value ($M)</label>
                          <input type="number" value={edits.leaseValueM ?? ''} onChange={(e) => handleSplitLeaseChange(upId, 'leaseValueM', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white" />
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-500">Lease Term (yr)</label>
                          <input type="number" value={edits.leaseYears ?? ''} onChange={(e) => handleSplitLeaseChange(upId, 'leaseYears', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white" />
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-500">NOI %</label>
                          <input type="number" value={edits.noiPct ?? ''} onChange={(e) => handleSplitLeaseChange(upId, 'noiPct', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white" />
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-500">Lease Start</label>
                          <input type="date" value={edits.leaseStart ?? ''} onChange={(e) => handleSplitLeaseChange(upId, 'leaseStart', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white" />
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-500">CapEx $/MW</label>
                          <input type="number" step="0.5" value={edits.capexPerMw ?? ''} onChange={(e) => handleSplitLeaseChange(upId, 'capexPerMw', e.target.value)} placeholder="Default" className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white" />
                        </div>
                      </div>
                    )}
                    {/* Read-only info when not editing */}
                    {!isEditing && (
                      <>
                        {(up.startDate || up.endDate) && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {up.startDate ? new Date(up.startDate).toLocaleDateString() : 'Now'}
                              {' → '}
                              {up.endDate ? new Date(up.endDate).toLocaleDateString() : 'Ongoing'}
                            </span>
                          </div>
                        )}
                        {up.leaseValueM && (
                          <div className="text-[10px] text-gray-500 mt-1">
                            Lease: ${Number(up.leaseValueM).toLocaleString()}M
                            {up.leaseYears ? ` · ${up.leaseYears}yr` : ''}
                            {up.noiPct ? ` · ${(Number(up.noiPct) * 100).toFixed(0)}% NOI` : ''}
                          </div>
                        )}
                        {!up.tenant && !up.leaseValueM && (
                          <div className="text-[10px] text-gray-500 mt-1 italic">Click edit to add lease details</div>
                        )}
                      </>
                    )}
                  </div>
                  );
                })}
              </div>

              {/* Planned Transitions — show non-current future periods */}
              {(() => {
                const plannedTransitions = (data?.usePeriods || []).filter((up: any) => !up.isCurrent);
                if (plannedTransitions.length === 0) return null;
                return (
                  <div className="mb-3">
                    <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-1.5 font-medium">Planned Transitions</div>
                    <div className="space-y-2">
                      {plannedTransitions.map((up: any) => {
                        const upId = up.id;
                        const edits = splitLeaseEdits[upId];
                        const isEditing = !!edits;
                        return (
                          <div key={up.id} className="bg-blue-950/20 border border-blue-600/30 rounded p-2">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400">
                                  Planned
                                </span>
                                <span className="text-sm font-medium text-white">{up.tenant || 'No tenant yet'}</span>
                                {up.mwAllocation && (
                                  <span className="text-xs text-blue-400">{up.mwAllocation} MW</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  up.useType === 'HPC_AI_HOSTING' ? 'bg-purple-900/50 text-purple-400' :
                                  up.useType === 'BTC_MINING' ? 'bg-orange-900/50 text-orange-400' :
                                  'bg-gray-700 text-gray-400'
                                }`}>
                                  {up.useType === 'HPC_AI_HOSTING' ? 'HPC/AI' : up.useType === 'BTC_MINING' ? 'BTC' : up.useType}
                                </span>
                                {/* Edit button */}
                                {!isEditing ? (
                                  <button
                                    onClick={() => {
                                      setSplitLeaseEdits(prev => ({
                                        ...prev,
                                        [upId]: {
                                          tenant: up.tenant || '',
                                          leaseValueM: up.leaseValueM?.toString() || '',
                                          leaseYears: up.leaseYears?.toString() || '',
                                          noiPct: up.noiPct ? (Number(up.noiPct) * 100).toString() : '',
                                          mwAllocation: up.mwAllocation?.toString() || '',
                                          useType: up.useType || 'HPC_AI_HOSTING',
                                          capexPerMw: up.capexPerMwOverride?.toString() || '',
                                          leaseStart: up.startDate ? new Date(up.startDate).toISOString().split('T')[0] : '',
                                        },
                                      }));
                                      setHasChanges(true);
                                    }}
                                    className="p-1 hover:bg-blue-900/30 rounded text-blue-400/70 hover:text-blue-300"
                                    title="Edit transition"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setSplitLeaseEdits(prev => {
                                        const next = { ...prev };
                                        delete next[upId];
                                        return next;
                                      });
                                    }}
                                    className="p-1 hover:bg-gray-700 rounded text-gray-400"
                                    title="Cancel edit"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                                {/* Activate button */}
                                {confirmActivate === up.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => activateTransitionMutation.mutate(up.id)}
                                      className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded hover:bg-green-700"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => setConfirmActivate(null)}
                                      className="text-[10px] px-1.5 py-0.5 bg-gray-600 text-gray-200 rounded hover:bg-gray-500"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmActivate(up.id)}
                                    className="text-[10px] px-1.5 py-0.5 bg-green-900/40 text-green-400 rounded hover:bg-green-800/60"
                                    title="Activate — ends current periods and makes this one live"
                                  >
                                    Activate
                                  </button>
                                )}
                                {/* Delete button */}
                                {confirmDelete === up.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => deleteUsePeriodMutation.mutate(up.id)}
                                      className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                      Delete
                                    </button>
                                    <button
                                      onClick={() => setConfirmDelete(null)}
                                      className="text-[10px] px-1.5 py-0.5 bg-gray-600 text-gray-200 rounded hover:bg-gray-500"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDelete(up.id)}
                                    className="p-1 hover:bg-red-900/30 rounded text-red-500/70 hover:text-red-400"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {/* Dates */}
                            {(up.startDate || up.endDate) && !isEditing && (
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
                                <Calendar className="h-3 w-3" />
                                <span>
                                  {up.startDate ? new Date(up.startDate).toLocaleDateString() : 'TBD'}
                                  {up.endDate ? ` → ${new Date(up.endDate).toLocaleDateString()}` : ''}
                                </span>
                              </div>
                            )}
                            {/* Lease info summary (when not editing) */}
                            {!isEditing && up.leaseValueM && (
                              <div className="text-[10px] text-gray-500 mt-1">
                                Lease: ${Number(up.leaseValueM).toLocaleString()}M
                                {up.leaseYears ? ` · ${up.leaseYears}yr` : ''}
                                {up.noiPct ? ` · ${(Number(up.noiPct) * 100).toFixed(0)}% NOI` : ''}
                              </div>
                            )}
                            {!isEditing && !up.tenant && !up.leaseValueM && (
                              <div className="text-[10px] text-gray-500/60 mt-1 italic">
                                Click edit to add lease details
                              </div>
                            )}
                            {/* Inline edit fields */}
                            {isEditing && edits && (
                              <div className="mt-2 space-y-1.5">
                                <div className="grid grid-cols-3 gap-1.5">
                                  <div>
                                    <label className="text-[9px] text-gray-500">Tenant</label>
                                    <select
                                      value={edits.tenant || ''}
                                      onChange={(e) => handleSplitLeaseChange(upId, 'tenant', e.target.value)}
                                      className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white"
                                    >
                                      {tenantOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-gray-500">Use Type</label>
                                    <select
                                      value={edits.useType || 'HPC_AI_HOSTING'}
                                      onChange={(e) => handleSplitLeaseChange(upId, 'useType', e.target.value)}
                                      className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white"
                                    >
                                      <option value="HPC_AI_HOSTING">HPC/AI</option>
                                      <option value="BTC_MINING">BTC Mining</option>
                                      <option value="GPU_CLOUD">GPU Cloud</option>
                                      <option value="UNCONTRACTED">Uncontracted</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-gray-500">MW</label>
                                    <input type="number" value={edits.mwAllocation ?? ''} onChange={(e) => handleSplitLeaseChange(upId, 'mwAllocation', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                  <div>
                                    <label className="text-[9px] text-gray-500">Lease Value ($M)</label>
                                    <input type="number" value={edits.leaseValueM ?? ''} onChange={(e) => handleSplitLeaseChange(upId, 'leaseValueM', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white" />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-gray-500">Lease Term (yr)</label>
                                    <input type="number" value={edits.leaseYears ?? ''} onChange={(e) => handleSplitLeaseChange(upId, 'leaseYears', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white" />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-gray-500">NOI %</label>
                                    <input type="number" value={edits.noiPct ?? ''} onChange={(e) => handleSplitLeaseChange(upId, 'noiPct', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="text-[9px] text-gray-500">Lease Start</label>
                                    <input type="date" value={edits.leaseStart ?? ''} onChange={(e) => handleSplitLeaseChange(upId, 'leaseStart', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white" />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-gray-500">CapEx $/MW</label>
                                    <input type="number" step="0.5" value={edits.capexPerMw ?? ''} onChange={(e) => handleSplitLeaseChange(upId, 'capexPerMw', e.target.value)} placeholder="Default: 10" className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white" />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setSplitType('split'); setShowSplitModal(true); setNewUsePeriod({ isCurrent: true }); }}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-purple-600/20 border border-purple-600/50 text-purple-400 rounded hover:bg-purple-600/30 text-xs"
                >
                  <Split className="h-3 w-3" />
                  Add Split
                </button>
                <button
                  onClick={() => { setSplitType('transition'); setShowSplitModal(true); setNewUsePeriod({ isCurrent: false }); }}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600/20 border border-blue-600/50 text-blue-400 rounded hover:bg-blue-600/30 text-xs"
                >
                  <Calendar className="h-3 w-3" />
                  Plan Transition
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lease Details Section */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection('lease')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-2">
              {expandedSections.lease ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-200">Lease Details</span>
            </div>
          </button>
          {expandedSections.lease && (() => {
            if (isSplitBuilding) {
              // Per-period editable lease details for split buildings
              const energDate = data?.building?.energizationDate ? data.building.energizationDate.split('T')[0] : '';
              return (
                <div className="px-4 pb-4 space-y-2">
                  <div className="text-[10px] text-gray-500 mb-1">Edit lease details per split below.</div>
                  {periodValuations.map((pv: any, idx: number) => {
                    const upId = pv.usePeriodId;
                    const edits = upId ? splitLeaseEdits[upId] : null;
                    if (!edits) {
                      // Read-only fallback for unallocated
                      return (
                        <div key={upId || idx} className="bg-gray-800/30 border border-gray-700 rounded p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-cyan-400">{pv.tenant || 'Uncontracted'}</span>
                            <span className="text-[10px] text-gray-500">{safeToFixed(pv.mw, 0)} MW</span>
                          </div>
                          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px]">
                            <span className="text-gray-500">NOI</span>
                            <span className="text-green-400 col-span-2">{pv.noiAnnual > 0 ? formatMoney(pv.noiAnnual) : '—'}</span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={upId} className="bg-gray-800/30 border border-gray-700 rounded p-2.5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-cyan-400">{edits.tenant || 'Uncontracted'}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            edits.useType === 'HPC_AI_HOSTING' ? 'bg-purple-900/50 text-purple-400' :
                            edits.useType === 'BTC_MINING' ? 'bg-orange-900/50 text-orange-400' :
                            'bg-gray-700 text-gray-400'
                          }`}>
                            {edits.useType === 'HPC_AI_HOSTING' ? 'HPC/AI' : edits.useType === 'BTC_MINING' ? 'BTC' : edits.useType}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">Tenant</label>
                            <input
                              type="text"
                              value={edits.tenant}
                              onChange={(e) => handleSplitLeaseChange(upId, 'tenant', e.target.value)}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white"
                              placeholder="Tenant"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">MW</label>
                            <input
                              type="number"
                              value={edits.mwAllocation}
                              onChange={(e) => handleSplitLeaseChange(upId, 'mwAllocation', e.target.value)}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">Lease Start</label>
                            <input
                              type="date"
                              value={edits.leaseStart}
                              min={energDate}
                              onChange={(e) => handleSplitLeaseChange(upId, 'leaseStart', e.target.value)}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white"
                            />
                            {edits.leaseStart && energDate && edits.leaseStart < energDate && (
                              <span className="text-red-400 text-[9px]">Before energization!</span>
                            )}
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">Lease $M</label>
                            <input
                              type="number"
                              value={edits.leaseValueM}
                              onChange={(e) => handleSplitLeaseChange(upId, 'leaseValueM', e.target.value)}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white"
                              step="0.1"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">Years</label>
                            <input
                              type="number"
                              value={edits.leaseYears}
                              onChange={(e) => handleSplitLeaseChange(upId, 'leaseYears', e.target.value)}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white"
                              step="0.5"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">NOI %</label>
                            <input
                              type="number"
                              value={edits.noiPct}
                              onChange={(e) => handleSplitLeaseChange(upId, 'noiPct', e.target.value)}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white"
                              placeholder="e.g. 85"
                            />
                          </div>
                          <div>
                              <label className="text-[10px] text-gray-500 block mb-0.5">CapEx $/MW</label>
                              <input
                                type="number"
                                value={edits.capexPerMw ?? ''}
                                onChange={(e) => handleSplitLeaseChange(upId, 'capexPerMw', e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-white"
                                placeholder={`${factorDetails.capexPerMw?.resolved ?? 10}`}
                                step="0.5"
                              />
                            </div>
                        </div>
                        {/* Calculated NOI preview */}
                        {edits.leaseValueM && edits.leaseYears && edits.noiPct && (
                          <div className="mt-1.5 pt-1.5 border-t border-gray-700/50 flex justify-between text-[10px]">
                            <span className="text-gray-500">Calculated NOI</span>
                            <span className="text-green-400 font-medium">
                              {formatMoney((parseFloat(edits.leaseValueM) / Math.max(parseFloat(edits.leaseYears), 0.1)) * (parseFloat(edits.noiPct) / 100))}
                              /yr
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Single-period: editable lease form
            return (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-3 gap-3">
                  <EditableField
                    label="Tenant"
                    value={leaseEdits.tenant}
                    onChange={(v) => handleLeaseChange('tenant', v)}
                    type="select"
                    options={tenantOptions}
                  />
                  <EditableField
                    label="Term (years)"
                    value={leaseEdits.leaseYears}
                    onChange={(v) => handleLeaseChange('leaseYears', v)}
                    type="number"
                    step="0.5"
                  />
                  <EditableField
                    label="Lease Value ($M)"
                    value={leaseEdits.leaseValueM}
                    onChange={(v) => handleLeaseChange('leaseValueM', v)}
                    type="number"
                    step="0.1"
                  />
                  <div>
                    <div className="text-[10px] text-gray-500 mb-0.5">Annual Rev ($M) — calculated</div>
                    <div className="bg-gray-800/50 border border-gray-700 rounded px-2 py-1 text-xs text-blue-400 font-medium">
                      {(() => {
                        const leaseVal = parseFloat(leaseEdits.leaseValueM) || 0;
                        const years = parseFloat(leaseEdits.leaseYears) || 1;
                        const annualRev = leaseVal / Math.max(years, 0.1);
                        return `$${annualRev.toFixed(2)}M`;
                      })()}
                    </div>
                  </div>
                  <EditableField
                    label="NOI %"
                    value={leaseEdits.noiPct}
                    onChange={(v) => handleLeaseChange('noiPct', v)}
                    type="number"
                    step="1"
                    suffix="%"
                  />
                  <div className="col-span-3 bg-gray-800/50 rounded p-2">
                    <div className="text-[10px] text-gray-500 mb-0.5">Annual NOI ($M) — calculated: (Lease Value ÷ Term) × NOI %</div>
                    <div className="text-lg font-bold text-green-400">
                      {(() => {
                        const leaseVal = parseFloat(leaseEdits.leaseValueM) || 0;
                        const years = parseFloat(leaseEdits.leaseYears) || 1;
                        const annualRev = leaseVal / Math.max(years, 0.1);
                        const pct = parseFloat(leaseEdits.noiPct) || 0;
                        const noi = annualRev * (pct / 100);
                        return formatMoney(noi);
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Adjustment Factors Section */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection('factors')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-2">
              {expandedSections.factors ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
              <span className="text-sm font-medium text-gray-200">Adjustment Factors</span>
            </div>
          </button>
          {expandedSections.factors && (
            <div className="px-4 pb-4">
              {/* Fidoodle Factor - combined building factor / override */}
              <div className="mb-3 pb-3 border-b border-gray-700">
                <SliderRow
                  label="Fidoodle Factor"
                  autoValue={factorDetails.fidoodleFactor?.auto ?? 1.0}
                  currentValue={factorOverrides.fidoodleFactor ?? factorDetails.fidoodleFactor?.auto ?? 1.0}
                  onChange={(v) => handleFactorChange('fidoodleFactor', v)}
                  min={0.0}
                  max={2.0}
                  step={0.01}
                  format={formatMultiplier}
                  description="combined building factor"
                  variant="green"
                />
              </div>
              <SliderRow
                label="Phase Probability"
                autoValue={factorDetails.phaseProbability?.auto ?? 0.5}
                currentValue={factorOverrides.phaseProbability ?? 0.5}
                onChange={(v) => handleFactorChange('phaseProbability', v)}
                min={0}
                max={1}
                step={0.01}
                format={formatPercent}
                description={factorDetails.phase || 'phase'}
              />
              <SliderRow
                label="Regulatory Risk"
                autoValue={1.0}
                currentValue={factorOverrides.regulatoryRisk ?? 1.0}
                onChange={(v) => handleFactorChange('regulatoryRisk', v)}
                min={0.5}
                max={1.5}
                step={0.01}
                format={formatMultiplier}
                description="0.5x=blocked, 1.5x=favorable"
              />
              <SliderRow
                label="Size Multiplier"
                autoValue={factorDetails.sizeMultiplier?.auto ?? 1.0}
                currentValue={factorOverrides.sizeMultiplier ?? 1.0}
                onChange={(v) => handleFactorChange('sizeMultiplier', v)}
                min={0.8}
                max={1.2}
                step={0.01}
                format={formatMultiplier}
                description={`${Math.round(factorDetails.sizeMultiplier?.siteTotalMw ?? 0)} MW`}
              />
              <SliderRow
                label="Power Authority"
                autoValue={factorDetails.powerAuthority?.auto ?? 1.0}
                currentValue={factorOverrides.powerAuthority ?? 1.0}
                onChange={(v) => handleFactorChange('powerAuthority', v)}
                min={0.8}
                max={1.2}
                step={0.01}
                format={formatMultiplier}
                description={factorDetails.powerAuthority?.grid || 'grid'}
              />
              <SliderRow
                label="Ownership"
                autoValue={factorDetails.ownership?.auto ?? 1.0}
                currentValue={factorOverrides.ownership ?? 1.0}
                onChange={(v) => handleFactorChange('ownership', v)}
                min={0.8}
                max={1.1}
                step={0.01}
                format={formatMultiplier}
                description={factorDetails.ownership?.status || 'owned'}
              />
              <SliderRow
                label="Datacenter Tier"
                autoValue={factorDetails.datacenterTier?.auto ?? 1.0}
                currentValue={factorOverrides.datacenterTier ?? 1.0}
                onChange={(v) => handleFactorChange('datacenterTier', v)}
                min={0.85}
                max={1.15}
                step={0.01}
                format={formatMultiplier}
                description={factorDetails.datacenterTier?.tier || 'Tier III'}
              />
              <div className="mt-2 pt-2 border-t border-gray-700">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <span className="text-xs font-medium text-gray-300">CapEx in Financials</span>
                      <p className="text-[10px] text-gray-500">Financing already arranged — skip capex & implied debt deductions</p>
                    </div>
                    <button
                      onClick={() => { setCapexInFinancials(!capexInFinancials); setHasChanges(true); }}
                      className={`relative w-10 h-5 rounded-full transition-colors ${capexInFinancials ? 'bg-green-600' : 'bg-gray-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${capexInFinancials ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  {!capexInFinancials && (
                    <SliderRow
                      label="CapEx $/MW"
                      autoValue={factorDetails.capexPerMw?.global ?? 10}
                      currentValue={factorOverrides.capexPerMw ?? factorDetails.capexPerMw?.resolved ?? 10}
                      onChange={(v) => handleFactorChange('capexPerMw', v)}
                      min={0}
                      max={30}
                      step={0.5}
                      format={(v) => `$${v.toFixed(1)}M`}
                      description="building override"
                    />
                  )}
                  <SliderRow
                    label="Pipeline $/MW"
                    autoValue={factorDetails.pipelineMwValue?.global ?? 8}
                    currentValue={factorOverrides.pipelineMwValue ?? factorDetails.pipelineMwValue?.global ?? 8}
                    onChange={(v) => handleFactorChange('pipelineMwValue', v)}
                    min={0}
                    max={20}
                    step={0.5}
                    format={(v) => `$${v.toFixed(1)}M`}
                    description="uncontracted MW value"
                  />
                </div>
              {!isSplitBuilding && (
                <>
                  <SliderRow
                    label="Lease Structure"
                    autoValue={factorDetails.leaseStructure?.auto ?? 1.0}
                    currentValue={factorOverrides.leaseStructure ?? 1.0}
                    onChange={(v) => handleFactorChange('leaseStructure', v)}
                    min={0.9}
                    max={1.05}
                    step={0.01}
                    format={formatMultiplier}
                    description={leaseEdits.leaseStructure || 'NNN'}
                  />
                  <SliderRow
                    label="Tenant Credit"
                    autoValue={factorDetails.tenantCredit?.auto ?? 1.0}
                    currentValue={factorOverrides.tenantCredit ?? 1.0}
                    onChange={(v) => handleFactorChange('tenantCredit', v)}
                    min={0.85}
                    max={1.05}
                    step={0.01}
                    format={formatMultiplier}
                    description={leaseEdits.tenant || 'no tenant'}
                  />
                  <SliderRow
                    label="Time Value"
                    autoValue={factorDetails.timeValue?.auto ?? 1.0}
                    currentValue={factorOverrides.timeValue ?? 1.0}
                    onChange={(v) => handleFactorChange('timeValue', v)}
                    min={0.5}
                    max={1.0}
                    step={0.01}
                    format={formatMultiplier}
                    description={factorDetails.timeValue?.source === 'leaseStart' ? 'from lease start' : factorDetails.timeValue?.source === 'energization' ? 'from energization' : 'no date'}
                  />
                </>
              )}
              {isSplitBuilding && periodValuations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-[10px] text-gray-500 mb-2 font-medium uppercase tracking-wide">Per-Split Factors</div>
                  {periodValuations.map((pv: any, i: number) => (
                    <div key={pv.usePeriodId || i} className="mb-2 bg-gray-800/40 rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-cyan-400 font-medium">{pv.tenant || 'Uncontracted'}</span>
                        <span className="text-[10px] text-gray-500">{safeToFixed(pv.mw, 0)} MW</span>
                      </div>
                      <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px]">
                        <span className="text-gray-500">Tenant Credit</span>
                        <span className="text-gray-300 col-span-2">{formatMultiplier(pv.tenantMult ?? 1)}</span>
                        <span className="text-gray-500">Lease Structure</span>
                        <span className="text-gray-300 col-span-2">{formatMultiplier(pv.leaseStructMult ?? 1)}</span>
                        <span className="text-gray-500">Time Value</span>
                        <span className={`col-span-2 ${(pv.timeValueMult ?? 1) < 0.99 ? 'text-yellow-400' : 'text-gray-300'}`}>
                          {formatMultiplier(pv.timeValueMult ?? 1)}
                          {pv.leaseStart && <span className="text-gray-600 ml-1">({new Date(pv.leaseStart).toLocaleDateString()})</span>}
                        </span>
                        {(pv.capexDeductionM ?? 0) > 0 && (
                          <>
                            <span className="text-gray-500">CapEx Deduction</span>
                            <span className="text-rose-400 col-span-2">−{formatMoney(pv.capexDeductionM)}</span>
                          </>
                        )}
                        <span className="text-gray-500 border-t border-gray-700/50 pt-0.5">Combined</span>
                        <span className="text-orange-400 font-medium col-span-2 border-t border-gray-700/50 pt-0.5">{formatMultiplier(pv.periodFactor ?? 1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer with Save/Reset */}
      {hasChanges && (
        <div className="flex-shrink-0 p-3 border-t border-gray-700 bg-gray-800 flex justify-between items-center">
          <button
            onClick={handleResetAll}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-1 px-4 py-1.5 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 text-sm font-medium"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      )}

      {/* Split/Transition Modal */}
      {showSplitModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                {splitType === 'split' ? (
                  <>
                    <Split className="h-5 w-5 text-purple-500" />
                    Add Capacity Split
                  </>
                ) : (
                  <>
                    <Calendar className="h-5 w-5 text-blue-500" />
                    Plan Transition
                  </>
                )}
              </h3>
              <button onClick={() => setShowSplitModal(false)} className="p-1 hover:bg-gray-700 rounded">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">MW Allocation</label>
                  <input
                    type="number"
                    value={newUsePeriod.mwAllocation || ''}
                    onChange={(e) => setNewUsePeriod({ ...newUsePeriod, mwAllocation: e.target.value })}
                    placeholder={`Building total: ${data?.building?.itMw || 0} MW`}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  />
                  <p className="text-[9px] text-gray-600 mt-0.5">Remaining MW valued as pipeline. No double counting.</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Use Type</label>
                  <select
                    value={newUsePeriod.useType || 'HPC_AI_HOSTING'}
                    onChange={(e) => setNewUsePeriod({ ...newUsePeriod, useType: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  >
                    <option value="HPC_AI_HOSTING">HPC/AI Hosting</option>
                    <option value="BTC_MINING">BTC Mining</option>
                    <option value="GPU_CLOUD">GPU Cloud</option>
                    <option value="COLOCATION">Colocation</option>
                    <option value="UNCONTRACTED">Uncontracted</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Tenant</label>
                  <select
                    value={newUsePeriod.tenant || ''}
                    onChange={(e) => setNewUsePeriod({ ...newUsePeriod, tenant: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  >
                    {tenantOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Lease Start Date</label>
                  <input
                    type="date"
                    value={newUsePeriod.startDate || ''}
                    min={data?.building?.energizationDate ? data.building.energizationDate.split('T')[0] : ''}
                    onChange={(e) => setNewUsePeriod({ ...newUsePeriod, startDate: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  />
                  {newUsePeriod.startDate && data?.building?.energizationDate &&
                    newUsePeriod.startDate < data.building.energizationDate.split('T')[0] && (
                    <p className="text-[10px] text-red-400 mt-0.5">Cannot be before energization date</p>
                  )}
                </div>
              </div>

              {splitType === 'transition' && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">End Date (optional)</label>
                  <input
                    type="date"
                    value={newUsePeriod.endDate || ''}
                    onChange={(e) => setNewUsePeriod({ ...newUsePeriod, endDate: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Lease Value ($M)</label>
                  <input
                    type="number"
                    value={newUsePeriod.leaseValueM || ''}
                    onChange={(e) => setNewUsePeriod({ ...newUsePeriod, leaseValueM: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Lease Term (years)</label>
                  <input
                    type="number"
                    value={newUsePeriod.leaseYears || ''}
                    onChange={(e) => setNewUsePeriod({ ...newUsePeriod, leaseYears: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">NOI %</label>
                  <input
                    type="number"
                    value={newUsePeriod.noiPct || ''}
                    onChange={(e) => setNewUsePeriod({ ...newUsePeriod, noiPct: e.target.value })}
                    placeholder="e.g., 85"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">CapEx $/MW {splitType === 'transition' ? '(conversion)' : ''}</label>
                  <input
                    type="number"
                    value={newUsePeriod.capexPerMw || ''}
                    onChange={(e) => setNewUsePeriod({ ...newUsePeriod, capexPerMw: e.target.value })}
                    placeholder="Default: 10"
                    step="0.5"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  />
                  <p className="text-[9px] text-gray-600 mt-0.5">Set to override building/global default. Forces capex deduction.</p>
                </div>
              </div>

              {/* MW validation warning — warn if new allocation exceeds total building MW */}
              {newUsePeriod.mwAllocation && parseFloat(newUsePeriod.mwAllocation) > (data?.capacityAllocation?.totalItMw || 0) && (
                <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-700/30 rounded p-2">
                  Warning: MW allocation ({newUsePeriod.mwAllocation}) exceeds building capacity ({data?.capacityAllocation?.totalItMw || 0} MW)
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowSplitModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const payload: Record<string, any> = {
                    buildingId,
                    isCurrent: splitType === 'split', // splits are current, transitions are planned
                    isSplit: splitType === 'split',
                    useType: newUsePeriod.useType || 'HPC_AI_HOSTING',
                    tenant: newUsePeriod.tenant || null,
                    mwAllocation: newUsePeriod.mwAllocation ? parseFloat(newUsePeriod.mwAllocation) : null,
                    leaseValueM: newUsePeriod.leaseValueM ? parseFloat(newUsePeriod.leaseValueM) : null,
                    leaseYears: newUsePeriod.leaseYears ? parseFloat(newUsePeriod.leaseYears) : null,
                    noiPct: newUsePeriod.noiPct ? parseFloat(newUsePeriod.noiPct) / 100 : null,
                    capexPerMwOverride: newUsePeriod.capexPerMw !== '' && newUsePeriod.capexPerMw != null ? parseFloat(newUsePeriod.capexPerMw) : null,
                    startDate: newUsePeriod.startDate ? new Date(newUsePeriod.startDate) : null,
                    leaseStart: newUsePeriod.startDate ? new Date(newUsePeriod.startDate) : null,
                  };
                  if (splitType === 'transition') {
                    payload.endDate = newUsePeriod.endDate ? new Date(newUsePeriod.endDate) : null;
                  }
                  createUsePeriodMutation.mutate(payload);
                }}
                disabled={createUsePeriodMutation.isPending}
                className={`px-4 py-2 text-sm text-white rounded ${
                  splitType === 'split'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {createUsePeriodMutation.isPending ? 'Creating...' : splitType === 'split' ? 'Add Split' : 'Plan Transition'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BuildingDetailPanel({ buildingId, onClose }: BuildingDetailPanelProps) {
  return (
    <PanelErrorBoundary onClose={onClose}>
      <BuildingDetailPanelInner buildingId={buildingId} onClose={onClose} />
    </PanelErrorBoundary>
  );
}
