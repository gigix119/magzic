import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ListTodo, Package, CheckCircle2, User, LogOut } from 'lucide-react'

const BOTTOM_NAV = [
  { to: '/pracownik', icon: ListTodo, label: 'Dziś' },
  { to: '/pracownik/zabrac', icon: Package, label: 'Zabrać' },
  { to: '/pracownik/gotowe', icon: CheckCircle2, label: 'Gotowe' },
  { to: '/pracownik/profil', icon: User, label: 'Ja' },
]

export default function WorkerLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const initial = user?.email ? user.email[0].toUpperCase() : '?'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--c-app-bg)' }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{
          background: 'var(--c-surface)',
          borderBottom: '1px solid var(--border)',
          height: 56,
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div
          className="flex items-center justify-center rounded-lg font-bold text-white text-sm flex-shrink-0"
          style={{ width: 30, height: 30, background: 'var(--c-action)' }}
        >
          M
        </div>
        <span className="font-semibold" style={{ fontSize: 15, color: 'var(--text)' }}>magzic</span>
        <div className="flex-1" />
        <div
          className="flex items-center justify-center rounded-full font-bold text-white text-sm flex-shrink-0"
          style={{ width: 32, height: 32, background: 'var(--c-action)' }}
          title={user?.email}
        >
          {initial}
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ color: 'var(--text-2)', minWidth: 44, minHeight: 44 }}
          aria-label="Wyloguj się"
          title="Wyloguj się"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto" style={{ padding: 16, paddingBottom: 88 }}>
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 flex items-center justify-around"
        style={{
          background: 'var(--c-surface)',
          borderTop: '1px solid var(--border)',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
          zIndex: 40,
        }}
      >
        {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/pracownik'}
            className="flex flex-col items-center gap-1 py-2"
            style={({ isActive }) => ({
              color: isActive ? 'var(--c-action)' : 'var(--text-2)',
              minWidth: 64,
              minHeight: 56,
              justifyContent: 'center',
            })}
          >
            <Icon size={22} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
