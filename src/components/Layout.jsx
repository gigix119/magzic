import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { isOwner, trackEvent } from '../utils/adminHelpers'
import {
  LayoutDashboard, Package, Warehouse, Users, FileText,
  Sparkles, Bell, Menu, X, Sun, Moon, LogOut, Shield,
} from 'lucide-react'

const BOTTOM_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/towary', icon: Package, label: 'Towary' },
  { to: '/faktury', icon: FileText, label: 'Faktury' },
  { to: '/alerty', icon: Bell, label: 'Alerty', showBadge: true },
  { to: '/magazyny', icon: Warehouse, label: 'Magazyny' },
]

const STATIC_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/towary', icon: Package, label: 'Towary' },
  { to: '/magazyny', icon: Warehouse, label: 'Magazyny' },
  { to: '/kontrahenci', icon: Users, label: 'Kontrahenci' },
  { to: '/faktury', icon: FileText, label: 'Faktury' },
  { to: '/pakiety', icon: Sparkles, label: 'Pakiety sprzątania' },
  { to: '/alerty', icon: Bell, label: 'Alerty', showBadge: true },
]

const ROUTE_TRACKING = {
  '/dashboard':   { module: 'dashboard',   action: 'dashboard_opened' },
  '/towary':      { module: 'inventory',   action: 'inventory_opened' },
  '/magazyny':    { module: 'warehouses',  action: 'warehouses_opened' },
  '/kontrahenci': { module: 'contractors', action: 'contractors_opened' },
  '/faktury':     { module: 'invoices',    action: 'invoices_opened' },
  '/pakiety':     { module: 'packages',    action: 'packages_opened' },
  '/alerty':      { module: 'alerts',      action: 'alerts_opened' },
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [alertCount, setAlertCount] = useState(0)
  const { theme, toggleTheme } = useTheme()
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const dark = theme === 'dark'

  const navItems = [
    ...STATIC_NAV,
    ...(isOwner(profile) ? [{ to: '/backend', icon: Shield, label: 'Backend', isBackend: true }] : []),
  ]

  // Page view tracking on navigation
  useEffect(() => {
    const match = ROUTE_TRACKING[location.pathname]
    if (match) {
      trackEvent({ eventType: 'page_view', moduleKey: match.module, action: match.action })
    }
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function fetchAlertCount() {
      try {
        const [{ count: priceCount }, { data: stany }] = await Promise.all([
          supabase
            .from('alerty_cenowe_faktury')
            .select('id', { count: 'exact', head: true })
            .eq('przeczytany', false),
          supabase
            .from('stany_magazynowe')
            .select('ilosc, towary!inner(stan_minimalny, aktywny)')
            .eq('towary.aktywny', true)
            .not('towary.stan_minimalny', 'is', null),
        ])
        const stockCount = (stany || []).filter(
          s => s.ilosc < (s.towary?.stan_minimalny ?? Infinity)
        ).length
        setAlertCount((priceCount ?? 0) + stockCount)
      } catch {
        // Table may not exist yet — silently ignore
      }
    }
    fetchAlertCount()
    const interval = setInterval(fetchAlertCount, 60000)
    return () => clearInterval(interval)
  }, [])

  async function handleSignOut() {
    trackEvent({ eventType: 'auth_logout', action: 'user_logged_out' })
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
          height: '100dvh',
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
          {navItems.map(({ to, icon: Icon, label, showBadge, isBackend }) => (
            <div key={to}>
              {isBackend && (
                <div style={{ borderTop: '1px solid var(--sidebar-border)', margin: '6px 0 6px' }} />
              )}
              <NavLink
                to={to}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors"
                style={({ isActive }) => isActive
                  ? isBackend
                    ? { background: 'rgba(124,58,237,0.12)', color: '#7c3aed', fontWeight: 500 }
                    : { background: 'rgba(59,130,246,0.12)', color: dark ? '#60a5fa' : '#2563eb', fontWeight: 500 }
                  : { color: isBackend ? '#7c3aed' : 'var(--text-2)' }
                }
                onMouseEnter={e => { if (!e.currentTarget.style.fontWeight) e.currentTarget.style.background = 'var(--hover-bg)' }}
                onMouseLeave={e => { if (!e.currentTarget.style.fontWeight) e.currentTarget.style.background = '' }}
              >
                <Icon size={16} />
                <span className="flex-1">{label}</span>
                {showBadge && alertCount > 0 && (
                  <span style={{
                    background: '#ef4444', color: '#fff',
                    borderRadius: 10, padding: '1px 6px',
                    fontSize: 11, fontWeight: 700,
                    minWidth: 18, textAlign: 'center', lineHeight: '16px',
                  }}>
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
              </NavLink>
            </div>
          ))}
        </nav>

        {/* User + Logout footer */}
        <div
          className="sidebar-footer flex-shrink-0"
          style={{ borderTop: '1px solid var(--sidebar-border)' }}
        >
          {user && (
            <div className="px-4 py-2.5">
              <p className="text-xs truncate" style={{ color: 'var(--muted)' }} title={user.email}>
                {user.email}
              </p>
            </div>
          )}
          <div className="px-2 sidebar-logout-wrap">
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
          className="flex items-center gap-3 px-3 py-2 lg:px-4 lg:py-3"
          style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg lg:hidden flex items-center justify-center"
            style={{ color: 'var(--muted)', minWidth: 44, minHeight: 44 }}
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold lg:hidden" style={{ fontSize: 14, color: 'var(--text)' }}>magzic</span>
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

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="mobile-bottombar fixed bottom-0 left-0 right-0 z-40 items-center justify-around px-2 py-1"
        style={{
          background: 'var(--card)',
          borderTop: '1px solid var(--border)',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        }}
      >
        {BOTTOM_NAV.map(({ to, icon: Icon, label, showBadge }) => (
          <NavLink
            key={to}
            to={to}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg relative"
            style={({ isActive }) => ({
              color: isActive ? '#3b82f6' : 'var(--text-2)',
              minWidth: 48,
              minHeight: 44,
              justifyContent: 'center',
            })}
          >
            <Icon size={20} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
            {showBadge && alertCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 8,
                background: '#ef4444', color: '#fff',
                borderRadius: 10, padding: '1px 5px',
                fontSize: 9, fontWeight: 700, lineHeight: '14px',
              }}>
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
