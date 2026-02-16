import { useState, useRef, useEffect, useMemo } from 'react';
import { Save, Loader2, RotateCcw, ChevronDown, ChevronRight, RefreshCw, Plus, Trash2 } from 'lucide-react';
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
    { key: 'sofrRate', label: 'SOFR Rate', min: 0, max: 10, step: 0.05, format: (v) => `${v.toFixed(2)}%`, defaultValue: 4.3 },
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
  powerAuthority: [
    { key: 'paErcot', label: 'ERCOT (Texas)', min: 0, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 1.05 },
    { key: 'paPjm', label: 'PJM', min: 0, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 1.00 },
    { key: 'paMiso', label: 'MISO', min: 0, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.95 },
    { key: 'paNyiso', label: 'NYISO', min: 0, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.95 },
    { key: 'paCaiso', label: 'CAISO', min: 0, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.90 },
    { key: 'paCanada', label: 'Canada', min: 0, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.95 },
    { key: 'paNorway', label: 'Norway', min: 0, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.90 },
    { key: 'paUae', label: 'UAE', min: 0, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.85 },
    { key: 'paBhutan', label: 'Bhutan', min: 0, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.70 },
    { key: 'paParaguay', label: 'Paraguay', min: 0, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.70 },
    { key: 'paEthiopia', label: 'Ethiopia', min: 0, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.60 },
    { key: 'paOther', label: 'Other', min: 0, max: 1.5, step: 0.05, format: (v) => `${v.toFixed(2)}x`, defaultValue: 0.80 },
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
  { id: 'powerAuthority', title: 'Power Authority', color: 'red', configs: FACTOR_CONFIGS.powerAuthority },
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

export default function Factors() {
  const queryClient = useQueryClient();
  const [factors, setFactors] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [fetchingPrices, setFetchingPrices] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const saveTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Fetch live crypto prices from CoinGecko and SOFR from NY Fed
  const fetchLivePrices = async () => {
    setFetchingPrices(true);
    try {
      // Fetch crypto prices
      const cryptoRes = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd'
      );
      if (cryptoRes.ok) {
        const data = await cryptoRes.json();
        if (data.bitcoin?.usd) {
          handleFactorChange('btcPrice', Math.round(data.bitcoin.usd));
        }
        if (data.ethereum?.usd) {
          handleFactorChange('ethPrice', Math.round(data.ethereum.usd));
        }
      }

      // Fetch SOFR rate from NY Fed
      try {
        const sofrRes = await fetch(
          'https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json'
        );
        if (sofrRes.ok) {
          const sofrData = await sofrRes.json();
          const rate = sofrData.refRates?.[0]?.percentRate;
          if (rate) {
            handleFactorChange('sofrRate', Math.round(rate * 100) / 100);
          }
        }
      } catch (sofrError) {
        console.error('Error fetching SOFR rate:', sofrError);
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
      const saved = savedFactors?.[config.key];
      initial[config.key] = saved != null ? Number(saved) : config.defaultValue;
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

  // Add a new custom tenant
  const addTenant = async () => {
    const name = newTenantName.trim();
    if (!name) return;
    const key = `tc${name.replace(/[^a-zA-Z0-9]/g, '')}`;
    // Save to settings with default spread of 0
    const apiUrl = getApiUrl();
    await fetch(`${apiUrl}/api/v1/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: 0 }),
    });
    // Add to local FACTOR_CONFIGS so it renders immediately
    FACTOR_CONFIGS.tenantCredit.push({
      key, label: name, min: -3, max: 5, step: 0.25,
      format: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
      defaultValue: 0,
    });
    setFactors(prev => ({ ...prev, [key]: 0 }));
    setNewTenantName('');
    setShowAddTenant(false);
    queryClient.invalidateQueries({ queryKey: ['tenants'] });
    queryClient.invalidateQueries({ queryKey: ['valuation'] });
  };

  // Remove a tenant (custom ones only)
  const removeTenant = async (key: string) => {
    const apiUrl = getApiUrl();
    await fetch(`${apiUrl}/api/v1/settings/${key}`, { method: 'DELETE' });
    // Remove from FACTOR_CONFIGS
    const idx = FACTOR_CONFIGS.tenantCredit.findIndex(c => c.key === key);
    if (idx >= 0) FACTOR_CONFIGS.tenantCredit.splice(idx, 1);
    setFactors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    queryClient.invalidateQueries({ queryKey: ['tenants'] });
    queryClient.invalidateQueries({ queryKey: ['valuation'] });
  };

  // Default tenant keys that can't be removed
  const defaultTenantKeys = new Set([
    'tcGoogle', 'tcMicrosoft', 'tcAmazon', 'tcMeta', 'tcOracle',
    'tcCoreweave', 'tcAnthropic', 'tcOpenai', 'tcXai', 'tcOther', 'tcSelf',
  ]);

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
                  {section.id === 'tenantCredit' ? (
                    <>
                      {section.configs.map((config) => (
                        <div key={config.key} className="relative group">
                          {renderSlider(config)}
                          {!defaultTenantKeys.has(config.key) && (
                            <button
                              onClick={() => removeTenant(config.key)}
                              className="absolute top-2 right-0 p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                              title="Remove tenant"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      {showAddTenant ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="text"
                            value={newTenantName}
                            onChange={(e) => setNewTenantName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addTenant()}
                            placeholder="Tenant name"
                            className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                            autoFocus
                          />
                          <button onClick={addTenant} className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500">Add</button>
                          <button onClick={() => { setShowAddTenant(false); setNewTenantName(''); }} className="px-2 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddTenant(true)}
                          className="flex items-center gap-1 mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition"
                        >
                          <Plus className="w-3 h-3" /> Add Tenant
                        </button>
                      )}
                    </>
                  ) : (
                    section.configs.map(renderSlider)
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
