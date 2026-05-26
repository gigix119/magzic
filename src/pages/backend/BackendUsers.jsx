import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronRight } from 'lucide-react'
import { supabase } from '../../supabase'
import { trackAdminAudit, formatDate, timeAgo, ROLE_LABELS, STATUS_LABELS } from '../../utils/adminHelpers'

const ROLE_COLORS  = { owner: '#7c3aed', admin: '#3b82f6', user: '#6b7280' }
const STATUS_COLORS = { active: '#16a34a', blocked: '#ef4444', pending: '#d97706' }

function Badge({ label, color }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: `${color}18`, color }}>
      {label}
    </span>
  )
}

const PAGE_SIZE = 20

export default function BackendUsers() {
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [roleFilter, setRole]   = useState('')
  const [statusFilter, setStatus] = useState('')
  const [page, setPage]         = useState(0)

  useEffect(() => {
    trackAdminAudit({ action: 'users_list_viewed' })
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, display_name, role, status, created_at, last_login_at, last_seen_at')
        .order('created_at', { ascending: false })
      setUsers(data ?? [])
    } catch (err) {
      console.error('[BackendUsers] loadUsers error:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const nameMatch = q
      ? (u.email ?? '').toLowerCase().includes(q) ||
        (u.first_name ?? '').toLowerCase().includes(q) ||
        (u.last_name ?? '').toLowerCase().includes(q) ||
        (u.display_name ?? '').toLowerCase().includes(q)
      : true
    const roleMatch   = roleFilter   ? u.role   === roleFilter   : true
    const statusMatch = statusFilter ? u.status === statusFilter : true
    return nameMatch && roleMatch && statusMatch
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function displayName(u) {
    if (u.display_name) return u.display_name
    const full = [u.first_name, u.last_name].filter(Boolean).join(' ')
    return full || '—'
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1" style={{ minWidth: 180 }}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Szukaj email, imię…"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRole(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          <option value="">Wszystkie role</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatus(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          <option value="">Wszystkie statusy</option>
          <option value="active">Aktywny</option>
          <option value="blocked">Zablokowany</option>
          <option value="pending">Oczekuje</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {filtered.length} użytkownik{filtered.length === 1 ? '' : filtered.length < 5 ? 'ów' : 'ów'}
          </span>
          <button onClick={loadUsers} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--muted)', background: 'var(--hover-bg)' }}>
            Odśwież
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Ładowanie…</div>
        ) : paged.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Brak użytkowników spełniających kryteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Email', 'Imię i nazwisko', 'Rola', 'Status', 'Konto założone', 'Ostatnie logowanie', 'Ostatnia aktywność', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap"
                      style={{ color: 'var(--muted)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}
                    className="hover:bg-[var(--hover-bg)] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text)' }}>{u.email}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-2)' }}>{displayName(u)}</td>
                    <td className="px-4 py-3">
                      <Badge label={ROLE_LABELS[u.role] ?? u.role} color={ROLE_COLORS[u.role] ?? '#6b7280'} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={STATUS_LABELS[u.status] ?? u.status} color={STATUS_COLORS[u.status] ?? '#6b7280'} />
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>{timeAgo(u.last_login_at)}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>{timeAgo(u.last_seen_at)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/backend/users/${u.id}`}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
                        style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}
                        onClick={() => trackAdminAudit({ action: 'user_viewed', targetUserId: u.id, metadata: { email: u.email } })}>
                        Szczegóły <ChevronRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              Strona {page + 1} z {totalPages}
            </span>
            <div className="flex gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded text-xs disabled:opacity-40"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}>
                ← Poprzednia
              </button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded text-xs disabled:opacity-40"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}>
                Następna →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
