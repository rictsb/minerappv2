import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import MarketPulse from './MarketPulse';

interface LayoutProps {
  children: ReactNode;
}

function getApiUrl(): string {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
  return apiUrl;
}

/**
 * Terminal shell: left rail + top pulse bar + main content area.
 * Keeps the same `{ children }` prop contract as the previous Layout,
 * so App.tsx needs no changes.
 *
 * Note: canvas background is set on <body> via tokens.css — do not add
 * bg-* classes here or on page roots.
 */
export default function Layout({ children }: LayoutProps) {
  const apiUrl = getApiUrl();

  // Fetch live market data from settings (BTC, ETH prices stored by refresh)
  // Refreshes every hour automatically
  const { data: settings } = useQuery<Record<string, any>>({
    queryKey: ['settings-market'],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/v1/settings`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
    refetchInterval: 60 * 60 * 1000, // Auto-refresh every hour
    staleTime: 5 * 60 * 1000,        // Consider stale after 5 min
  });

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MarketPulse
          btcPrice={settings?.btcPrice}
          networkHashrate={settings?.networkHashrateEh ? `${settings.networkHashrateEh} EH/s` : undefined}
        />
        <main className="flex-1 overflow-auto min-h-0">{children}</main>
      </div>
    </div>
  );
}
