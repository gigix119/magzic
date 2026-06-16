import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { autoCreatePreparation } from '../../domain/reservationAutomation'
import { shouldAutoCreatePreparation } from '../../domain/commands'
import BottomSheet from '../../components/ui/BottomSheet'
import Modal from '../../components/Modal'
import Spinner from '../../components/Spinner'
import { CalendarDays, Plus, Pencil, Trash2, ArrowRight, BedDouble } from 'lucide-react'

const STATUS_COLORS = {
  wstepna:     { bg: '#f3f4f6', text: '#6b7280', label: 'Wstępna' },
  potwierdzona:{ bg: '#eff6ff', text: '#1e40af', label: 'Potwierdzona' },
  zameldowana: { bg: '#ecfdf5', text: '#065f46', label: 'Zameldowana' },
  wymeldowana: { bg: '#f0fdf4', text: '#166534', label: 'Wymeldowana' },
  anulowana:   { bg: '#fef2f2', text: '#991b1b', label: 'Anulowana' },
}

const SOURCE_LABELS = {
  manual: 'ręcznie',
  kwhotel: 'KW Hotel',
  booking: 'Booking.com',
  airbnb: 'Airbnb',
}

const DATE_FILTERS = [
  { key: 'all',   label: 'Wszystkie' },
  { key: 'today', label: 'Dziś' },
  { key: 'week',  label: 'Ten tydzień' },
  { key: 'month', label: 'Ten miesiąc' },
]

const STATUS_FILTERS = [
  { key: 'all',          label: 'Wszystkie' },
  { key: 'potwierdzona', label: 'Potwierdzone' },
  { key: 'zameldowana',  label: 'Zameldowane' },
  { key: 'wymeldowana',  label: 'Wymeldowane' },
  { key: 'anulowana',    label: 'Anulowane' },
]

const IS = (err) => ({
  background: 'var(--input-bg)',
  border: `1px solid ${err ? '#ef4444' : 'var(--border)'}`,
  borderRadius: 8,
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: 16,
  width: '100%',
  outline: 'none',
  minHeight: 48,
  boxSizing: 'border-box',
})

const emptyForm = {
  lokal_id: '',
  checkin_at: '',
  checkout_at: '',
  gosc_nazwa: '',
  gosc_email: '',
  gosc_telefon: '',
  liczba_gosci: '1',
  status: 'potwierdzona',
  notatki: '',
}

function useMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return isMobile
}

function isoToday() { return new Date().toISOString().split('T')[0] }
function isoWeekEnd() {
  const d = new Date(); d.setDate(d.getDate() + (7 - d.getDay()))
  return d.toISOString().split('T')[0]
}
function isoMonthEnd() {
  const d = new Date(); d.setMonth(d.getMonth() + 1, 0)
  return d.toISOString().split('T')[0]
}

export default function RezerwacjeTab() {
  const { addToast } = useToast()
  const { workspaceId, wsQuery, addWsFilter, wsData } = useWorkspace()
  const isMobile = useMobile()

  const [items, setItems] = useState([])
  const [lokale, setLokale] = useState([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)

  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [lokalFilter, setLokalFilter] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [autoCreating, setAutoCreating] = useState(null)

  async function fetchData() {
    if (!workspaceId) { setLoading(false); return }
    const [{ data: rez, error }, { data: lok }] = await Promise.all([
      addWsFilter(wsQuery('rezerwacje').select('*')).order('checkin_at', { ascending: true }),
      addWsFilter(wsQuery('lokale').select('id, nazwa')).order('nazwa'),
    ])
    if (error) {
      if (error.code === '42P01') { setTableExists(false); setLoading(false); return }
      addToast(error.message, 'error')
    } else {
      setItems(rez || [])
      setTableExists(true)
    }
    setLokale(lok || [])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [workspaceId])

  const lokalMap = Object.fromEntries(lokale.map(l => [l.id, l.nazwa]))

  const today = isoToday()

  const filtered = items.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (lokalFilter && r.lokal_id !== lokalFilter) return false
    if (dateFilter === 'today' && r.checkin_at !== today) return false
    if (dateFilter === 'week' && r.checkin_at > isoWeekEnd()) return false
    if (dateFilter === 'month' && r.checkin_at > isoMonthEnd()) return false
    return true
  })

  function openCreate() {
    setEditItem(null)
    setForm(emptyForm)
    setErrors({})
    setShowForm(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      lokal_id: item.lokal_id || '',
      checkin_at: item.checkin_at || '',
      checkout_at: item.checkout_at || '',
      gosc_nazwa: item.gosc_nazwa || '',
      gosc_email: item.gosc_email || '',
      gosc_telefon: item.gosc_telefon || '',
      liczba_gosci: item.liczba_gosci != null ? String(item.liczba_gosci) : '1',
      status: item.status || 'potwierdzona',
      notatki: item.notatki || '',
    })
    setErrors({})
    setShowForm(true)
  }

  function validate() {
    const e = {}
    if (!form.checkin_at) e.checkin_at = true
    if (!form.checkout_at) e.checkout_at = true
    if (form.checkin_at && form.checkout_at && form.checkout_at <= form.checkin_at) e.checkout_at = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function triggerAutoPrep(rezerwacja) {
    if (!shouldAutoCreatePreparation(rezerwacja)) return
    setAutoCreating(rezerwacja.id)
    const result = await autoCreatePreparation(rezerwacja, { supabase, workspaceId })
    setAutoCreating(null)
    if (result.created) {
      addToast(`Utworzono przygotowanie: ${result.nazwa}`, 'success')
      fetchData()
    } else if (result.reason === 'no_default_package') {
      addToast('Brak domyślnego pakietu w lokalu — przygotowanie nie zostało utworzone', 'warning')
    }
  }

  async function handleSave(ev) {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)

    const payload = {
      lokal_id: form.lokal_id || null,
      checkin_at: form.checkin_at,
      checkout_at: form.checkout_at,
      gosc_nazwa: form.gosc_nazwa.trim() || null,
      gosc_email: form.gosc_email.trim() || null,
      gosc_telefon: form.gosc_telefon.trim() || null,
      liczba_gosci: parseInt(form.liczba_gosci, 10) || 1,
      status: form.status,
      notatki: form.notatki.trim() || null,
      external_source: 'manual',
    }

    if (editItem) {
      const { error } = await supabase.from('rezerwacje').update(payload).eq('id', editItem.id)
      if (error) { addToast(error.message, 'error'); setSaving(false); return }
      addToast('Zaktualizowano rezerwację', 'success')
      setShowForm(false)
      await fetchData()
      if (form.status === 'potwierdzona' && !editItem.przygotowanie_id) {
        const updated = { ...editItem, ...payload }
        await triggerAutoPrep(updated)
      }
    } else {
      const { data: inserted, error } = await supabase
        .from('rezerwacje')
        .insert([{ ...payload, ...wsData() }])
        .select()
        .single()
      if (error) { addToast(error.message, 'error'); setSaving(false); return }
      addToast('Dodano rezerwację', 'success')
      setShowForm(false)
      await fetchData()
      if (inserted && form.status === 'potwierdzona') {
        await triggerAutoPrep(inserted)
      }
    }
    setSaving(false)
  }

  async function handleDelete(item) {
    if (!window.confirm('Usunąć rezerwację?')) return
    const { error } = await supabase.from('rezerwacje').delete().eq('id', item.id)
    if (error) { addToast(error.message, 'error') }
    else { addToast('Usunięto rezerwację', 'success'); fetchData() }
  }

  if (loading) return <Spinner />

  if (!tableExists) {
    return (
      <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <BedDouble size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
        <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Moduł Rezerwacje — wymaga migracji</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Uruchom migrations/lokale_rezerwacje_migration.sql w panelu Supabase, aby aktywować ten moduł.</p>
      </div>
    )
  }

  const RezForm = (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Lokal</label>
        <select style={IS()} value={form.lokal_id} onChange={e => setForm(f => ({ ...f, lokal_id: e.target.value }))}>
          <option value="">— wybierz lokal —</option>
          {lokale.map(l => <option key={l.id} value={l.id}>{l.nazwa}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Check-in *</label>
          <input type="date" style={IS(errors.checkin_at)} value={form.checkin_at} onChange={e => setForm(f => ({ ...f, checkin_at: e.target.value }))} />
          {errors.checkin_at && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Wymagana</p>}
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Check-out *</label>
          <input type="date" style={IS(errors.checkout_at)} value={form.checkout_at} onChange={e => setForm(f => ({ ...f, checkout_at: e.target.value }))} />
          {errors.checkout_at && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Wymagana</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Gość (imię i nazwisko)</label>
        <input style={IS()} value={form.gosc_nazwa} onChange={e => setForm(f => ({ ...f, gosc_nazwa: e.target.value }))} placeholder="np. Jan Kowalski" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>E-mail</label>
          <input type="email" style={IS()} value={form.gosc_email} onChange={e => setForm(f => ({ ...f, gosc_email: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Telefon</label>
          <input type="tel" style={IS()} value={form.gosc_telefon} onChange={e => setForm(f => ({ ...f, gosc_telefon: e.target.value }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Liczba gości</label>
          <input type="number" min="1" step="1" style={IS()} value={form.liczba_gosci} onChange={e => setForm(f => ({ ...f, liczba_gosci: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Status</label>
          <select style={IS()} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {Object.entries(STATUS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Notatki</label>
        <textarea style={{ ...IS(), minHeight: 60, resize: 'vertical' }} value={form.notatki} onChange={e => setForm(f => ({ ...f, notatki: e.target.value }))} placeholder="Opcjonalne uwagi…" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48 }}>Anuluj</button>
        <button type="submit" disabled={saving} className="flex-1 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 48, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Zapisywanie…' : editItem ? 'Zapisz zmiany' : 'Dodaj rezerwację'}
        </button>
      </div>
    </form>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Rezerwacje</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg px-4 text-sm font-medium text-white w-full sm:w-auto justify-center"
          style={{ background: 'var(--c-action)', minHeight: 48 }}
        >
          <Plus size={16} /> Nowa rezerwacja
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className="rounded-full px-3 text-xs font-medium flex-shrink-0 transition-colors"
            style={{ minHeight: 36, background: statusFilter === f.key ? 'var(--c-action)' : 'var(--card)', color: statusFilter === f.key ? '#fff' : 'var(--text-2)', border: `1px solid ${statusFilter === f.key ? 'var(--c-action)' : 'var(--border)'}` }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {DATE_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setDateFilter(f.key)}
            className="rounded-full px-3 text-xs font-medium flex-shrink-0 transition-colors"
            style={{ minHeight: 36, background: dateFilter === f.key ? 'rgba(59,130,246,0.15)' : 'var(--card)', color: dateFilter === f.key ? 'var(--c-action)' : 'var(--text-2)', border: `1px solid ${dateFilter === f.key ? 'var(--c-action)' : 'var(--border)'}` }}
          >
            <CalendarDays size={11} className="inline mr-1" />
            {f.label}
          </button>
        ))}
        {lokale.length > 0 && (
          <select
            style={{ ...IS(), minHeight: 36, fontSize: 12, padding: '0 10px', width: 'auto' }}
            value={lokalFilter}
            onChange={e => setLokalFilter(e.target.value)}
          >
            <option value="">Wszystkie lokale</option>
            {lokale.map(l => <option key={l.id} value={l.id}>{l.nazwa}</option>)}
          </select>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <BedDouble size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Brak rezerwacji</p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Dodaj rezerwację, aby automatycznie tworzyć przygotowania apartamentów.</p>
          <button onClick={openCreate} className="rounded-lg px-4 text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 44 }}>
            + Nowa rezerwacja
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const sc = STATUS_COLORS[item.status] || STATUS_COLORS.wstepna
            const lokalNazwa = item.lokal_id ? (lokalMap[item.lokal_id] || '—') : '—'
            const sourceName = SOURCE_LABELS[item.external_source] || item.external_source
            const isAutoCreating = autoCreating === item.id

            return (
              <div key={item.id} className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg flex-shrink-0 flex items-center justify-center" style={{ width: 40, height: 40, background: 'rgba(16,185,129,0.1)' }}>
                    <BedDouble size={18} style={{ color: '#059669' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold" style={{ color: 'var(--text)', fontSize: 15 }}>{lokalNazwa}</p>
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                    </div>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
                      {item.checkin_at} – {item.checkout_at}
                      {item.gosc_nazwa && <> · {item.gosc_nazwa}</>}
                      {item.liczba_gosci != null && <> · {item.liczba_gosci} os.</>}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {sourceName && (
                        <span className="rounded px-2 py-0.5 text-xs" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>{sourceName}</span>
                      )}
                      {item.przygotowanie_id ? (
                        <Link
                          to={`/operacje/przygotowania/${item.przygotowanie_id}`}
                          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
                          style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--c-action)', textDecoration: 'none' }}
                        >
                          Przygotowanie <ArrowRight size={10} />
                        </Link>
                      ) : (
                        isAutoCreating && (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>Tworzę przygotowanie…</span>
                        )
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(item)} className="flex items-center justify-center rounded-lg" style={{ color: 'var(--text-2)', minWidth: 38, minHeight: 38 }} title="Edytuj">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(item)} className="flex items-center justify-center rounded-lg" style={{ color: '#dc2626', minWidth: 38, minHeight: 38 }} title="Usuń">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isMobile ? (
        <BottomSheet open={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edytuj rezerwację' : 'Nowa rezerwacja'}>
          {RezForm}
        </BottomSheet>
      ) : (
        showForm && (
          <Modal title={editItem ? 'Edytuj rezerwację' : 'Nowa rezerwacja'} onClose={() => setShowForm(false)}>
            {RezForm}
          </Modal>
        )
      )}
    </div>
  )
}
