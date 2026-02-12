import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Building2,
  MapPin,
  DollarSign,
  TrendingUp,
  Percent,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
  Info,
} from 'lucide-react';

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

interface FactorRowProps {
  label: string;
  autoValue: number;
  overrideValue: number | null;
  finalValue: number;
  suffix?: string;
  description?: string;
  onOverrideChange?: (value: number | null) => void;
  editable?: boolean;
  min?: number;
  max?: number;
  step?: number;
  asPercent?: boolean;
}

function FactorRow({
  label,
  autoValue,
  overrideValue,
  finalValue,
  suffix = 'x',
  description,
  onOverrideChange,
  editable = true,
  min = 0,
  max = 2,
  step = 0.01,
  asPercent = false,
}: FactorRowProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const displayValue = (v: number) => {
    if (asPercent) return `${(v * 100).toFixed(1)}%`;
    return `${v.toFixed(3)}${suffix}`;
  };

  const handleSave = () => {
    if (inputValue === '' || inputValue === 'auto') {
      onOverrideChange?.(null);
    } else {
      const val = asPercent ? parseFloat(inputValue) / 100 : parseFloat(inputValue);
      if (!isNaN(val)) {
        onOverrideChange?.(val);
      }
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-700/30 rounded group">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">{label}</span>
        {description && (
          <div className="relative">
            <Info className="h-3 w-3 text-gray-600 cursor-help" />
            <div className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-800 text-xs text-gray-300 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-gray-700">
              {description}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-16 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs text-right text-white"
              autoFocus
              min={asPercent ? min * 100 : min}
              max={asPercent ? max * 100 : max}
              step={asPercent ? step * 100 : step}
            />
            <button onClick={handleSave} className="p-0.5 text-green-400 hover:text-green-300">
              <Save className="h-3 w-3" />
            </button>
            <button onClick={() => setEditing(false)} className="p-0.5 text-gray-400 hover:text-gray-300">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <>
            <span className="text-xs text-gray-500">
              auto: {displayValue(autoValue)}
            </span>
            {overrideValue !== null && (
              <span className="text-xs text-orange-400">
                → {displayValue(overrideValue)}
              </span>
            )}
            <span className={`text-xs font-medium ${overrideValue !== null ? 'text-orange-400' : 'text-white'}`}>
              = {displayValue(finalValue)}
            </span>
            {editable && (
              <button
                onClick={() => {
                  setInputValue(asPercent ? (finalValue * 100).toFixed(1) : finalValue.toFixed(3));
                  setEditing(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-500 hover:text-gray-300"
                title="Override"
              >
                <Percent className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function BuildingDetailPanel({ buildingId, onClose }: BuildingDetailPanelProps) {
  const queryClient = useQueryClient();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    lease: true,
    factors: true,
    valuation: true,
  });
  const [factorOverrides, setFactorOverrides] = useState<Record<string, any>>({});
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

  useEffect(() => {
    if (data) {
      const fd = data.factorDetails || {};
      const gf = data.globalFactors || {};
      const val = data.valuation || { inputs: {} };
      const bld = data.building || {};

      setFactorOverrides({
        fidoodleFactor: bld.fidoodleFactor ?? 1.0,
        probabilityOverride: fd.phaseProbability?.override ?? null,
        regulatoryRisk: fd.regulatoryRisk?.value ?? 1.0,
        sizeMultOverride: fd.sizeMultiplier?.override ?? null,
        powerAuthMultOverride: fd.powerAuthority?.override ?? null,
        ownershipMultOverride: fd.ownership?.override ?? null,
        tierMultOverride: fd.datacenterTier?.override ?? null,
        capRateOverride: (val.inputs?.capRate && val.inputs.capRate !== gf.hpcCapRate) ? val.inputs.capRate : null,
        exitCapRateOverride: (val.inputs?.exitCapRate && val.inputs.exitCapRate !== gf.hpcExitCapRate) ? val.inputs.exitCapRate : null,
        terminalGrowthOverride: (val.inputs?.terminalGrowthRate && val.inputs.terminalGrowthRate !== gf.terminalGrowthRate) ? val.inputs.terminalGrowthRate : null,
      });
    }
  }, [data]);

  const handleFactorChange = (key: string, value: number | null) => {
    setFactorOverrides((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateFactorsMutation.mutate(factorOverrides);
  };

  const handleReset = () => {
    if (data) {
      setFactorOverrides({
        fidoodleFactor: 1.0,
        probabilityOverride: null,
        regulatoryRisk: 1.0,
        sizeMultOverride: null,
        powerAuthMultOverride: null,
        ownershipMultOverride: null,
        tierMultOverride: null,
        capRateOverride: null,
        exitCapRateOverride: null,
        terminalGrowthOverride: null,
      });
      setHasChanges(true);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const formatMoney = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-y-0 right-0 w-[500px] bg-gray-900 border-l border-gray-700 shadow-2xl flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-y-0 right-0 w-[500px] bg-gray-900 border-l border-gray-700 shadow-2xl z-50 p-4">
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
  const remainingLeaseYears = data.remainingLeaseYears ?? 0;
  const combinedFactor = data.combinedFactor ?? 1;

  // Safe factor details with defaults
  const factorDetails = data.factorDetails || {};

  // Safe valuation with defaults
  const valuation = data.valuation || {
    inputs: { capRate: 0.075, exitCapRate: 0.08, terminalGrowthRate: 0.025 },
    calculation: {},
    results: { baseValueM: 0, terminalValueM: 0, grossValueM: 0, adjustedValueM: 0 },
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-gray-900 border-l border-gray-700 shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-orange-500" />
              {building.name || 'Building'}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
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

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="bg-gray-700/50 rounded px-2 py-1.5">
            <div className="text-xs text-gray-500">Gross MW</div>
            <div className="text-sm font-medium text-white">{building.grossMw || '-'}</div>
          </div>
          <div className="bg-gray-700/50 rounded px-2 py-1.5">
            <div className="text-xs text-gray-500">Phase</div>
            <div className="text-sm font-medium text-white">{building.developmentPhase || '-'}</div>
          </div>
          <div className="bg-gray-700/50 rounded px-2 py-1.5">
            <div className="text-xs text-gray-500">Grid</div>
            <div className="text-sm font-medium text-white">{building.grid || '-'}</div>
          </div>
          <div className="bg-gray-700/50 rounded px-2 py-1.5">
            <div className="text-xs text-gray-500">Site Total</div>
            <div className="text-sm font-medium text-white">{Math.round(site.totalMw || 0)} MW</div>
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
            <div className="px-4 pb-4 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500">Tenant</div>
                  <div className="text-sm text-white">{leaseDetails.tenant || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Structure</div>
                  <div className="text-sm text-white">{leaseDetails.leaseStructure}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Lease Value</div>
                  <div className="text-sm text-white">{formatMoney(leaseDetails.leaseValueM)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Lease Term</div>
                  <div className="text-sm text-white">{leaseDetails.leaseYears ? `${leaseDetails.leaseYears} yrs` : '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Annual Revenue</div>
                  <div className="text-sm text-white">{formatMoney(leaseDetails.annualRevM)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">NOI %</div>
                  <div className="text-sm text-white">{leaseDetails.noiPct ? `${(leaseDetails.noiPct * 100).toFixed(1)}%` : '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Annual NOI</div>
                  <div className="text-sm text-green-400 font-medium">{formatMoney(leaseDetails.noiAnnualM)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Remaining Term</div>
                  <div className="text-sm text-white">{remainingLeaseYears ? `${remainingLeaseYears.toFixed(1)} yrs` : '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Lease Start</div>
                  <div className="text-sm text-white">{formatDate(leaseDetails.leaseStart)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Lease End</div>
                  <div className="text-sm text-white">{formatDate(leaseDetails.leaseEnd)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Factors Section */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection('factors')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-2">
              {expandedSections.factors ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
              <Percent className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-200">Adjustment Factors</span>
            </div>
            <span className="text-sm text-blue-400">{combinedFactor.toFixed(4)}x combined</span>
          </button>
          {expandedSections.factors && (
            <div className="px-2 pb-3">
              <FactorRow
                label="Phase Probability"
                autoValue={factorDetails.phaseProbability?.auto ?? 0.5}
                overrideValue={factorOverrides.probabilityOverride}
                finalValue={factorOverrides.probabilityOverride ?? factorDetails.phaseProbability?.auto ?? 0.5}
                description={`Based on ${factorDetails.phase || 'unknown'} phase`}
                onOverrideChange={(v) => handleFactorChange('probabilityOverride', v)}
                asPercent
              />
              <FactorRow
                label="Regulatory Risk"
                autoValue={1.0}
                overrideValue={factorOverrides.regulatoryRisk !== 1.0 ? factorOverrides.regulatoryRisk : null}
                finalValue={factorOverrides.regulatoryRisk ?? 1.0}
                description="1.0 = no risk, 0.0 = blocked"
                onOverrideChange={(v) => handleFactorChange('regulatoryRisk', v ?? 1.0)}
                asPercent
              />
              <FactorRow
                label="Size Multiplier"
                autoValue={factorDetails.sizeMultiplier?.auto ?? 1.0}
                overrideValue={factorOverrides.sizeMultOverride}
                finalValue={factorOverrides.sizeMultOverride ?? factorDetails.sizeMultiplier?.auto ?? 1.0}
                description={`Site total: ${Math.round(factorDetails.sizeMultiplier?.siteTotalMw ?? 0)} MW`}
                onOverrideChange={(v) => handleFactorChange('sizeMultOverride', v)}
              />
              <FactorRow
                label="Power Authority"
                autoValue={factorDetails.powerAuthority?.auto ?? 1.0}
                overrideValue={factorOverrides.powerAuthMultOverride}
                finalValue={factorOverrides.powerAuthMultOverride ?? factorDetails.powerAuthority?.auto ?? 1.0}
                description={factorDetails.powerAuthority?.grid || 'Unknown grid'}
                onOverrideChange={(v) => handleFactorChange('powerAuthMultOverride', v)}
              />
              <FactorRow
                label="Ownership"
                autoValue={factorDetails.ownership?.auto ?? 1.0}
                overrideValue={factorOverrides.ownershipMultOverride}
                finalValue={factorOverrides.ownershipMultOverride ?? factorDetails.ownership?.auto ?? 1.0}
                description={factorDetails.ownership?.status || 'Unknown'}
                onOverrideChange={(v) => handleFactorChange('ownershipMultOverride', v)}
              />
              <FactorRow
                label="Datacenter Tier"
                autoValue={factorDetails.datacenterTier?.auto ?? 1.0}
                overrideValue={factorOverrides.tierMultOverride}
                finalValue={factorOverrides.tierMultOverride ?? factorDetails.datacenterTier?.auto ?? 1.0}
                description={factorDetails.datacenterTier?.tier || 'TIER_III'}
                onOverrideChange={(v) => handleFactorChange('tierMultOverride', v)}
              />
              <FactorRow
                label="Lease Structure"
                autoValue={factorDetails.leaseStructure?.auto ?? 1.0}
                overrideValue={null}
                finalValue={factorDetails.leaseStructure?.final ?? 1.0}
                description={factorDetails.leaseStructure?.structure || 'NNN'}
                editable={false}
              />
              <FactorRow
                label="Tenant Credit"
                autoValue={factorDetails.tenantCredit?.auto ?? 1.0}
                overrideValue={null}
                finalValue={factorDetails.tenantCredit?.final ?? 1.0}
                description={factorDetails.tenantCredit?.tenant || 'No tenant'}
                editable={false}
              />
              <FactorRow
                label="Energization"
                autoValue={factorDetails.energization?.auto ?? 1.0}
                overrideValue={null}
                finalValue={factorDetails.energization?.final ?? 1.0}
                description={factorDetails.energization?.date ? formatDate(factorDetails.energization.date) : 'No date'}
                editable={false}
              />
              <div className="border-t border-gray-700 mt-2 pt-2">
                <FactorRow
                  label="Fidoodle Factor"
                  autoValue={1.0}
                  overrideValue={factorOverrides.fidoodleFactor !== 1.0 ? factorOverrides.fidoodleFactor : null}
                  finalValue={factorOverrides.fidoodleFactor ?? 1.0}
                  description="Custom site-specific adjustment"
                  onOverrideChange={(v) => handleFactorChange('fidoodleFactor', v ?? 1.0)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Valuation Section */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection('valuation')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-2">
              {expandedSections.valuation ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-gray-200">Valuation</span>
            </div>
            <span className="text-lg font-bold text-orange-400">{formatMoney(valuation.results?.adjustedValueM ?? 0)}</span>
          </button>
          {expandedSections.valuation && (
            <div className="px-4 pb-4">
              {/* Inputs */}
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-2">Valuation Inputs</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-gray-800 rounded px-2 py-1.5">
                    <div className="text-gray-500">Cap Rate</div>
                    <div className="text-white">{((valuation.inputs?.capRate ?? 0.075) * 100).toFixed(2)}%</div>
                  </div>
                  <div className="bg-gray-800 rounded px-2 py-1.5">
                    <div className="text-gray-500">Exit Cap</div>
                    <div className="text-white">{((valuation.inputs?.exitCapRate ?? 0.08) * 100).toFixed(2)}%</div>
                  </div>
                  <div className="bg-gray-800 rounded px-2 py-1.5">
                    <div className="text-gray-500">Growth</div>
                    <div className="text-white">{((valuation.inputs?.terminalGrowthRate ?? 0.025) * 100).toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              {/* Calculation Steps */}
              <div className="space-y-2 text-xs">
                {Object.entries(valuation.calculation || {}).map(([key, step]: [string, any]) => (
                  <div key={key} className="flex justify-between items-center py-1 border-b border-gray-800">
                    <div>
                      <div className="text-gray-300">{step?.description || key}</div>
                      {step?.formula && <div className="text-gray-500 text-[10px]">{step.formula}</div>}
                    </div>
                    <div className="text-right font-mono text-gray-200">
                      {formatMoney(step?.value ?? 0)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Results Summary */}
              <div className="mt-4 bg-gray-800 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">Base Value</div>
                    <div className="text-lg font-medium text-white">{formatMoney(valuation.results?.baseValueM ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Terminal Value</div>
                    <div className="text-lg font-medium text-white">{formatMoney(valuation.results?.terminalValueM ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Gross Value</div>
                    <div className="text-lg font-medium text-white">{formatMoney(valuation.results?.grossValueM ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Adjusted Value</div>
                    <div className="text-xl font-bold text-orange-400">{formatMoney(valuation.results?.adjustedValueM ?? 0)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer with Save/Reset */}
      {hasChanges && (
        <div className="flex-shrink-0 p-3 border-t border-gray-700 bg-gray-800 flex justify-between items-center">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
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
