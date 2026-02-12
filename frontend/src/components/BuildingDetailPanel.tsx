import { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
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
  Settings,
  Split,
  Calendar,
  Trash2,
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
        <div className="fixed inset-y-0 right-0 w-[520px] bg-gray-900 border-l border-gray-700 shadow-2xl z-50 p-4">
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

  // Editable lease details
  const [leaseEdits, setLeaseEdits] = useState<Record<string, any>>({});
  // Editable valuation inputs
  const [valInputEdits, setValInputEdits] = useState<Record<string, any>>({});
  // Factor overrides
  const [factorOverrides, setFactorOverrides] = useState<Record<string, number>>({});
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
      if (!res.ok) throw new Error('Failed to delete use period');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['building-valuation', buildingId] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  // Initialize state from data
  useEffect(() => {
    if (data) {
      const ld = data.leaseDetails || {};
      const fd = data.factorDetails || {};
      const vi = data.valuation?.inputs || {};
      const bld = data.building || {};

      setLeaseEdits({
        tenant: ld.tenant || '',
        leaseStructure: ld.leaseStructure || 'NNN',
        leaseYears: ld.leaseYears || '',
        leaseValueM: ld.leaseValueM || '',
        annualRevM: ld.annualRevM || '',
        noiPct: ld.noiPct ? (ld.noiPct * 100).toFixed(1) : '',
      });

      setValInputEdits({
        capRate: vi.capRate ? (vi.capRate * 100).toFixed(2) : '7.50',
        exitCapRate: vi.exitCapRate ? (vi.exitCapRate * 100).toFixed(2) : '8.00',
        terminalGrowthRate: vi.terminalGrowthRate ? (vi.terminalGrowthRate * 100).toFixed(1) : '2.5',
      });

      setFactorOverrides({
        phaseProbability: fd.phaseProbability?.final ?? fd.phaseProbability?.auto ?? 0.5,
        regulatoryRisk: fd.regulatoryRisk?.value ?? 1.0,
        sizeMultiplier: fd.sizeMultiplier?.final ?? fd.sizeMultiplier?.auto ?? 1.0,
        powerAuthority: fd.powerAuthority?.final ?? fd.powerAuthority?.auto ?? 1.0,
        ownership: fd.ownership?.final ?? fd.ownership?.auto ?? 1.0,
        datacenterTier: fd.datacenterTier?.final ?? fd.datacenterTier?.auto ?? 1.0,
        leaseStructure: fd.leaseStructure?.final ?? fd.leaseStructure?.auto ?? 1.0,
        tenantCredit: fd.tenantCredit?.final ?? fd.tenantCredit?.auto ?? 1.0,
        energization: fd.energization?.final ?? fd.energization?.auto ?? 1.0,
        fidoodleFactor: bld.fidoodleFactor ?? 1.0,
      });
    }
  }, [data]);

  const handleLeaseChange = (key: string, value: string) => {
    setLeaseEdits((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleValInputChange = (key: string, value: string) => {
    setValInputEdits((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleFactorChange = (key: string, value: number) => {
    setFactorOverrides((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const fd = data?.factorDetails || {};

    // Calculate Annual Rev from Lease Value / Term
    const leaseVal = parseFloat(leaseEdits.leaseValueM) || 0;
    const years = parseFloat(leaseEdits.leaseYears) || 1;
    const annualRev = leaseVal / Math.max(years, 0.1);

    // Calculate NOI from Annual Rev × NOI %
    const noiPct = parseFloat(leaseEdits.noiPct) || 0;
    const calculatedNoi = annualRev * (noiPct / 100);

    updateMutation.mutate({
      // Lease details
      lease: {
        tenant: leaseEdits.tenant || null,
        leaseStructure: leaseEdits.leaseStructure,
        leaseYears: leaseEdits.leaseYears ? parseFloat(leaseEdits.leaseYears) : null,
        leaseValueM: leaseEdits.leaseValueM ? parseFloat(leaseEdits.leaseValueM) : null,
        annualRevM: annualRev || null,
        noiPct: noiPct ? noiPct / 100 : null,
        noiAnnualM: calculatedNoi || null,
      },
      // Valuation inputs (cap rates)
      valuation: {
        capRateOverride: parseFloat(valInputEdits.capRate) / 100,
        exitCapRateOverride: parseFloat(valInputEdits.exitCapRate) / 100,
        terminalGrowthOverride: parseFloat(valInputEdits.terminalGrowthRate) / 100,
      },
      // Factor overrides
      factors: {
        fidoodleFactor: factorOverrides.fidoodleFactor,
        probabilityOverride: factorOverrides.phaseProbability !== (fd.phaseProbability?.auto ?? 0.5) ? factorOverrides.phaseProbability : null,
        regulatoryRisk: factorOverrides.regulatoryRisk,
        sizeMultOverride: factorOverrides.sizeMultiplier !== (fd.sizeMultiplier?.auto ?? 1) ? factorOverrides.sizeMultiplier : null,
        powerAuthMultOverride: factorOverrides.powerAuthority !== (fd.powerAuthority?.auto ?? 1) ? factorOverrides.powerAuthority : null,
        ownershipMultOverride: factorOverrides.ownership !== (fd.ownership?.auto ?? 1) ? factorOverrides.ownership : null,
        tierMultOverride: factorOverrides.datacenterTier !== (fd.datacenterTier?.auto ?? 1) ? factorOverrides.datacenterTier : null,
      },
    });
  };

  const handleResetAll = () => {
    if (data) {
      const ld = data.leaseDetails || {};
      const fd = data.factorDetails || {};
      const gf = data.globalFactors || {};

      setLeaseEdits({
        tenant: ld.tenant || '',
        leaseStructure: ld.leaseStructure || 'NNN',
        leaseYears: ld.leaseYears || '',
        leaseValueM: ld.leaseValueM || '',
        annualRevM: ld.annualRevM || '',
        noiPct: ld.noiPct ? (ld.noiPct * 100).toFixed(1) : '',
      });

      setValInputEdits({
        capRate: ((gf.hpcCapRate || 0.075) * 100).toFixed(2),
        exitCapRate: ((gf.hpcExitCapRate || 0.08) * 100).toFixed(2),
        terminalGrowthRate: ((gf.terminalGrowthRate || 0.025) * 100).toFixed(1),
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
        energization: fd.energization?.auto ?? 1.0,
        fidoodleFactor: 1.0,
      });

      setHasChanges(true);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Calculate live valuation
  const calculateLiveValuation = () => {
    if (!data) return { combinedFactor: 1, adjustedValue: 0, baseValue: 0, terminalValue: 0, grossValue: 0 };

    const combinedFactor =
      (factorOverrides.phaseProbability || 1) *
      (factorOverrides.regulatoryRisk || 1) *
      (factorOverrides.sizeMultiplier || 1) *
      (factorOverrides.powerAuthority || 1) *
      (factorOverrides.ownership || 1) *
      (factorOverrides.datacenterTier || 1) *
      (factorOverrides.leaseStructure || 1) *
      (factorOverrides.tenantCredit || 1) *
      (factorOverrides.energization || 1) *
      (factorOverrides.fidoodleFactor || 1);

    // Calculate Annual Rev from Lease Value / Term
    const leaseVal = parseFloat(leaseEdits.leaseValueM) || 0;
    const leaseYearsVal = leaseEdits.leaseYears ? parseFloat(leaseEdits.leaseYears) : (data.remainingLeaseYears || 10);
    const annualRev = leaseVal / Math.max(leaseYearsVal, 0.1);

    // Calculate NOI from Annual Rev × NOI %
    const noiPct = parseFloat(leaseEdits.noiPct) || 0;
    const noiAnnual = annualRev * (noiPct / 100);
    const capRate = valInputEdits.capRate ? parseFloat(valInputEdits.capRate) / 100 : 0.075;
    const exitCapRate = valInputEdits.exitCapRate ? parseFloat(valInputEdits.exitCapRate) / 100 : 0.08;
    const terminalGrowthRate = valInputEdits.terminalGrowthRate ? parseFloat(valInputEdits.terminalGrowthRate) / 100 : 0.025;
    const discountRate = data.valuation?.inputs?.discountRate || 0.10;
    const leaseYears = leaseYearsVal;
    const renewalProbability = data.globalFactors?.renewalProbability || 0.75;

    // Base Value = NOI / Cap Rate
    const baseValue = noiAnnual > 0 && capRate > 0 ? noiAnnual / capRate : 0;

    // Terminal Value calculation
    const capRateDiff = Math.max(exitCapRate - terminalGrowthRate, 0.001);
    const terminalNoi = noiAnnual * Math.pow(1 + terminalGrowthRate, leaseYears);
    const terminalValueAtEnd = terminalNoi / capRateDiff;
    const terminalValue = terminalValueAtEnd / Math.pow(1 + discountRate, leaseYears) * renewalProbability;

    const grossValue = baseValue + terminalValue;
    const adjustedValue = grossValue * combinedFactor;

    return {
      combinedFactor: isFinite(combinedFactor) ? combinedFactor : 1,
      adjustedValue: isFinite(adjustedValue) ? adjustedValue : 0,
      baseValue: isFinite(baseValue) ? baseValue : 0,
      terminalValue: isFinite(terminalValue) ? terminalValue : 0,
      grossValue: isFinite(grossValue) ? grossValue : 0,
    };
  };

  if (isLoading) {
    return (
      <div className="fixed inset-y-0 right-0 w-[520px] bg-gray-900 border-l border-gray-700 shadow-2xl flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-y-0 right-0 w-[520px] bg-gray-900 border-l border-gray-700 shadow-2xl z-50 p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-red-400">Error Loading</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
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
  const liveValuation = calculateLiveValuation();

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-gray-900 border-l border-gray-700 shadow-2xl z-50 flex flex-col overflow-hidden">
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
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Sticky Valuation Summary */}
      <div className="flex-shrink-0 p-3 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-300">Valuation</span>
            <span className="text-xs text-orange-400 font-medium">
              ({safeToFixed(liveValuation.combinedFactor, 3)}x)
            </span>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-orange-400">
              {formatMoney(liveValuation.adjustedValue)}
            </div>
            <div className="text-[10px] text-gray-500">
              Base: {formatMoney(liveValuation.baseValue)} + Terminal: {formatMoney(liveValuation.terminalValue)}
            </div>
          </div>
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
              {data?.usePeriods && data.usePeriods.length > 1 && (
                <span className="text-xs bg-purple-900/50 text-purple-400 px-1.5 py-0.5 rounded">
                  {data.usePeriods.filter((up: any) => up.isCurrent).length} splits
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

              {/* Use Periods List */}
              <div className="space-y-2 mb-3">
                {(data?.usePeriods || []).map((up: any) => (
                  <div
                    key={up.id}
                    className={`bg-gray-800/30 border rounded p-2 ${up.isCurrent ? 'border-purple-600/50' : 'border-gray-700'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${up.isCurrent ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                          {up.isCurrent ? 'Current' : 'Future'}
                        </span>
                        <span className="text-sm font-medium text-white">{up.tenant || 'Uncontracted'}</span>
                        {up.mwAllocation && (
                          <span className="text-xs text-purple-400">{up.mwAllocation} MW</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          up.useType === 'HPC_AI_HOSTING' ? 'bg-purple-900/50 text-purple-400' :
                          up.useType === 'BTC_MINING' ? 'bg-orange-900/50 text-orange-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {up.useType === 'HPC_AI_HOSTING' ? 'HPC/AI' : up.useType === 'BTC_MINING' ? 'BTC' : up.useType}
                        </span>
                        {(data?.usePeriods || []).length > 1 && (
                          <button
                            onClick={() => deleteUsePeriodMutation.mutate(up.id)}
                            className="p-1 hover:bg-red-900/30 rounded text-red-500/70 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
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
                  </div>
                ))}
              </div>

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
          {expandedSections.lease && (
            <div className="px-4 pb-4">
              <div className="grid grid-cols-3 gap-3">
                <EditableField
                  label="Tenant"
                  value={leaseEdits.tenant}
                  onChange={(v) => handleLeaseChange('tenant', v)}
                  placeholder="e.g., CoreWeave"
                />
                <EditableField
                  label="Structure"
                  value={leaseEdits.leaseStructure}
                  onChange={(v) => handleLeaseChange('leaseStructure', v)}
                  type="select"
                  options={[
                    { value: 'NNN', label: 'NNN (Triple Net)' },
                    { value: 'MODIFIED_GROSS', label: 'Modified Gross' },
                    { value: 'GROSS', label: 'Gross' },
                  ]}
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
          )}
        </div>

        {/* Valuation Inputs Section */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection('valInputs')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-2">
              {expandedSections.valInputs ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
              <Settings className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-200">Valuation Inputs</span>
            </div>
          </button>
          {expandedSections.valInputs && (
            <div className="px-4 pb-4">
              <div className="grid grid-cols-3 gap-3">
                <EditableField
                  label="Cap Rate"
                  value={valInputEdits.capRate}
                  onChange={(v) => handleValInputChange('capRate', v)}
                  type="number"
                  step="0.25"
                  suffix="%"
                />
                <EditableField
                  label="Exit Cap Rate"
                  value={valInputEdits.exitCapRate}
                  onChange={(v) => handleValInputChange('exitCapRate', v)}
                  type="number"
                  step="0.25"
                  suffix="%"
                />
                <EditableField
                  label="Terminal Growth"
                  value={valInputEdits.terminalGrowthRate}
                  onChange={(v) => handleValInputChange('terminalGrowthRate', v)}
                  type="number"
                  step="0.1"
                  suffix="%"
                />
              </div>
            </div>
          )}
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
              {/* Fidoodle Factor - first and green */}
              <div className="mb-3 pb-3 border-b border-gray-700">
                <SliderRow
                  label="Fidoodle Factor"
                  autoValue={1.0}
                  currentValue={factorOverrides.fidoodleFactor ?? 1.0}
                  onChange={(v) => handleFactorChange('fidoodleFactor', v)}
                  min={0.5}
                  max={2.0}
                  step={0.01}
                  format={formatMultiplier}
                  description="manual override"
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
                label="Energization"
                autoValue={factorDetails.energization?.auto ?? 1.0}
                currentValue={factorOverrides.energization ?? 1.0}
                onChange={(v) => handleFactorChange('energization', v)}
                min={0.8}
                max={1.1}
                step={0.01}
                format={formatMultiplier}
              />
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
                    placeholder={`Max: ${data?.capacityAllocation?.unallocatedMw || data?.building?.itMw || 0}`}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                  />
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

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Tenant</label>
                <input
                  type="text"
                  value={newUsePeriod.tenant || ''}
                  onChange={(e) => setNewUsePeriod({ ...newUsePeriod, tenant: e.target.value })}
                  placeholder="e.g., CoreWeave, Microsoft"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                />
              </div>

              {splitType === 'transition' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Start Date</label>
                    <input
                      type="date"
                      value={newUsePeriod.startDate || ''}
                      onChange={(e) => setNewUsePeriod({ ...newUsePeriod, startDate: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">End Date (optional)</label>
                    <input
                      type="date"
                      value={newUsePeriod.endDate || ''}
                      onChange={(e) => setNewUsePeriod({ ...newUsePeriod, endDate: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                    />
                  </div>
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
                    isCurrent: splitType === 'split',
                    isSplit: splitType === 'split',
                    useType: newUsePeriod.useType || 'HPC_AI_HOSTING',
                    tenant: newUsePeriod.tenant || null,
                    mwAllocation: newUsePeriod.mwAllocation ? parseFloat(newUsePeriod.mwAllocation) : null,
                    leaseValueM: newUsePeriod.leaseValueM ? parseFloat(newUsePeriod.leaseValueM) : null,
                    leaseYears: newUsePeriod.leaseYears ? parseFloat(newUsePeriod.leaseYears) : null,
                    noiPct: newUsePeriod.noiPct ? parseFloat(newUsePeriod.noiPct) / 100 : null,
                  };
                  if (splitType === 'transition') {
                    payload.startDate = newUsePeriod.startDate ? new Date(newUsePeriod.startDate) : null;
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
