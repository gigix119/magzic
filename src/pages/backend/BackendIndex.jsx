import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Activity, ShieldCheck, AlertTriangle, ScrollText, TrendingUp } from 'lucide-react'
import { supabase } from '../../supabase'
import { trackEvent, trackAdminAudit, formatDate, timeAgo } from '../../utils/adminHelpers'

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

function StatCard({ icon: Icon, label, value, color, to }) {
  const card = (
    <div
      className="rounded-xl p-4 flex items-center gap-4"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ width: 44, height: 44, background: `${color}18` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{label}</p>
        <p className="font-bold text-xl" style={{ color: 'var(--text)' }}>
          {value === null ? '…' : value}
        </p>
      </div>
    </div>
  )
  return to ? <Link to={to} className="block hover:opacity-90 transition-opacity">{card}</Link> : card
}

export default function BackendIndex() {
  const [stats, setStats] = useState({ users: null, active: null, events: null, errors: null })
  const [recentEvents, setRecentEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    trackEvent({ eventType: 'page_view', moduleKey: 'backend', action: 'backend_opened' })
    trackAdminAudit({ action: 'backend_opened' })
    loadData()
  }, [])

  async function loadData() {
    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const [
        { count: usersCount },
        { count: activeCount },
        { count: eventsCount },
        { count: errorsCount },
        { data: events },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('app_events').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
        supabase.from('app_error_logs').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
        supabase.from('app_events')
          .select('id, user_id, event_type, module_key, action, created_at, profiles(email, first_name, last_name)')
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      setStats({
        users:  usersCount ?? 0,
        active: activeCount ?? 0,
        events: eventsCount ?? 0,
        errors: errorsCount ?? 0,
      })
      setRecentEvents(events ?? [])
    } catch (err) {
      console.error('[BackendIndex] loadData error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-6 lg:grid-cols-4">
        <StatCard icon={Users}         label="Wszyscy użytkownicy" value={stats.users}  color="#3b82f6" to="/backend/users" />
        <StatCard icon={TrendingUp}    label="Aktywni"             value={stats.active} color="#16a34a" to="/backend/users" />
        <StatCard icon={Activity}      label="Eventy (24h)"        value={stats.events} color="#7c3aed" to="/backend/activity" />
        <StatCard icon={AlertTriangle} label="Błędy (24h)"         value={stats.errors} color="#ef4444" to="/backend/errors" />
      </div>

      {/* Recent activity */}
      <div className="rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Ostatnia aktywność</span>
          <Link to="/backend/activity" className="text-xs" style={{ color: '#7c3aed' }}>
            Zobacz wszystkie →
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--muted)' }}>Ładowanie…</div>
        ) : recentEvents.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Brak zarejestrowanych eventów. Aktywność pojawi się tutaj automatycznie.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Użytkownik', 'Typ eventu', 'Moduł', 'Akcja', 'Kiedy'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentEvents.map(ev => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text)' }}>
                      {ev.profiles?.email ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: `${EVENT_TYPE_COLORS[ev.event_type] ?? '#6b7280'}18`,
                          color: EVENT_TYPE_COLORS[ev.event_type] ?? '#6b7280'
                        }}>
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{ev.module_key ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>{ev.action}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{timeAgo(ev.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 mt-4 lg:grid-cols-3">
        {[
          { to: '/backend/users',       icon: Users,       label: 'Zarządzaj użytkownikami',  desc: 'Role, blokady, szczegóły' },
          { to: '/backend/permissions', icon: ShieldCheck, label: 'Uprawnienia do modułów',   desc: 'Per-user, per-module' },
          { to: '/backend/audit',       icon: ScrollText,  label: 'Audit log administratora', desc: 'Historia działań admin' },
        ].map(({ to, icon: Icon, label, desc }) => (
          <Link key={to} to={to}
            className="rounded-xl p-4 flex gap-3 hover:opacity-90 transition-opacity"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <Icon size={18} style={{ color: '#7c3aed', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
