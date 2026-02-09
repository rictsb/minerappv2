// Map page - Geographic visualization of mining sites
// Will be fully implemented per PRD Section 5.5

export default function MapView() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-xl font-semibold text-gray-300 mb-6">Map</h1>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-400 mb-4">
          Geographic visualization of mining sites
        </p>
        <p className="text-sm text-gray-500">
          Features: Leaflet map, site markers, filtering, clustering
        </p>
        <div className="mt-6 p-4 bg-gray-700/50 rounded-lg text-left text-sm">
          <p className="font-semibold text-gray-300 mb-2">Map features:</p>
          <ul className="list-disc list-inside text-gray-400 space-y-1">
            <li>Site markers color-coded by status</li>
            <li>Marker size proportional to MW capacity</li>
            <li>Click to show site details popup</li>
            <li>Filter by company, status, capacity</li>
            <li>Cluster markers at low zoom levels</li>
            <li>Link to Google Maps for directions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
