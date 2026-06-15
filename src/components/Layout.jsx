import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { isOwner, trackEvent } from '../utils/adminHelpers'
import { useWorkspace } from '../context/WorkspaceContext'
import { getZlecenieConfigFor } from '../config/businessTypes'
import {
  LayoutDashboard, Package, Warehouse, Users, FileText,
  Sparkles, Bell, X, Shield, Settings,
} from 'lucide-react'
import Topbar from './ui/Topbar'

const CORE_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/towary', icon: Package, label: 'Towary' },
  { to: '/magazyny', icon: Warehouse, label: 'Magazyny' },
  { to: '/kontrahenci', icon: Users, label: 'Kontrahenci' },
  { to: '/faktury', icon: FileText, label: 'Faktury' },
  { to: '/alerty', icon: Bell, label: 'Alerty', showBadge: true },
]

const BOTTOM_NAV_BASE = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/towary', icon: Package, label: 'Towary' },
  { to: '/faktury', icon: FileText, label: 'Faktury' },
  // zlecenia inserted here dynamically
  { to: '/alerty', icon: Bell, label: 'Alerty', showBadge: true },
]

const CLEANING_CATEGORIES = ['cleaning_facility', 'hospitality']

const ROUTE_TRACKING = {
  '/dashboard':   { module: 'dashboard',   action: 'dashboard_opened' },
  '/towary':      { module: 'inventory',   action: 'inventory_opened' },
  '/magazyny':    { module: 'warehouses',  action: 'warehouses_opened' },
  '/kontrahenci': { module: 'contractors', action: 'contractors_opened' },
  '/faktury':     { module: 'invoices',    action: 'invoices_opened' },
  '/pakiety':     { module: 'packages',    action: 'packages_opened' },
  '/alerty':      { module: 'alerts',      action: 'alerts_opened' },
  '/zlecenia':    { module: 'zlecenia',    action: 'zlecenia_opened' },
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [alertCount, setAlertCount] = useState(0)
  const { theme, toggleTheme } = useTheme()
  const { user, profile, signOut } = useAuth()
  const { getBusinessCategory, workspace } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const dark = theme === 'dark'

  const businessCategory = getBusinessCategory()
  const zlecenieConfig = getZlecenieConfigFor(businessCategory)
  const zlecenieItem = { to: '/zlecenia', icon: zlecenieConfig.icon, label: zlecenieConfig.moduleLabel }

  const businessItems = CLEANING_CATEGORIES.includes(businessCategory)
    ? [{ to: '/pakiety', icon: Sparkles, label: 'Pakiety sprzątania' }]
    : []

  const adminItems = isOwner(profile)
    ? [{ to: '/backend', icon: Shield, label: 'Backend', isBackend: true }]
    : []

  const navItems = [...CORE_NAV, zlecenieItem, ...businessItems, ...adminItems]

  const bottomNav = [
    ...BOTTOM_NAV_BASE.slice(0, 3),
    zlecenieItem,
    ...BOTTOM_NAV_BASE.slice(3),
  ]

  // Page view tracking on navigation
  useEffect(() => {
    const match = ROUTE_TRACKING[location.pathname]
    if (match) {
      trackEvent({ eventType: 'page_view', moduleKey: match.module, action: match.action })
    }
  }, [location.pathname])

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
      {/* Mobile overlay — z-[45] aby przykryć bottom nav (z-40) gdy sidebar jest otwarty */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[45] lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — z-50 aby być nad bottom nav (z-40) i overlay (z-[45]) */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col sidebar-panel ${sidebarOpen ? '' : 'sidebar-panel-closed'}`}
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
                {typeof Icon === 'string'
                  ? <span style={{ fontSize: 15, lineHeight: 1, width: 16, textAlign: 'center', flexShrink: 0 }}>{Icon}</span>
                  : <Icon size={16} />}
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
          <div className="px-2">
            <NavLink
              to="/ustawienia"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors"
              style={({ isActive }) => ({
                color: isActive ? (dark ? '#60a5fa' : '#2563eb') : 'var(--text-2)',
                background: isActive ? 'rgba(59,130,246,0.12)' : '',
                fontWeight: isActive ? 500 : undefined,
                minHeight: 44,
              })}
              onMouseEnter={e => { if (!e.currentTarget.style.fontWeight) e.currentTarget.style.background = 'var(--hover-bg)' }}
              onMouseLeave={e => { if (!e.currentTarget.style.fontWeight) e.currentTarget.style.background = '' }}
            >
              <Settings size={15} />
              <span>Ustawienia</span>
            </NavLink>
          </div>
          <div className="px-2 sidebar-logout-wrap">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ color: '#ef4444', minHeight: 44 }}
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
        <Topbar
          onMenuOpen={() => setSidebarOpen(true)}
          alertCount={alertCount}
          user={user}
          dark={dark}
          toggleTheme={toggleTheme}
          handleSignOut={handleSignOut}
          workspace={workspace}
        />

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
        {bottomNav.map(({ to, icon: Icon, label, showBadge }) => (
          <NavLink
            key={to}
            to={to}
            className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg relative"
            style={({ isActive }) => ({
              color: isActive ? '#3b82f6' : 'var(--text-2)',
              minWidth: 44,
              minHeight: 44,
              justifyContent: 'center',
            })}
          >
            {typeof Icon === 'string'
              ? <span style={{ fontSize: 20, lineHeight: 1 }}>{Icon}</span>
              : <Icon size={20} />}
            <span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
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
