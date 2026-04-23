import { ReactNode, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import Kbd from './Kbd';

interface CommandPaletteProps {
  children: ReactNode;
  /** Optional list of tickers for the "Tickers" group. */
  tickers?: { ticker: string; name: string; stockPrice?: number }[];
}

const PAGES = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Projects', path: '/projects' },
  { label: 'Mining Valuation', path: '/mining-valuation' },
  { label: 'Net Liquid Assets', path: '/net-liquid-assets' },
  { label: 'Debt Tracker', path: '/debt' },
  { label: 'Factors', path: '/factors' },
  { label: 'Data Quality', path: '/data-quality' },
  { label: 'Map', path: '/map' },
  { label: 'Settings', path: '/settings' },
];

/**
 * ⌘K / Ctrl+K command palette. Wraps its children and registers a global
 * key listener. Navigates with react-router's useNavigate.
 *
 * Pass a `tickers` prop to enable ticker search — typically you'd source it
 * from your React Query cache of `/api/v1/companies`.
 */
export default function CommandPalette({ children, tickers = [] }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const close = useCallback(() => setOpen(false), []);
  const go = (path: string) => {
    navigate(path);
    close();
  };

  const needle = q.toLowerCase();
  const matchedTickers = tickers
    .filter((t) => !q || (t.ticker + t.name).toLowerCase().includes(needle))
    .slice(0, 8);
  const matchedPages = PAGES.filter((p) => !q || p.label.toLowerCase().includes(needle));

  return (
    <>
      {children}
      {open && (
        <div
          onClick={close}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[120px]"
          style={{ background: 'rgba(20,19,15,0.35)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[560px] bg-elevated rounded-md shadow-pop overflow-hidden"
          >
            <div className="flex items-center gap-[10px] px-4 py-3 border-b border-hairline">
              <Search size={15} className="text-ink-3" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tickers, sites, pages…"
                className="flex-1 border-0 outline-none bg-transparent text-[14px]"
              />
              <Kbd>ESC</Kbd>
            </div>
            <div className="max-h-[400px] overflow-auto p-[6px]">
              {matchedTickers.length > 0 && (
                <>
                  <div className="eyebrow px-[10px] pt-2 pb-1">Tickers</div>
                  {matchedTickers.map((t) => (
                    <button
                      key={t.ticker}
                      onClick={() => go(`/valuation/${t.ticker}`)}
                      className="flex items-center gap-[10px] px-[10px] py-2 rounded-sm w-full text-left hover:bg-subtle"
                    >
                      <span className="font-medium text-[13px]">{t.ticker}</span>
                      <span className="text-[11.5px] text-ink-3">{t.name}</span>
                      {t.stockPrice != null && (
                        <span className="num ml-auto text-[12px] text-ink-3">
                          ${t.stockPrice.toFixed(2)}
                        </span>
                      )}
                    </button>
                  ))}
                </>
              )}
              {matchedPages.length > 0 && (
                <>
                  <div className="eyebrow px-[10px] pt-2 pb-1 mt-1">Go to</div>
                  {matchedPages.map((p) => (
                    <button
                      key={p.path}
                      onClick={() => go(p.path)}
                      className="flex items-center gap-[10px] px-[10px] py-2 rounded-sm w-full text-left hover:bg-subtle"
                    >
                      <ArrowRight size={13} className="text-ink-3" />
                      <span className="text-[13px]">{p.label}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
