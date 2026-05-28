import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../supabase'
import { formatDate, timeAgo } from '../../utils/adminHelpers'

const AUDIT_ACTION_COLORS = {
  backend_opened:           '#7c3aed',
  user_viewed:              '#3b82f6',
  user_blocked:             '#ef4444',
  user_unblocked:           '#16a34a',
  role_changed:             '#d97706',
  permissions_changed:      '#0891b2',
  password_reset_link_sent: '#6b7280',
  system_setting_changed:   '#7c3aed',
}

const PAGE_SIZE = 30

export default function BackendAudit() {
  const [logs, setLogs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [actionFilter, setAction] = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('admin_audit_logs')
        .select(`
          id, action, metadata, created_at,
          admin:profiles!admin_audit_logs_admin_user_id_fkey(email),
          target:profiles!admin_audit_logs_target_user_id_fkey(email)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (actionFilter) q = q.eq('action', actionFilter)
      if (dateFrom)     q = q.gte('created_at', dateFrom)
      if (dateTo)       q = q.lte('created_at', dateTo + 'T23:59:59')

      const { data, count } = await q
      setLogs(data ?? [])
      setTotal(count ?? 0)
    } catch (err) {
      console.error('[BackendAudit] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter, dateFrom, dateTo])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const ACTION_LABELS = {
    backend_opened:           'Otwarto backend',
    user_viewed:              'Wyświetlono użytkownika',
    user_blocked:             'Zablokowano konto',
    user_unblocked:           'Odblokowano konto',
    role_changed:             'Zmieniono rolę',
    permissions_changed:      'Zmieniono uprawnienia',
    password_reset_link_sent: 'Wysłano reset hasła',
    users_list_viewed:        'Wyświetlono listę użytkowników',
    system_setting_changed:   'Zmieniono ustawienia systemowe',
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={actionFilter} onChange={e => { setAction(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <option value="">Wszystkie akcje</option>
          {Object.keys(ACTION_LABELS).map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a]}</option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <button onClick={() => { setAction(''); setDateFrom(''); setDateTo(''); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}>
          Reset
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{total} wpisów</span>
          <button onClick={() => load()} className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--muted)', background: 'var(--hover-bg)' }}>Odśwież</button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Ładowanie…</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Brak wpisów audit log.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Administrator', 'Dotyczy użytkownika', 'Akcja', 'Szczegóły', 'Kiedy'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap"
                      style={{ color: 'var(--muted)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>
                      {log.admin?.email ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--muted)' }}>
                      {log.target?.email ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: `${AUDIT_ACTION_COLORS[log.action] ?? '#6b7280'}18`,
                          color: AUDIT_ACTION_COLORS[log.action] ?? '#6b7280',
                        }}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)', maxWidth: 240 }}>
                      {Object.keys(log.metadata ?? {}).length > 0
                        ? Object.entries(log.metadata)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                      <span title={formatDate(log.created_at)}>{timeAgo(log.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Strona {page + 1} z {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded text-xs disabled:opacity-40"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}>← Poprzednia</button>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded text-xs disabled:opacity-40"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}>Następna →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
