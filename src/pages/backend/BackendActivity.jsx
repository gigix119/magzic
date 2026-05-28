import { useEffect, useState, useCallback } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '../../supabase'
import { formatDate, timeAgo } from '../../utils/adminHelpers'

const EVENT_COLORS = {
  auth_login:        '#16a34a',
  auth_logout:       '#6b7280',
  page_view:         '#3b82f6',
  permission_denied: '#ef4444',
  error:             '#dc2626',
  create:            '#059669',
  update:            '#d97706',
  delete:            '#ef4444',
  button_click:      '#7c3aed',
  export:            '#0891b2',
}

const EVENT_TYPES = [
  'auth_login', 'auth_logout', 'page_view', 'button_click',
  'create', 'update', 'delete', 'export', 'permission_denied', 'error',
]

const MODULES = ['dashboard', 'invoices', 'inventory', 'contractors', 'reports', 'settings', 'backend']

const PAGE_SIZE = 30

export default function BackendActivity() {
  const [events, setEvents]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [search, setSearch]       = useState('')
  const [typeFilter, setType]     = useState('')
  const [moduleFilter, setModule] = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('app_events')
        .select('id, user_id, event_type, module_key, action, entity_type, entity_id, created_at, metadata, profiles(email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (typeFilter)   q = q.eq('event_type', typeFilter)
      if (moduleFilter) q = q.eq('module_key', moduleFilter)
      if (dateFrom)     q = q.gte('created_at', dateFrom)
      if (dateTo)       q = q.lte('created_at', dateTo + 'T23:59:59')

      const { data, count } = await q
      setEvents(data ?? [])
      setTotal(count ?? 0)
    } catch (err) {
      console.error('[BackendActivity] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter, moduleFilter, dateFrom, dateTo])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const filteredBySearch = search
    ? events.filter(ev =>
        (ev.profiles?.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        ev.action.toLowerCase().includes(search.toLowerCase())
      )
    : events

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative" style={{ minWidth: 180, flex: 1 }}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj email, akcja…"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
        <select value={typeFilter} onChange={e => { setType(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <option value="">Wszystkie typy</option>
          {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={moduleFilter} onChange={e => { setModule(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <option value="">Wszystkie moduły</option>
          {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <button onClick={() => { setType(''); setModule(''); setDateFrom(''); setDateTo(''); setSearch(''); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}>
          Reset
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {total} event{total !== 1 ? 'ów' : ''}
          </span>
          <button onClick={() => load()} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--muted)', background: 'var(--hover-bg)' }}>
            Odśwież
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Ładowanie…</div>
        ) : filteredBySearch.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Brak eventów spełniających kryteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Email', 'Typ eventu', 'Moduł', 'Akcja', 'Encja', 'Kiedy'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap"
                      style={{ color: 'var(--muted)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredBySearch.map(ev => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>
                      {ev.profiles?.email ?? <span style={{ color: 'var(--muted)' }}>anon</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: `${EVENT_COLORS[ev.event_type] ?? '#6b7280'}18`,
                          color: EVENT_COLORS[ev.event_type] ?? '#6b7280',
                        }}>
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{ev.module_key ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text)' }}>{ev.action}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>
                      {ev.entity_type ? `${ev.entity_type}${ev.entity_id ? ' #' + ev.entity_id.slice(0, 8) : ''}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                      <span title={formatDate(ev.created_at)}>{timeAgo(ev.created_at)}</span>
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
