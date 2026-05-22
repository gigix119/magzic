import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Package, Warehouse, Users, FileText,
  Sparkles, Bell, Menu, X, Sun, Moon, LogOut,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/towary', icon: Package, label: 'Towary' },
  { to: '/magazyny', icon: Warehouse, label: 'Magazyny' },
  { to: '/kontrahenci', icon: Users, label: 'Kontrahenci' },
  { to: '/faktury', icon: FileText, label: 'Faktury' },
  { to: '/pakiety', icon: Sparkles, label: 'Pakiety sprzątania' },
  { to: '/alerty', icon: Bell, label: 'Alerty' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const dark = theme === 'dark'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 flex flex-col sidebar-panel ${sidebarOpen ? '' : 'sidebar-panel-closed'}`}
        style={{
          width: 220,
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--sidebar-border)',
          transition: 'transform 0.2s',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2 px-5 py-5"
          style={{ borderBottom: '1px solid var(--sidebar-border)' }}
        >
          <div
            className="flex items-center justify-center rounded-lg font-bold text-white text-sm flex-shrink-0"
            style={{ width: 32, height: 32, background: '#3b82f6', fontFamily: 'DM Mono, monospace' }}
          >
            M
          </div>
          <span className="font-semibold tracking-tight" style={{ fontSize: 16, color: 'var(--text)' }}>
            magzic
          </span>
          <button className="ml-auto lg:hidden p-1 rounded" style={{ color: 'var(--muted)' }} onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors"
              style={({ isActive }) => isActive
                ? { background: 'rgba(59,130,246,0.12)', color: dark ? '#60a5fa' : '#2563eb', fontWeight: 500 }
                : { color: 'var(--text-2)' }
              }
              onMouseEnter={e => { if (!e.currentTarget.style.fontWeight) e.currentTarget.style.background = 'var(--hover-bg)' }}
              onMouseLeave={e => { if (!e.currentTarget.style.fontWeight) e.currentTarget.style.background = '' }}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User + Logout footer */}
        <div style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          {user && (
            <div className="px-4 py-2.5">
              <p className="text-xs truncate" style={{ color: 'var(--muted)' }} title={user.email}>
                {user.email}
              </p>
            </div>
          )}
          <div className="px-2 pb-3">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ color: '#ef4444' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <LogOut size={15} />
              <span>Wyloguj się</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          className="flex items-center gap-3 px-4 py-3"
          style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg lg:hidden"
            style={{ color: 'var(--muted)' }}
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold lg:hidden" style={{ fontSize: 15, color: 'var(--text)' }}>magzic</span>
          <div className="ml-auto">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-colors"
              style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}
              title={dark ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 panel-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
