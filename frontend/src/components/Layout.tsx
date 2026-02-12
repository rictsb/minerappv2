import { ReactNode, useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Settings2,
  AlertTriangle,
  Map,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/projects', label: 'Projects', icon: Building2 },
  { path: '/factors', label: 'Factors', icon: Settings2 },
  { path: '/data-quality', label: 'Data Quality', icon: AlertTriangle },
  { path: '/map', label: 'Map', icon: Map },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('nav-collapsed');
    // Default to collapsed (true) if not set
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('nav-collapsed', String(collapsed));
  }, [collapsed]);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`${collapsed ? 'w-16' : 'w-56'} bg-gray-900 text-white flex flex-col border-r border-gray-800 transition-all duration-200 flex-shrink-0`}
      >
        {/* Header */}
        <div className={`p-3 border-b border-gray-800 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-orange-500">₿TC Miner</h1>
              <p className="text-[10px] text-gray-500">Terminal</p>
            </div>
          )}
          {collapsed && (
            <span className="text-orange-500 font-bold text-lg">₿</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="space-y-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group relative ${
                      isActive
                        ? 'bg-orange-600 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    } ${collapsed ? 'justify-center' : ''}`
                  }
                  title={collapsed ? label : undefined}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && <span className="text-sm">{label}</span>}
                  {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                      {label}
                    </div>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Toggle & Version */}
        <div className="p-2 border-t border-gray-800">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight size={16} />
            ) : (
              <>
                <ChevronLeft size={16} />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </button>
          {!collapsed && (
            <p className="text-[10px] text-gray-600 text-center mt-2">v10.0</p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-900">
        {children}
      </main>
    </div>
  );
}
