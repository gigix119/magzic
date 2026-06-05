import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronRight, Users, UserCheck, Calendar, RefreshCw } from 'lucide-react'
import { supabase } from '../../supabase'
import { trackAdminAudit, formatDate, timeAgo, ROLE_LABELS, STATUS_LABELS } from '../../utils/adminHelpers'
import { getCategoryLabel } from '../../config/businessTypes'

const ROLE_COLORS   = { owner: '#7c3aed', admin: '#3b82f6', user: '#6b7280' }
const STATUS_COLORS = { active: '#16a34a', blocked: '#ef4444', pending: '#d97706' }

function Badge({ label, color }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: `${color}18`, color }}
    >
      {label}
    </span>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div
        className="rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ width: 36, height: 36, background: `${color}18` }}
      >
        <Icon size={16} style={{ color }} />
      </div>
      <div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
        <p className="font-bold text-lg leading-tight" style={{ color: 'var(--text)' }}>
          {value === null ? '…' : value}
        </p>
      </div>
    </div>
  )
}

const PAGE_SIZE = 20

export default function BackendUsers() {
  const [users, setUsers]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [roleFilter, setRole]         = useState('')
  const [statusFilter, setStatus]     = useState('')
  const [createdFilter, setCreated]   = useState('')   // '' | '7' | '30' | '90'
  const [activityFilter, setActivity] = useState('')   // '' | '1' | '7' | '30'
  const [page, setPage]               = useState(0)

  useEffect(() => {
    trackAdminAudit({ action: 'users_list_viewed' })
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const [{ data: profs }, { data: wks }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, first_name, last_name, display_name, role, status, created_at, last_login_at, last_seen_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('workspaces')
          .select('owner_user_id, company_name, business_category, business_profile_completed'),
      ])
      const wksByOwner = Object.fromEntries((wks ?? []).map(w => [w.owner_user_id, w]))
      setUsers((profs ?? []).map(p => ({ ...p, workspace: wksByOwner[p.id] ?? null })))
    } catch (err) {
      console.error('[BackendUsers] loadUsers error:', err)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const now = Date.now()
    return {
      total:   users.length,
      active:  users.filter(u => u.status === 'active').length,
      new7:    users.filter(u => u.created_at && new Date(u.created_at) > new Date(now - 7 * 86400000)).length,
      seen24h: users.filter(u => u.last_seen_at && new Date(u.last_seen_at) > new Date(now - 86400000)).length,
    }
  }, [users])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const now = Date.now()
    const createdCutoff  = createdFilter  ? new Date(now - parseInt(createdFilter)  * 86400000) : null
    const activityCutoff = activityFilter ? new Date(now - parseInt(activityFilter) * 86400000) : null

    return users.filter(u => {
      if (q && !(
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.first_name ?? '').toLowerCase().includes(q) ||
        (u.last_name ?? '').toLowerCase().includes(q) ||
        (u.display_name ?? '').toLowerCase().includes(q)
      )) return false
      if (roleFilter   && u.role   !== roleFilter)   return false
      if (statusFilter && u.status !== statusFilter) return false
      if (createdCutoff  && (!u.created_at  || new Date(u.created_at)  < createdCutoff))  return false
      if (activityCutoff && (!u.last_seen_at || new Date(u.last_seen_at) < activityCutoff)) return false
      return true
    })
  }, [users, search, roleFilter, statusFilter, createdFilter, activityFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const anyFilter = search || roleFilter || statusFilter || createdFilter || activityFilter

  function clearFilters() {
    setSearch(''); setRole(''); setStatus('')
    setCreated(''); setActivity(''); setPage(0)
  }

  function displayName(u) {
    if (u.display_name) return u.display_name
    const full = [u.first_name, u.last_name].filter(Boolean).join(' ')
    return full || '—'
  }

  return (
    <div className="space-y-4">

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users}    label="Wszyscy"        value={stats.total}   color="#3b82f6" />
        <StatCard icon={UserCheck} label="Aktywni"       value={stats.active}  color="#16a34a" />
        <StatCard icon={Calendar} label="Nowi (7 dni)"   value={stats.new7}    color="#059669" />
        <StatCard icon={RefreshCw} label="Aktywni (24h)" value={stats.seen24h} color="#7c3aed" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Email search */}
        <div className="relative" style={{ flex: '1 1 180px' }}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Szukaj email, imię…"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
          />
        </div>

        {/* Role */}
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

        {/* Status */}
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

        {/* Created at */}
        <select
          value={createdFilter}
          onChange={e => { setCreated(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          <option value="">Data założenia: cały okres</option>
          <option value="7">Założone w ciągu 7 dni</option>
          <option value="30">Założone w ciągu 30 dni</option>
          <option value="90">Założone w ciągu 90 dni</option>
        </select>

        {/* Last activity */}
        <select
          value={activityFilter}
          onChange={e => { setActivity(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          <option value="">Aktywność: cały okres</option>
          <option value="1">Aktywni w ostatnich 24h</option>
          <option value="7">Aktywni w ostatnich 7 dniach</option>
          <option value="30">Aktywni w ostatnich 30 dniach</option>
        </select>

        {anyFilter && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}
          >
            Wyczyść
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {filtered.length} użytkownik{filtered.length === 1 ? '' : filtered.length < 5 ? 'i' : 'ów'}
            {anyFilter && <span className="ml-1 text-xs font-normal" style={{ color: 'var(--muted)' }}>(z filtrami)</span>}
          </span>
          <button
            onClick={loadUsers}
            className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--muted)', background: 'var(--hover-bg)' }}
          >
            Odśwież
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Ładowanie…</div>
        ) : paged.length === 0 ? (
          <div className="py-16 text-center" style={{ color: 'var(--muted)' }}>
            <p className="text-sm">Brak użytkowników spełniających kryteria.</p>
            {anyFilter && (
              <button onClick={clearFilters} className="mt-2 text-xs underline" style={{ color: '#7c3aed' }}>
                Wyczyść filtry
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Email', 'Imię i nazwisko', 'Firma', 'Branża', 'Rola', 'Status', 'Konto założone', 'Ostatnie logowanie', 'Ostatnia aktywność', ''].map(h => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left font-medium whitespace-nowrap"
                      style={{ color: 'var(--muted)', fontSize: 12 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(u => (
                  <tr
                    key={u.id}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    className="hover:bg-[var(--hover-bg)] transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text)' }}>{u.email}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-2)' }}>{displayName(u)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-2)' }}>{u.workspace?.company_name || '—'}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                      {u.workspace
                        ? <>{u.workspace.business_profile_completed
                            ? <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold mr-1" style={{ background: '#16a34a18', color: '#16a34a' }}>✓</span>
                            : <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold mr-1" style={{ background: '#d9770618', color: '#d97706' }}>—</span>
                          }{getCategoryLabel(u.workspace.business_category)}</>
                        : '—'
                      }
                    </td>
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
                      <Link
                        to={`/backend/users/${u.id}`}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
                        style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}
                        onClick={() => trackAdminAudit({ action: 'user_viewed', targetUserId: u.id, metadata: { email: u.email } })}
                      >
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
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded text-xs disabled:opacity-40"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}
              >
                ← Poprzednia
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded text-xs disabled:opacity-40"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}
              >
                Następna →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
