import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { MapPin, Filter, Building2, Zap, ExternalLink } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) {
    apiUrl = `https://${apiUrl}`;
  }
  return apiUrl;
}

interface Site {
  id: string;
  ticker: string;
  name: string;
  country: string;
  state: string | null;
  latitude: string | null;
  longitude: string | null;
  campuses: Campus[];
}

interface Campus {
  id: string;
  name: string;
  buildings: Building[];
}

interface Building {
  id: string;
  name: string;
  grossMw: string | null;
  itMw: string | null;
  developmentPhase: string;
  usePeriods: UsePeriod[];
}

interface UsePeriod {
  useType: string;
  tenant: string | null;
  isCurrent: boolean;
}

// Company colors for markers
const COMPANY_COLORS: Record<string, string> = {
  MARA: '#f97316',   // orange
  RIOT: '#ef4444',   // red
  CLSK: '#22c55e',   // green
  WULF: '#3b82f6',   // blue
  IREN: '#a855f7',   // purple
  BITF: '#ec4899',   // pink
  HUT: '#14b8a6',    // teal
  CORZ: '#f59e0b',   // amber
  CIFR: '#6366f1',   // indigo
  BTDR: '#84cc16',   // lime
  HIVE: '#06b6d4',   // cyan
  APLD: '#8b5cf6',   // violet
  GLXY: '#d946ef',   // fuchsia
  SLNH: '#78716c',   // stone
  FUFU: '#fb923c',   // orange-400
};

// Phase colors
const PHASE_COLORS: Record<string, string> = {
  OPERATIONAL: '#22c55e',    // green
  CONSTRUCTION: '#f59e0b',   // amber
  DEVELOPMENT: '#3b82f6',    // blue
  EXCLUSIVITY: '#a855f7',    // purple
  DILIGENCE: '#6b7280',      // gray
};

// Use type labels
const USE_TYPE_LABELS: Record<string, string> = {
  BTC_MINING: 'BTC Mining',
  BTC_MINING_HOSTING: 'BTC Mining (Hosted)',
  HPC_AI_HOSTING: 'HPC/AI Hosting',
  HPC_AI_PLANNED: 'HPC/AI Planned',
  GPU_CLOUD: 'GPU Cloud',
  UNCONTRACTED: 'Uncontracted',
  UNCONTRACTED_ROFR: 'Uncontracted (ROFR)',
};

// Map bounds controller
function MapBoundsController({ sites }: { sites: Site[] }) {
  const map = useMap();

  useMemo(() => {
    const validSites = sites.filter(s => s.latitude && s.longitude);
    if (validSites.length > 0) {
      const bounds = validSites.map(s => [
        parseFloat(s.latitude!),
        parseFloat(s.longitude!)
      ] as [number, number]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [sites, map]);

  return null;
}

export default function MapView() {
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [colorBy, setColorBy] = useState<'company' | 'phase'>('company');

  // Fetch sites data
  const { data: sites = [], isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/api/v1/sites`);
      if (!res.ok) throw new Error('Failed to fetch sites');
      return res.json() as Promise<Site[]>;
    },
  });

  // Get unique companies
  const companies = useMemo(() => {
    const tickers = new Set(sites.map(s => s.ticker));
    return Array.from(tickers).sort();
  }, [sites]);

  // Filter sites
  const filteredSites = useMemo(() => {
    return sites.filter(site => {
      if (!site.latitude || !site.longitude) return false;
      if (selectedCompany !== 'all' && site.ticker !== selectedCompany) return false;

      if (selectedPhase !== 'all') {
        const hasPhase = site.campuses.some(c =>
          c.buildings.some(b => b.developmentPhase === selectedPhase)
        );
        if (!hasPhase) return false;
      }

      return true;
    });
  }, [sites, selectedCompany, selectedPhase]);

  // Calculate site stats
  const getSiteStats = (site: Site) => {
    let totalMw = 0;
    let totalItMw = 0;
    const phases = new Set<string>();
    const useTypes = new Set<string>();
    const tenants = new Set<string>();

    site.campuses.forEach(campus => {
      campus.buildings.forEach(building => {
        totalMw += parseFloat(building.grossMw || '0') || 0;
        totalItMw += parseFloat(building.itMw || '0') || 0;
        phases.add(building.developmentPhase);

        building.usePeriods.filter(up => up.isCurrent).forEach(up => {
          useTypes.add(up.useType);
          if (up.tenant) tenants.add(up.tenant);
        });
      });
    });

    return {
      totalMw,
      totalItMw,
      phases: Array.from(phases),
      useTypes: Array.from(useTypes),
      tenants: Array.from(tenants),
      buildingCount: site.campuses.reduce((sum, c) => sum + c.buildings.length, 0),
    };
  };

  // Get marker color
  const getMarkerColor = (site: Site) => {
    if (colorBy === 'company') {
      return COMPANY_COLORS[site.ticker] || '#6b7280';
    }
    // Color by primary phase
    const stats = getSiteStats(site);
    if (stats.phases.includes('OPERATIONAL')) return PHASE_COLORS.OPERATIONAL;
    if (stats.phases.includes('CONSTRUCTION')) return PHASE_COLORS.CONSTRUCTION;
    if (stats.phases.includes('DEVELOPMENT')) return PHASE_COLORS.DEVELOPMENT;
    if (stats.phases.includes('EXCLUSIVITY')) return PHASE_COLORS.EXCLUSIVITY;
    return PHASE_COLORS.DILIGENCE;
  };

  // Get marker radius based on MW
  const getMarkerRadius = (site: Site) => {
    const stats = getSiteStats(site);
    const mw = stats.totalMw;
    if (mw >= 500) return 20;
    if (mw >= 200) return 15;
    if (mw >= 100) return 12;
    if (mw >= 50) return 9;
    return 6;
  };

  // Summary stats
  const summaryStats = useMemo(() => {
    let totalMw = 0;
    let totalItMw = 0;
    filteredSites.forEach(site => {
      const stats = getSiteStats(site);
      totalMw += stats.totalMw;
      totalItMw += stats.totalItMw;
    });
    return { totalMw, totalItMw, siteCount: filteredSites.length };
  }, [filteredSites]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MapPin className="h-6 w-6 text-green-500" />
          <h1 className="text-2xl font-bold">Site Map</h1>
          <span className="text-sm text-gray-500">Geographic view of data center sites</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-400">Filters:</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Company:</label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
            >
              <option value="all">All Companies</option>
              {companies.map(ticker => (
                <option key={ticker} value={ticker}>{ticker}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Phase:</label>
            <select
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
            >
              <option value="all">All Phases</option>
              <option value="OPERATIONAL">Operational</option>
              <option value="CONSTRUCTION">Construction</option>
              <option value="DEVELOPMENT">Development</option>
              <option value="EXCLUSIVITY">Exclusivity</option>
              <option value="DILIGENCE">Diligence</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Color by:</label>
            <select
              value={colorBy}
              onChange={(e) => setColorBy(e.target.value as 'company' | 'phase')}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
            >
              <option value="company">Company</option>
              <option value="phase">Phase</option>
            </select>
          </div>

          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-gray-400">
              <span className="font-mono text-orange-400">{summaryStats.siteCount}</span> sites
            </span>
            <span className="text-gray-400">
              <span className="font-mono text-cyan-400">{summaryStats.totalMw.toLocaleString()}</span> MW total
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden" style={{ height: '600px' }}>
        <MapContainer
          center={[39.8283, -98.5795]} // Center of US
          zoom={4}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          <MapBoundsController sites={filteredSites} />

          {filteredSites.map(site => {
            const lat = parseFloat(site.latitude!);
            const lng = parseFloat(site.longitude!);
            const stats = getSiteStats(site);
            const color = getMarkerColor(site);
            const radius = getMarkerRadius(site);

            return (
              <CircleMarker
                key={site.id}
                center={[lat, lng]}
                radius={radius}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.7,
                  weight: 2,
                }}
              >
                <Popup className="dark-popup">
                  <div className="min-w-[250px] text-gray-900">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-bold text-white"
                        style={{ backgroundColor: COMPANY_COLORS[site.ticker] || '#6b7280' }}
                      >
                        {site.ticker}
                      </span>
                      <span className="font-semibold">{site.name}</span>
                    </div>

                    <div className="text-sm text-gray-600 mb-3">
                      {site.state ? `${site.state}, ` : ''}{site.country}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-yellow-500" />
                        <span>{stats.totalMw.toLocaleString()} MW</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-blue-500" />
                        <span>{stats.buildingCount} buildings</span>
                      </div>
                    </div>

                    {stats.phases.length > 0 && (
                      <div className="mb-2">
                        <span className="text-xs text-gray-500">Phases: </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {stats.phases.map(phase => (
                            <span
                              key={phase}
                              className="px-1.5 py-0.5 rounded text-xs text-white"
                              style={{ backgroundColor: PHASE_COLORS[phase] || '#6b7280' }}
                            >
                              {phase.toLowerCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {stats.useTypes.length > 0 && (
                      <div className="mb-2">
                        <span className="text-xs text-gray-500">Uses: </span>
                        <span className="text-xs">
                          {stats.useTypes.map(ut => USE_TYPE_LABELS[ut] || ut).join(', ')}
                        </span>
                      </div>
                    )}

                    {stats.tenants.length > 0 && (
                      <div className="mb-2">
                        <span className="text-xs text-gray-500">Tenants: </span>
                        <span className="text-xs font-medium">{stats.tenants.join(', ')}</span>
                      </div>
                    )}

                    <a
                      href={`https://www.google.com/maps?q=${lat},${lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open in Google Maps
                    </a>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap gap-6">
          {colorBy === 'company' ? (
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Companies</span>
              <div className="flex flex-wrap gap-3 mt-2">
                {companies.map(ticker => (
                  <div key={ticker} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COMPANY_COLORS[ticker] || '#6b7280' }}
                    />
                    <span className="text-xs text-gray-400">{ticker}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Phases</span>
              <div className="flex flex-wrap gap-3 mt-2">
                {Object.entries(PHASE_COLORS).map(([phase, color]) => (
                  <div key={phase} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs text-gray-400">{phase.toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="ml-auto">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Marker Size = MW Capacity</span>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-xs text-gray-400">&lt;50 MW</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-gray-500" />
                <span className="text-xs text-gray-400">50-100 MW</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-gray-500" />
                <span className="text-xs text-gray-400">100-200 MW</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-gray-500" />
                <span className="text-xs text-gray-400">200+ MW</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
