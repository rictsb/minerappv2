import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  return apiUrl;
}

interface ImportResult {
  success: boolean;
  message: string;
  results: {
    companies: number;
    sites: number;
    campuses: number;
    buildings: number;
    usePeriods: number;
    debts: number;
    errors: string[];
  };
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      setError('Please upload an Excel file (.xlsx)');
      return;
    }

    setUploading(true);
    setError(null);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/v1/import/excel`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.message || data.error || 'Import failed');
      }

      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['valuation'] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    } catch (err: any) {
      setError(err.message || 'Failed to import file');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-xl font-semibold text-gray-300 mb-6">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Excel Import */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <FileSpreadsheet className="text-green-500" size={24} />
            Excel Import
          </h2>

          <p className="text-sm text-gray-400 mb-4">
            Upload your Excel file to import company, site, and project data.
            The importer will look for sheets named <span className="text-orange-400">"Sites"</span>,
            <span className="text-orange-400"> "Debt"</span>,
            <span className="text-orange-400"> "Net Liquid Assets"</span>, and
            <span className="text-orange-400"> "Mining Valuation"</span>.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />

          <div className="mb-4">
            <button
              onClick={handleButtonClick}
              disabled={uploading}
              className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg transition-colors ${
                uploading
                  ? 'border-gray-600 bg-gray-700/50 cursor-not-allowed'
                  : 'border-gray-600 hover:border-orange-500 hover:bg-orange-900/20 cursor-pointer'
              }`}
            >
              {uploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
                  <p className="text-sm text-gray-400">Importing data...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="w-8 h-8 text-gray-500 mb-2" />
                  <p className="text-sm text-gray-400">
                    <span className="font-semibold text-orange-500">Click to upload</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">.xlsx files only</p>
                </div>
              )}
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-red-300">Import Error</p>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          )}

          {importResult?.success && (
            <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="text-green-400" size={20} />
                <p className="font-medium text-green-300">Import Successful!</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Companies:</span>
                  <span className="font-semibold text-white">{importResult.results.companies}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Sites:</span>
                  <span className="font-semibold text-white">{importResult.results.sites}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Campuses:</span>
                  <span className="font-semibold text-white">{importResult.results.campuses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Buildings:</span>
                  <span className="font-semibold text-white">{importResult.results.buildings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Use Periods:</span>
                  <span className="font-semibold text-white">{importResult.results.usePeriods}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Debts:</span>
                  <span className="font-semibold text-white">{importResult.results.debts}</span>
                </div>
              </div>
              {importResult.results.errors && importResult.results.errors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-green-700">
                  <p className="text-sm font-medium text-yellow-400 mb-1">Warnings:</p>
                  <ul className="text-xs text-yellow-500 list-disc list-inside max-h-24 overflow-y-auto">
                    {importResult.results.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-200">
              Expected column names
            </summary>
            <div className="mt-2 p-3 bg-gray-700/50 rounded text-xs font-mono space-y-3">
              <div>
                <p className="font-semibold text-orange-400 mb-1">Sites sheet:</p>
                <p className="text-gray-400">
                  Ticker, Site_Name, Campus_Name, Building_Name, Site_Phase, Country, State,
                  Gross_MW, IT_MW, PUE, Grid, Energization_Date, Current_Use, Lessee,
                  Lease_Value_M, NOI_Annual_M, Confidence, Notes, Source_URL
                </p>
              </div>
              <div>
                <p className="font-semibold text-orange-400 mb-1">Debt sheet:</p>
                <p className="text-gray-400">
                  Ticker, Instrument, Type, Issuer, Principal_$M, Maturity, Coupon_%,
                  Secured, Collateral, Convertible, Conv_Price_$, Status, Confidence
                </p>
              </div>
              <div>
                <p className="font-semibold text-orange-400 mb-1">Net Liquid Assets sheet:</p>
                <p className="text-gray-400">
                  Ticker, Cash_$M, BTC_Count, BTC_Value_$M, ETH_Value_$M, Total_Debt_$M
                </p>
              </div>
              <div>
                <p className="font-semibold text-orange-400 mb-1">Mining Valuation sheet:</p>
                <p className="text-gray-400">
                  Ticker, EH/s, Eff (J/TH), Power ($/kWh)
                </p>
              </div>
            </div>
          </details>
        </div>

        {/* System Info & Export */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">System Information</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Version</span>
              <span className="font-mono text-gray-300">12.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Database</span>
              <span className="font-mono text-green-400">Connected</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">API URL</span>
              <span className="font-mono text-xs text-gray-400 truncate max-w-[200px]">{import.meta.env.VITE_API_URL || '(not set)'}</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-700">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Data Export</h3>
            <p className="text-sm text-gray-400 mb-3">
              Export current data for backup or analysis.
            </p>
            <button
              onClick={() => {
                const apiUrl = getApiUrl();
                window.open(`${apiUrl}/api/v1/companies`, '_blank');
              }}
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition text-sm"
            >
              Export JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
