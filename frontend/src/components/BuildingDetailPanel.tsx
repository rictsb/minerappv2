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
} from 'lucide-react';

// Error Boundary to catch render errors
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
            {'\n\n'}
            {this.state.error?.stack}
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
}: SliderRowProps) {
  const isOverridden = Math.abs(currentValue - autoValue) > 0.0001;

  return (
    <div className="py-2 border-b border-gray-800 last:border-b-0">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-300">{label}</span>
          {description && (
            <span className="text-[10px] text-gray-500">({description})</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500 w-16 text-right">Auto: {format(autoValue)}</span>
          <span className={`font-mono w-16 text-right ${isOverridden ? 'text-orange-400 font-medium' : 'text-white'}`}>
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
          className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
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

// Safe number formatting helpers
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

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
};

function BuildingDetailPanelInner({ buildingId, onClose }: BuildingDetailPanelProps) {
  const queryClient = useQueryClient();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    lease: true,
    factors: true,
  });
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

  const updateFactorsMutation = useMutation({
    mutationFn: async (factors: Record<string, any>) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/buildings/${buildingId}/factors`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(factors),
      });
      if (!res.ok) throw new Error('Failed to update factors');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['building-valuation', buildingId] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
      setHasChanges(false);
    },
  });

  // Initialize factor overrides from data
  useEffect(() => {
    if (data) {
      const fd = data.factorDetails || {};
      const bld = data.building || {};

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

  const handleFactorChange = (key: string, value: number) => {
    setFactorOverrides((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const fd = data?.factorDetails || {};
    updateFactorsMutation.mutate({
      fidoodleFactor: factorOverrides.fidoodleFactor,
      probabilityOverride: factorOverrides.phaseProbability !== (fd.phaseProbability?.auto ?? 0.5) ? factorOverrides.phaseProbability : null,
      regulatoryRisk: factorOverrides.regulatoryRisk,
      sizeMultOverride: factorOverrides.sizeMultiplier !== (fd.sizeMultiplier?.auto ?? 1) ? factorOverrides.sizeMultiplier : null,
      powerAuthMultOverride: factorOverrides.powerAuthority !== (fd.powerAuthority?.auto ?? 1) ? factorOverrides.powerAuthority : null,
      ownershipMultOverride: factorOverrides.ownership !== (fd.ownership?.auto ?? 1) ? factorOverrides.ownership : null,
      tierMultOverride: factorOverrides.datacenterTier !== (fd.datacenterTier?.auto ?? 1) ? factorOverrides.datacenterTier : null,
    });
  };

  const handleResetAll = () => {
    if (data) {
      const fd = data.factorDetails || {};
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

  // Calculate live valuation based on current slider values
  const calculateLiveValuation = () => {
    if (!data) return { combinedFactor: 1, adjustedValue: 0, baseValue: 0, terminalValue: 0 };

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

    const baseValue = data.valuation?.results?.baseValueM ?? 0;
    const terminalValue = data.valuation?.results?.terminalValueM ?? 0;
    const grossValue = baseValue + terminalValue;
    const adjustedValue = grossValue * combinedFactor;

    return {
      combinedFactor: isFinite(combinedFactor) ? combinedFactor : 1,
      adjustedValue: isFinite(adjustedValue) ? adjustedValue : 0,
      baseValue,
      terminalValue,
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

  // Safely extract data with defaults
  const building = data.building || {};
  const site = data.site || {};
  const campus = data.campus || {};
  const leaseDetails = data.leaseDetails || {};
  const factorDetails = data.factorDetails || {};

  const liveValuation = calculateLiveValuation();

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-gray-900 border-l border-gray-700 shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header with Building Info */}
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
      <div className="flex-shrink-0 p-3 bg-gray-850 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-300">Valuation</span>
            <span className="text-xs text-gray-500">
              ({safeToFixed(liveValuation.combinedFactor, 3)}x factor)
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
            {leaseDetails.noiAnnualM && (
              <span className="text-sm text-green-400">{formatMoney(leaseDetails.noiAnnualM)}/yr NOI</span>
            )}
          </button>
          {expandedSections.lease && (
            <div className="px-4 pb-4">
              <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs">
                <div>
                  <div className="text-gray-500">Tenant</div>
                  <div className="text-white font-medium">{leaseDetails.tenant || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Structure</div>
                  <div className="text-white font-medium">{leaseDetails.leaseStructure || 'NNN'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Term</div>
                  <div className="text-white font-medium">{leaseDetails.leaseYears ? `${leaseDetails.leaseYears} yrs` : '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Lease Value</div>
                  <div className="text-white">{formatMoney(leaseDetails.leaseValueM)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Annual Rev</div>
                  <div className="text-white">{formatMoney(leaseDetails.annualRevM)}</div>
                </div>
                <div>
                  <div className="text-gray-500">NOI %</div>
                  <div className="text-white">{leaseDetails.noiPct ? formatPercent(leaseDetails.noiPct) : '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Annual NOI</div>
                  <div className="text-green-400 font-medium">{formatMoney(leaseDetails.noiAnnualM)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Start</div>
                  <div className="text-white">{formatDate(leaseDetails.leaseStart)}</div>
                </div>
                <div>
                  <div className="text-gray-500">End</div>
                  <div className="text-white">{formatDate(leaseDetails.leaseEnd)}</div>
                </div>
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
                description={`${Math.round(factorDetails.sizeMultiplier?.siteTotalMw ?? 0)} MW site`}
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
                description={factorDetails.leaseStructure?.structure || 'NNN'}
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
                description={factorDetails.tenantCredit?.tenant || 'no tenant'}
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
                description={factorDetails.energization?.date ? formatDate(factorDetails.energization.date) : 'no date'}
              />
              <div className="mt-3 pt-3 border-t border-gray-700">
                <SliderRow
                  label="Custom Adjustment"
                  autoValue={1.0}
                  currentValue={factorOverrides.fidoodleFactor ?? 1.0}
                  onChange={(v) => handleFactorChange('fidoodleFactor', v)}
                  min={0.5}
                  max={2.0}
                  step={0.01}
                  format={formatMultiplier}
                  description="manual override"
                />
              </div>
            </div>
          )}
        </div>

        {/* Valuation Methodology (collapsed by default, read-only) */}
        <div className="px-4 py-3">
          <div className="text-xs text-gray-500 mb-2">Valuation Methodology</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-gray-800 rounded px-2 py-1.5">
              <div className="text-gray-500">Cap Rate</div>
              <div className="text-white">{((data.valuation?.inputs?.capRate ?? 0.075) * 100).toFixed(2)}%</div>
            </div>
            <div className="bg-gray-800 rounded px-2 py-1.5">
              <div className="text-gray-500">Exit Cap</div>
              <div className="text-white">{((data.valuation?.inputs?.exitCapRate ?? 0.08) * 100).toFixed(2)}%</div>
            </div>
            <div className="bg-gray-800 rounded px-2 py-1.5">
              <div className="text-gray-500">Growth</div>
              <div className="text-white">{((data.valuation?.inputs?.terminalGrowthRate ?? 0.025) * 100).toFixed(1)}%</div>
            </div>
          </div>
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
            Reset All
          </button>
          <button
            onClick={handleSave}
            disabled={updateFactorsMutation.isPending}
            className="flex items-center gap-1 px-4 py-1.5 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 text-sm font-medium"
          >
            <Save className="h-4 w-4" />
            {updateFactorsMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}

// Wrapper component with error boundary
export default function BuildingDetailPanel({ buildingId, onClose }: BuildingDetailPanelProps) {
  return (
    <PanelErrorBoundary onClose={onClose}>
      <BuildingDetailPanelInner buildingId={buildingId} onClose={onClose} />
    </PanelErrorBoundary>
  );
}
