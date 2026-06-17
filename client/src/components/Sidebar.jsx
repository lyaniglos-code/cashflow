import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from './Logo.jsx';
import { DashboardIcon, AnalyticsIcon, DigestIcon, ScenarioIcon, ImportIcon, SettingsIcon } from './Icons.jsx';

const links = [
  { to: '/', label: 'Dashboard', Icon: DashboardIcon, end: true },
  { to: '/analytics', label: 'Analytics', Icon: AnalyticsIcon },
  { to: '/digest', label: 'Weekly Digest', Icon: DigestIcon },
  { to: '/scenarios', label: 'Scenario Planner', Icon: ScenarioIcon },
  { to: '/upload', label: 'Import Data', Icon: ImportIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 transition-opacity lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed z-40 flex h-full w-64 flex-col border-r border-white/[0.06] bg-gradient-to-b from-charcoal-900 to-charcoal-950 px-3.5 py-5 backdrop-blur transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-7 px-2">
          <Logo size="md" />
        </div>

        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Menu</div>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive ? 'bg-teal/[0.08] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* active left accent bar */}
                  <span
                    className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-teal transition-all duration-200 ${
                      isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40 group-hover:bg-slate-500'
                    }`}
                  />
                  <span
                    className={`transition-colors duration-200 ${isActive ? 'text-teal' : 'text-slate-500 group-hover:text-slate-300'}`}
                  >
                    <Icon />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="mb-2.5 flex items-center gap-2.5 px-1">
            <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-teal/15 text-xs font-bold text-teal">
              {(user?.businessName || user?.email || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{user?.businessName || 'My Business'}</div>
              <div className="truncate text-xs text-slate-500">{user?.email}</div>
            </div>
          </div>
          <button onClick={logout} className="btn-ghost btn-sm w-full">
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
