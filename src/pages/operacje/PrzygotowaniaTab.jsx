import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { getZlecenieConfigFor } from '../../config/businessTypes'
import { getZlecenieIcon } from '../../components/ui/categoryIcon'
import Modal from '../../components/Modal'
import BottomSheet from '../../components/ui/BottomSheet'
import Spinner from '../../components/Spinner'
import DateFilter, { isoToday, resolveFilterDate } from '../../components/ui/DateFilter'
import { Plus, ChevronRight, CalendarDays, Users, BedDouble, Minus, Trash2, ChevronLeft } from 'lucide-react'

const STATUS_COLORS = {
  nowe:         { bg: '#eff6ff', text: '#1e40af' },
  w_realizacji: { bg: '#fff7ed', text: '#9a3412' },
  gotowe:       { bg: '#ecfdf5', text: '#065f46' },
  anulowane:    { bg: '#f3f4f6', text: '#6b7280' },
}

const PRIORITY_COLORS = {
  niski:    { bg: '#f0fdf4', text: '#166534', label: 'Niski' },
  normalny: { bg: '#f8fafc', text: '#475569', label: 'Normalny' },
  pilny:    { bg: '#fef2f2', text: '#991b1b', label: 'Pilne' },
}

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
  nazwa: '',
  opis: '',
  data_realizacji: '',
  status: 'nowe',
  priorytet: 'normalny',
  kontrahent_id: '',
}

function isoTomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
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

// ── Wizard step indicator ──────────────────────────────────────────────────────

function WizardSteps({ step }) {
  const steps = ['Lokal', 'Szczegóły', 'Materiały', 'Zatwierdź']
  return (
    <div className="flex items-center gap-1 mb-5">
      {steps.map((label, i) => {
        const n = i + 1
        const done = step > n
        const active = step === n
        return (
          <div key={n} className="flex items-center" style={{ flex: i < steps.length - 1 ? 1 : 0 }}>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div
                style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? 'var(--c-success)' : active ? 'var(--c-action)' : 'var(--border)',
                  fontSize: 11, fontWeight: 700,
                  color: (done || active) ? '#fff' : 'var(--text-2)',
                }}
              >
                {done ? '✓' : n}
              </div>
              <span className="text-xs hidden sm:block" style={{ color: active ? 'var(--text)' : 'var(--muted)', fontWeight: active ? 600 : 400 }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: 'var(--border)', margin: '0 6px' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PrzygotowaniaTab() {
  const { addToast } = useToast()
  const { workspaceId, wsQuery, addWsFilter, wsData, getBusinessCategory } = useWorkspace()
  const navigate = useNavigate()
  const isMobile = useMobile()
  const businessCategory = getBusinessCategory()
  const config = getZlecenieConfigFor(businessCategory)
  const ZlecenieIcon = getZlecenieIcon(businessCategory)

  const [items, setItems] = useState([])
  const [kontrahenci, setKontrahenci] = useState([])
  const [rezMap, setRezMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('today')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Wizard state
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wizardLokale, setWizardLokale] = useState([])
  const [wizardSelectedLokal, setWizardSelectedLokal] = useState(null)
  const [wizardDate, setWizardDate] = useState(isoToday())
  const [wizardGuests, setWizardGuests] = useState(1)
  const [wizardPriority, setWizardPriority] = useState('normalny')
  const [wizardNotes, setWizardNotes] = useState('')
  const [wizardItems, setWizardItems] = useState([])
  const [wizardAllTowary, setWizardAllTowary] = useState([])
  const [wizardLoading, setWizardLoading] = useState(false)
  const [wizardSaving, setWizardSaving] = useState(false)
  const [wizardSearch, setWizardSearch] = useState('')
  const [wizardAddItem, setWizardAddItem] = useState({ towar_id: '', ilosc: 1 })

  async function fetchData() {
    if (!workspaceId) { setLoading(false); return }
    const [{ data: z }, { data: k }] = await Promise.all([
      addWsFilter(wsQuery('zlecenia').select('*, zlecenia_pozycje(id, wydano)')).order('data_realizacji', { ascending: true, nullsFirst: false }),
      addWsFilter(wsQuery('kontrahenci').select('id, nazwa').eq('aktywny', true)).order('nazwa'),
    ])
    const zl = z || []
    setItems(zl)
    setKontrahenci(k || [])

    const ids = zl.map(i => i.id)
    if (ids.length > 0) {
      const { data: rez } = await supabase
        .from('rezerwacje')
        .select('przygotowanie_id, lokal_id, checkin_at, checkout_at, gosc_nazwa, liczba_gosci, lokale(nazwa)')
        .in('przygotowanie_id', ids)
      const map = {}
      for (const r of rez || []) {
        if (r.przygotowanie_id) map[r.przygotowanie_id] = r
      }
      setRezMap(map)
    } else {
      setRezMap({})
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [workspaceId])

  // Client-side filtering
  const filteredDate = resolveFilterDate(dateFilter)
  const filtered = (statusFilter === 'all' ? items : items.filter(i => i.status === statusFilter))
    .filter(i => !filteredDate || i.data_realizacji === filteredDate)

  // ── Edit modal (legacy form for editing existing) ──────────────────────────

  function openEdit(ev, item) {
    ev.stopPropagation()
    setEditItem(item)
    setForm({
      nazwa: item.nazwa || '',
      opis: item.opis || '',
      data_realizacji: item.data_realizacji || '',
      status: item.status || 'nowe',
      priorytet: item.priorytet || 'normalny',
      kontrahent_id: item.kontrahent_id || '',
    })
    setErrors({})
    setShowForm(true)
  }

  function validate() {
    const e = {}
    if (!form.nazwa.trim()) e.nazwa = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave(ev) {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true)
    const payload = {
      nazwa: form.nazwa.trim(),
      opis: form.opis || null,
      data_realizacji: form.data_realizacji || null,
      status: form.status,
      priorytet: form.priorytet,
      kontrahent_id: form.kontrahent_id || null,
      updated_at: new Date().toISOString(),
    }
    let error
    if (editItem) {
      ({ error } = await supabase.from('zlecenia').update(payload).eq('id', editItem.id))
    } else {
      const { updated_at: _u, ...insertPayload } = payload
      ;({ error } = await supabase.from('zlecenia').insert([{ ...insertPayload, ...wsData() }]))
    }
    if (error) { addToast(error.message, 'error') }
    else {
      addToast(editItem ? 'Zaktualizowano' : 'Dodano', 'success')
      setShowForm(false)
      fetchData()
    }
    setSaving(false)
  }

  // ── Wizard functions ──────────────────────────────────────────────────────

  async function openWizard() {
    setWizardStep(1)
    setWizardSelectedLokal(null)
    setWizardDate(isoToday())
    setWizardGuests(1)
    setWizardPriority('normalny')
    setWizardNotes('')
    setWizardItems([])
    setWizardSearch('')
    setWizardAddItem({ towar_id: '', ilosc: 1 })
    setShowWizard(true)
    setWizardLoading(true)

    const [{ data: lok }, { data: tow }] = await Promise.all([
      supabase.from('lokale').select('id, nazwa, lokalizacja, pojemnosc, domyslny_pakiet_id').eq('workspace_id', workspaceId).eq('aktywny', true).order('nazwa'),
      supabase.from('towary').select('id, nazwa, jednostka').eq('workspace_id', workspaceId).eq('aktywny', true).order('nazwa'),
    ])
    setWizardLokale(lok || [])
    setWizardAllTowary(tow || [])
    setWizardLoading(false)
  }

  function openManualForm() {
    setShowWizard(false)
    setEditItem(null)
    setForm(emptyForm)
    setErrors({})
    setShowForm(true)
  }

  async function wizardSelectLokal(lokal) {
    setWizardSelectedLokal(lokal)
    setWizardGuests(lokal.pojemnosc || 1)
    setWizardItems([])

    if (lokal.domyslny_pakiet_id) {
      setWizardLoading(true)
      const { data: elementy } = await supabase
        .from('elementy_pakietu')
        .select('towar_id, ilosc, towary(nazwa, jednostka)')
        .eq('pakiet_id', lokal.domyslny_pakiet_id)
      setWizardItems((elementy || []).map(e => ({
        nazwa_pozycji: e.towary?.nazwa || '',
        ilosc: Number(e.ilosc),
        jednostka: e.towary?.jednostka || 'szt.',
      })))
      setWizardLoading(false)
    }

    setWizardStep(2)
  }

  function wizardAdjustQty(idx, delta) {
    setWizardItems(items => items.map((item, i) => {
      if (i !== idx) return item
      return { ...item, ilosc: Math.max(0, item.ilosc + delta) }
    }))
  }

  function wizardSetQty(idx, val) {
    const n = parseInt(val, 10)
    if (isNaN(n)) return
    setWizardItems(items => items.map((item, i) => i === idx ? { ...item, ilosc: Math.max(0, n) } : item))
  }

  function wizardRemoveItem(idx) {
    setWizardItems(items => items.filter((_, i) => i !== idx))
  }

  function wizardAddItemToList() {
    if (!wizardAddItem.towar_id) return
    const towar = wizardAllTowary.find(t => t.id === wizardAddItem.towar_id)
    if (!towar) return
    const existing = wizardItems.findIndex(i => i.nazwa_pozycji === towar.nazwa)
    if (existing >= 0) {
      setWizardItems(items => items.map((item, i) => i === existing ? { ...item, ilosc: item.ilosc + wizardAddItem.ilosc } : item))
    } else {
      setWizardItems(items => [...items, {
        nazwa_pozycji: towar.nazwa,
        ilosc: wizardAddItem.ilosc,
        jednostka: towar.jednostka || 'szt.',
      }])
    }
    setWizardAddItem({ towar_id: '', ilosc: 1 })
  }

  async function wizardSubmit() {
    setWizardSaving(true)
    const nazwa = wizardSelectedLokal
      ? `${wizardSelectedLokal.nazwa} – ${wizardDate}`
      : `Przygotowanie ${wizardDate}`

    const { data: zlecenie, error } = await supabase
      .from('zlecenia')
      .insert([{
        ...wsData(),
        nazwa,
        opis: wizardNotes || null,
        data_realizacji: wizardDate || null,
        status: 'nowe',
        priorytet: wizardPriority,
      }])
      .select('id')
      .single()

    if (error) { addToast(error.message, 'error'); setWizardSaving(false); return }

    const activeItems = wizardItems.filter(i => i.ilosc > 0)
    if (activeItems.length) {
      await supabase.from('zlecenia_pozycje').insert(
        activeItems.map(i => ({
          zlecenie_id: zlecenie.id,
          nazwa_pozycji: i.nazwa_pozycji,
          ilosc: i.ilosc,
          jednostka: i.jednostka,
          wydano: false,
        }))
      )
    }

    addToast(`Utworzono przygotowanie: ${wizardSelectedLokal?.nazwa || nazwa} — ${wizardDate}`, 'success')
    setShowWizard(false)
    setWizardSaving(false)
    fetchData()
  }

  // ── Wizard render ─────────────────────────────────────────────────────────

  const localFiltered = wizardSearch
    ? wizardLokale.filter(l => l.nazwa.toLowerCase().includes(wizardSearch.toLowerCase()) || (l.lokalizacja || '').toLowerCase().includes(wizardSearch.toLowerCase()))
    : wizardLokale

  function WizardContent() {
    return (
      <div>
        <WizardSteps step={wizardStep} />

        {wizardLoading && <div className="flex justify-center py-8"><Spinner /></div>}

        {!wizardLoading && (
          <>
            {/* Step 1: Select local */}
            {wizardStep === 1 && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Szukaj lokalu lub lokalizacji..."
                  style={IS()}
                  value={wizardSearch}
                  onChange={e => setWizardSearch(e.target.value)}
                />
                <div className="space-y-1" style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {localFiltered.map(lokal => (
                    <button
                      key={lokal.id}
                      onClick={() => wizardSelectLokal(lokal)}
                      className="w-full text-left rounded-lg px-4 py-3 transition-colors"
                      style={{ background: 'var(--table-sub)', border: '1px solid var(--border)', minHeight: 52 }}
                    >
                      <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{lokal.nazwa}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                        {lokal.lokalizacja && <>{lokal.lokalizacja} · </>}
                        {lokal.pojemnosc ? `${lokal.pojemnosc} os.` : ''}
                        {lokal.domyslny_pakiet_id ? ' · ma pakiet' : ' · brak pakietu'}
                      </p>
                    </button>
                  ))}
                  {localFiltered.length === 0 && (
                    <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>Brak lokali — dodaj lokale w sekcji Lokale.</p>
                  )}
                </div>
                <button
                  onClick={openManualForm}
                  className="w-full rounded-lg text-sm font-medium"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-2)', minHeight: 44, cursor: 'pointer' }}
                >
                  Bez lokalu (ręczne)
                </button>
              </div>
            )}

            {/* Step 2: Date and details */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                {wizardSelectedLokal && (
                  <div className="rounded-lg px-4 py-3" style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{wizardSelectedLokal.nazwa}</p>
                    {wizardSelectedLokal.lokalizacja && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{wizardSelectedLokal.lokalizacja} · {wizardSelectedLokal.pojemnosc} os.</p>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Data realizacji</label>
                  <input type="date" style={IS()} value={wizardDate} onChange={e => setWizardDate(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  {[isoToday(), isoTomorrow()].map((d, i) => (
                    <button key={d} onClick={() => setWizardDate(d)}
                      className="rounded-lg px-3 text-sm font-medium"
                      style={{ minHeight: 40, background: wizardDate === d ? 'var(--c-action)' : 'var(--table-sub)', color: wizardDate === d ? '#fff' : 'var(--text-2)', border: `1px solid ${wizardDate === d ? 'var(--c-action)' : 'var(--border)'}` }}>
                      {i === 0 ? 'Dziś' : 'Jutro'}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Liczba gości</label>
                  <input type="number" min="1" step="1" style={IS()} value={wizardGuests} onChange={e => setWizardGuests(parseInt(e.target.value, 10) || 1)} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Priorytet</label>
                  <div className="flex gap-2">
                    {['niski', 'normalny', 'pilny'].map(p => {
                      const pc = PRIORITY_COLORS[p]
                      return (
                        <button key={p} type="button" onClick={() => setWizardPriority(p)}
                          className="flex-1 rounded-lg text-sm font-medium"
                          style={{ minHeight: 44, background: wizardPriority === p ? pc.bg : 'var(--card)', color: wizardPriority === p ? pc.text : 'var(--text-2)', border: `1px solid ${wizardPriority === p ? pc.text : 'var(--border)'}` }}>
                          {pc.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Notatki (opcjonalnie)</label>
                  <textarea style={{ ...IS(), minHeight: 64, height: 64, resize: 'vertical' }} value={wizardNotes} onChange={e => setWizardNotes(e.target.value)} placeholder="Uwagi do przygotowania..." />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setWizardStep(1)} className="flex items-center gap-1 rounded-lg text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48, padding: '0 16px' }}>
                    <ChevronLeft size={14} /> Wróć
                  </button>
                  <button onClick={() => setWizardStep(3)} className="flex-1 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 48 }}>
                    Dalej: Materiały →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Materials list */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                {wizardItems.length === 0 && !wizardSelectedLokal?.domyslny_pakiet_id && (
                  <p className="text-sm py-2" style={{ color: 'var(--muted)' }}>Ten lokal nie ma przypisanego pakietu. Dodaj pozycje ręcznie.</p>
                )}
                {wizardItems.length === 0 && wizardSelectedLokal?.domyslny_pakiet_id && (
                  <p className="text-sm py-2" style={{ color: 'var(--muted)' }}>Pakiet jest pusty. Dodaj pozycje ręcznie.</p>
                )}

                {wizardItems.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {wizardItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-2.5"
                        style={{ borderBottom: idx < wizardItems.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--card)', opacity: item.ilosc === 0 ? 0.4 : 1 }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{item.nazwa_pozycji}</p>
                          <p className="text-xs" style={{ color: 'var(--text-2)' }}>{item.jednostka}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => wizardAdjustQty(idx, -1)}
                            style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--table-sub)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 18, color: 'var(--text-2)' }}
                          >−</button>
                          <input
                            type="number"
                            min="0"
                            value={item.ilosc}
                            onChange={e => wizardSetQty(idx, e.target.value)}
                            style={{ width: 52, textAlign: 'center', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 16, height: 44, minHeight: 44 }}
                          />
                          <button
                            onClick={() => wizardAdjustQty(idx, +1)}
                            style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--table-sub)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 18, color: 'var(--text-2)' }}
                          >+</button>
                        </div>
                        <button onClick={() => wizardRemoveItem(idx)} style={{ width: 36, height: 36, color: '#dc2626', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add product */}
                <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>+ Dodaj produkt</p>
                  <div className="flex gap-2">
                    <select
                      style={{ ...IS(), flex: 1, padding: '8px 10px', fontSize: 14 }}
                      value={wizardAddItem.towar_id}
                      onChange={e => setWizardAddItem(i => ({ ...i, towar_id: e.target.value }))}
                    >
                      <option value="">— wybierz produkt —</option>
                      {wizardAllTowary.map(t => <option key={t.id} value={t.id}>{t.nazwa} ({t.jednostka || 'szt.'})</option>)}
                    </select>
                    <input
                      type="number" min="1" step="1"
                      style={{ ...IS(), width: 72 }}
                      value={wizardAddItem.ilosc}
                      onChange={e => setWizardAddItem(i => ({ ...i, ilosc: parseInt(e.target.value, 10) || 1 }))}
                    />
                    <button
                      onClick={wizardAddItemToList}
                      disabled={!wizardAddItem.towar_id}
                      className="rounded-lg text-sm font-medium text-white"
                      style={{ background: 'var(--c-action)', minHeight: 48, padding: '0 16px', opacity: wizardAddItem.towar_id ? 1 : 0.5, cursor: wizardAddItem.towar_id ? 'pointer' : 'not-allowed' }}
                    >
                      Dodaj
                    </button>
                  </div>
                </div>

                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {wizardItems.filter(i => i.ilosc > 0).length} pozycji · {wizardItems.reduce((s, i) => s + i.ilosc, 0)} szt. łącznie
                </p>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setWizardStep(2)} className="flex items-center gap-1 rounded-lg text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48, padding: '0 16px' }}>
                    <ChevronLeft size={14} /> Wróć
                  </button>
                  <button onClick={() => setWizardStep(4)} className="flex-1 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 48 }}>
                    Dalej: Zatwierdź →
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Confirm */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <div className="rounded-lg p-4 space-y-2" style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <BedDouble size={16} style={{ color: 'var(--c-action)' }} />
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                      {wizardSelectedLokal?.nazwa || 'Bez lokalu'}
                    </p>
                  </div>
                  {wizardDate && (
                    <div className="flex items-center gap-2">
                      <CalendarDays size={14} style={{ color: 'var(--muted)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                        {new Date(wizardDate + 'T00:00:00').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                    </div>
                  )}
                  {wizardGuests > 0 && (
                    <div className="flex items-center gap-2">
                      <Users size={14} style={{ color: 'var(--muted)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-2)' }}>{wizardGuests} gości</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: PRIORITY_COLORS[wizardPriority].bg, color: PRIORITY_COLORS[wizardPriority].text }}>
                      {PRIORITY_COLORS[wizardPriority].label}
                    </span>
                  </div>
                </div>

                {wizardItems.filter(i => i.ilosc > 0).length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    <div className="px-4 py-2 text-xs font-medium" style={{ background: 'var(--table-head)', color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}>
                      Lista materiałów ({wizardItems.filter(i => i.ilosc > 0).length} pozycji)
                    </div>
                    {wizardItems.filter(i => i.ilosc > 0).map((item, idx, arr) => (
                      <div key={idx} className="flex items-center justify-between px-4 py-2.5"
                        style={{ borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--card)' }}>
                        <p className="text-sm" style={{ color: 'var(--text)' }}>{item.nazwa_pozycji}</p>
                        <span className="text-sm num font-medium" style={{ color: 'var(--text-2)' }}>{item.ilosc} {item.jednostka}</span>
                      </div>
                    ))}
                  </div>
                )}

                {wizardNotes && (
                  <p className="text-sm" style={{ color: 'var(--text-2)' }}>Notatki: {wizardNotes}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setWizardStep(3)} className="flex items-center gap-1 rounded-lg text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48, padding: '0 16px' }}>
                    <ChevronLeft size={14} /> Wróć
                  </button>
                  <button
                    onClick={wizardSubmit}
                    disabled={wizardSaving}
                    className="flex-1 rounded-lg text-sm font-medium text-white"
                    style={{ background: 'var(--c-action)', minHeight: 48, opacity: wizardSaving ? 0.7 : 1 }}
                  >
                    {wizardSaving ? 'Tworzę…' : 'Utwórz przygotowanie'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ── Status tabs config ────────────────────────────────────────────────────

  const statusTabs = [
    { key: 'all', label: 'Wszystkie' },
    { key: 'nowe', label: config.statusLabels.nowe },
    { key: 'w_realizacji', label: config.statusLabels.w_realizacji },
    { key: 'gotowe', label: config.statusLabels.gotowe },
  ]

  const namePlaceholder = businessCategory === 'hospitality'
    ? 'np. Apartament 3B — checkout 15.06, check-in 16.06'
    : config.namePlaceholder

  if (loading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
          {config.moduleLabel}
        </h1>
        <button
          onClick={openWizard}
          className="flex items-center gap-2 rounded-lg px-4 text-sm font-medium text-white w-full sm:w-auto justify-center"
          style={{ background: 'var(--c-action)', minHeight: 48 }}
        >
          <Plus size={16} /> {config.createLabel}
        </button>
      </div>

      {/* Date filter */}
      <div className="mb-3">
        <DateFilter value={dateFilter} onChange={setDateFilter} showAll={true} />
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {statusTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className="rounded-full px-4 text-sm font-medium flex-shrink-0 transition-colors"
            style={{
              minHeight: 44,
              background: statusFilter === tab.key ? 'var(--c-action)' : 'var(--card)',
              color: statusFilter === tab.key ? '#fff' : 'var(--text-2)',
              border: `1px solid ${statusFilter === tab.key ? 'var(--c-action)' : 'var(--border)'}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List / empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <ZlecenieIcon size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)', opacity: 0.4 }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>
            {businessCategory === 'hospitality' ? 'Brak przygotowań' : config.emptyTitle}
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            {businessCategory === 'hospitality'
              ? 'Utwórz przygotowanie obiektu, aby zaplanować wydanie materiałów i kontrolę.'
              : config.emptyDescription}
          </p>
          <button onClick={openWizard} className="rounded-lg px-4 text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 44 }}>
            + {config.createLabel}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const sc = STATUS_COLORS[item.status] || STATUS_COLORS.nowe
            const pc = PRIORITY_COLORS[item.priorytet] || PRIORITY_COLORS.normalny
            const pozycje = item.zlecenia_pozycje || []
            const total = pozycje.length
            const wydano = pozycje.filter(p => p.wydano).length
            const progressPct = total > 0 ? Math.round((wydano / total) * 100) : 0
            const rez = rezMap[item.id]

            return (
              <div
                key={item.id}
                className="rounded-xl overflow-hidden cursor-pointer"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                onClick={() => navigate(`/operacje/przygotowania/${item.id}`)}
              >
                <div className="px-4 py-4">
                  {rez && (
                    <div className="flex items-center gap-2 mb-2">
                      <BedDouble size={13} style={{ color: 'var(--c-success)', flexShrink: 0 }} />
                      <p className="text-xs truncate" style={{ color: 'var(--text-2)' }}>
                        {rez.lokale?.nazwa || '—'}
                        {rez.gosc_nazwa && <> · {rez.gosc_nazwa}</>}
                        {rez.liczba_gosci != null && <> · <Users size={10} className="inline" /> {rez.liczba_gosci} os.</>}
                        {rez.checkin_at && <> · {rez.checkin_at}–{rez.checkout_at}</>}
                      </p>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold" style={{ color: 'var(--text)', fontSize: 16 }}>{item.nazwa}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap" style={{ fontSize: 13 }}>
                        {item.data_realizacji && (
                          <span className="flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                            <CalendarDays size={12} />
                            {new Date(item.data_realizacji).toLocaleDateString('pl-PL')}
                          </span>
                        )}
                        {item.priorytet === 'pilny' && (
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: pc.bg, color: pc.text }}>
                            {pc.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: sc.bg, color: sc.text }}>
                          {config.statusLabels[item.status] || item.status}
                        </span>
                        {total > 0 && (
                          <span className="text-xs num" style={{ color: 'var(--muted)' }}>
                            {wydano}/{total} wydano
                          </span>
                        )}
                      </div>

                      {total > 0 && (
                        <div className="mt-2" style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', maxWidth: 200 }}>
                          <div style={{ width: `${progressPct}%`, height: '100%', background: progressPct === 100 ? 'var(--c-success)' : 'var(--c-action)', borderRadius: 2, transition: 'width 0.3s' }} />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/operacje/przygotowania/${item.id}`) }}
                      className="flex items-center gap-1 rounded-lg px-2 text-sm font-medium flex-shrink-0"
                      style={{ color: 'var(--c-action)', minHeight: 44 }}
                    >
                      Otwórz <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Wizard — BottomSheet on mobile, Modal on desktop */}
      {showWizard && (isMobile ? (
        <BottomSheet
          open={showWizard}
          onClose={() => setShowWizard(false)}
          title={wizardStep === 1 ? 'Wybierz lokal' : wizardStep === 2 ? 'Data i szczegóły' : wizardStep === 3 ? 'Lista materiałów' : 'Zatwierdź przygotowanie'}
        >
          <WizardContent />
        </BottomSheet>
      ) : (
        <Modal
          title={wizardStep === 1 ? 'Nowe przygotowanie' : wizardStep === 2 ? 'Data i szczegóły' : wizardStep === 3 ? 'Lista materiałów' : 'Zatwierdź przygotowanie'}
          onClose={() => setShowWizard(false)}
          maxWidth={560}
        >
          <WizardContent />
        </Modal>
      ))}

      {/* Legacy edit modal */}
      {showForm && (
        <Modal
          title={editItem ? `Edytuj ${config.singularLabel.toLowerCase()}` : config.createLabel}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>{config.nameLabel} *</label>
              <input
                style={IS(errors.nazwa)}
                value={form.nazwa}
                onChange={e => setForm(f => ({ ...f, nazwa: e.target.value }))}
                placeholder={namePlaceholder}
              />
              {errors.nazwa && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>{config.descriptionLabel}</label>
              <textarea style={{ ...IS(), minHeight: 72, height: 72, resize: 'vertical' }} value={form.opis} onChange={e => setForm(f => ({ ...f, opis: e.target.value }))} placeholder="Opcjonalne notatki..." />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>{config.dateLabel}</label>
              <input type="date" style={IS()} value={form.data_realizacji} onChange={e => setForm(f => ({ ...f, data_realizacji: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Priorytet</label>
              <div className="flex gap-2">
                {['niski', 'normalny', 'pilny'].map(p => {
                  const pc2 = PRIORITY_COLORS[p]
                  const active = form.priorytet === p
                  return (
                    <button key={p} type="button" onClick={() => setForm(f => ({ ...f, priorytet: p }))} className="flex-1 rounded-lg text-sm font-medium transition-colors"
                      style={{ minHeight: 44, background: active ? pc2.bg : 'var(--card)', color: active ? pc2.text : 'var(--text-2)', border: `1px solid ${active ? pc2.text : 'var(--border)'}` }}>
                      {pc2.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {kontrahenci.length > 0 && (
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Kontrahent (opcjonalnie)</label>
                <select style={{ ...IS(), cursor: 'pointer' }} value={form.kontrahent_id} onChange={e => setForm(f => ({ ...f, kontrahent_id: e.target.value }))}>
                  <option value="">— brak —</option>
                  {kontrahenci.map(k => <option key={k.id} value={k.id}>{k.nazwa}</option>)}
                </select>
              </div>
            )}
            {editItem && (
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Status</label>
                <select style={{ ...IS(), cursor: 'pointer' }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {Object.entries(config.statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48 }}>Anuluj</button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 48, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Zapisywanie…' : 'Zapisz'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
