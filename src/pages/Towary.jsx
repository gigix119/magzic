import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import { dodajStan, wydajStan, transferujStan, korektaStan, getRuchyTowaru } from '../utils/magazyn'
import {
  Plus, Minus, Search, Package, Pencil, Trash2,
  ArrowLeftRight, SlidersHorizontal, ChevronDown, ChevronUp,
  Warehouse, Clock,
} from 'lucide-react'

const IS = (err) => ({
  background: 'var(--input-bg)',
  border: `1px solid ${err ? '#ef4444' : 'var(--border)'}`,
  borderRadius: 8, color: 'var(--text)',
  padding: '8px 12px', fontSize: 14, width: '100%', outline: 'none',
})

const empty = { nazwa: '', typ: '', jednostka: '', kategoria_id: '', stan_minimalny: '', aktywny: true, cena_domyslna: '', poczatkowy_stan: '', poczatkowy_magazyn: '' }

const RUCH_LABELS = { purchase: 'Zakup', issue: 'Wydanie', transfer: 'Transfer', correction_plus: 'Korekta +', correction_minus: 'Korekta −' }
const RUCH_COLORS = { purchase: '#16a34a', issue: '#dc2626', transfer: '#3b82f6', correction_plus: '#16a34a', correction_minus: '#f59e0b' }

const ISSUE_POWODY = ['sprzątanie', 'technik', 'apartament', 'uszkodzenie', 'inne']

const HIST_PERIODS = [
  { key: '7d',  label: 'Tydzień' },
  { key: '30d', label: 'Miesiąc' },
  { key: '90d', label: '3 miesiące' },
  { key: 'all', label: 'Wszystko' },
]

function stanBadge(stan, min) {
  if (min === null || min === undefined) return <Badge variant="zinc">—</Badge>
  if (stan <= 0) return <Badge variant="red">Brak</Badge>
  if (stan < min) return <Badge variant="yellow">Niski</Badge>
  return <Badge variant="green">OK</Badge>
}

export default function Towary() {
  const { addToast } = useToast()
  const [items, setItems] = useState([])
  const [kategorie, setKategorie] = useState([])
  const [magazyny, setMagazyny] = useState([])
  const [stanyPerMag, setStanyPerMag] = useState([])
  const [stanMap, setStanMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState(empty)

  // Expandable rows
  const [expandedRow, setExpandedRow] = useState(null)
  const [rowRuchy, setRowRuchy] = useState({})
  const [rowLoading, setRowLoading] = useState(null)

  // Action modals: 'add' | 'issue' | 'transfer' | 'korekta' | null
  const [actionModal, setActionModal] = useState(null)
  const [actionTowar, setActionTowar] = useState(null)
  const [actionForm, setActionForm] = useState({})
  const [actionKorektaStan, setActionKorektaStan] = useState(null)
  const [actionSaving, setActionSaving] = useState(false)

  // Analytics: per-row tab, period filter, and fetched historia
  const [rowTab, setRowTab] = useState({})
  const [rowPeriod, setRowPeriod] = useState({})
  const [rowHistoria, setRowHistoria] = useState({})

  async function fetchData() {
    const [{ data: t, error: e1 }, { data: k }, { data: m }, { data: s }] = await Promise.all([
      supabase.from('towary').select('*, kategorie(nazwa)').order('nazwa'),
      supabase.from('kategorie').select('*').order('nazwa'),
      supabase.from('magazyny').select('id, nazwa').eq('aktywny', true).order('nazwa'),
      supabase.from('stany_magazynowe').select('towar_id, magazyn_id, ilosc, magazyny(nazwa)'),
    ])
    if (e1) { console.error(e1); addToast(e1.message, 'error') }
    setItems(t || [])
    setKategorie(k || [])
    setMagazyny(m || [])
    setStanyPerMag(s || [])

    const map = {}
    for (const row of s || []) map[row.towar_id] = (map[row.towar_id] || 0) + Number(row.ilosc)
    setStanMap(map)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    window.addEventListener('inventory-updated', fetchData)
    return () => window.removeEventListener('inventory-updated', fetchData)
  }, [])

  async function toggleRow(towarId) {
    if (expandedRow === towarId) { setExpandedRow(null); return }
    setExpandedRow(towarId)
    if (!rowRuchy[towarId]) {
      setRowLoading(towarId)
      const ruchy = await getRuchyTowaru(towarId, 5)
      setRowRuchy(r => ({ ...r, [towarId]: ruchy }))
      setRowLoading(null)
    }
  }

  async function fetchHistoria(towarId, period) {
    setRowHistoria(h => ({ ...h, [towarId]: { ...h[towarId], loading: true, error: null } }))
    let query = supabase
      .from('pozycje_faktury')
      .select('ilosc, cena_netto, faktury!inner(id, numer, data_zakupu, typ, kontrahenci!inner(id, nazwa))')
      .eq('towar_id', towarId)
      .eq('faktury.status', 'zatwierdzona')
      .order('data_zakupu', { foreignTable: 'faktury', ascending: false })
      .limit(200)
    if (period !== 'all') {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const dateFrom = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
      query = query.gte('faktury.data_zakupu', dateFrom)
    }
    const { data, error } = await query
    if (error) {
      setRowHistoria(h => ({ ...h, [towarId]: { data: [], suppliers: [], loading: false, error: error.message, period } }))
      return
    }
    const supplierMap = {}
    for (const row of data || []) {
      const sid = row.faktury?.kontrahenci?.id
      if (!sid) continue
      if (!supplierMap[sid]) {
        supplierMap[sid] = { id: sid, nazwa: row.faktury.kontrahenci.nazwa, totalValue: 0, totalQty: 0, count: 0, lastDate: null, prices: [] }
      }
      const s = supplierMap[sid]
      s.totalValue += Number(row.ilosc) * Number(row.cena_netto)
      s.totalQty += Number(row.ilosc)
      s.count++
      if (!s.lastDate || row.faktury.data_zakupu > s.lastDate) s.lastDate = row.faktury.data_zakupu
      s.prices.push({ date: row.faktury.data_zakupu, price: Number(row.cena_netto) })
    }
    const suppliers = Object.values(supplierMap).map(s => {
      const sorted = [...s.prices].sort((a, b) => b.date.localeCompare(a.date))
      const lastPrice = sorted[0]?.price ?? 0
      const prevPrice = sorted[1]?.price ?? null
      const trend = prevPrice === null ? 'same' : lastPrice > prevPrice ? 'up' : lastPrice < prevPrice ? 'down' : 'same'
      return { id: s.id, nazwa: s.nazwa, avgPrice: s.totalQty > 0 ? s.totalValue / s.totalQty : 0, count: s.count, lastDate: s.lastDate, lastPrice, trend }
    }).sort((a, b) => a.avgPrice - b.avgPrice)
    setRowHistoria(h => ({ ...h, [towarId]: { data: data || [], suppliers, loading: false, error: null, period } }))
  }

  // ── CRUD ────────────────────────────────────────────────────

  function openCreate() { setEditItem(null); setForm(empty); setErrors({}); setShowModal(true) }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      nazwa: item.nazwa || '', typ: item.typ || '', jednostka: item.jednostka || '',
      kategoria_id: item.kategoria_id || '', stan_minimalny: item.stan_minimalny ?? '',
      aktywny: item.aktywny, cena_domyslna: '', poczatkowy_stan: '', poczatkowy_magazyn: '',
    })
    setErrors({}); setShowModal(true)
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
      typ: form.typ || null,
      jednostka: form.jednostka || null,
      kategoria_id: form.kategoria_id || null,
      stan_minimalny: form.stan_minimalny !== '' ? Number(form.stan_minimalny) : null,
      aktywny: form.aktywny,
    }

    let error, newId
    if (editItem) {
      ({ error } = await supabase.from('towary').update(payload).eq('id', editItem.id))
      newId = editItem.id
    } else {
      const { data, error: e } = await supabase.from('towary').insert([payload]).select('id').single()
      error = e
      newId = data?.id
    }

    if (error) { console.error(error); addToast(error.message, 'error'); setSaving(false); return }

    // Początkowy stan jeśli podano
    if (!editItem && form.poczatkowy_stan && form.poczatkowy_magazyn && newId) {
      const result = await dodajStan(newId, form.poczatkowy_magazyn, Number(form.poczatkowy_stan), 'Stan początkowy')
      if (!result.success) addToast(`Towar dodany, ale błąd stanu: ${result.error}`, 'error')
    }

    addToast(editItem ? 'Towar zaktualizowany' : 'Towar dodany', 'success')
    setShowModal(false)
    fetchData()
    setSaving(false)
  }

  async function handleDelete(item) {
    if (!window.confirm(`Usunąć towar "${item.nazwa}"?`)) return
    const { error } = await supabase.from('towary').delete().eq('id', item.id)
    if (error) { console.error(error); addToast(error.message, 'error') }
    else { addToast('Towar usunięty', 'success'); fetchData() }
  }

  // ── Action modals ───────────────────────────────────────────

  function openAction(type, towar) {
    setActionTowar(towar)
    setActionForm({ magazyn_id: '', z_magazyn_id: '', do_magazyn_id: '', ilosc: '', powod: '', nowaIlosc: '' })
    setActionKorektaStan(null)
    setActionModal(type)
  }

  async function loadKorektaStan(towarId, magazynId) {
    if (!magazynId) { setActionKorektaStan(null); return }
    const { data } = await supabase.from('stany_magazynowe')
      .select('ilosc').eq('towar_id', towarId).eq('magazyn_id', magazynId).maybeSingle()
    setActionKorektaStan(data?.ilosc ?? 0)
  }

  async function handleAction() {
    if (!actionTowar) return
    setActionSaving(true)
    let result

    if (actionModal === 'add') {
      result = await dodajStan(actionTowar.id, actionForm.magazyn_id, Number(actionForm.ilosc), actionForm.powod || null)
    } else if (actionModal === 'issue') {
      result = await wydajStan(actionTowar.id, actionForm.magazyn_id, Number(actionForm.ilosc), actionForm.powod || null)
    } else if (actionModal === 'transfer') {
      result = await transferujStan(actionTowar.id, actionForm.z_magazyn_id, actionForm.do_magazyn_id, Number(actionForm.ilosc), actionForm.powod || null)
    } else if (actionModal === 'korekta') {
      result = await korektaStan(actionTowar.id, actionForm.magazyn_id, Number(actionForm.nowaIlosc), actionForm.powod)
    }

    if (result?.success) {
      addToast('Operacja wykonana pomyślnie', 'success')
      setActionModal(null)
      setRowRuchy(r => { const n = { ...r }; delete n[actionTowar.id]; return n })
      fetchData()
    } else {
      addToast(result?.error || 'Błąd operacji', 'error')
    }
    setActionSaving(false)
  }

  if (loading) return <Spinner />

  const filtered = items.filter(i =>
    i.nazwa.toLowerCase().includes(search.toLowerCase()) ||
    (i.typ || '').toLowerCase().includes(search.toLowerCase())
  )

  const ACTION_TITLES = { add: 'Dodaj stan', issue: 'Wydaj / zużyj', transfer: 'Transfer między magazynami', korekta: 'Korekta stanu' }
  const canSubmitAction = () => {
    if (!actionForm.ilosc && actionModal !== 'korekta') return false
    if (actionModal === 'add' || actionModal === 'issue') return actionForm.magazyn_id && Number(actionForm.ilosc) > 0
    if (actionModal === 'transfer') return actionForm.z_magazyn_id && actionForm.do_magazyn_id && Number(actionForm.ilosc) > 0 && actionForm.z_magazyn_id !== actionForm.do_magazyn_id
    if (actionModal === 'korekta') return actionForm.magazyn_id && actionForm.nowaIlosc !== '' && Number(actionForm.nowaIlosc) >= 0 && actionForm.powod?.trim()
    return false
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 page-header">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Towary</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{items.length} towarów w bazie</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white page-header-btn" style={{ background: '#3b82f6' }}>
          <Plus size={16} /> Dodaj towar
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
        <input style={{ ...IS(), paddingLeft: 36 }} placeholder="Szukaj towarów..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="rounded-xl overflow-hidden table-scroll-x" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm" style={{ minWidth: 560 }}>
          <thead>
            <tr style={{ background: 'var(--table-head)', borderBottom: '1px solid var(--border)' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-2)' }}>Nazwa</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell" style={{ color: 'var(--text-2)' }}>Typ</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell" style={{ color: 'var(--text-2)' }}>Kategoria</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-2)' }}>Jedn.</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-2)' }}>Stan</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--text-2)' }}>Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12" style={{ color: 'var(--muted)', background: 'var(--table-even)' }}>
                  <Package size={32} className="mx-auto mb-2 opacity-30" />
                  <p>Brak towarów</p>
                </td>
              </tr>
            ) : (
              filtered.map((item, idx) => {
                const total = stanMap[item.id] || 0
                const isExpanded = expandedRow === item.id
                const perMag = stanyPerMag.filter(s => s.towar_id === item.id && Number(s.ilosc) > 0)
                const ruchy = rowRuchy[item.id] || []
                const tab = rowTab[item.id] || 'stany'
                const period = rowPeriod[item.id] || '30d'
                const hist = rowHistoria[item.id]

                return (
                  <>
                    <tr
                      key={item.id}
                      className="table-row"
                      style={{
                        background: isExpanded ? 'var(--table-odd)' : idx % 2 === 0 ? 'var(--table-even)' : 'var(--table-odd)',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleRow(item.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isExpanded
                            ? <ChevronUp size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                            : <ChevronDown size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
                          <span className="font-medium" style={{ color: 'var(--text)' }}>{item.nazwa}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell" style={{ color: 'var(--text-2)' }}>{item.typ || '—'}</td>
                      <td className="px-4 py-3 hidden sm:table-cell" style={{ color: 'var(--text-2)' }}>{item.kategorie?.nazwa || '—'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-2)' }}>{item.jednostka || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>{total}</td>
                      <td className="px-4 py-3 text-center">{stanBadge(total, item.stan_minimalny)}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openAction('add', item)} className="p-1.5 rounded-lg" style={{ color: '#16a34a' }} title="Dodaj stan"><Plus size={12} /></button>
                          <button onClick={() => openAction('issue', item)} className="p-1.5 rounded-lg" style={{ color: '#dc2626' }} title="Wydaj"><Minus size={12} /></button>
                          <button onClick={() => openAction('transfer', item)} className="p-1.5 rounded-lg" style={{ color: '#3b82f6' }} title="Transfer"><ArrowLeftRight size={12} /></button>
                          <button onClick={() => openAction('korekta', item)} className="p-1.5 rounded-lg" style={{ color: '#f59e0b' }} title="Korekta"><SlidersHorizontal size={12} /></button>
                          <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-2)' }} title="Edytuj"><Pencil size={13} /></button>
                          <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg" style={{ color: '#dc2626' }} title="Usuń"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr key={`${item.id}-exp`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td colSpan={7} style={{ padding: 0, background: 'var(--table-sub)' }}>

                          {/* Tab bar */}
                          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingLeft: 12 }}>
                            {[['stany', 'Stany i ruchy'], ['historia', 'Historia zakupów']].map(([key, label]) => (
                              <button
                                key={key}
                                onClick={() => {
                                  setRowTab(t => ({ ...t, [item.id]: key }))
                                  if (key === 'historia') {
                                    const cur = rowHistoria[item.id]
                                    if (!cur || cur.period !== period) fetchHistoria(item.id, period)
                                  }
                                }}
                                style={{
                                  padding: '7px 14px',
                                  fontSize: 12,
                                  fontWeight: tab === key ? 600 : 400,
                                  color: tab === key ? '#3b82f6' : 'var(--text-2)',
                                  borderBottom: `2px solid ${tab === key ? '#3b82f6' : 'transparent'}`,
                                  background: 'none',
                                  cursor: 'pointer',
                                  marginBottom: -1,
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>

                          {/* Stany i ruchy tab */}
                          {tab === 'stany' && (
                            <div className="expanded-row-grid" style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                              {/* Stany per magazyn */}
                              <div>
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Warehouse size={13} style={{ color: 'var(--muted)' }} />
                                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Stany w magazynach</span>
                                </div>
                                {perMag.length === 0 ? (
                                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Brak stanów</p>
                                ) : (
                                  <div className="space-y-1">
                                    {perMag.map(s => (
                                      <div key={s.id} className="flex items-center justify-between rounded px-2.5 py-1.5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                                        <span className="text-xs" style={{ color: 'var(--text-2)' }}>{s.magazyny?.nazwa || '—'}</span>
                                        <span className="text-xs font-semibold" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>
                                          {Number(s.ilosc)} {item.jednostka || ''}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Ostatnie ruchy */}
                              <div>
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Clock size={13} style={{ color: 'var(--muted)' }} />
                                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Ostatnie ruchy</span>
                                </div>
                                {rowLoading === item.id ? (
                                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Ładowanie...</p>
                                ) : ruchy.length === 0 ? (
                                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Brak ruchów</p>
                                ) : (
                                  <div className="space-y-1">
                                    {ruchy.map(r => (
                                      <div key={r.id} className="flex items-center justify-between rounded px-2.5 py-1.5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="text-xs font-semibold flex-shrink-0" style={{ color: RUCH_COLORS[r.typ] || 'var(--text-2)' }}>
                                            {RUCH_LABELS[r.typ] || r.typ}
                                          </span>
                                          <span className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                                            {r.powod || (r.mz?.nazwa && r.md?.nazwa ? `${r.mz.nazwa} → ${r.md.nazwa}` : r.mz?.nazwa || r.md?.nazwa || '')}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                          <span className="text-xs" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>{Number(r.ilosc)}</span>
                                          <span className="text-xs" style={{ color: 'var(--muted)' }}>{new Date(r.created_at).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Historia zakupów tab */}
                          {tab === 'historia' && (
                            <div style={{ padding: '12px 16px' }}>
                              {/* Period filter */}
                              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                                {HIST_PERIODS.map(p => (
                                  <button
                                    key={p.key}
                                    onClick={() => {
                                      setRowPeriod(rp => ({ ...rp, [item.id]: p.key }))
                                      fetchHistoria(item.id, p.key)
                                    }}
                                    style={{
                                      padding: '3px 10px',
                                      fontSize: 11,
                                      borderRadius: 6,
                                      fontWeight: period === p.key ? 600 : 400,
                                      background: period === p.key ? '#3b82f6' : 'var(--card)',
                                      color: period === p.key ? '#fff' : 'var(--text-2)',
                                      border: `1px solid ${period === p.key ? '#3b82f6' : 'var(--border)'}`,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>

                              {/* Loading / error */}
                              {(!hist || hist.loading) && (
                                <p className="text-xs" style={{ color: 'var(--muted)' }}>Ładowanie...</p>
                              )}
                              {hist && !hist.loading && hist.error && (
                                <p className="text-xs" style={{ color: '#ef4444' }}>Błąd: {hist.error}</p>
                              )}

                              {/* Data */}
                              {hist && !hist.loading && !hist.error && (
                                <>
                                  {/* Supplier average price cards */}
                                  {hist.suppliers.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                      {hist.suppliers.map((s, si) => (
                                        <div
                                          key={s.id}
                                          style={{
                                            border: `1px solid ${si === 0 ? '#16a34a' : 'var(--border)'}`,
                                            borderRadius: 8,
                                            padding: '8px 12px',
                                            background: 'var(--card)',
                                            minWidth: 150,
                                            flex: '1 1 150px',
                                            maxWidth: 220,
                                          }}
                                        >
                                          <p className="text-xs font-semibold mb-1 truncate" style={{ color: 'var(--text)' }} title={s.nazwa}>{s.nazwa}</p>
                                          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                                            {s.avgPrice.toFixed(2)} zł{' '}
                                            <span style={{ fontSize: 11, fontWeight: 400, color: s.trend === 'up' ? '#ef4444' : s.trend === 'down' ? '#16a34a' : 'var(--muted)' }}>
                                              {s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '='}
                                            </span>
                                          </p>
                                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                                            {s.count} {s.count === 1 ? 'faktura' : s.count < 5 ? 'faktury' : 'faktur'} · {s.lastDate || '—'}
                                          </p>
                                          {si === 0 && <p className="text-xs mt-1" style={{ color: '#16a34a', fontWeight: 600 }}>Najlepsza cena</p>}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* History table */}
                                  {hist.data.length === 0 ? (
                                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Brak faktur zakupu w wybranym okresie.</p>
                                  ) : (
                                    <div className="table-scroll-x">
                                      <table className="w-full text-xs" style={{ minWidth: 480, borderCollapse: 'collapse' }}>
                                        <thead>
                                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            {['Data', 'Numer faktury', 'Kontrahent', 'Ilość', 'Cena netto', 'Suma netto'].map(h => (
                                              <th key={h} className="text-left py-1.5 px-2 font-semibold" style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {hist.data.map((row, ri) => (
                                            <tr key={ri} style={{ borderBottom: '1px solid var(--border)', background: ri % 2 === 0 ? 'var(--table-even)' : 'var(--table-odd)' }}>
                                              <td className="py-1.5 px-2" style={{ color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                                                {row.faktury?.data_zakupu ? new Date(row.faktury.data_zakupu).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                                              </td>
                                              <td className="py-1.5 px-2" style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>{row.faktury?.numer || '—'}</td>
                                              <td className="py-1.5 px-2" style={{ color: 'var(--text-2)' }}>{row.faktury?.kontrahenci?.nazwa || '—'}</td>
                                              <td className="py-1.5 px-2 text-right" style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
                                                {Number(row.ilosc)} {item.jednostka || ''}
                                              </td>
                                              <td className="py-1.5 px-2 text-right" style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
                                                {Number(row.cena_netto).toFixed(2)} zł
                                              </td>
                                              <td className="py-1.5 px-2 text-right" style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
                                                {(Number(row.ilosc) * Number(row.cena_netto)).toFixed(2)} zł
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                        </td>
                      </tr>
                    )}
                  </>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── ACTION MODAL ──────────────────────────────────────── */}
      {actionModal && actionTowar && (
        <Modal title={`${ACTION_TITLES[actionModal]} — ${actionTowar.nazwa}`} onClose={() => setActionModal(null)} maxWidth={440}>
          <div className="space-y-4">
            {(actionModal === 'add' || actionModal === 'issue') && (
              <>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Magazyn *</label>
                  <select style={IS()} value={actionForm.magazyn_id} onChange={e => setActionForm(f => ({ ...f, magazyn_id: e.target.value }))}>
                    <option value="">— wybierz magazyn —</option>
                    {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Ilość *</label>
                  <input type="number" min="0.01" step="0.01" style={IS()} value={actionForm.ilosc} onChange={e => setActionForm(f => ({ ...f, ilosc: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>
                    {actionModal === 'issue' ? 'Powód *' : 'Powód (opcjonalnie)'}
                  </label>
                  {actionModal === 'issue' ? (
                    <select style={IS()} value={actionForm.powod} onChange={e => setActionForm(f => ({ ...f, powod: e.target.value }))}>
                      <option value="">— wybierz powód —</option>
                      {ISSUE_POWODY.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <input style={IS()} value={actionForm.powod} onChange={e => setActionForm(f => ({ ...f, powod: e.target.value }))} placeholder="Opcjonalny powód..." />
                  )}
                </div>
              </>
            )}

            {actionModal === 'transfer' && (
              <>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Magazyn źródłowy *</label>
                  <select style={IS()} value={actionForm.z_magazyn_id} onChange={e => setActionForm(f => ({ ...f, z_magazyn_id: e.target.value }))}>
                    <option value="">— skąd —</option>
                    {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Magazyn docelowy *</label>
                  <select style={IS()} value={actionForm.do_magazyn_id} onChange={e => setActionForm(f => ({ ...f, do_magazyn_id: e.target.value }))}>
                    <option value="">— dokąd —</option>
                    {magazyny.filter(m => m.id !== actionForm.z_magazyn_id).map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Ilość *</label>
                  <input type="number" min="0.01" step="0.01" style={IS()} value={actionForm.ilosc} onChange={e => setActionForm(f => ({ ...f, ilosc: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Powód</label>
                  <input style={IS()} value={actionForm.powod} onChange={e => setActionForm(f => ({ ...f, powod: e.target.value }))} placeholder="Opcjonalny powód..." />
                </div>
              </>
            )}

            {actionModal === 'korekta' && (
              <>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Magazyn *</label>
                  <select style={IS()} value={actionForm.magazyn_id} onChange={e => {
                    setActionForm(f => ({ ...f, magazyn_id: e.target.value }))
                    loadKorektaStan(actionTowar.id, e.target.value)
                  }}>
                    <option value="">— wybierz magazyn —</option>
                    {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
                  </select>
                </div>
                {actionKorektaStan !== null && (
                  <div className="rounded-lg px-3 py-2.5 text-sm" style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}>
                    Aktualny stan: <span className="font-semibold" style={{ fontFamily: 'DM Mono, monospace' }}>{actionKorektaStan} {actionTowar.jednostka || ''}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Nowa ilość *</label>
                  <input type="number" min="0" step="0.01" style={IS()} value={actionForm.nowaIlosc} onChange={e => setActionForm(f => ({ ...f, nowaIlosc: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Powód korekty *</label>
                  <input style={IS()} value={actionForm.powod} onChange={e => setActionForm(f => ({ ...f, powod: e.target.value }))} placeholder="np. Inwentaryzacja, błąd wpisania..." />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setActionModal(null)} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>Anuluj</button>
              <button
                type="button"
                onClick={handleAction}
                disabled={actionSaving || !canSubmitAction()}
                className="flex-1 rounded-lg py-2 text-sm font-medium text-white"
                style={{ background: canSubmitAction() ? '#3b82f6' : '#6b7280', opacity: actionSaving ? 0.7 : 1 }}
              >
                {actionSaving ? 'Zapisywanie...' : 'Zapisz'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── CRUD MODAL ────────────────────────────────────────── */}
      {showModal && (
        <Modal title={editItem ? 'Edytuj towar' : 'Nowy towar'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Nazwa *</label>
              <input style={IS(errors.nazwa)} value={form.nazwa} onChange={e => setForm(f => ({ ...f, nazwa: e.target.value }))} placeholder="np. Płyn do mycia podłóg" />
              {errors.nazwa && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 modal-2col">
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Typ</label>
                <input style={IS()} value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value }))} placeholder="np. Chemiczny" />
              </div>
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Jednostka</label>
                <input style={IS()} value={form.jednostka} onChange={e => setForm(f => ({ ...f, jednostka: e.target.value }))} placeholder="np. litr, szt" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 modal-2col">
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Kategoria</label>
                <select style={IS()} value={form.kategoria_id} onChange={e => setForm(f => ({ ...f, kategoria_id: e.target.value }))}>
                  <option value="">— brak —</option>
                  {kategorie.map(k => <option key={k.id} value={k.id}>{k.nazwa}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Stan minimalny</label>
                <input style={IS()} type="number" min="0" value={form.stan_minimalny} onChange={e => setForm(f => ({ ...f, stan_minimalny: e.target.value }))} placeholder="0" />
              </div>
            </div>

            {!editItem && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--muted)' }}>Stan początkowy (opcjonalnie)</p>
                <div className="grid grid-cols-2 gap-3 modal-2col">
                  <div>
                    <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Ilość</label>
                    <input type="number" min="0" step="0.01" style={IS()} value={form.poczatkowy_stan} onChange={e => setForm(f => ({ ...f, poczatkowy_stan: e.target.value }))} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Magazyn</label>
                    <select style={IS()} value={form.poczatkowy_magazyn} onChange={e => setForm(f => ({ ...f, poczatkowy_magazyn: e.target.value }))}>
                      <option value="">— wybierz —</option>
                      {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input type="checkbox" id="t_aktywny" checked={form.aktywny} onChange={e => setForm(f => ({ ...f, aktywny: e.target.checked }))} style={{ accentColor: '#3b82f6' }} />
              <label htmlFor="t_aktywny" className="text-sm" style={{ color: 'var(--text-2)' }}>Aktywny</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>Anuluj</button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg py-2 text-sm font-medium text-white" style={{ background: '#3b82f6', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Zapisywanie...' : editItem ? 'Zapisz zmiany' : 'Dodaj towar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
