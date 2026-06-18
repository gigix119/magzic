import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { isOwner, trackEvent } from '../utils/adminHelpers'
import { useWorkspace } from '../context/WorkspaceContext'
import { AlertCountProvider } from '../context/AlertCountContext'
import {
  LayoutDashboard, Package, Warehouse, Users, FileText,
  ClipboardList, X, Shield, Settings, LogOut, Menu, Building2, Kanban,
} from 'lucide-react'
import Topbar from './ui/Topbar'

const ROUTE_TRACKING = {
  '/dashboard':  { module: 'dashboard',  action: 'dashboard_opened' },
  '/towary':     { module: 'inventory',  action: 'inventory_opened' },
  '/magazyny':   { module: 'warehouses', action: 'warehouses_opened' },
  '/kontrahenci':{ module: 'contractors',action: 'contractors_opened' },
  '/lokale':     { module: 'lokale',     action: 'lokale_opened' },
  '/faktury':    { module: 'invoices',   action: 'invoices_opened' },
  '/operacje':   { module: 'operacje',   action: 'operacje_opened' },
  '/tablice':    { module: 'tablice',    action: 'tablice_opened' },
}

const GROUP_LABEL_STYLE = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.09em',
  color: 'var(--muted)',
  padding: '10px 12px 3px',
  textTransform: 'uppercase',
  userSelect: 'none',
}

function SidebarNavLink({ to, icon: Icon, label, showBadge, alertCount, onClick, automation }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-3 rounded-lg mb-0.5 text-sm transition-colors"
      style={({ isActive }) => ({
        color: isActive
          ? (automation ? 'var(--c-automation)' : 'var(--c-action)')
          : (automation ? 'var(--c-automation)' : 'var(--text-2)'),
        background: isActive
          ? (automation ? 'var(--c-automation-subtle)' : 'var(--c-action-subtle)')
          : '',
        fontWeight: isActive ? 500 : undefined,
        opacity: !isActive && automation ? 0.75 : undefined,
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
      })}
      onMouseEnter={e => {
        if (!e.currentTarget.getAttribute('aria-current')) {
          e.currentTarget.style.background = automation
            ? 'var(--c-automation-subtle)'
            : 'var(--hover-bg)'
        }
      }}
      onMouseLeave={e => {
        if (!e.currentTarget.getAttribute('aria-current')) {
          e.currentTarget.style.background = ''
        }
      }}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
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
  )
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [alertCount, setAlertCount] = useState(0)
  const { theme, toggleTheme } = useTheme()
  const { user, profile, signOut } = useAuth()
  const { workspace } = useWorkspace()
  const navigate = useNavigate()
  const location = useLocation()
  const dark = theme === 'dark'

  const ownerAccess = isOwner(profile)

  const close = () => setSidebarOpen(false)

  const bottomNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dziś' },
    { to: '/operacje',  icon: ClipboardList,   label: 'Operacje', showBadge: true },
    { to: '/faktury',   icon: FileText,         label: 'Faktury' },
    { icon: Menu, label: 'Więcej', showBadge: false, onClick: () => setSidebarOpen(true) },
  ]

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
    <AlertCountProvider value={alertCount}>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-[45] lg:hidden"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={close}
          />
        )}

        {/* Sidebar */}
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
              style={{ width: 32, height: 32, background: 'var(--c-action)' }}
            >
              M
            </div>
            <span className="font-semibold tracking-tight" style={{ fontSize: 16, color: 'var(--text)' }}>
              magzic
            </span>
            <button className="ml-auto lg:hidden p-1 rounded" style={{ color: 'var(--muted)' }} onClick={close}>
              <X size={16} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Nawigacja główna">

            {/* START */}
            <div style={GROUP_LABEL_STYLE}>Start</div>
            <SidebarNavLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={close} alertCount={alertCount} />

            {/* OPERACJE — single unified link with alert badge */}
            <div style={{ ...GROUP_LABEL_STYLE, marginTop: 4 }}>Operacje</div>
            <SidebarNavLink to="/operacje" icon={ClipboardList} label="Operacje" showBadge onClick={close} alertCount={alertCount} />
            <SidebarNavLink to="/tablice" icon={Kanban} label="Tablice" onClick={close} alertCount={alertCount} />

            {/* MAGAZYN */}
            <div style={{ ...GROUP_LABEL_STYLE, marginTop: 4 }}>Magazyn</div>
            <SidebarNavLink to="/towary"      icon={Package}    label="Towary"       onClick={close} alertCount={alertCount} />
            <SidebarNavLink to="/magazyny"    icon={Warehouse}  label="Magazyny"     onClick={close} alertCount={alertCount} />
            <SidebarNavLink to="/kontrahenci" icon={Users}      label="Kontrahenci"  onClick={close} alertCount={alertCount} />
            <SidebarNavLink to="/lokale"      icon={Building2}  label="Lokale"       onClick={close} alertCount={alertCount} />
            <SidebarNavLink to="/faktury"     icon={FileText}   label="Faktury"      onClick={close} alertCount={alertCount} />

            {/* SYSTEM */}
            <div style={{ ...GROUP_LABEL_STYLE, marginTop: 4 }}>System</div>
            <SidebarNavLink to="/ustawienia" icon={Settings} label="Ustawienia" onClick={close} alertCount={alertCount} />

            {/* BACKEND — owner only */}
            {ownerAccess && (
              <>
                <div style={{ borderTop: '1px solid var(--sidebar-border)', margin: '10px 0 6px' }} />
                <SidebarNavLink to="/backend" icon={Shield} label="Backend" onClick={close} alertCount={alertCount} automation />
              </>
            )}
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
          {bottomNav.map(({ to, icon: Icon, label, showBadge, onClick }) =>
            to ? (
              <NavLink
                key={to}
                to={to}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg relative"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--c-action)' : 'var(--text-2)',
                  minWidth: 44,
                  minHeight: 44,
                  justifyContent: 'center',
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} />
                    <span className="bottom-nav-label" style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
                    {showBadge && alertCount > 0 && (
                      <span style={{
                        position: 'absolute', top: 4, right: 6,
                        background: '#ef4444', color: '#fff',
                        borderRadius: 10, padding: '1px 5px',
                        fontSize: 9, fontWeight: 700, lineHeight: '14px',
                      }}>
                        {alertCount > 9 ? '9+' : alertCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ) : (
              <button
                key={label}
                onClick={onClick}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg relative"
                style={{
                  color: 'var(--text-2)',
                  minWidth: 44,
                  minHeight: 44,
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Icon size={20} />
                <span className="bottom-nav-label" style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
              </button>
            )
          )}
        </nav>
      </div>
    </AlertCountProvider>
  )
}
