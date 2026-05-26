import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../supabase'
import { formatDate, timeAgo } from '../../utils/adminHelpers'

const ERROR_COLORS = {
  api_error:        '#ef4444',
  app_error:        '#dc2626',
  permission_denied:'#d97706',
  db_error:         '#7c3aed',
  import_error:     '#0891b2',
  export_error:     '#0891b2',
  validation_error: '#d97706',
  unknown:          '#6b7280',
}

const MODULES = ['dashboard', 'invoices', 'inventory', 'contractors', 'reports', 'settings', 'backend']

const PAGE_SIZE = 30

export default function BackendErrors() {
  const [errors, setErrors]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [typeFilter, setType]     = useState('')
  const [moduleFilter, setModule] = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('app_error_logs')
        .select('id, user_id, error_type, message, module_key, action, metadata, created_at, profiles(email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (typeFilter)   q = q.eq('error_type', typeFilter)
      if (moduleFilter) q = q.eq('module_key', moduleFilter)
      if (dateFrom)     q = q.gte('created_at', dateFrom)
      if (dateTo)       q = q.lte('created_at', dateTo + 'T23:59:59')

      const { data, count } = await q
      setErrors(data ?? [])
      setTotal(count ?? 0)
    } catch (err) {
      console.error('[BackendErrors] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter, moduleFilter, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={typeFilter} onChange={e => { setType(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <option value="">Wszystkie typy błędów</option>
          {Object.keys(ERROR_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
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
        <button onClick={() => { setType(''); setModule(''); setDateFrom(''); setDateTo(''); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}>
          Reset
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{total} błędów</span>
          <button onClick={() => load()} className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--muted)', background: 'var(--hover-bg)' }}>Odśwież</button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Ładowanie…</div>
        ) : errors.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm mb-1" style={{ color: 'var(--text)' }}>Brak błędów</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Brak błędów spełniających kryteria. To dobra wiadomość!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Użytkownik', 'Typ błędu', 'Moduł', 'Akcja', 'Komunikat', 'Kiedy'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap"
                      style={{ color: 'var(--muted)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {errors.map(err => (
                  <tr key={err.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>
                      {err.profiles?.email ?? <span style={{ color: 'var(--muted)' }}>anon</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: `${ERROR_COLORS[err.error_type] ?? '#6b7280'}18`,
                          color: ERROR_COLORS[err.error_type] ?? '#6b7280',
                        }}>
                        {err.error_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{err.module_key ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>{err.action ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text)', maxWidth: 300 }}>
                      <span title={err.message}>{err.message?.slice(0, 80)}{err.message?.length > 80 ? '…' : ''}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                      <span title={formatDate(err.created_at)}>{timeAgo(err.created_at)}</span>
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
