import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import { wykonajPakiet } from '../utils/magazyn'
import { Plus, Sparkles, Trash2, CheckCircle2, XCircle, ChevronDown, ChevronUp, Pencil, PlayCircle, AlertCircle } from 'lucide-react'

const IS = (err) => ({
  background: 'var(--input-bg)',
  border: `1px solid ${err ? '#ef4444' : 'var(--border)'}`,
  borderRadius: 8, color: 'var(--text)',
  padding: '8px 12px', fontSize: 14, width: '100%', outline: 'none',
})

const emptyItem = { towar_id: '', ilosc: '' }
const emptyForm = { nazwa: '', opis: '', aktywny: true }

export default function Pakiety() {
  const { addToast } = useToast()
  const [pakiety, setPakiety] = useState([])
  const [elementy, setElementy] = useState({})
  const [stany, setStany] = useState({})
  const [towary, setTowary] = useState([])
  const [magazyny, setMagazyny] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState(emptyForm)
  const [formItems, setFormItems] = useState([{ ...emptyItem }])

  // execute modal
  const [execPak, setExecPak] = useState(null)
  const [execMagId, setExecMagId] = useState('')
  const [execing, setExecing] = useState(false)
  const [execBraki, setExecBraki] = useState([])

  async function fetchData() {
    const [{ data: pak, error: e1 }, { data: elem }, { data: stanyRaw }, { data: t }, { data: mag }] = await Promise.all([
      supabase.from('pakiety_sprzatania').select('*').order('nazwa'),
      supabase.from('elementy_pakietu').select('*, towary(id, nazwa, jednostka)'),
      supabase.from('stany_magazynowe').select('towar_id, ilosc'),
      supabase.from('towary').select('id, nazwa, jednostka').eq('aktywny', true).order('nazwa'),
      supabase.from('magazyny').select('id, nazwa').eq('aktywny', true).order('nazwa'),
    ])
    if (e1) { console.error(e1); addToast(e1.message, 'error') }
    setPakiety(pak || [])
    setTowary(t || [])

    const elemMap = {}
    for (const e of elem || []) {
      if (!elemMap[e.pakiet_id]) elemMap[e.pakiet_id] = []
      elemMap[e.pakiet_id].push(e)
    }
    setElementy(elemMap)

    const stanMap = {}
    for (const s of stanyRaw || []) stanMap[s.towar_id] = (stanMap[s.towar_id] || 0) + Number(s.ilosc)
    setStany(stanMap)
    setMagazyny(mag || [])
    setLoading(false)
  }

  function openExec(pak) {
    setExecPak(pak)
    setExecMagId(magazyny[0]?.id || '')
    setExecBraki([])
  }

  async function handleExec() {
    if (!execMagId) { addToast('Wybierz magazyn', 'error'); return }
    setExecing(true)
    setExecBraki([])
    const result = await wykonajPakiet(execPak.id, execMagId)
    if (result.success) {
      addToast(`Pakiet "${execPak.nazwa}" wykonany`, 'success')
      setExecPak(null)
      fetchData()
    } else if (result.braki) {
      setExecBraki(result.braki)
    } else {
      addToast(result.error || 'Błąd wykonania pakietu', 'error')
    }
    setExecing(false)
  }

  useEffect(() => { fetchData() }, [])

  function calcMax(pakietId) {
    const items = elementy[pakietId] || []
    if (!items.length) return 0
    let max = Infinity
    for (const el of items) {
      const needed = Number(el.ilosc)
      if (needed <= 0) continue
      max = Math.min(max, Math.floor((stany[el.towar_id] || 0) / needed))
    }
    return max === Infinity ? 0 : max
  }

  function openCreate() {
    setEditItem(null); setForm(emptyForm); setFormItems([{ ...emptyItem }]); setErrors({}); setShowModal(true)
  }

  function openEdit(pak) {
    setEditItem(pak)
    setForm({ nazwa: pak.nazwa || '', opis: pak.opis || '', aktywny: pak.aktywny })
    const items = elementy[pak.id] || []
    setFormItems(items.length ? items.map(e => ({ towar_id: e.towar_id, ilosc: e.ilosc })) : [{ ...emptyItem }])
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

    const payload = { nazwa: form.nazwa.trim(), opis: form.opis || null, aktywny: form.aktywny }
    let pakId, error

    if (editItem) {
      ({ error } = await supabase.from('pakiety_sprzatania').update(payload).eq('id', editItem.id))
      pakId = editItem.id
      if (!error) {
        await supabase.from('elementy_pakietu').delete().eq('pakiet_id', pakId)
      }
    } else {
      let data
      ;({ data, error } = await supabase.from('pakiety_sprzatania').insert([payload]).select().single())
      if (data) pakId = data.id
    }

    if (error) {
      console.error(error); addToast(error.message, 'error')
      setSaving(false); return
    }

    const valid = formItems.filter(i => i.towar_id && i.ilosc)
    if (valid.length && pakId) {
      const { error: eElem } = await supabase.from('elementy_pakietu').insert(
        valid.map(i => ({ pakiet_id: pakId, towar_id: i.towar_id, ilosc: Number(i.ilosc) }))
      )
      if (eElem) { console.error(eElem); addToast(eElem.message, 'error') }
    }

    addToast(editItem ? 'Pakiet zaktualizowany' : 'Pakiet dodany', 'success')
    setSaving(false); setShowModal(false); fetchData()
  }

  async function handleDelete(pak) {
    if (!window.confirm(`Usunąć pakiet "${pak.nazwa}"?`)) return
    const { error } = await supabase.from('pakiety_sprzatania').delete().eq('id', pak.id)
    if (error) { console.error(error); addToast(error.message, 'error') }
    else { addToast('Pakiet usunięty', 'success'); fetchData() }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 page-header">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Pakiety sprzątania</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{pakiety.length} pakietów</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white page-header-btn" style={{ background: '#3b82f6' }}>
          <Plus size={16} /> Nowy pakiet
        </button>
      </div>

      <div className="space-y-3">
        {pakiety.length === 0 ? (
          <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            <Sparkles size={40} className="mx-auto mb-3 opacity-30" />
            <p>Brak pakietów</p>
          </div>
        ) : (
          pakiety.map(pak => {
            const items = elementy[pak.id] || []
            const max = calcMax(pak.id)
            const isOpen = expanded === pak.id
            return (
              <div key={pak.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3 px-5 py-4" style={{ background: isOpen ? 'var(--table-odd)' : 'transparent' }}>
                  <button className="flex-1 flex items-center gap-4 text-left min-w-0" onClick={() => setExpanded(isOpen ? null : pak.id)}>
                    <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: 'rgba(139,92,246,0.1)' }}>
                      <Sparkles size={18} style={{ color: '#8b5cf6' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium" style={{ color: 'var(--text)' }}>{pak.nazwa}</p>
                      {pak.opis && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-2)' }}>{pak.opis}</p>}
                    </div>
                    <div className="text-right flex-shrink-0 mr-1">
                      <p className="text-xs" style={{ color: 'var(--text-2)' }}>Możliwe realizacje</p>
                      <div className="flex items-center gap-1.5 justify-end mt-0.5">
                        {max > 0 ? <CheckCircle2 size={13} style={{ color: '#16a34a' }} /> : <XCircle size={13} style={{ color: '#dc2626' }} />}
                        <span className="font-bold" style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, color: 'var(--text)' }}>{max}</span>
                        <span className="text-xs" style={{ color: 'var(--text-2)' }}>szt.</span>
                      </div>
                    </div>
                    <Badge variant={pak.aktywny ? 'green' : 'zinc'}>{pak.aktywny ? 'Aktywny' : 'Nieaktywny'}</Badge>
                    {isOpen ? <ChevronUp size={16} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--muted)' }} />}
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {pak.aktywny && (
                      <button onClick={() => openExec(pak)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#8b5cf6' }} title="Wykonaj pakiet">
                        <PlayCircle size={13} /> Wykonaj
                      </button>
                    )}
                    <button onClick={() => openEdit(pak)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-2)' }} title="Edytuj"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(pak)} className="p-1.5 rounded-lg" style={{ color: '#dc2626' }} title="Usuń"><Trash2 size={13} /></button>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {items.length === 0 ? (
                      <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>Brak elementów w pakiecie</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: 'var(--table-sub)' }}>
                            <th className="text-left px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Towar</th>
                            <th className="text-right px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Wymagana ilość</th>
                            <th className="text-right px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Dostępne</th>
                            <th className="text-center px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(el => {
                            const dostepny = stany[el.towar_id] || 0
                            const needed = Number(el.ilosc)
                            const ok = dostepny >= needed
                            return (
                              <tr key={el.id} className="table-row" style={{ borderTop: '1px solid var(--border)' }}>
                                <td className="px-5 py-3" style={{ color: 'var(--text)' }}>{el.towary?.nazwa || '—'}</td>
                                <td className="px-5 py-3 text-right" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>{needed} {el.towary?.jednostka || ''}</td>
                                <td className="px-5 py-3 text-right font-semibold" style={{ fontFamily: 'DM Mono, monospace', color: ok ? '#16a34a' : '#dc2626' }}>{dostepny}</td>
                                <td className="px-5 py-3 text-center"><Badge variant={ok ? 'green' : 'red'}>{ok ? 'OK' : 'Brak'}</Badge></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Execute modal */}
      {execPak && (
        <Modal title={`Wykonaj: ${execPak.nazwa}`} onClose={() => setExecPak(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Magazyn źródłowy</label>
              <select style={IS()} value={execMagId} onChange={e => { setExecMagId(e.target.value); setExecBraki([]) }}>
                <option value="">-- wybierz --</option>
                {magazyny.map(m => <option key={m.id} value={m.id}>{m.nazwa}</option>)}
              </select>
            </div>

            {execMagId && (
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--table-sub)' }}>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Towar</th>
                      <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Potrzeba</th>
                      <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Dostępne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(elementy[execPak.id] || []).map(el => {
                      const dostepne = stany[el.towar_id] || 0
                      const ok = dostepne >= Number(el.ilosc)
                      return (
                        <tr key={el.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td className="px-4 py-2" style={{ color: 'var(--text)' }}>{el.towary?.nazwa || '—'}</td>
                          <td className="px-4 py-2 text-right" style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>{el.ilosc}</td>
                          <td className="px-4 py-2 text-right font-semibold" style={{ fontFamily: 'DM Mono, monospace', color: ok ? '#16a34a' : '#dc2626' }}>{dostepne}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {execBraki.length > 0 && (
              <div className="rounded-lg p-3 flex gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <AlertCircle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                <div className="text-sm" style={{ color: '#ef4444' }}>
                  <p className="font-medium mb-1">Niewystarczające stany:</p>
                  {execBraki.map((b, i) => (
                    <p key={i}>{b.nazwa}: potrzeba {b.potrzebne}, dostępne {b.dostepne}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setExecPak(null)} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>Anuluj</button>
              <button onClick={handleExec} disabled={execing || !execMagId} className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-white" style={{ background: '#8b5cf6', opacity: (execing || !execMagId) ? 0.7 : 1 }}>
                <PlayCircle size={15} />
                {execing ? 'Wykonywanie...' : 'Wykonaj pakiet'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal title={editItem ? 'Edytuj pakiet' : 'Nowy pakiet sprzątania'} onClose={() => setShowModal(false)} maxWidth={580}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Nazwa pakietu *</label>
              <input style={IS(errors.nazwa)} value={form.nazwa} onChange={e => setForm(f => ({ ...f, nazwa: e.target.value }))} placeholder="np. Pakiet standard 2-pokojowe" />
              {errors.nazwa && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Opis</label>
              <textarea style={{ ...IS(), resize: 'vertical', minHeight: 60 }} value={form.opis} onChange={e => setForm(f => ({ ...f, opis: e.target.value }))} placeholder="Opcjonalny opis..." />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Elementy pakietu</label>
                <button type="button" onClick={() => setFormItems(p => [...p, { ...emptyItem }])} className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ background: 'var(--table-sub)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  <Plus size={12} /> Dodaj element
                </button>
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {formItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Towar</label>
                      <select style={{ ...IS(), padding: '6px 10px' }} value={item.towar_id} onChange={e => setFormItems(p => p.map((x, i) => i === idx ? { ...x, towar_id: e.target.value } : x))}>
                        <option value="">— wybierz —</option>
                        {towary.map(t => <option key={t.id} value={t.id}>{t.nazwa} ({t.jednostka || 'szt'})</option>)}
                      </select>
                    </div>
                    <div style={{ width: 90 }}>
                      <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Ilość</label>
                      <input style={{ ...IS(), padding: '6px 10px' }} type="number" min="0" step="0.01" value={item.ilosc} onChange={e => setFormItems(p => p.map((x, i) => i === idx ? { ...x, ilosc: e.target.value } : x))} placeholder="0" />
                    </div>
                    <button type="button" onClick={() => setFormItems(p => p.filter((_, i) => i !== idx))} disabled={formItems.length === 1} className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: 'var(--table-sub)', color: 'var(--text-2)', flexShrink: 0, border: '1px solid var(--border)', opacity: formItems.length === 1 ? 0.4 : 1 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="pak_a" checked={form.aktywny} onChange={e => setForm(f => ({ ...f, aktywny: e.target.checked }))} style={{ accentColor: '#3b82f6' }} />
              <label htmlFor="pak_a" className="text-sm" style={{ color: 'var(--text-2)' }}>Aktywny</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>Anuluj</button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg py-2 text-sm font-medium text-white" style={{ background: '#3b82f6', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Zapisywanie...' : editItem ? 'Zapisz zmiany' : 'Utwórz pakiet'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
