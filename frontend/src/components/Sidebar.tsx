import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Pickaxe,
  Wallet,
  Landmark,
  Settings2,
  AlertTriangle,
  Map,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/**
 * Left rail. Paths match existing App.tsx routes exactly — do not change
 * without updating App.tsx in lockstep.
 */

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/projects', label: 'Projects', icon: Building2 },
  { path: '/mining-valuation', label: 'Mining Val', icon: Pickaxe },
  { path: '/net-liquid-assets', label: 'Net Liquid', icon: Wallet },
  { path: '/debt', label: 'Debt', icon: Landmark },
  { path: '/factors', label: 'Factors', icon: Settings2 },
  { path: '/data-quality', label: 'Data Quality', icon: AlertTriangle },
  { path: '/map', label: 'Map', icon: Map },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('nav-collapsed');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('nav-collapsed', String(collapsed));
  }, [collapsed]);

  return (
    <aside
      className={`${collapsed ? 'w-14' : 'w-52'} bg-elevated border-r border-hairline flex flex-col transition-all duration-200 flex-shrink-0 h-full`}
    >
      {/* Wordmark */}
      <div
        className={`h-12 border-b border-hairline flex items-center ${
          collapsed ? 'justify-center' : 'px-4'
        }`}
      >
        {collapsed ? (
          <span className="text-[var(--btc)] font-bold text-lg leading-none">₿</span>
        ) : (
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-ink-1 tracking-tight">
              Miner Terminal
            </div>
            <div className="text-[10px] text-ink-3 uppercase tracking-wider">v10</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2">
        <ul className="space-y-[2px]">
          {navItems.map(({ path, label, icon: Icon }) => (
            <li key={path}>
              <NavLink
                to={path}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-[10px] py-[7px] rounded-sm text-[12px] transition-colors ${
                    isActive
                      ? 'bg-[var(--btc-soft)] text-[var(--btc-ink)] font-medium'
                      : 'text-ink-2 hover:bg-subtle hover:text-ink-1'
                  } ${collapsed ? 'justify-center' : ''}`
                }
                title={collapsed ? label : undefined}
              >
                <Icon size={15} className="flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-ink-1 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    {label}
                  </div>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Collapse */}
      <div className="p-2 border-t border-hairline">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-2 py-[6px] text-ink-3 hover:text-ink-1 hover:bg-subtle rounded-sm transition-colors text-[11px]"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight size={14} />
          ) : (
            <>
              <ChevronLeft size={14} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
