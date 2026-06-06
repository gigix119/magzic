import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { getZlecenieConfigFor } from '../config/businessTypes'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import { ArrowLeft, Trash2, Pencil, Plus, Check } from 'lucide-react'

const STATUS_COLORS = {
  nowe:         { bg: '#eff6ff', text: '#1e40af' },
  w_realizacji: { bg: '#fff7ed', text: '#9a3412' },
  gotowe:       { bg: '#ecfdf5', text: '#065f46' },
  anulowane:    { bg: '#f3f4f6', text: '#6b7280' },
}

const PRIORITY_COLORS = {
  niski:    { bg: '#f0fdf4', text: '#166534', label: 'Niski' },
  normalny: { bg: '#f8fafc', text: '#475569', label: 'Normalny' },
  pilny:    { bg: '#fef2f2', text: '#991b1b', label: '🔴 Pilne' },
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

const emptyItem = { nazwa_pozycji: '', ilosc: '1', jednostka: '', notatka: '' }

export default function ZlecenieDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { wsQuery, addWsFilter, getBusinessCategory } = useWorkspace()
  const config = getZlecenieConfigFor(getBusinessCategory())

  const [zlecenie, setZlecenie] = useState(null)
  const [pozycje, setPozycje] = useState([])
  const [kontrahent, setKontrahent] = useState(null)
  const [kontrahenci, setKontrahenci] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddItem, setShowAddItem] = useState(false)
  const [itemForm, setItemForm] = useState(emptyItem)
  const [addingSaving, setAddingSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editErrors, setEditErrors] = useState({})

  async function fetchData() {
    const [{ data: z }, { data: p }] = await Promise.all([
      supabase.from('zlecenia').select('*').eq('id', id).single(),
      supabase.from('zlecenia_pozycje').select('*').eq('zlecenie_id', id).order('created_at'),
    ])
    if (!z) { navigate('/zlecenia'); return }
    setZlecenie(z)
    setPozycje(p || [])
    if (z.kontrahent_id) {
      const { data: k } = await supabase.from('kontrahenci').select('id, nazwa').eq('id', z.kontrahent_id).single()
      setKontrahent(k)
    }
    setLoading(false)
  }

  async function fetchKontrahenci() {
    const { data: k } = await addWsFilter(
      wsQuery('kontrahenci').select('id, nazwa').eq('aktywny', true)
    ).order('nazwa')
    setKontrahenci(k || [])
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); fetchKontrahenci() }, [id])

  function openEdit() {
    setEditForm({
      nazwa: zlecenie.nazwa || '',
      opis: zlecenie.opis || '',
      data_realizacji: zlecenie.data_realizacji || '',
      status: zlecenie.status || 'nowe',
      priorytet: zlecenie.priorytet || 'normalny',
      kontrahent_id: zlecenie.kontrahent_id || '',
    })
    setEditErrors({})
    setShowEdit(true)
  }

  async function handleEditSave(ev) {
    ev.preventDefault()
    const e = {}
    if (!editForm.nazwa.trim()) e.nazwa = true
    setEditErrors(e)
    if (Object.keys(e).length > 0) return
    setEditSaving(true)
    const payload = {
      nazwa: editForm.nazwa.trim(),
      opis: editForm.opis || null,
      data_realizacji: editForm.data_realizacji || null,
      status: editForm.status,
      priorytet: editForm.priorytet,
      kontrahent_id: editForm.kontrahent_id || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('zlecenia').update(payload).eq('id', id)
    if (error) { addToast(error.message, 'error') }
    else {
      addToast('Zaktualizowano', 'success')
      setShowEdit(false)
      fetchData()
    }
    setEditSaving(false)
  }

  async function changeStatus(newStatus) {
    const { error } = await supabase.from('zlecenia').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { addToast(error.message, 'error') }
    else { setZlecenie(z => ({ ...z, status: newStatus })) }
  }

  async function toggleWydano(pozycja) {
    const { error } = await supabase.from('zlecenia_pozycje').update({ wydano: !pozycja.wydano }).eq('id', pozycja.id)
    if (error) { addToast(error.message, 'error') }
    else { setPozycje(pp => pp.map(p => p.id === pozycja.id ? { ...p, wydano: !p.wydano } : p)) }
  }

  async function handleAddItem(ev) {
    ev.preventDefault()
    if (!itemForm.nazwa_pozycji.trim()) return
    setAddingSaving(true)
    const { error, data: newRows } = await supabase.from('zlecenia_pozycje').insert([{
      zlecenie_id: id,
      nazwa_pozycji: itemForm.nazwa_pozycji.trim(),
      ilosc: parseFloat(itemForm.ilosc) || 1,
      jednostka: itemForm.jednostka || null,
      notatka: itemForm.notatka || null,
    }]).select()
    if (error) { addToast(error.message, 'error') }
    else {
      setPozycje(pp => [...pp, ...(newRows || [])])
      setItemForm(emptyItem)
      setShowAddItem(false)
    }
    setAddingSaving(false)
  }

  async function handleDeleteItem(pId) {
    if (!window.confirm('Usunąć pozycję?')) return
    setDeletingId(pId)
    const { error } = await supabase.from('zlecenia_pozycje').delete().eq('id', pId)
    if (!error) setPozycje(pp => pp.filter(p => p.id !== pId))
    setDeletingId(null)
  }

  async function handleDelete() {
    if (!window.confirm(`Usunąć to ${config.singularLabel.toLowerCase()}?`)) return
    await supabase.from('zlecenia').delete().eq('id', id)
    addToast(`${config.singularLabel} usunięte`, 'success')
    navigate('/zlecenia')
  }

  if (loading) return <Spinner />
  if (!zlecenie) return null

  const sc = STATUS_COLORS[zlecenie.status] || STATUS_COLORS.nowe
  const pc = PRIORITY_COLORS[zlecenie.priorytet] || PRIORITY_COLORS.normalny
  const wydano = pozycje.filter(p => p.wydano).length
  const total = pozycje.length
  const progressPct = total > 0 ? Math.round((wydano / total) * 100) : 0

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <button
        onClick={() => navigate('/zlecenia')}
        className="flex items-center gap-1 text-sm mb-4"
        style={{ color: 'var(--text-2)', minHeight: 44 }}
      >
        <ArrowLeft size={15} /> Wróć do listy
      </button>

      {/* Header card */}
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-bold break-words" style={{ fontSize: 18, color: 'var(--text)' }}>{zlecenie.nazwa}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: sc.bg, color: sc.text }}>
                {config.statusLabels[zlecenie.status] || zlecenie.status}
              </span>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: pc.bg, color: pc.text }}>
                {pc.label}
              </span>
            </div>
          </div>
          <button
            onClick={openEdit}
            className="flex-shrink-0 flex items-center gap-1 rounded-lg px-3 text-sm"
            style={{ color: 'var(--text-2)', minHeight: 44, border: '1px solid var(--border)' }}
          >
            <Pencil size={14} /> Edytuj
          </button>
        </div>
        {zlecenie.data_realizacji && (
          <p className="text-sm mb-2" style={{ color: 'var(--text-2)' }}>
            📅 {new Date(zlecenie.data_realizacji).toLocaleDateString('pl-PL')}
          </p>
        )}
        {zlecenie.opis && (
          <p className="text-sm mb-2" style={{ color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{zlecenie.opis}</p>
        )}
        {kontrahent && (
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            👤 <Link to="/kontrahenci" style={{ color: '#2563eb' }}>{kontrahent.nazwa}</Link>
          </p>
        )}
      </div>

      {/* Status change */}
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-2)' }}>Zmień status</p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {Object.entries(config.statusLabels).map(([key, label]) => {
            const c = STATUS_COLORS[key] || STATUS_COLORS.nowe
            const isActive = zlecenie.status === key
            return (
              <button
                key={key}
                onClick={() => changeStatus(key)}
                className="rounded-lg text-sm font-medium transition-colors"
                style={{
                  minHeight: 44,
                  background: isActive ? c.bg : 'var(--card)',
                  color: isActive ? c.text : 'var(--text-2)',
                  border: `2px solid ${isActive ? c.text : 'var(--border)'}`,
                  padding: '0 12px',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2 text-sm" style={{ color: 'var(--text-2)' }}>
            <span>Wydano: {wydano}/{total} pozycji</span>
            <span>{progressPct}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${progressPct}%`, height: '100%', background: '#22c55e', borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Pozycje */}
      <div className="rounded-xl mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{config.itemsLabel}</p>
          <button
            onClick={() => setShowAddItem(v => !v)}
            className="flex items-center gap-1 text-sm font-medium rounded-lg px-3"
            style={{ color: '#3b82f6', minHeight: 36 }}
          >
            <Plus size={14} /> {config.addItemLabel}
          </button>
        </div>

        {showAddItem && (
          <form onSubmit={handleAddItem} className="px-4 py-3 space-y-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)' }}>
            <input
              style={IS()}
              value={itemForm.nazwa_pozycji}
              onChange={e => setItemForm(f => ({ ...f, nazwa_pozycji: e.target.value }))}
              placeholder="Nazwa pozycji"
              autoFocus
            />
            <div className="flex gap-2">
              <input
                type="number"
                style={{ ...IS(), flex: '0 0 80px' }}
                value={itemForm.ilosc}
                onChange={e => setItemForm(f => ({ ...f, ilosc: e.target.value }))}
                min={0}
                step="any"
                placeholder="1"
              />
              <input
                style={{ ...IS(), flex: 1 }}
                value={itemForm.jednostka}
                onChange={e => setItemForm(f => ({ ...f, jednostka: e.target.value }))}
                placeholder="szt., kg, m, opak."
              />
            </div>
            <input
              style={IS()}
              value={itemForm.notatka}
              onChange={e => setItemForm(f => ({ ...f, notatka: e.target.value }))}
              placeholder="Notatka (opcjonalnie)"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddItem(false)}
                className="flex-1 rounded-lg text-sm"
                style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 44 }}
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={addingSaving}
                className="flex-1 rounded-lg text-sm font-medium text-white"
                style={{ background: '#3b82f6', minHeight: 44, opacity: addingSaving ? 0.7 : 1 }}
              >
                {addingSaving ? 'Dodaję…' : 'Dodaj'}
              </button>
            </div>
          </form>
        )}

        {pozycje.length === 0 && !showAddItem ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>Brak pozycji – dodaj pierwszą</div>
        ) : (
          pozycje.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={() => toggleWydano(p)}
                className="flex-shrink-0 flex items-center justify-center rounded-lg transition-colors"
                style={{ width: 32, height: 32, background: p.wydano ? '#22c55e' : 'var(--border)', color: '#fff', border: 'none' }}
                title={p.wydano ? 'Oznacz jako niewydane' : 'Oznacz jako wydane'}
              >
                {p.wydano && <Check size={14} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{
                  color: 'var(--text)',
                  textDecoration: p.wydano ? 'line-through' : 'none',
                  opacity: p.wydano ? 0.6 : 1,
                }}>
                  {p.nazwa_pozycji}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {p.ilosc} {p.jednostka || ''}
                  {p.notatka ? ` · ${p.notatka}` : ''}
                </p>
              </div>
              <button
                onClick={() => handleDeleteItem(p.id)}
                disabled={deletingId === p.id}
                className="flex-shrink-0 flex items-center justify-center rounded-lg"
                style={{ color: '#dc2626', minWidth: 44, minHeight: 44, opacity: deletingId === p.id ? 0.5 : 1 }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Delete action */}
      <div>
        <button
          onClick={handleDelete}
          className="w-full rounded-lg text-sm font-medium"
          style={{ background: '#fee2e2', color: '#dc2626', minHeight: 48 }}
        >
          Usuń {config.singularLabel.toLowerCase()}
        </button>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <Modal
          title={`Edytuj ${config.singularLabel.toLowerCase()}`}
          onClose={() => setShowEdit(false)}
        >
          <form onSubmit={handleEditSave} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>{config.nameLabel} *</label>
              <input
                style={IS(editErrors.nazwa)}
                value={editForm.nazwa}
                onChange={e => setEditForm(f => ({ ...f, nazwa: e.target.value }))}
                placeholder={config.namePlaceholder}
              />
              {editErrors.nazwa && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>{config.descriptionLabel}</label>
              <textarea
                style={{ ...IS(), minHeight: 72, height: 72, resize: 'vertical' }}
                value={editForm.opis}
                onChange={e => setEditForm(f => ({ ...f, opis: e.target.value }))}
                placeholder="Opcjonalne notatki..."
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>{config.dateLabel}</label>
              <input
                type="date"
                style={IS()}
                value={editForm.data_realizacji}
                onChange={e => setEditForm(f => ({ ...f, data_realizacji: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Priorytet</label>
              <div className="flex gap-2">
                {['niski', 'normalny', 'pilny'].map(p => {
                  const pc2 = PRIORITY_COLORS[p]
                  const active = editForm.priorytet === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, priorytet: p }))}
                      className="flex-1 rounded-lg text-sm font-medium"
                      style={{
                        minHeight: 44,
                        background: active ? pc2.bg : 'var(--card)',
                        color: active ? pc2.text : 'var(--text-2)',
                        border: `1px solid ${active ? pc2.text : 'var(--border)'}`,
                      }}
                    >
                      {pc2.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {kontrahenci.length > 0 && (
              <div>
                <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Kontrahent (opcjonalnie)</label>
                <select
                  style={{ ...IS(), cursor: 'pointer' }}
                  value={editForm.kontrahent_id}
                  onChange={e => setEditForm(f => ({ ...f, kontrahent_id: e.target.value }))}
                >
                  <option value="">— brak —</option>
                  {kontrahenci.map(k => <option key={k.id} value={k.id}>{k.nazwa}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Status</label>
              <select
                style={{ ...IS(), cursor: 'pointer' }}
                value={editForm.status}
                onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
              >
                {Object.entries(config.statusLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="flex-1 rounded-lg text-sm font-medium"
                style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48 }}
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="flex-1 rounded-lg text-sm font-medium text-white"
                style={{ background: '#3b82f6', minHeight: 48, opacity: editSaving ? 0.7 : 1 }}
              >
                {editSaving ? 'Zapisywanie…' : 'Zapisz zmiany'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
