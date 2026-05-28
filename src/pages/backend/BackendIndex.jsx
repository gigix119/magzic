import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, Activity, ShieldCheck, AlertTriangle, ScrollText,
  UserCheck, UserX, Calendar, Clock, TrendingUp,
} from 'lucide-react'
import { supabase } from '../../supabase'
import { trackEvent, trackAdminAudit, timeAgo, ROLE_LABELS, STATUS_LABELS } from '../../utils/adminHelpers'

const ROLE_COLORS = { owner: '#7c3aed', admin: '#3b82f6', user: '#6b7280' }
const STATUS_COLORS = { active: '#16a34a', blocked: '#ef4444', pending: '#d97706' }
const EVENT_TYPE_COLORS = {
  auth_login:        '#16a34a',
  auth_logout:       '#6b7280',
  page_view:         '#3b82f6',
  permission_denied: '#ef4444',
  error:             '#dc2626',
  create:            '#059669',
  update:            '#d97706',
  delete:            '#ef4444',
}

function StatCard({ icon: Icon, label, value, color, sub, to }) {
  const inner = (
    <div
      className="rounded-xl p-4 flex items-center gap-3 h-full"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div
        className="rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ width: 40, height: 40, background: `${color}18` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{label}</p>
        <p className="font-bold text-xl leading-tight" style={{ color: 'var(--text)' }}>
          {value === null ? '…' : value}
        </p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</p>}
      </div>
    </div>
  )
  return to
    ? <Link to={to} className="block hover:opacity-90 transition-opacity">{inner}</Link>
    : inner
}

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

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
      {children}
    </p>
  )
}

export default function BackendIndex() {
  const [stats, setStats] = useState({
    total: null, active: null, blocked: null, pending: null,
    owners: null, admins: null, regularUsers: null,
    new7: null, new30: null, seen24h: null, seen7d: null,
    events24h: null, errors24h: null,
  })
  const [recentUsers, setRecentUsers]   = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)

  useEffect(() => {
    trackEvent({ eventType: 'page_view', moduleKey: 'backend', action: 'backend_opened' })
    trackAdminAudit({ action: 'backend_opened' })
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const now    = Date.now()
      const s24h   = new Date(now - 86400000).toISOString()
      const s7d    = new Date(now - 7 * 86400000).toISOString()
      const s30d   = new Date(now - 30 * 86400000).toISOString()

      const [
        { count: total },
        { count: activeCount },
        { count: blockedCount },
        { count: pendingCount },
        { count: ownerCount },
        { count: adminCount },
        { count: userCount },
        { count: new7Count },
        { count: new30Count },
        { count: seen24hCount },
        { count: seen7dCount },
        { count: events24h },
        { count: errors24h },
        { data: usersData },
        { data: eventsData },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'blocked'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'owner'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'user'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', s7d),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', s30d),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_seen_at', s24h),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_seen_at', s7d),
        supabase.from('app_events').select('id', { count: 'exact', head: true }).gte('created_at', s24h),
        supabase.from('app_error_logs').select('id', { count: 'exact', head: true }).gte('created_at', s24h),
        supabase.from('profiles')
          .select('id, email, first_name, last_name, role, status, created_at, last_login_at, last_seen_at')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.from('app_events')
          .select('id, event_type, module_key, action, created_at, profiles(email)')
          .order('created_at', { ascending: false })
          .limit(8),
      ])

      setStats({
        total: total ?? 0, active: activeCount ?? 0, blocked: blockedCount ?? 0, pending: pendingCount ?? 0,
        owners: ownerCount ?? 0, admins: adminCount ?? 0, regularUsers: userCount ?? 0,
        new7: new7Count ?? 0, new30: new30Count ?? 0,
        seen24h: seen24hCount ?? 0, seen7d: seen7dCount ?? 0,
        events24h: events24h ?? 0, errors24h: errors24h ?? 0,
      })
      setRecentUsers(usersData ?? [])
      setRecentEvents(eventsData ?? [])
    } catch (err) {
      console.error('[BackendIndex] loadData error:', err)
      setError('Nie udało się załadować danych. Sprawdź uprawnienia RLS lub połączenie z Supabase.')
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return (
      <div className="rounded-xl p-6" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
        <p className="font-semibold text-sm" style={{ color: '#dc2626' }}>Błąd ładowania danych</p>
        <p className="text-sm mt-1" style={{ color: '#991b1b' }}>{error}</p>
        <button
          onClick={loadData}
          className="mt-3 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#dc2626', color: '#fff' }}
        >
          Spróbuj ponownie
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* === SEKCJA: Użytkownicy === */}
      <div>
        <SectionLabel>Użytkownicy — łącznie</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Users}     label="Wszyscy użytkownicy"   value={stats.total}   color="#3b82f6" to="/backend/users" />
          <StatCard icon={UserCheck} label="Aktywni"                value={stats.active}  color="#16a34a" to="/backend/users" />
          <StatCard icon={UserX}     label="Zablokowani"            value={stats.blocked} color="#ef4444" to="/backend/users" />
          <StatCard
            icon={ShieldCheck}
            label="Ownerzy / Adminowie / Userzy"
            value={stats.owners !== null ? `${stats.owners} / ${stats.admins} / ${stats.regularUsers}` : null}
            color="#7c3aed"
          />
        </div>
      </div>

      {/* === SEKCJA: Wzrost i aktywność === */}
      <div>
        <SectionLabel>Wzrost i aktywność</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Calendar}   label="Nowi użytkownicy (7 dni)"  value={stats.new7}    color="#059669" />
          <StatCard icon={Calendar}   label="Nowi użytkownicy (30 dni)" value={stats.new30}   color="#0891b2" />
          <StatCard icon={Clock}      label="Aktywni ostatnie 24h"       value={stats.seen24h} color="#7c3aed" />
          <StatCard icon={TrendingUp} label="Aktywni ostatnie 7 dni"     value={stats.seen7d}  color="#d97706" />
        </div>
      </div>

      {/* === SEKCJA: System 24h === */}
      <div>
        <SectionLabel>System — ostatnie 24h</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Activity}      label="Eventy (24h)"    value={stats.events24h} color="#7c3aed" to="/backend/activity" />
          <StatCard icon={AlertTriangle} label="Błędy (24h)"     value={stats.errors24h} color="#ef4444" to="/backend/errors" />
          <StatCard icon={ScrollText}    label="Audit log"        value="→" color="#6b7280" to="/backend/audit" />
          <StatCard icon={ShieldCheck}   label="Uprawnienia"      value="→" color="#3b82f6" to="/backend/permissions" />
        </div>
      </div>

      {/* === DWA PANELE: Ostatnio dodani / Ostatnia aktywność === */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Ostatnio utworzeni użytkownicy */}
        <div className="rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Ostatnio utworzeni użytkownicy</span>
            <Link to="/backend/users" className="text-xs" style={{ color: '#7c3aed' }}>Wszyscy →</Link>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>Ładowanie…</div>
          ) : recentUsers.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
              Brak użytkowników. Pojawią się tu po pierwszej rejestracji.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Email', 'Rola', 'Status', 'Założono', 'Ostatnia aktywność'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap"
                        style={{ color: 'var(--muted)', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-3 py-2.5 font-mono text-xs max-w-[150px] truncate" style={{ color: 'var(--text)' }} title={u.email}>
                        {u.email}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge label={ROLE_LABELS[u.role] ?? u.role} color={ROLE_COLORS[u.role] ?? '#6b7280'} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge label={STATUS_LABELS[u.status] ?? u.status} color={STATUS_COLORS[u.status] ?? '#6b7280'} />
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                        {timeAgo(u.created_at)}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                        {timeAgo(u.last_seen_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Ostatnia aktywność */}
        <div className="rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Ostatnia aktywność użytkowników</span>
            <Link to="/backend/activity" className="text-xs" style={{ color: '#7c3aed' }}>Wszystkie →</Link>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>Ładowanie…</div>
          ) : recentEvents.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
              Brak zarejestrowanych eventów. Pojawią się tu automatycznie po akcjach użytkowników.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Email', 'Typ', 'Moduł', 'Akcja', 'Kiedy'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap"
                        style={{ color: 'var(--muted)', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map(ev => (
                    <tr key={ev.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-3 py-2.5 font-mono text-xs max-w-[120px] truncate" style={{ color: 'var(--text)' }}
                        title={ev.profiles?.email}>
                        {ev.profiles?.email ?? '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            background: `${EVENT_TYPE_COLORS[ev.event_type] ?? '#6b7280'}18`,
                            color: EVENT_TYPE_COLORS[ev.event_type] ?? '#6b7280',
                          }}
                        >
                          {ev.event_type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{ev.module_key ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>{ev.action}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>{timeAgo(ev.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div>
        <SectionLabel>Zarządzanie</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { to: '/backend/users',       icon: Users,       label: 'Zarządzaj użytkownikami',  desc: 'Role, blokady, szczegóły konta' },
            { to: '/backend/permissions', icon: ShieldCheck, label: 'Uprawnienia modułów',       desc: 'Per-user, per-module' },
            { to: '/backend/audit',       icon: ScrollText,  label: 'Audit log',                 desc: 'Historia działań administratora' },
          ].map(({ to, icon: Icon, label, desc }) => (
            <Link
              key={to} to={to}
              className="rounded-xl p-4 flex gap-3 hover:opacity-90 transition-opacity"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <Icon size={18} style={{ color: '#7c3aed', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
