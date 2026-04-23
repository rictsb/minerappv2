import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import MarketPulse from './MarketPulse';

interface LayoutProps {
  children: ReactNode;
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
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MarketPulse />
        <main className="flex-1 overflow-auto min-h-0">{children}</main>
      </div>
    </div>
  );
}
