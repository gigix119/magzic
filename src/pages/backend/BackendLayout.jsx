import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, Activity, ShieldCheck, ScrollText, AlertTriangle } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

const BACKEND_NAV = [
  { to: '/backend',             icon: LayoutDashboard, label: 'Przegląd',    end: true },
  { to: '/backend/users',       icon: Users,           label: 'Użytkownicy' },
  { to: '/backend/activity',    icon: Activity,        label: 'Aktywność' },
  { to: '/backend/permissions', icon: ShieldCheck,     label: 'Uprawnienia' },
  { to: '/backend/audit',       icon: ScrollText,      label: 'Audit log' },
  { to: '/backend/errors',      icon: AlertTriangle,   label: 'Błędy' },
]

export default function BackendLayout() {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  return (
    <div>
      {/* Backend header */}
      <div className="mb-5" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <div className="flex items-center gap-2 mb-3">
          <span
            className="inline-flex items-center justify-center rounded text-white text-xs font-bold px-2 py-0.5"
            style={{ background: '#7c3aed', fontSize: 11, letterSpacing: '0.05em' }}
          >
            BACKEND
          </span>
          <span className="font-semibold" style={{ fontSize: 18, color: 'var(--text)' }}>
            Panel administracyjny
          </span>
        </div>

        {/* Sub-navigation tabs */}
        <nav className="flex gap-1 flex-wrap">
          {BACKEND_NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={({ isActive }) => isActive
                ? { background: dark ? 'rgba(124,58,237,0.18)' : 'rgba(124,58,237,0.1)', color: '#7c3aed' }
                : { color: 'var(--text-2)' }
              }
              onMouseEnter={e => { if (!e.currentTarget.getAttribute('aria-current')) e.currentTarget.style.background = 'var(--hover-bg)' }}
              onMouseLeave={e => { if (!e.currentTarget.getAttribute('aria-current')) e.currentTarget.style.background = '' }}
            >
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  )
}
