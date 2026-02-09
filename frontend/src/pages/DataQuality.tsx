// Data Quality page - Validation results and corrections
// Will be fully implemented per PRD Section 5.4

export default function DataQuality() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-xl font-semibold text-gray-300 mb-6">Data Quality</h1>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-400 mb-4">
          Data quality tests and monitoring alerts
        </p>
        <p className="text-sm text-gray-500">
          Features: Test results table, severity badges, one-click corrections
        </p>
        <div className="mt-6 p-4 bg-gray-700/50 rounded-lg text-left text-sm">
          <p className="font-semibold text-gray-300 mb-2">Test categories:</p>
          <ul className="list-disc list-inside text-gray-400 space-y-1">
            <li>Completeness: Missing required fields</li>
            <li>Range validation: Values within expected bounds</li>
            <li>Consistency: Phase MW ≤ Site gross capacity</li>
            <li>Temporal: Energization dates reasonable</li>
            <li>Reference integrity: Valid foreign keys</li>
          </ul>
          <p className="font-semibold text-gray-300 mt-4 mb-2">Severity levels:</p>
          <ul className="list-disc list-inside space-y-1">
            <li className="text-red-400">P0 - Critical: Blocks valuation</li>
            <li className="text-yellow-400">P1 - Warning: Questionable data</li>
            <li className="text-blue-400">P2 - Info: Suggestions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
