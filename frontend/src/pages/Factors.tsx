import { useState, useRef, useEffect } from 'react';
import { Save, Loader2, RotateCcw } from 'lucide-react';
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

const FACTOR_CONFIGS: Record<string, FactorConfig[]> = {
  market: [
    { key: 'btcPrice', label: 'BTC Price', min: 10000, max: 250000, step: 1000, format: (v) => `$${v.toLocaleString()}`, defaultValue: 97000 },
    { key: 'ethPrice', label: 'ETH Price', min: 500, max: 10000, step: 50, format: (v) => `$${v.toLocaleString()}`, defaultValue: 2500 },
  ],
  hpc: [
    { key: 'mwValueHpcContracted', label: 'Contracted HPC ($/MW)', min: 5, max: 50, step: 1, format: (v) => `$${v}M/MW`, defaultValue: 25 },
    { key: 'mwValueHpcUncontracted', label: 'Pipeline HPC ($/MW)', min: 1, max: 30, step: 0.5, format: (v) => `$${v}M/MW`, defaultValue: 8 },
    { key: 'noiMultiple', label: 'NOI Multiple', min: 5, max: 20, step: 0.5, format: (v) => `${v}x`, defaultValue: 10 },
  ],
  mining: [
    { key: 'ebitdaMultiple', label: 'EBITDA Multiple', min: 2, max: 15, step: 0.5, format: (v) => `${v}x`, defaultValue: 6 },
    { key: 'dailyRevPerEh', label: 'Daily Rev per EH', min: 10000, max: 100000, step: 1000, format: (v) => `$${v.toLocaleString()}`, defaultValue: 29400 },
    { key: 'poolFeePct', label: 'Pool Fee %', min: 0, max: 0.05, step: 0.005, format: (v) => `${(v * 100).toFixed(1)}%`, defaultValue: 0.02 },
  ],
  phases: [
    { key: 'probOperational', label: 'Operational', min: 0, max: 1, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%`, defaultValue: 1.0 },
    { key: 'probConstruction', label: 'Construction', min: 0, max: 1, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%`, defaultValue: 0.9 },
    { key: 'probDevelopment', label: 'Development', min: 0, max: 1, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%`, defaultValue: 0.7 },
    { key: 'probExclusivity', label: 'Exclusivity', min: 0, max: 1, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%`, defaultValue: 0.5 },
    { key: 'probDiligence', label: 'Diligence', min: 0, max: 1, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%`, defaultValue: 0.3 },
  ],
};

export default function Factors() {
  const queryClient = useQueryClient();
  const [factors, setFactors] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const saveTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  const renderSlider = (config: FactorConfig) => {
    const value = factors[config.key] ?? config.defaultValue;
    const isDefault = Math.abs(value - config.defaultValue) < 0.001;
    const isSaving = saving === config.key;

    return (
      <div key={config.key} className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-gray-300">{config.label}</label>
          <div className="flex items-center gap-2">
            {isSaving && <Save className="w-3 h-3 text-orange-500 animate-pulse" />}
            <span className="text-sm font-mono text-orange-400 min-w-[80px] text-right">{config.format(value)}</span>
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
          <span className="text-gray-600">default: {config.format(config.defaultValue)}</span>
          <span>{config.format(config.max)}</span>
        </div>
      </div>
    );
  };

  // Count modified factors
  const modifiedCount = Object.values(FACTOR_CONFIGS).flat().filter((config) => {
    const value = factors[config.key] ?? config.defaultValue;
    return Math.abs(value - config.defaultValue) >= 0.001;
  }).length;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="flex items-center justify-between mb-6">
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
            Reset All ({modifiedCount} modified)
          </button>
        )}
      </div>

      <p className="text-sm text-gray-400 mb-6">
        Adjust these factors to modify valuation calculations. Changes auto-save and immediately update the dashboard.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Market Factors */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            Market Prices
          </h3>
          {FACTOR_CONFIGS.market.map(renderSlider)}
        </div>

        {/* HPC/AI Factors */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            HPC/AI Valuation
          </h3>
          {FACTOR_CONFIGS.hpc.map(renderSlider)}
        </div>

        {/* Mining Factors */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            Mining Valuation
          </h3>
          {FACTOR_CONFIGS.mining.map(renderSlider)}
        </div>

        {/* Phase Probabilities */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            Phase Probabilities
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Default probability weights by development phase. Override per-building in Projects.
          </p>
          {FACTOR_CONFIGS.phases.map(renderSlider)}
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">About These Factors</h4>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>• <span className="text-orange-400">Market Prices</span>: Used to calculate BTC/ETH holdings value</li>
          <li>• <span className="text-purple-400">HPC/AI Valuation</span>: $/MW values for contracted and pipeline capacity; NOI multiple for lease-based valuation</li>
          <li>• <span className="text-orange-400">Mining Valuation</span>: EBITDA multiple and revenue assumptions for mining operations</li>
          <li>• <span className="text-blue-400">Phase Probabilities</span>: Default probability weights applied to buildings by development phase (can override per-building)</li>
          <li>• <span className="text-red-400">Regulatory Risk</span>: Set per-building in the Projects page to discount for regulatory uncertainty</li>
        </ul>
      </div>

      <style>{`
        .slider-orange::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .slider-orange::-moz-range-thumb {
          width: 18px;
          height: 18px;
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
      `}</style>
    </div>
  );
}
