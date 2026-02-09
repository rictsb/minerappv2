import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ImportResult {
  success: boolean;
  message: string;
  results: {
    companies: number;
    sites: number;
    phases: number;
    tenancies: number;
    factors: number;
    errors: string[];
  };
}

export default function Settings() {
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    console.log('Button clicked, triggering file input');
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed');
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', file.name);

    // Validate file type
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
      // Build API URL - handle Render's host format
      let apiUrl = import.meta.env.VITE_API_URL || '';
      console.log('VITE_API_URL:', apiUrl);
      if (apiUrl && !apiUrl.startsWith('http')) {
        apiUrl = `https://${apiUrl}`;
      }
      const fullUrl = `${apiUrl}/api/v1/import/excel`;
      console.log('Uploading to:', fullUrl);

      const response = await fetch(fullUrl, {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Import failed');
      }

      setImportResult(data);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to import file');
    } finally {
      setUploading(false);
      // Reset file input
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
            The importer will look for sheets named "Project List" and "Factors".
          </p>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />

          {/* Upload Button */}
          <div className="mb-4">
            <button
              onClick={handleButtonClick}
              disabled={uploading}
              className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg transition-colors ${
                uploading
                  ? 'border-gray-600 bg-gray-700/50 cursor-not-allowed'
                  : 'border-gray-600 hover:border-orange-500 hover:bg-orange-900/20 cursor-pointer'
              }`}
            >
              {uploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-2" />
                  <p className="text-sm text-gray-400">Importing data...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="w-10 h-10 text-gray-500 mb-2" />
                  <p className="text-sm text-gray-400">
                    <span className="font-semibold text-orange-500">Click to upload</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">.xlsx files only</p>
                </div>
              )}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-red-300">Import Error</p>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          )}

          {/* Success Result */}
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
                  <span className="text-gray-400">Phases:</span>
                  <span className="font-semibold text-white">{importResult.results.phases}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Tenancies:</span>
                  <span className="font-semibold text-white">{importResult.results.tenancies}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Factors:</span>
                  <span className="font-semibold text-white">{importResult.results.factors}</span>
                </div>
              </div>
              {importResult.results.errors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-green-700">
                  <p className="text-sm font-medium text-yellow-400 mb-1">Warnings:</p>
                  <ul className="text-xs text-yellow-500 list-disc list-inside">
                    {importResult.results.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Expected Columns */}
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-200">
              Expected column names
            </summary>
            <div className="mt-2 p-3 bg-gray-700/50 rounded text-xs font-mono">
              <p className="font-semibold text-gray-300 mb-1">Project List sheet:</p>
              <p className="text-gray-400 mb-2">
                Ticker, Company, Site_Name, Site_Phase, Status, Gross_MW, IT_MW, PUE,
                Energization_Date, Current_Use, Country, State, Latitude, Longitude...
              </p>
              <p className="font-semibold text-gray-300 mb-1">Factors sheet:</p>
              <p className="text-gray-400">Category, Key, Value, Description</p>
            </div>
          </details>
        </div>

        {/* Data Export */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Data Export</h2>
          <div className="space-y-4 text-sm text-gray-400">
            <p>Export current data for backup or analysis:</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  let apiUrl = import.meta.env.VITE_API_URL || '';
                  if (apiUrl && !apiUrl.startsWith('http')) {
                    apiUrl = `https://${apiUrl}`;
                  }
                  window.open(`${apiUrl}/api/v1/companies`, '_blank');
                }}
                className="px-4 py-2 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition"
              >
                Export JSON
              </button>
            </div>
          </div>
        </div>

        {/* Monitoring Configuration */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Monitoring Configuration</h2>
          <div className="space-y-4 text-sm text-gray-400">
            <p>Configure IR page URLs and Twitter accounts for each company:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>IR Page URL: Checked weekly for press releases</li>
              <li>Twitter accounts: Monitored for announcements</li>
              <li>SEC filings: Auto-detected for public companies</li>
            </ul>
            <p className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded text-yellow-400">
              Monitoring alerts appear in Data Quality page
            </p>
          </div>
        </div>

        {/* System Info */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">System Information</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Version</span>
              <span className="font-mono text-gray-300">10.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Database</span>
              <span className="font-mono text-green-400">Connected</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">API URL</span>
              <span className="font-mono text-xs text-gray-400">{import.meta.env.VITE_API_URL || '(not set)'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
