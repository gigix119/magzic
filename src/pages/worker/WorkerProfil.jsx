import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { LayoutDashboard, Sun, Moon, LogOut, ChevronRight } from 'lucide-react'

export default function WorkerProfil() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const dark = theme === 'dark'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const initial = user?.email ? user.email[0].toUpperCase() : '?'

  return (
    <div>
      <h1 className="font-bold mb-4" style={{ fontSize: 20, color: 'var(--text)' }}>Ja</h1>

      <div className="rounded-xl p-4 mb-4 flex items-center gap-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-center rounded-full font-bold text-white flex-shrink-0" style={{ width: 48, height: 48, background: 'var(--c-action)', fontSize: 18 }}>
          {initial}
        </div>
        <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{user?.email}</p>
      </div>

      <div className="rounded-xl mb-4 overflow-hidden" style={{ background: 'var(--c-surface)', border: '1px solid var(--border)' }}>
        <Link
          to="/dashboard"
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ color: 'var(--text)', minHeight: 56, borderBottom: '1px solid var(--border)', textDecoration: 'none' }}
        >
          <LayoutDashboard size={18} style={{ color: 'var(--c-action)' }} />
          <span className="flex-1 text-sm font-medium">Przełącz na widok właściciela</span>
          <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
        </Link>

        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3.5"
          style={{ color: 'var(--text)', minHeight: 56 }}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          <span className="flex-1 text-sm font-medium text-left">{dark ? 'Tryb jasny' : 'Tryb ciemny'}</span>
        </button>
      </div>

      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-medium mb-4"
        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', minHeight: 52 }}
      >
        <LogOut size={16} /> Wyloguj się
      </button>

      <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>Magzic — widok pracownika · v1.0</p>
    </div>
  )
}
