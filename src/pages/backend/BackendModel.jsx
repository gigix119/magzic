import { useEffect, useState, useCallback } from 'react'
import {
  Brain, Settings2, ScrollText, GitFork, ListChecks, Wrench,
  RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, TrendingUp,
} from 'lucide-react'
import { supabase } from '../../supabase'
import InvoiceLearningDebugPanel from '../../components/InvoiceLearningDebugPanel'
import { getInvoiceModelConfig } from '../../utils/invoiceModelConfig'
import { getCorrectionStats } from '../../utils/invoiceCorrectionTracker'
import { getInvoiceTrainingExamples } from '../../utils/invoiceLearning'
import { trackAdminAudit } from '../../utils/adminHelpers'
import { formatDate, timeAgo } from '../../utils/adminHelpers'

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  success:       '#16a34a',
  partial:       '#d97706',
  failed:        '#ef4444',
  review_needed: '#7c3aed',
  pending:       '#6b7280',
  completed:     '#16a34a',
  running:       '#3b82f6',
}

const CORRECTION_STATUS_COLORS = {
  pending:           '#6b7280',
  approved:          '#16a34a',
  rejected:          '#ef4444',
  used_for_training: '#7c3aed',
}

const PRIORITY_COLORS = {
  low:      '#6b7280',
  normal:   '#3b82f6',
  high:     '#d97706',
  critical: '#ef4444',
}

const MODE_META = {
  off:    { label: 'Wyłączony',   color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  shadow: { label: 'Shadow',      color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  active: { label: 'Aktywny',     color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
}

const PAGE_SIZE = 25

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color = '#3b82f6', source }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between mb-2">
        <div className="rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ width: 36, height: 36, background: `${color}18` }}>
          <Icon size={16} style={{ color }} />
        </div>
        {source && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--hover-bg)', color: 'var(--muted)', fontSize: 10 }}>
            {source}
          </span>
        )}
      </div>
      <p className="font-bold text-xl mt-1" style={{ color: 'var(--text)' }}>
        {value === null || value === undefined ? '…' : value}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{label}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)', opacity: 0.7 }}>{sub}</p>}
    </div>
  )
}

function Badge({ label, color }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: `${color}18`, color }}>
      {label}
    </span>
  )
}

function TabBtn({ id, active, onClick, icon: Icon, label }) {
  return (
    <button onClick={() => onClick(id)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors"
      style={active
        ? { background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }
        : { color: 'var(--text-2)' }}>
      <Icon size={14} /> {label}
    </button>
  )
}

// ── Tab: Overview ────────────────────────────────────────────────────────────

function TabOverview() {
  const [dbStats, setDbStats]   = useState(null)
  const [lsConfig, setLsConfig] = useState(null)
  const [lsStats, setLsStats]   = useState(null)

  useEffect(() => {
    // Load localStorage stats
    try {
      setLsConfig(getInvoiceModelConfig())
      const corrStats = getCorrectionStats()
      const trainingEx = getInvoiceTrainingExamples()
      setLsStats({ corrStats, trainingCount: (trainingEx ?? []).length })
    } catch { /* ignore */ }

    // Load Supabase stats
    loadDbStats()
  }, [])

  async function loadDbStats() {
    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const [
        { count: logsTotal },
        { count: logs24h },
        { count: correctionsTotal },
        { count: queuePending },
        { count: runsTotal },
      ] = await Promise.all([
        supabase.from('invoice_extraction_logs').select('id', { count: 'exact', head: true }),
        supabase.from('invoice_extraction_logs').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
        supabase.from('invoice_user_corrections').select('id', { count: 'exact', head: true }),
        supabase.from('invoice_model_review_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('invoice_model_runs').select('id', { count: 'exact', head: true }),
      ])
      setDbStats({ logsTotal, logs24h, correctionsTotal, queuePending, runsTotal })
    } catch { /* ignore */ }
  }

  const mode = lsConfig?.mode ?? 'off'
  const modeMeta = MODE_META[mode] ?? MODE_META.off

  return (
    <div>
      {/* Model status banner */}
      <div className="rounded-xl p-4 mb-5 flex items-center gap-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <Brain size={28} style={{ color: '#7c3aed', flexShrink: 0 }} />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold" style={{ color: 'var(--text)' }}>Model ekstrakcji faktur</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold" style={{ background: modeMeta.bg, color: modeMeta.color }}>
              {modeMeta.label}
            </span>
            {lsConfig?.version && (
              <span className="text-xs" style={{ color: 'var(--muted)' }}>v{lsConfig.version}</span>
            )}
          </div>
          <div className="flex gap-4 mt-1 text-xs flex-wrap" style={{ color: 'var(--muted)' }}>
            {lsConfig?.trainedAt && <span>Ostatni trening: {timeAgo(lsConfig.trainedAt)}</span>}
            {lsConfig?.trainedOn && (
              <span>
                Próbki: {lsConfig.trainedOn.goldenSamples ?? 0} golden +{' '}
                {lsConfig.trainedOn.correctionEvents ?? 0} korekt
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-xs" style={{ color: 'var(--muted)' }}>
          <div>Grid search</div>
          <div>21 wag · 6 progów</div>
        </div>
      </div>

      {/* Stats: localStorage */}
      <p className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
        Dane lokalne (localStorage)
      </p>
      <div className="grid grid-cols-2 gap-3 mb-5 lg:grid-cols-4">
        <StatCard icon={GitFork}   label="Przykłady treningowe"  value={lsStats?.trainingCount ?? '…'}                         color="#7c3aed" source="local" />
        <StatCard icon={ListChecks} label="Zdarzenia korekt"     value={lsStats?.corrStats?.totalEvents ?? '…'}                color="#3b82f6" source="local" />
        <StatCard icon={TrendingUp} label="Łącznie korekt"       value={lsStats?.corrStats?.totalCorrections ?? '…'}           color="#16a34a" source="local" />
        <StatCard icon={Settings2}  label="Wagi modelu"          value={lsConfig ? '21 aktywnych' : '…'}                      color="#d97706" source="local" />
      </div>

      {/* Stats: Supabase */}
      <p className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
        Dane globalne (Supabase DB)
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ScrollText}   label="Logi ekstrakcji (łącznie)"  value={dbStats?.logsTotal ?? '…'}     color="#3b82f6" source="DB" />
        <StatCard icon={ScrollText}   label="Logi ekstrakcji (24h)"      value={dbStats?.logs24h ?? '…'}       color="#7c3aed" source="DB" />
        <StatCard icon={ListChecks}   label="Korekty użytkowników"       value={dbStats?.correctionsTotal ?? '…'} color="#16a34a" source="DB" />
        <StatCard icon={AlertTriangle} label="Do review (pending)"       value={dbStats?.queuePending ?? '…'}  color="#ef4444" source="DB" />
      </div>

      {dbStats?.logsTotal === 0 && (
        <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', color: '#3b82f6' }}>
          Logi DB są puste — dane pojawią się tu automatycznie po zintegrowaniu <code>logExtraction()</code> i <code>logCorrection()</code> z funkcjami ekstrakcji faktur. Szczegóły: <code>src/utils/modelLogger.js</code>.
        </div>
      )}
    </div>
  )
}

// ── Tab: Extraction Logs ─────────────────────────────────────────────────────

function TabLogs() {
  const [logs, setLogs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [statusFilter, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('invoice_extraction_logs')
        .select('id, user_id, file_name, supplier_name, supplier_nip, extraction_status, confidence_total, processing_time_ms, error_message, created_at, profiles(email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (statusFilter) q = q.eq('extraction_status', statusFilter)

      const { data, count } = await q
      setLogs(data ?? [])
      setTotal(count ?? 0)
    } catch { /* ignore */ }
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <option value="">Wszystkie statusy</option>
          {['success', 'partial', 'failed', 'review_needed', 'pending'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={() => load()} className="px-3 py-2 rounded-lg text-sm flex items-center gap-1"
          style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}>
          <RefreshCw size={13} /> Odśwież
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="px-4 py-3 text-sm font-semibold" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
          {total} log{total === 1 ? '' : 'ów'} ekstrakcji
        </div>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Ładowanie…</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Brak logów ekstrakcji. Dane pojawią się po zintegrowaniu <code>logExtraction()</code>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Użytkownik', 'Plik', 'Dostawca', 'Status', 'Confidence', 'Czas (ms)', 'Kiedy'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap"
                      style={{ color: 'var(--muted)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>
                      {log.profiles?.email ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text)', maxWidth: 180 }}>
                      <span title={log.file_name}>{log.file_name?.slice(0, 30) ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>
                      {log.supplier_name ?? '—'}{log.supplier_nip ? ` (${log.supplier_nip})` : ''}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge label={log.extraction_status} color={STATUS_COLORS[log.extraction_status] ?? '#6b7280'} />
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text)' }}>
                      {log.confidence_total != null ? (log.confidence_total * 100).toFixed(1) + '%' : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--muted)' }}>
                      {log.processing_time_ms ?? '—'}
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

// ── Tab: User Corrections ────────────────────────────────────────────────────

function TabCorrections() {
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [statusFilter, setStatus] = useState('')
  const [saving, setSaving]       = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('invoice_user_corrections')
        .select('id, user_id, field_key, original_value, corrected_value, correction_status, used_for_training, created_at, profiles(email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (statusFilter) q = q.eq('correction_status', statusFilter)

      const { data, count } = await q
      setRows(data ?? [])
      setTotal(count ?? 0)
    } catch { /* ignore */ }
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  async function updateStatus(id, newStatus) {
    setSaving(id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('invoice_user_corrections').update({
      correction_status: newStatus,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
      used_for_training: newStatus === 'used_for_training',
    }).eq('id', id)
    await trackAdminAudit({ action: 'correction_status_changed', metadata: { correctionId: id, newStatus } })
    setSaving(null)
    load()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <option value="">Wszystkie statusy</option>
          {['pending', 'approved', 'rejected', 'used_for_training'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={() => load()} className="px-3 py-2 rounded-lg text-sm flex items-center gap-1"
          style={{ background: 'var(--hover-bg)', color: 'var(--text-2)' }}>
          <RefreshCw size={13} /> Odśwież
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="px-4 py-3 text-sm font-semibold" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
          {total} korekta{total === 1 ? '' : total < 5 ? 'y' : 'y'}
        </div>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Ładowanie…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Brak korekt. Pojawią się tu po zintegrowaniu <code>logCorrection()</code>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Użytkownik', 'Pole', 'Przed korektą', 'Po korekcie', 'Status', 'Trening', 'Kiedy', 'Akcja'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap"
                      style={{ color: 'var(--muted)', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>
                      {row.profiles?.email ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--muted)' }}>{row.field_key ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#ef4444', maxWidth: 140 }}>
                      <span title={row.original_value}>{(row.original_value ?? '—').slice(0, 30)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#16a34a', maxWidth: 140 }}>
                      <span title={row.corrected_value}>{(row.corrected_value ?? '—').slice(0, 30)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge label={row.correction_status} color={CORRECTION_STATUS_COLORS[row.correction_status] ?? '#6b7280'} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {row.used_for_training
                        ? <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                        : <XCircle size={14} style={{ color: 'var(--muted)' }} />}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                      {timeAgo(row.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.correction_status === 'pending' && (
                        <div className="flex gap-1">
                          <button disabled={saving === row.id} onClick={() => updateStatus(row.id, 'approved')}
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                            Zatwierdź
                          </button>
                          <button disabled={saving === row.id} onClick={() => updateStatus(row.id, 'rejected')}
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                            Odrzuć
                          </button>
                        </div>
                      )}
                      {row.correction_status === 'approved' && (
                        <button disabled={saving === row.id} onClick={() => updateStatus(row.id, 'used_for_training')}
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>
                          Użyj do treningu
                        </button>
                      )}
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

// ── Tab: Review Queue ────────────────────────────────────────────────────────

function TabQueue() {
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [total, setTotal]         = useState(0)
  const [statusFilter, setStatus] = useState('pending')
  const [saving, setSaving]       = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('invoice_model_review_queue')
        .select(`
          id, reason, priority, status, created_at,
          invoice_extraction_logs(file_name, supplier_name, extraction_status, profiles(email))
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(50)

      if (statusFilter) q = q.eq('status', statusFilter)

      const { data, count } = await q
      setItems(data ?? [])
      setTotal(count ?? 0)
    } catch { /* ignore */ }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  async function resolve(id, newStatus) {
    setSaving(id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('invoice_model_review_queue').update({
      status:      newStatus,
      resolved_by: user?.id,
      resolved_at: new Date().toISOString(),
    }).eq('id', id)
    setSaving(null)
    load()
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {['pending', 'in_review', 'resolved', 'dismissed', ''].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className="px-3 py-1.5 rounded-md text-xs font-medium"
            style={statusFilter === s
              ? { background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }
              : { background: 'var(--hover-bg)', color: 'var(--text-2)' }}>
            {s === '' ? 'Wszystkie' : s}
            {s === 'pending' && total > 0 && statusFilter === 'pending' ? ` (${total})` : ''}
          </button>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Ładowanie…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle2 size={24} style={{ color: '#16a34a', margin: '0 auto 8px' }} />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {statusFilter === 'pending' ? 'Brak przypadków do review.' : 'Brak wyników.'}
            </p>
          </div>
        ) : (
          <div>
            {items.map(item => (
              <div key={item.id} className="px-4 py-3 flex items-start gap-3"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge label={item.priority} color={PRIORITY_COLORS[item.priority] ?? '#6b7280'} />
                    <Badge label={item.status} color={STATUS_COLORS[item.status] ?? '#6b7280'} />
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{timeAgo(item.created_at)}</span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{item.reason}</p>
                  {item.invoice_extraction_logs && (
                    <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      {item.invoice_extraction_logs.file_name ?? '—'} ·{' '}
                      {item.invoice_extraction_logs.supplier_name ?? '—'} ·{' '}
                      {item.invoice_extraction_logs.profiles?.email ?? '—'}
                    </div>
                  )}
                </div>
                {item.status === 'pending' && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button disabled={saving === item.id} onClick={() => resolve(item.id, 'resolved')}
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                      Rozwiąż
                    </button>
                    <button disabled={saving === item.id} onClick={() => resolve(item.id, 'dismissed')}
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ background: 'rgba(107,114,128,0.1)', color: '#6b7280' }}>
                      Odrzuć
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: Model Config ────────────────────────────────────────────────────────

function TabConfig() {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    try { setConfig(getInvoiceModelConfig()) } catch { /* ignore */ }
  }, [])

  if (!config) return <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Ładowanie konfiguracji…</div>

  const thresholds = config.thresholds ?? {}
  const weights    = config.weights ?? {}

  return (
    <div className="space-y-4">
      {/* Metadata */}
      <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>Metadane modelu</h3>
        <div className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
          {[
            ['Wersja', config.version ?? '—'],
            ['Tryb', config.mode ?? '—'],
            ['Ostatni trening', config.trainedAt ? formatDate(config.trainedAt) : 'Brak'],
            ['Golden samples', config.trainedOn?.goldenSamples ?? 0],
            ['Korekty użyte', config.trainedOn?.correctionEvents ?? 0],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>{k}</p>
              <p className="font-medium" style={{ color: 'var(--text)' }}>{String(v)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Thresholds */}
      <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>Progi decyzyjne (thresholds)</h3>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {Object.entries(thresholds).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between p-2 rounded-lg"
              style={{ background: 'var(--hover-bg)' }}>
              <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{k}</span>
              <span className="text-sm font-bold ml-2" style={{ color: '#7c3aed' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Weights */}
      <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>Wagi modelu (21 parametrów)</h3>
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
          {Object.entries(weights).map(([k, v]) => {
            const isNeg = v < 0
            return (
              <div key={k} className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div style={{
                    width: `${Math.min(100, Math.abs(v) * 100)}%`,
                    height: '100%',
                    background: isNeg ? '#ef4444' : '#7c3aed',
                    borderRadius: 4,
                  }} />
                </div>
                <span className="text-xs font-mono w-8 text-right" style={{ color: isNeg ? '#ef4444' : '#7c3aed' }}>
                  {v > 0 ? '+' : ''}{v}
                </span>
                <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--muted)', minWidth: 0 }} title={k}>{k}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Metrics */}
      {config.metrics && (
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>Metryki aktualnego modelu</h3>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {Object.entries(config.metrics).map(([k, v]) => (
              <div key={k} className="p-2 rounded-lg" style={{ background: 'var(--hover-bg)' }}>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{k}</p>
                <p className="font-bold text-sm mt-0.5" style={{ color: typeof v === 'number' && v < 0.5 ? '#ef4444' : '#16a34a' }}>
                  {typeof v === 'number' ? (v * 100).toFixed(1) + '%' : String(v)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Model Runs History ──────────────────────────────────────────────────

function TabRuns() {
  const [runs, setRuns]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('invoice_model_runs')
      .select('id, model_version, status, training_examples_count, final_accuracy, metrics, started_at, finished_at, profiles(email)')
      .order('started_at', { ascending: false })
      .limit(30)
      .then(({ data }) => { setRuns(data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="px-4 py-3 font-semibold text-sm" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
        Historia uruchomień treningu
      </div>
      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Ładowanie…</div>
      ) : runs.length === 0 ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Brak historii treningu w DB. Uruchom trening z zakładki „Panel treningu" — zostanie zalogowany tutaj.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Uruchomiony przez', 'Wersja', 'Status', 'Próbki', 'Accuracy', 'Kiedy', 'Czas'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap"
                    style={{ color: 'var(--muted)', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map(r => {
                const durationMs = r.finished_at && r.started_at
                  ? new Date(r.finished_at) - new Date(r.started_at) : null
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>{r.profiles?.email ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{r.model_version ?? '—'}</td>
                    <td className="px-4 py-2.5"><Badge label={r.status} color={STATUS_COLORS[r.status] ?? '#6b7280'} /></td>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: 'var(--text)' }}>{r.training_examples_count ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs font-bold"
                      style={{ color: r.final_accuracy != null && r.final_accuracy > 0.8 ? '#16a34a' : 'var(--text)' }}>
                      {r.final_accuracy != null ? (r.final_accuracy * 100).toFixed(1) + '%' : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>{timeAgo(r.started_at)}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>
                      {durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    icon: Brain,      label: 'Przegląd' },
  { id: 'config',      icon: Settings2,  label: 'Parametry modelu' },
  { id: 'logs',        icon: ScrollText, label: 'Logi ekstrakcji' },
  { id: 'corrections', icon: ListChecks, label: 'Korekty' },
  { id: 'queue',       icon: Clock,      label: 'Kolejka review' },
  { id: 'runs',        icon: TrendingUp, label: 'Historia treningu' },
  { id: 'trainer',     icon: Wrench,     label: 'Panel treningu' },
]

export default function BackendModel() {
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    trackAdminAudit({ action: 'model_panel_opened' })
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Brain size={20} style={{ color: '#7c3aed' }} />
        <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>Model faktur</h2>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>
          Owner only
        </span>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 flex-wrap mb-5 pb-3" style={{ borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <TabBtn key={t.id} id={t.id} active={tab === t.id} onClick={setTab} icon={t.icon} label={t.label} />
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview'    && <TabOverview />}
      {tab === 'config'      && <TabConfig />}
      {tab === 'logs'        && <TabLogs />}
      {tab === 'corrections' && <TabCorrections />}
      {tab === 'queue'       && <TabQueue />}
      {tab === 'runs'        && <TabRuns />}
      {tab === 'trainer'     && (
        <div>
          <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', color: '#7c3aed' }}>
            Panel treningu działa lokalnie w przeglądarce (localStorage). Dane treningowe i konfiguracja są prywatne dla tej sesji.
            Po treningu użyj funkcji eksportu/importu, żeby przenieść konfigurację między urządzeniami.
          </div>
          <InvoiceLearningDebugPanel />
        </div>
      )}
    </div>
  )
}
