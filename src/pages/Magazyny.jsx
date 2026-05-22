import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import { dodajStan, wydajStan, transferujStan, korektaStan } from '../utils/magazyn'
import {
  Plus, Warehouse, ChevronDown, ChevronUp, MapPin, Pencil, Trash2,
  PackageMinus, ArrowLeftRight, SlidersHorizontal, PackagePlus,
} from 'lucide-react'

const IS = (err) => ({
  background: 'var(--input-bg)',
  border: `1px solid ${err ? '#ef4444' : 'var(--border)'}`,
  borderRadius: 8,
  color: 'var(--text)',
  padding: '8px 12px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
})

const empty = { nazwa: '', lokalizacja: '', opis: '', aktywny: true }

const POWODY = ['sprzątanie', 'technik', 'apartament', 'uszkodzenie', 'inne']

function StanBadge({ ilosc, min }) {
  if (Number(ilosc) <= 0) return <Badge variant="red">Brak</Badge>
  if (min && Number(ilosc) < Number(min)) return <Badge variant="yellow">Niski</Badge>
  return <Badge variant="green">OK</Badge>
}

export default function Magazyny() {
  const { addToast } = useToast()
  const [magazyny, setMagazyny] = useState([])
  const [stany, setStany] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState(empty)

  // action modal
  const [actionModal, setActionModal] = useState(null) // null | 'add' | 'issue' | 'transfer' | 'korekta'
  const [actionRow, setActionRow] = useState(null)     // stany row
  const [actionMag, setActionMag] = useState(null)     // current magazyn
  const [aForm, setAForm] = useState({})
  const [aSaving, setASaving] = useState(false)

  async function fetchData() {
    const [{ data: mag, error: e1 }, { data: s }] = await Promise.all([
      supabase.from('magazyny').select('*').order('nazwa'),
      supabase.from('stany_magazynowe').select('*, towary(id, nazwa, jednostka, stan_minimalny, kategoria)'),
    ])
    if (e1) { console.error(e1); addToast(e1.message, 'error') }
    setMagazyny(mag || [])
    setStany(s || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    window.addEventListener('inventory-updated', fetchData)
    return () => window.removeEventListener('inventory-updated', fetchData)
  }, [])

  function getStanyFor(id) {
    return stany.filter(s => s.magazyn_id === id && Number(s.ilosc) > 0)
  }

  function getSummary(id) {
    const items = stany.filter(s => s.magazyn_id === id && Number(s.ilosc) > 0)
    const liczbaTowarow = new Set(items.map(s => s.towar_id)).size
    const lacznaIlosc = items.reduce((sum, s) => sum + Number(s.ilosc), 0)
    const belowMin = items.filter(s => {
      const min = s.towary?.stan_minimalny
      return min != null && Number(s.ilosc) < Number(min)
    }).length
    return { count: liczbaTowarow, total: lacznaIlosc, belowMin }
  }

  function openCreate() { setEditItem(null); setForm(empty); setErrors({}); setShowModal(true) }

  function openEdit(item) {
    setEditItem(item)
    setForm({ nazwa: item.nazwa || '', lokalizacja: item.lokalizacja || '', opis: item.opis || '', aktywny: item.aktywny })
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
    const payload = { nazwa: form.nazwa.trim(), lokalizacja: form.lokalizacja || null, opis: form.opis || null, aktywny: form.aktywny }
    let error
    if (editItem) {
      ({ error } = await supabase.from('magazyny').update(payload).eq('id', editItem.id))
    } else {
      ({ error } = await supabase.from('magazyny').insert([payload]))
    }
    if (error) { console.error(error); addToast(error.message, 'error') }
    else { addToast(editItem ? 'Magazyn zaktualizowany' : 'Magazyn dodany', 'success'); setShowModal(false); fetchData() }
    setSaving(false)
  }

  async function handleDelete(item) {
    if (!window.confirm(`Usunąć magazyn "${item.nazwa}"?`)) return
    const { error } = await supabase.from('magazyny').delete().eq('id', item.id)
    if (error) { console.error(error); addToast(error.message, 'error') }
    else { addToast('Magazyn usunięty', 'success'); fetchData() }
  }

  function openAction(type, row, mag) {
    setActionRow(row)
    setActionMag(mag)
    if (type === 'add') setAForm({ ilosc: '', powod: '' })
    if (type === 'issue') setAForm({ ilosc: '', powod: POWODY[0] })
    if (type === 'transfer') setAForm({ ilosc: '', targetMagId: '', powod: '' })
    if (type === 'korekta') setAForm({ ilosc: String(row.ilosc), powod: '' })
    setActionModal(type)
  }

  async function handleAction() {
    if (!actionRow || !actionMag) return
    const towarId = actionRow.towar_id || actionRow.towary?.id
    const magId = actionMag.id
    const ilosc = Number(aForm.ilosc)
    setASaving(true)
    let result

    if (actionModal === 'add') {
      if (!ilosc || ilosc <= 0) { addToast('Podaj ilość > 0', 'error'); setASaving(false); return }
      result = await dodajStan(towarId, magId, ilosc, aForm.powod || null)
    } else if (actionModal === 'issue') {
      if (!ilosc || ilosc <= 0) { addToast('Podaj ilość > 0', 'error'); setASaving(false); return }
      result = await wydajStan(towarId, magId, ilosc, aForm.powod || null)
    } else if (actionModal === 'transfer') {
      if (!ilosc || ilosc <= 0) { addToast('Podaj ilość > 0', 'error'); setASaving(false); return }
      if (!aForm.targetMagId) { addToast('Wybierz magazyn docelowy', 'error'); setASaving(false); return }
      result = await transferujStan(towarId, magId, aForm.targetMagId, ilosc, aForm.powod || null)
    } else if (actionModal === 'korekta') {
      const nowaIlosc = Number(aForm.ilosc)
      if (nowaIlosc < 0) { addToast('Ilość nie może być ujemna', 'error'); setASaving(false); return }
      if (!aForm.powod?.trim()) { addToast('Podaj powód korekty', 'error'); setASaving(false); return }
      result = await korektaStan(towarId, magId, nowaIlosc, aForm.powod)
    }

    if (result?.success) {
      addToast('Operacja wykonana', 'success')
      setActionModal(null)
      fetchData()
    } else {
      addToast(result?.error || 'Błąd operacji', 'error')
    }
    setASaving(false)
  }

  const actionLabels = { add: 'Przyjmij towar', issue: 'Wydaj towar', transfer: 'Przenieś do magazynu', korekta: 'Korekta stanu' }

  if (loading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 page-header">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Magazyny</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{magazyny.length} magazynów</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white page-header-btn" style={{ background: '#3b82f6' }}>
          <Plus size={16} /> Dodaj magazyn
        </button>
      </div>

      <div className="space-y-3">
        {magazyny.length === 0 ? (
          <div className="text-center py-16 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            <Warehouse size={40} className="mx-auto mb-3 opacity-30" />
            <p>Brak magazynów</p>
          </div>
        ) : (
          magazyny.map(mag => {
            const items = getStanyFor(mag.id)
            const summary = getSummary(mag.id)
            const isOpen = expanded === mag.id
            return (
              <div key={mag.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-4 px-5 py-4" style={{ background: isOpen ? 'var(--table-odd)' : 'transparent' }}>
                  <button className="flex-1 flex items-center gap-4 text-left" onClick={() => setExpanded(isOpen ? null : mag.id)}>
                    <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, background: 'rgba(59,130,246,0.1)' }}>
                      <Warehouse size={18} style={{ color: '#3b82f6' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium" style={{ color: 'var(--text)' }}>{mag.nazwa}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {mag.lokalizacja && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-2)' }}>
                            <MapPin size={11} /> {mag.lokalizacja}
                          </span>
                        )}
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>{summary.count} rodzajów towarów</span>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>{summary.total} szt. łącznie</span>
                        {summary.belowMin > 0 && (
                          <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>⚠ {summary.belowMin} poniżej minimum</span>
                        )}
                      </div>
                    </div>
                    <Badge variant={mag.aktywny ? 'green' : 'zinc'}>{mag.aktywny ? 'Aktywny' : 'Nieaktywny'}</Badge>
                    {isOpen ? <ChevronUp size={16} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--muted)' }} />}
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(mag)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-2)' }} title="Edytuj"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(mag)} className="p-1.5 rounded-lg" style={{ color: '#dc2626' }} title="Usuń"><Trash2 size={13} /></button>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {items.length === 0 ? (
                      <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>Brak towarów w tym magazynie</p>
                    ) : (
                      <div className="table-scroll-x">
                      <table className="w-full text-sm" style={{ minWidth: 500 }}>
                        <thead>
                          <tr style={{ background: 'var(--table-sub)' }}>
                            <th className="text-left px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Towar</th>
                            <th className="text-left px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Kategoria</th>
                            <th className="text-right px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Ilość</th>
                            <th className="text-right px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Jedn.</th>
                            <th className="text-right px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Min.</th>
                            <th className="text-center px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Status</th>
                            <th className="text-center px-5 py-2.5 font-medium" style={{ color: 'var(--muted)', fontSize: 12 }}>Akcje</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(s => (
                            <tr key={s.id} className="table-row" style={{ borderTop: '1px solid var(--border)' }}>
                              <td className="px-5 py-3" style={{ color: 'var(--text)' }}>{s.towary?.nazwa || '—'}</td>
                              <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-2)' }}>{s.towary?.kategoria || '—'}</td>
                              <td className="px-5 py-3 text-right font-medium" style={{ fontFamily: 'DM Mono, monospace', color: '#3b82f6' }}>{Number(s.ilosc)}</td>
                              <td className="px-5 py-3 text-right" style={{ color: 'var(--text-2)' }}>{s.towary?.jednostka || '—'}</td>
                              <td className="px-5 py-3 text-right" style={{ color: 'var(--muted)', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{s.towary?.stan_minimalny ?? '—'}</td>
                              <td className="px-5 py-3 text-center">
                                <StanBadge ilosc={s.ilosc} min={s.towary?.stan_minimalny} />
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center justify-center gap-1">
                                  <button title="Przyjmij" onClick={() => openAction('add', s, mag)} className="p-1.5 rounded-md" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                                    <PackagePlus size={13} />
                                  </button>
                                  <button title="Wydaj" onClick={() => openAction('issue', s, mag)} className="p-1.5 rounded-md" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                                    <PackageMinus size={13} />
                                  </button>
                                  <button title="Przenieś" onClick={() => openAction('transfer', s, mag)} className="p-1.5 rounded-md" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                                    <ArrowLeftRight size={13} />
                                  </button>
                                  <button title="Korekta" onClick={() => openAction('korekta', s, mag)} className="p-1.5 rounded-md" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                                    <SlidersHorizontal size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    )}
                    {mag.opis && (
                      <div className="px-5 py-3 text-sm" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-2)' }}>{mag.opis}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Magazine CRUD modal */}
      {showModal && (
        <Modal title={editItem ? 'Edytuj magazyn' : 'Nowy magazyn'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Nazwa *</label>
              <input style={IS(errors.nazwa)} value={form.nazwa} onChange={e => setForm(f => ({ ...f, nazwa: e.target.value }))} placeholder="np. Magazyn główny" />
              {errors.nazwa && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Lokalizacja</label>
              <input style={IS()} value={form.lokalizacja} onChange={e => setForm(f => ({ ...f, lokalizacja: e.target.value }))} placeholder="np. ul. Przykładowa 1, Poznań" />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Opis</label>
              <textarea style={{ ...IS(), resize: 'vertical', minHeight: 72 }} value={form.opis} onChange={e => setForm(f => ({ ...f, opis: e.target.value }))} placeholder="Opcjonalny opis..." />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="mag_a" checked={form.aktywny} onChange={e => setForm(f => ({ ...f, aktywny: e.target.checked }))} style={{ accentColor: '#3b82f6' }} />
              <label htmlFor="mag_a" className="text-sm" style={{ color: 'var(--text-2)' }}>Aktywny</label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>Anuluj</button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg py-2 text-sm font-medium text-white" style={{ background: '#3b82f6', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Zapisywanie...' : editItem ? 'Zapisz zmiany' : 'Dodaj magazyn'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Action modal */}
      {actionModal && actionRow && (
        <Modal title={actionLabels[actionModal]} onClose={() => setActionModal(null)}>
          <div className="space-y-4">
            <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>
              <span className="font-medium" style={{ color: 'var(--text)' }}>{actionRow.towary?.nazwa}</span>
              {actionMag && <> · {actionMag.nazwa}</>}
              {actionModal !== 'add' && <> · dostępne: <strong>{Number(actionRow.ilosc)}</strong> {actionRow.towary?.jednostka || 'szt.'}</>}
            </div>

            {(actionModal === 'add' || actionModal === 'issue' || actionModal === 'transfer' || actionModal === 'korekta') && (
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>
                  {actionModal === 'korekta' ? 'Nowa ilość' : 'Ilość'}
                </label>
                <input type="number" min={actionModal === 'korekta' ? 0 : 1} style={IS()} value={aForm.ilosc}
                  onChange={e => setAForm(f => ({ ...f, ilosc: e.target.value }))} placeholder="0" />
              </div>
            )}

            {actionModal === 'transfer' && (
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Magazyn docelowy</label>
                <select style={IS()} value={aForm.targetMagId} onChange={e => setAForm(f => ({ ...f, targetMagId: e.target.value }))}>
                  <option value="">-- wybierz --</option>
                  {magazyny.filter(m => m.id !== actionMag?.id).map(m => (
                    <option key={m.id} value={m.id}>{m.nazwa}</option>
                  ))}
                </select>
              </div>
            )}

            {actionModal === 'issue' ? (
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Powód</label>
                <select style={IS()} value={aForm.powod} onChange={e => setAForm(f => ({ ...f, powod: e.target.value }))}>
                  {POWODY.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>
                  Powód {actionModal === 'korekta' ? '*' : '(opcjonalnie)'}
                </label>
                <input style={IS()} value={aForm.powod} onChange={e => setAForm(f => ({ ...f, powod: e.target.value }))}
                  placeholder={actionModal === 'korekta' ? 'Wymagany powód korekty' : 'np. zamówienie, dostawa...'} />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setActionModal(null)} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--table-sub)', color: 'var(--text-2)' }}>Anuluj</button>
              <button onClick={handleAction} disabled={aSaving} className="flex-1 rounded-lg py-2 text-sm font-medium text-white"
                style={{ background: actionModal === 'issue' ? '#ef4444' : actionModal === 'korekta' ? '#f59e0b' : actionModal === 'transfer' ? '#3b82f6' : '#22c55e', opacity: aSaving ? 0.7 : 1 }}>
                {aSaving ? 'Wykonywanie...' : actionLabels[actionModal]}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
