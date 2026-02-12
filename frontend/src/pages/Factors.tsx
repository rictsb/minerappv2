import { useState, useRef, useEffect, useMemo } from 'react';
import { Save, Loader2, RotateCcw, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  return apiUrl;
}

interface FactorConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  defaultValue: number;
}

// ==========================================
// FACTOR CONFIGURATIONS
// ==========================================

const FACTOR_CONFIGS: Record<string, FactorConfig[]> = {
  market: [
    { key: 'btcPrice', label: 'BTC Price', min: 10000, max: 250000, step: 1000, format: (v) => `$${v.toLocaleString()}`, defaultValue: 97000 },
    { key: 'ethPrice', label: 'ETH Price', min: 500, max: 10000, step: 50, format: (v) => `$${v.toLocaleString()}`, defaultValue: 2500 },
  ],
  hpc: [
    { key: 'hpcCapRate', label: 'Cap Rate', min: 0.04, max: 0.15, step: 0.0025, format: (v) => `${(v * 100).toFixed(2)}%`, defaultValue: 0.075 },
    { key: 'hpcExitCapRate', label: 'Exit Cap Rate', min: 0.04, max: 0.15, step: 0.0025, format: (v) => `${(v * 100).toFixed(2)}%`, defaultValue: 0.08 },
    { key: 'terminalGrowthRate', label: 'Terminal Growth', min: 0, max: 0.05, step: 0.0025, format: (v) => `${(v * 100).toFixed(2)}%`, defaultValue: 0.025 },
    { key: 'discountRate', label: 'Discount Rate', min: 0.05, max: 0.20, step: 0.005, format: (v) => `${(v * 100).toFixed(1)}%`, defaultValue: 0.10 },
    { key: 'leaseRenewalProbability', label: 'Renewal Probability', min: 0, max: 1, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%`, defaultValue: 0.85 },
    { key: 'mwValueHpcUncontracted', label: 'Pipeline HPC ($/MW)', min: 1, max: 30, step: 0.5, format: (v) => `$${v}M/MW`, defaultValue: 8 },
  ],
  mining: [
    { key: 'ebitdaMultiple', label: 'EBITDA Multiple', min: 2, max: 15, step: 0.5, format: (v) => `${v}x`, defaultValue: 6 },
    { key: 'dailyRevPerEh', label: 'Daily Rev per EH', min: 10000, max: 100000, step: 1000, format: (v) => `$${v.toLocaleString()}`, defaultValue: 29400 },
    { key: 'poolFeePct', label: 'Pool Fee %', min: 0, max: 0.05, step: 0.005, format: (v) => `${(v * 100).toFixed(1)}%`, defaultValue: 0.02 },
    { key: 'mwValueBtcMining', label: 'BTC Mining ($/MW)', min: 0.1, max: 2, step: 0.05, format: (v) => `$${v.toFixed(2)}M/MW`, defaultValue: 0.3 },
  ],
  phases: [
    { key: 'probOperational', label: 'Operational', min: 0, max: 1, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%`, defaultValue: 1.0 },
    { key: 'probConstruction', label: 'Construction', min: 0, max: 1, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%`, defaultValue: 0.9 },
    { key: 'probDevelopment', label: 'Development', min: 0, max: 1, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%`, defaultValue: 0.7 },
    { key: 'probExclusivity', label: 'Exclusivity', min: 0, max: 1, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%`, defaultValue: 0.5 },
    { key: 'probDiligence', label: 'Diligence', min: 0, max: 1, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%`, defaultValue: 0.3 },
  ],
  datacenterTier: [
    { key: 'tierIvMult', label: 'Tier IV', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 1.15 },
    { key: 'tierIiiMult', label: 'Tier III', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 1.00 },
    { key: 'tierIiMult', label: 'Tier II', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.90 },
    { key: 'tierIMult', label: 'Tier I', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.80 },
  ],
  ownership: [
    { key: 'ownedMult', label: 'Fully Owned', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 1.00 },
    { key: 'longtermLeaseMult', label: 'Long-term Lease', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.95 },
    { key: 'shorttermLeaseMult', label: 'Short-term Lease', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.85 },
  ],
  leaseStructure: [
    { key: 'nnnMult', label: 'NNN Lease', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 1.00 },
    { key: 'modifiedGrossMult', label: 'Modified Gross', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.95 },
    { key: 'grossMult', label: 'Gross Lease', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.90 },
  ],
  energization: [
    { key: 'energizationDecayRate', label: 'Annual Decay Rate', min: 0.05, max: 0.30, step: 0.01, format: (v) => `${(v * 100).toFixed(0)}%`, defaultValue: 0.15 },
    { key: 'energizationBaseYear', label: 'Base Year (1.0x)', min: 2024, max: 2030, step: 1, format: (v) => `${v}`, defaultValue: 2025 },
  ],
  powerAuthority: [
    { key: 'paErcot', label: 'ERCOT (Texas)', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 1.05 },
    { key: 'paPjm', label: 'PJM', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 1.00 },
    { key: 'paMiso', label: 'MISO', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.95 },
    { key: 'paNyiso', label: 'NYISO', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.95 },
    { key: 'paCaiso', label: 'CAISO', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.90 },
    { key: 'paCanada', label: 'Canada', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.95 },
    { key: 'paNorway', label: 'Norway', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.90 },
    { key: 'paUae', label: 'UAE', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.85 },
    { key: 'paBhutan', label: 'Bhutan', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.70 },
    { key: 'paParaguay', label: 'Paraguay', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.70 },
    { key: 'paEthiopia', label: 'Ethiopia', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.60 },
    { key: 'paOther', label: 'Other', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.80 },
  ],
  tenantCredit: [
    { key: 'tcGoogle', label: 'Google', min: -3, max: 5, step: 0.25, format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, defaultValue: -1.00 },
    { key: 'tcMicrosoft', label: 'Microsoft', min: -3, max: 5, step: 0.25, format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, defaultValue: -1.00 },
    { key: 'tcAmazon', label: 'Amazon/AWS', min: -3, max: 5, step: 0.25, format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, defaultValue: -1.00 },
    { key: 'tcMeta', label: 'Meta', min: -3, max: 5, step: 0.25, format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, defaultValue: -0.75 },
    { key: 'tcOracle', label: 'Oracle', min: -3, max: 5, step: 0.25, format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, defaultValue: -0.50 },
    { key: 'tcCoreweave', label: 'CoreWeave', min: -3, max: 5, step: 0.25, format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, defaultValue: 0.00 },
    { key: 'tcAnthropic', label: 'Anthropic', min: -3, max: 5, step: 0.25, format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, defaultValue: 0.00 },
    { key: 'tcOpenai', label: 'OpenAI', min: -3, max: 5, step: 0.25, format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, defaultValue: 0.00 },
    { key: 'tcXai', label: 'xAI', min: -3, max: 5, step: 0.25, format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, defaultValue: 0.25 },
    { key: 'tcOther', label: 'Other', min: -3, max: 5, step: 0.25, format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, defaultValue: 1.00 },
    { key: 'tcSelf', label: 'Self (No Tenant)', min: -3, max: 5, step: 0.25, format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`, defaultValue: 3.00 },
  ],
  siteSize: [
    { key: 'sizeGte500', label: '≥500 MW', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 1.10 },
    { key: 'size250to499', label: '250-499 MW', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 1.00 },
    { key: 'size100to249', label: '100-249 MW', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.95 },
    { key: 'sizeLt100', label: '<100 MW', min: 0.5, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.85 },
  ],
  sofr: [
    { key: 'sofrRate', label: 'SOFR Base Rate', min: 0, max: 10, step: 0.1, format: (v) => `${v.toFixed(1)}%`, defaultValue: 4.3 },
  ],
};

// Section metadata for collapsible panels
const SECTIONS = [
  { id: 'market', title: 'Market Prices', color: 'orange', configs: FACTOR_CONFIGS.market },
  { id: 'hpc', title: 'HPC/AI Valuation', color: 'purple', configs: FACTOR_CONFIGS.hpc },
  { id: 'mining', title: 'Mining Valuation', color: 'orange', configs: FACTOR_CONFIGS.mining },
  { id: 'phases', title: 'Phase Probabilities', color: 'blue', configs: FACTOR_CONFIGS.phases },
  { id: 'datacenterTier', title: 'Datacenter Tier', color: 'cyan', configs: FACTOR_CONFIGS.datacenterTier },
  { id: 'ownership', title: 'Site Ownership', color: 'green', configs: FACTOR_CONFIGS.ownership },
  { id: 'leaseStructure', title: 'Lease Structure', color: 'teal', configs: FACTOR_CONFIGS.leaseStructure },
  { id: 'energization', title: 'Energization Discount', color: 'yellow', configs: FACTOR_CONFIGS.energization, hasChart: true },
  { id: 'powerAuthority', title: 'Power Authority', color: 'red', configs: FACTOR_CONFIGS.powerAuthority },
  { id: 'sofr', title: 'Base Rate', color: 'emerald', configs: FACTOR_CONFIGS.sofr },
  { id: 'tenantCredit', title: 'Tenant Credit Spreads', color: 'indigo', configs: FACTOR_CONFIGS.tenantCredit },
  { id: 'siteSize', title: 'Site Size', color: 'amber', configs: FACTOR_CONFIGS.siteSize },
];

// Color mapping for section headers
const colorClasses: Record<string, string> = {
  orange: 'text-orange-400',
  purple: 'text-purple-400',
  blue: 'text-blue-400',
  cyan: 'text-cyan-400',
  green: 'text-green-400',
  teal: 'text-teal-400',
  yellow: 'text-yellow-400',
  red: 'text-red-400',
  indigo: 'text-indigo-400',
  amber: 'text-amber-400',
  emerald: 'text-emerald-400',
};

const dotColorClasses: Record<string, string> = {
  orange: 'bg-orange-400',
  purple: 'bg-purple-400',
  blue: 'bg-blue-400',
  cyan: 'bg-cyan-400',
  green: 'bg-green-400',
  teal: 'bg-teal-400',
  yellow: 'bg-yellow-400',
  red: 'bg-red-400',
  indigo: 'bg-indigo-400',
  amber: 'bg-amber-400',
  emerald: 'bg-emerald-400',
};

// Energization decay chart component
function EnergizationChart({ decayRate, baseYear }: { decayRate: number; baseYear: number }) {
  const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032];
  const multipliers = years.map((year) => Math.exp(-decayRate * (year - baseYear)));

  const maxMult = Math.max(...multipliers, 1.2);
  const chartHeight = 120;
  const chartWidth = 280;
  const padding = { top: 10, right: 10, bottom: 25, left: 35 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const points = years.map((year, i) => {
    const x = padding.left + (i / (years.length - 1)) * plotWidth;
    const y = padding.top + plotHeight - (multipliers[i] / maxMult) * plotHeight;
    return { x, y, year, mult: multipliers[i] };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="mt-3 bg-gray-900/50 rounded p-3">
      <svg width={chartWidth} height={chartHeight} className="w-full">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((v) => {
          const y = padding.top + plotHeight - (v / maxMult) * plotHeight;
          return (
            <g key={v}>
              <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#374151" strokeWidth="1" />
              <text x={padding.left - 5} y={y + 4} fill="#6b7280" fontSize="9" textAnchor="end">
                {v.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Base year marker */}
        {(() => {
          const baseIdx = years.indexOf(baseYear);
          if (baseIdx >= 0) {
            const x = padding.left + (baseIdx / (years.length - 1)) * plotWidth;
            return (
              <line x1={x} y1={padding.top} x2={x} y2={chartHeight - padding.bottom} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4,2" />
            );
          }
          return null;
        })()}

        {/* Decay curve */}
        <path d={pathD} fill="none" stroke="#f97316" strokeWidth="2" />

        {/* Data points */}
        {points.map((p) => (
          <circle key={p.year} cx={p.x} cy={p.y} r="4" fill={p.year === baseYear ? '#f59e0b' : '#f97316'} />
        ))}

        {/* Year labels */}
        {points.map((p, i) => (
          <text key={p.year} x={p.x} y={chartHeight - 5} fill="#9ca3af" fontSize="8" textAnchor="middle">
            {i % 2 === 0 ? p.year : ''}
          </text>
        ))}
      </svg>

      {/* Legend table */}
      <div className="mt-2 grid grid-cols-5 gap-1 text-xs">
        {points.slice(0, 5).map((p) => (
          <div key={p.year} className={`text-center ${p.year === baseYear ? 'text-yellow-400' : 'text-gray-400'}`}>
            <div className="font-medium">{p.year}</div>
            <div className="text-gray-500">{p.mult.toFixed(3)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Factors() {
  const queryClient = useQueryClient();
  const [factors, setFactors] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [fetchingPrices, setFetchingPrices] = useState(false);
  const saveTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Fetch live crypto prices from CoinGecko
  const fetchLivePrices = async () => {
    setFetchingPrices(true);
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd'
      );
      if (!res.ok) throw new Error('Failed to fetch prices');
      const data = await res.json();

      if (data.bitcoin?.usd) {
        handleFactorChange('btcPrice', Math.round(data.bitcoin.usd));
      }
      if (data.ethereum?.usd) {
        handleFactorChange('ethPrice', Math.round(data.ethereum.usd));
      }
    } catch (error) {
      console.error('Error fetching live prices:', error);
    } finally {
      setFetchingPrices(false);
    }
  };

  // Fetch current factors
  const { data: savedFactors, isLoading: loadingFactors } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/settings`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
  });

  // Initialize factors with saved values or defaults
  useEffect(() => {
    const initial: Record<string, number> = {};
    Object.values(FACTOR_CONFIGS).flat().forEach((config) => {
      initial[config.key] = savedFactors?.[config.key] ?? config.defaultValue;
    });
    setFactors(initial);
  }, [savedFactors]);

  // Mutation to save a factor
  const saveFactor = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: number }) => {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/api/v1/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
    },
  });

  // Handle slider change with debounced auto-save
  const handleFactorChange = (key: string, value: number) => {
    setFactors((prev) => ({ ...prev, [key]: value }));

    // Clear existing timeout for this key
    if (saveTimeoutRef.current[key]) {
      clearTimeout(saveTimeoutRef.current[key]);
    }

    // Debounce save by 500ms
    saveTimeoutRef.current[key] = setTimeout(() => {
      setSaving(key);
      saveFactor.mutate(
        { key, value },
        {
          onSettled: () => {
            setTimeout(() => setSaving(null), 500);
          },
        }
      );
    }, 500);
  };

  // Reset factor to default
  const resetToDefault = (key: string, defaultValue: number) => {
    handleFactorChange(key, defaultValue);
  };

  // Reset all to defaults
  const resetAllToDefaults = () => {
    Object.values(FACTOR_CONFIGS).flat().forEach((config) => {
      handleFactorChange(config.key, config.defaultValue);
    });
  };

  // Toggle section collapse
  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const renderSlider = (config: FactorConfig) => {
    const value = factors[config.key] ?? config.defaultValue;
    const isDefault = Math.abs(value - config.defaultValue) < 0.001;
    const isSaving = saving === config.key;

    return (
      <div key={config.key} className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm text-gray-300">{config.label}</label>
          <div className="flex items-center gap-2">
            {isSaving && <Save className="w-3 h-3 text-orange-500 animate-pulse" />}
            <span className="text-sm font-mono text-orange-400 min-w-[70px] text-right">{config.format(value)}</span>
            {!isDefault && (
              <button
                onClick={() => resetToDefault(config.key, config.defaultValue)}
                className="text-xs text-gray-500 hover:text-gray-300 p-1"
                title="Reset to default"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={value}
          onChange={(e) => handleFactorChange(config.key, parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-orange"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{config.format(config.min)}</span>
          <span className="text-gray-600">dflt: {config.format(config.defaultValue)}</span>
          <span>{config.format(config.max)}</span>
        </div>
      </div>
    );
  };

  // Count modified factors
  const modifiedCount = useMemo(() => {
    return Object.values(FACTOR_CONFIGS).flat().filter((config) => {
      const value = factors[config.key] ?? config.defaultValue;
      return Math.abs(value - config.defaultValue) >= 0.001;
    }).length;
  }, [factors]);

  // Calculate implied rate for tenant credit section
  const sofrRate = factors.sofrRate ?? 4.3;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-300">Valuation Factors</h1>
          {loadingFactors && <Loader2 className="w-5 h-5 animate-spin text-gray-500" />}
        </div>
        {modifiedCount > 0 && (
          <button
            onClick={resetAllToDefaults}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 rounded transition"
          >
            <RotateCcw className="w-4 h-4" />
            Reset All ({modifiedCount})
          </button>
        )}
      </div>

      <p className="text-sm text-gray-400 mb-4">
        Adjust these factors to modify valuation calculations. Changes auto-save and immediately update the dashboard.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {SECTIONS.map((section) => {
          const isCollapsed = collapsedSections[section.id];
          const sectionModifiedCount = section.configs.filter((config) => {
            const value = factors[config.key] ?? config.defaultValue;
            return Math.abs(value - config.defaultValue) >= 0.001;
          }).length;

          return (
            <div key={section.id} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-750 transition"
              >
                <h3 className={`text-sm font-semibold uppercase tracking-wider flex items-center gap-2 ${colorClasses[section.color]}`}>
                  <div className={`w-2 h-2 rounded-full ${dotColorClasses[section.color]}`} />
                  {section.title}
                  {sectionModifiedCount > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded">
                      {sectionModifiedCount}
                    </span>
                  )}
                </h3>
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {!isCollapsed && (
                <div className="px-4 pb-4">
                  {section.id === 'market' && (
                    <div className="flex justify-end mb-3">
                      <button
                        onClick={fetchLivePrices}
                        disabled={fetchingPrices}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs text-orange-400 hover:text-orange-300 border border-orange-500/50 hover:border-orange-400 rounded transition disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${fetchingPrices ? 'animate-spin' : ''}`} />
                        {fetchingPrices ? 'Fetching...' : 'Fetch Live'}
                      </button>
                    </div>
                  )}
                  {section.id === 'phases' && (
                    <p className="text-xs text-gray-500 mb-3">
                      Default probability weights by development phase. Override per-building in Projects.
                    </p>
                  )}
                  {section.id === 'tenantCredit' && (
                    <p className="text-xs text-gray-500 mb-3">
                      Credit spreads vs SOFR ({sofrRate.toFixed(1)}%). Negative = better credit.
                    </p>
                  )}
                  {section.id === 'energization' && (
                    <p className="text-xs text-gray-500 mb-3">
                      Discount for future energization: mult = e<sup>-rate×(year-base)</sup>
                    </p>
                  )}
                  {section.configs.map(renderSlider)}

                  {/* Energization decay chart */}
                  {section.id === 'energization' && (
                    <EnergizationChart
                      decayRate={factors.energizationDecayRate ?? 0.15}
                      baseYear={factors.energizationBaseYear ?? 2025}
                    />
                  )}

                  {/* Tenant credit implied rates table */}
                  {section.id === 'tenantCredit' && (
                    <div className="mt-3 bg-gray-900/50 rounded p-2">
                      <div className="text-xs text-gray-500 mb-2">Implied Rates (SOFR + Spread)</div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {FACTOR_CONFIGS.tenantCredit.slice(0, 6).map((config) => {
                          const spread = factors[config.key] ?? config.defaultValue;
                          const impliedRate = sofrRate + spread;
                          return (
                            <div key={config.key} className="flex justify-between text-gray-400">
                              <span>{config.label}</span>
                              <span className="font-mono text-emerald-400">{impliedRate.toFixed(2)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .slider-orange::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .slider-orange::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .slider-orange::-webkit-slider-runnable-track {
          background: linear-gradient(to right, #374151 0%, #374151 100%);
          border-radius: 4px;
        }
        .bg-gray-750 {
          background-color: rgba(55, 65, 81, 0.5);
        }
      `}</style>
    </div>
  );
}
