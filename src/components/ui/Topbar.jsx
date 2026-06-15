import { useState, useRef, useEffect } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { Menu, Search, X, Bell, Plus, ChevronDown, Sun, Moon, Settings, LogOut, Calendar } from 'lucide-react'

/* OperationalDatePicker – stan lokalny, onChange no-op */
function OperationalDatePicker() {
  const today = new Date().toISOString().split('T')[0]
  const [value, setValue] = useState(today)
  const [open, setOpen] = useState(false)

  const label = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
    : 'Dziś'

  return (
    <div className="relative">
      {/* Mobile: kompaktowy przycisk otwierający natywny input */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors"
        style={{
          background: 'var(--hover-bg)',
          color: 'var(--text-2)',
          minHeight: 36,
          border: '1px solid var(--border)',
        }}
        title="Data operacyjna"
      >
        <Calendar size={14} style={{ flexShrink: 0 }} />
        <span className="hidden sm:inline font-medium" style={{ fontSize: 13 }}>{label}</span>
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-xl shadow-xl p-3"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', minWidth: 200 }}
        >
          <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Data operacyjna</p>
          <input
            type="date"
            value={value}
            onChange={e => { setValue(e.target.value); console.log('[OperationalDate] onChange:', e.target.value) }}
            className="w-full rounded-lg px-2 py-1.5 text-sm"
            style={{
              background: 'var(--hover-bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
          />
          <button
            onClick={() => setOpen(false)}
            className="mt-2 w-full text-xs py-1.5 rounded-lg"
            style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}
          >
            Zamknij
          </button>
        </div>
      )}
    </div>
  )
}

/* SearchInput – pole prezentacyjne, na mobile zwija się do ikony */
function SearchInput() {
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (expanded && inputRef.current) inputRef.current.focus()
  }, [expanded])

  return (
    <div className="relative flex items-center">
      {expanded ? (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="search"
            placeholder="Szukaj..."
            onChange={e => console.log('[Search] onChange:', e.target.value)}
            className="rounded-lg px-3 py-1.5 text-sm outline-none"
            style={{
              background: 'var(--hover-bg)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              width: 180,
              minHeight: 36,
            }}
            onKeyDown={e => e.key === 'Escape' && setExpanded(false)}
          />
          <button
            onClick={() => setExpanded(false)}
            className="flex items-center justify-center rounded-lg"
            style={{ color: 'var(--muted)', minWidth: 36, minHeight: 36 }}
            aria-label="Zamknij wyszukiwanie"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{ color: 'var(--text-2)', background: 'var(--hover-bg)', minWidth: 36, minHeight: 36 }}
          aria-label="Wyszukaj"
          title="Wyszukaj"
        >
          <Search size={16} />
        </button>
      )}
    </div>
  )
}

/* AddMenu – przycisk + menu z linkami do istniejących tras */
function AddMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const items = [
    { label: 'Nowa faktura', to: '/faktury' },
    { label: 'Nowe zlecenie', to: '/zlecenia' },
    { label: 'Nowy towar', to: '/towary' },
    { label: 'Nowy kontrahent', to: '/kontrahenci' },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors"
        style={{
          background: '#3b82f6',
          color: '#fff',
          minHeight: 36,
          minWidth: 36,
        }}
        aria-label="Dodaj"
      >
        <Plus size={15} />
        <span className="hidden sm:inline">Dodaj</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 rounded-xl shadow-xl py-1.5"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            minWidth: 200,
          }}
        >
          {items.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-center px-4 py-2.5 text-sm transition-colors"
              style={{ color: 'var(--text)', minHeight: 44 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

/* ProfileMenu – avatar + menu */
function ProfileMenu({ user, dark, toggleTheme, handleSignOut }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    function onClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const initial = user?.email ? user.email[0].toUpperCase() : '?'
  const email = user?.email ?? ''

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-full transition-opacity hover:opacity-80"
        style={{ minWidth: 36, minHeight: 36 }}
        aria-label="Profil"
        title={email}
      >
        <div
          className="flex items-center justify-center rounded-full font-bold text-white text-sm flex-shrink-0"
          style={{ width: 34, height: 34, background: '#3b82f6', fontSize: 13 }}
          data-testid="profile-initial"
        >
          {initial}
        </div>
        <ChevronDown size={12} className="hidden sm:block" style={{ color: 'var(--muted)' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 rounded-xl shadow-xl py-1.5"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            minWidth: 220,
          }}
        >
          {/* Email */}
          <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{email}</p>
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => { toggleTheme(); setOpen(false) }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors"
            style={{ color: 'var(--text)', minHeight: 44 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
            <span>{dark ? 'Tryb jasny' : 'Tryb ciemny'}</span>
          </button>

          {/* Ustawienia */}
          <button
            onClick={() => { navigate('/ustawienia'); setOpen(false) }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors"
            style={{ color: 'var(--text)', minHeight: 44 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}
          >
            <Settings size={15} />
            <span>Ustawienia</span>
          </button>

          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />

          {/* Wyloguj */}
          <button
            onClick={() => { handleSignOut(); setOpen(false) }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors"
            style={{ color: '#ef4444', minHeight: 44 }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}
          >
            <LogOut size={15} />
            <span>Wyloguj się</span>
          </button>
        </div>
      )}
    </div>
  )
}

/* Topbar – główny komponent */
export default function Topbar({
  onMenuOpen,
  alertCount,
  user,
  dark,
  toggleTheme,
  handleSignOut,
  workspace,
}) {
  const navigate = useNavigate()
  const workspaceName = workspace?.name ?? 'magzic'
  const workspaceShort = workspaceName.slice(0, 2).toUpperCase()

  return (
    <header
      className="flex items-center gap-2 px-3 lg:px-4 flex-shrink-0"
      style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        height: 56,
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {/* === LEWA === */}
      {/* Menu burger – tylko mobile */}
      <button
        onClick={onMenuOpen}
        className="rounded-lg lg:hidden flex items-center justify-center flex-shrink-0"
        style={{ color: 'var(--muted)', minWidth: 44, minHeight: 44 }}
        aria-label="Otwórz menu"
      >
        <Menu size={20} />
      </button>

      {/* Workspace – mobile: skrót, desktop: pełna nazwa */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Avatar workspace – desktop */}
        <div
          className="hidden lg:flex items-center justify-center rounded-lg font-bold text-white text-xs flex-shrink-0"
          style={{ width: 28, height: 28, background: '#3b82f6', fontFamily: 'DM Mono, monospace' }}
        >
          {workspaceShort}
        </div>
        {/* Mobile: "magzic" / desktop: workspace name */}
        <span
          className="font-semibold"
          style={{ fontSize: 14, color: 'var(--text)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          <span className="lg:hidden">magzic</span>
          <span className="hidden lg:inline">{workspaceName}</span>
        </span>
      </div>

      {/* === SPACER === */}
      <div className="flex-1" />

      {/* === PRAWA === */}
      {/* Selektor daty – ukryty na xs, widoczny od sm */}
      <div className="hidden sm:block">
        <OperationalDatePicker />
      </div>

      {/* Wyszukiwarka */}
      <SearchInput />

      {/* + Dodaj */}
      <AddMenu />

      {/* Powiadomienia – dzwonek z alertCount */}
      <button
        onClick={() => navigate('/alerty')}
        className="relative flex items-center justify-center rounded-lg transition-colors"
        style={{ color: 'var(--text-2)', background: 'var(--hover-bg)', minWidth: 36, minHeight: 36 }}
        aria-label={`Powiadomienia${alertCount > 0 ? ` (${alertCount})` : ''}`}
        title="Alerty"
      >
        <Bell size={16} />
        {alertCount > 0 && (
          <span
            style={{
              position: 'absolute', top: 2, right: 2,
              background: '#ef4444', color: '#fff',
              borderRadius: 10, padding: '0 4px',
              fontSize: 9, fontWeight: 700, lineHeight: '14px',
              minWidth: 14, textAlign: 'center',
            }}
          >
            {alertCount > 99 ? '99+' : alertCount}
          </span>
        )}
      </button>

      {/* Profil */}
      <ProfileMenu
        user={user}
        dark={dark}
        toggleTheme={toggleTheme}
        handleSignOut={handleSignOut}
      />
    </header>
  )
}
