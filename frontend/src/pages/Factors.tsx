// Factors page - Hierarchical factors management
// Will be fully implemented per PRD Section 5.3

export default function Factors() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-xl font-semibold text-gray-300 mb-6">Factors</h1>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-400 mb-4">
          Hierarchical factors management (Global → Company → Site)
        </p>
        <p className="text-sm text-gray-500">
          Features: Three-panel layout, inheritance indicators, real-time recalc
        </p>
        <div className="mt-6 p-4 bg-gray-700/50 rounded-lg text-left text-sm">
          <p className="font-semibold text-gray-300 mb-2">Factor categories:</p>
          <ul className="list-disc list-inside text-gray-400 space-y-1">
            <li>Market: BTC price, network hashrate, block subsidy</li>
            <li>Valuation: SOFR rate, credit spreads, cap rates, HPC multiples</li>
            <li>Operations: Default PUE, curtailment, non-power OpEx</li>
            <li>Energization: Base year, decay rate (editable curve)</li>
          </ul>
          <p className="font-semibold text-gray-300 mt-4 mb-2">Inheritance logic:</p>
          <p className="text-gray-400">Site inherits from Company inherits from Global (unless overridden)</p>
        </div>
      </div>
    </div>
  );
}
