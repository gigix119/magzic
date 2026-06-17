import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { getZlecenieConfigFor } from '../config/businessTypes'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import {
  ArrowLeft, Trash2, Pencil, Plus, Check, CalendarDays, User, BedDouble,
  Camera, CheckSquare, Square, X, Image, ChevronDown, ChevronUp, ShieldCheck,
} from 'lucide-react'
import DemandExplanation from '../components/ui/DemandExplanation'

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

const PHOTO_LABELS = ['przed', 'po', 'usterka']
const emptyItem = { nazwa_pozycji: '', ilosc: '1', jednostka: '', notatka: '' }
const STORAGE_BUCKET = 'przygotowania-zdjecia'

function checkGate(zlecenie, pozycje, checklistItems, photos, readinessChecked) {
  const issues = []
  if (pozycje.length > 0 && !pozycje.every(p => p.wydano)) {
    const n = pozycje.filter(p => !p.wydano).length
    issues.push(`${n} ${n === 1 ? 'pozycja nie wydana' : 'pozycji nie wydano'}`)
  }
  if (checklistItems.length > 0 && !checklistItems.every(c => c.checked)) {
    const n = checklistItems.filter(c => !c.checked).length
    issues.push(`${n} ${n === 1 ? 'punkt checklisty nieodhaczony' : 'punktów checklisty nieodhaczonych'}`)
  }
  const reqPhotos = zlecenie?.required_photos || 0
  if (reqPhotos > 0 && photos.length < reqPhotos) {
    issues.push(`Brak wymaganych zdjęć (${photos.length}/${reqPhotos})`)
  }
  if (!readinessChecked) {
    issues.push('Potwierdź gotowość obiektu (checkbox poniżej)')
  }
  return { ok: issues.length === 0, issues }
}

export default function ZlecenieDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { workspaceId, wsQuery, addWsFilter, getBusinessCategory } = useWorkspace()
  const config = getZlecenieConfigFor(getBusinessCategory())
  const photoInputRef = useRef(null)

  // --- podstawowe stany ---
  const [zlecenie, setZlecenie] = useState(null)
  const [pozycje, setPozycje] = useState([])
  const [kontrahent, setKontrahent] = useState(null)
  const [kontrahenci, setKontrahenci] = useState([])
  const [linkedRez, setLinkedRez] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAddItem, setShowAddItem] = useState(false)
  const [itemForm, setItemForm] = useState(emptyItem)
  const [addingSaving, setAddingSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editErrors, setEditErrors] = useState({})

  // --- checklista ---
  const [checklistItems, setChecklistItems] = useState([])
  const [checklistError, setChecklistError] = useState(null)
  const [showAddChecklist, setShowAddChecklist] = useState(false)
  const [newChecklistLabel, setNewChecklistLabel] = useState('')
  const [checklistSaving, setChecklistSaving] = useState(false)
  const [deletingChecklistId, setDeletingChecklistId] = useState(null)

  // --- zdjęcia ---
  const [photos, setPhotos] = useState([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [selectedPhotoLabel, setSelectedPhotoLabel] = useState('')
  const [lightboxPhoto, setLightboxPhoto] = useState(null)
  const [deletingPhotoId, setDeletingPhotoId] = useState(null)

  // --- gate ---
  const [readinessChecked, setReadinessChecked] = useState(false)

  async function fetchData() {
    const [{ data: z }, { data: p }] = await Promise.all([
      supabase.from('zlecenia').select('*').eq('id', id).single(),
      supabase.from('zlecenia_pozycje').select('*').eq('zlecenie_id', id).order('created_at'),
    ])
    if (!z) { navigate('/zlecenia'); return }
    setZlecenie(z)
    setPozycje(p || [])
    setReadinessChecked(!!z.readiness_confirmed)

    if (z.kontrahent_id) {
      const { data: k } = await supabase.from('kontrahenci').select('id, nazwa').eq('id', z.kontrahent_id).single()
      setKontrahent(k)
    }

    const { data: rez, error: rezErr } = await supabase
      .from('rezerwacje')
      .select('id, lokal_id, checkin_at, checkout_at, liczba_gosci, lokale(nazwa)')
      .eq('przygotowanie_id', id)
      .maybeSingle()
    if (!rezErr) setLinkedRez(rez || null)

    // Checklista
    const { data: cl, error: clErr } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('zlecenie_id', id)
      .order('sort_order')
    setChecklistItems(cl || [])
    setChecklistError(clErr ? clErr.message : null)

    // Zdjęcia
    const { data: ph } = await supabase
      .from('preparation_photos')
      .select('*')
      .eq('zlecenie_id', id)
      .order('uploaded_at')
    setPhotos(ph || [])

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
    else { addToast('Zaktualizowano', 'success'); setShowEdit(false); fetchData() }
    setEditSaving(false)
  }

  async function changeStatus(newStatus) {
    if (newStatus === 'gotowe') {
      const gate = checkGate(zlecenie, pozycje, checklistItems, photos, readinessChecked)
      if (!gate.ok) {
        addToast(`Nie można zakończyć: ${gate.issues[0]}`, 'error')
        return
      }
      const { error } = await supabase
        .from('zlecenia')
        .update({ status: newStatus, readiness_confirmed: true, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) { addToast(error.message, 'error'); return }
      setZlecenie(z => ({ ...z, status: newStatus, readiness_confirmed: true }))
      addToast('Obiekt gotowy na przyjazd!', 'success')
      return
    }
    const { error } = await supabase
      .from('zlecenia')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { addToast(error.message, 'error') }
    else { setZlecenie(z => ({ ...z, status: newStatus })) }
  }

  async function toggleReadiness() {
    const newVal = !readinessChecked
    const { error } = await supabase.from('zlecenia').update({ readiness_confirmed: newVal }).eq('id', id)
    if (error) { addToast(error.message, 'error'); return }
    setReadinessChecked(newVal)
    setZlecenie(z => ({ ...z, readiness_confirmed: newVal }))
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
    else { setPozycje(pp => [...pp, ...(newRows || [])]); setItemForm(emptyItem); setShowAddItem(false) }
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
    navigate('/operacje?tab=przygotowania')
  }

  // --- Checklista handlers ---
  async function toggleChecklistItem(item) {
    const { error } = await supabase
      .from('checklist_items')
      .update({ checked: !item.checked })
      .eq('id', item.id)
    if (error) { addToast(error.message, 'error'); return }
    setChecklistItems(cl => cl.map(c => c.id === item.id ? { ...c, checked: !c.checked } : c))
  }

  async function handleAddChecklistItem() {
    if (!newChecklistLabel.trim() || !workspaceId) return
    setChecklistSaving(true)
    const sortOrder = checklistItems.length
    const { data: newItem, error } = await supabase
      .from('checklist_items')
      .insert([{ zlecenie_id: id, workspace_id: workspaceId, label: newChecklistLabel.trim(), sort_order: sortOrder }])
      .select()
      .single()
    if (error) { addToast(error.message, 'error') }
    else { setChecklistItems(cl => [...cl, newItem]); setNewChecklistLabel(''); setShowAddChecklist(false) }
    setChecklistSaving(false)
  }

  async function handleDeleteChecklistItem(cId) {
    if (!window.confirm('Usunąć punkt checklisty?')) return
    setDeletingChecklistId(cId)
    const { error } = await supabase.from('checklist_items').delete().eq('id', cId)
    if (!error) setChecklistItems(cl => cl.filter(c => c.id !== cId))
    setDeletingChecklistId(null)
  }

  // --- Zdjęcia handlers ---
  async function handlePhotoUpload(file) {
    if (!file || !workspaceId) return
    setPhotoUploading(true)
    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const uuid = crypto.randomUUID()
    const path = `${workspaceId}/${id}/${uuid}.${ext}`

    const { data: up, error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: false })

    if (upErr) {
      addToast(`Upload: ${upErr.message}`, 'error')
      setPhotoUploading(false)
      return
    }

    const { data: inserted, error: dbErr } = await supabase
      .from('preparation_photos')
      .insert([{
        zlecenie_id: id,
        workspace_id: workspaceId,
        storage_path: up.path,
        label: selectedPhotoLabel || null,
      }])
      .select()
      .single()

    if (dbErr) { addToast(dbErr.message, 'error') }
    else { setPhotos(ph => [...ph, inserted]) }
    setPhotoUploading(false)
    setSelectedPhotoLabel('')
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  async function handleDeletePhoto(photo) {
    if (!window.confirm('Usunąć to zdjęcie?')) return
    setDeletingPhotoId(photo.id)
    await supabase.storage.from(STORAGE_BUCKET).remove([photo.storage_path])
    const { error } = await supabase.from('preparation_photos').delete().eq('id', photo.id)
    if (!error) setPhotos(ph => ph.filter(p => p.id !== photo.id))
    else addToast(error.message, 'error')
    setDeletingPhotoId(null)
  }

  function getPhotoUrl(path) {
    return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl
  }

  if (loading) return <Spinner />
  if (!zlecenie) return null

  const sc = STATUS_COLORS[zlecenie.status] || STATUS_COLORS.nowe
  const pc = PRIORITY_COLORS[zlecenie.priorytet] || PRIORITY_COLORS.normalny
  const wydano = pozycje.filter(p => p.wydano).length
  const total = pozycje.length
  const progressPct = total > 0 ? Math.round((wydano / total) * 100) : 0

  const checklistChecked = checklistItems.filter(c => c.checked).length
  const checklistTotal = checklistItems.length
  const checklistPct = checklistTotal > 0 ? Math.round((checklistChecked / checklistTotal) * 100) : 0

  const gate = checkGate(zlecenie, pozycje, checklistItems, photos, readinessChecked)
  const gotoweBlocked = !gate.ok

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <button
        onClick={() => navigate('/operacje?tab=przygotowania')}
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
          <p className="flex items-center gap-1.5 text-sm mb-2" style={{ color: 'var(--text-2)' }}>
            <CalendarDays size={13} />
            {new Date(zlecenie.data_realizacji).toLocaleDateString('pl-PL')}
          </p>
        )}
        {zlecenie.opis && (
          <p className="text-sm mb-2" style={{ color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{zlecenie.opis}</p>
        )}
        {kontrahent && (
          <p className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-2)' }}>
            <User size={13} />
            <Link to="/kontrahenci" style={{ color: '#2563eb' }}>{kontrahent.nazwa}</Link>
          </p>
        )}
        {linkedRez && (
          <Link to="/operacje?tab=rezerwacje" className="flex items-center gap-1.5 mt-2 text-sm"
            style={{ color: '#059669', textDecoration: 'none' }}>
            <BedDouble size={13} />
            Rezerwacja: {linkedRez.lokale?.nazwa || '—'}, {linkedRez.checkin_at}–{linkedRez.checkout_at}
            {linkedRez.liczba_gosci != null && <>, {linkedRez.liczba_gosci} os.</>}
          </Link>
        )}
      </div>

      {/* Status change */}
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-2)' }}>Zmień status</p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {Object.entries(config.statusLabels).map(([key, label]) => {
            const c = STATUS_COLORS[key] || STATUS_COLORS.nowe
            const isActive = zlecenie.status === key
            const isGotowe = key === 'gotowe'
            const disabled = isGotowe && gotoweBlocked
            return (
              <button
                key={key}
                onClick={() => !disabled && changeStatus(key)}
                disabled={disabled}
                className="rounded-lg text-sm font-medium transition-colors"
                style={{
                  minHeight: 44,
                  background: isActive ? c.bg : 'var(--card)',
                  color: isActive ? c.text : disabled ? 'var(--muted)' : 'var(--text-2)',
                  border: `2px solid ${isActive ? c.text : disabled ? 'var(--border)' : 'var(--border)'}`,
                  padding: '0 12px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1,
                }}
                title={disabled ? gate.issues.join(' · ') : undefined}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Gate blockers */}
        {gotoweBlocked && zlecenie.status !== 'gotowe' && (
          <div className="mt-3 rounded-lg px-3 py-2.5" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#dc2626' }}>Nie można zakończyć:</p>
            {gate.issues.map((issue, i) => (
              <p key={i} className="text-xs" style={{ color: '#dc2626' }}>• {issue}</p>
            ))}
          </div>
        )}
      </div>

      {/* Progress bar (wydania) */}
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
            <input style={IS()} value={itemForm.nazwa_pozycji}
              onChange={e => setItemForm(f => ({ ...f, nazwa_pozycji: e.target.value }))}
              placeholder="Nazwa pozycji" autoFocus />
            <div className="flex gap-2">
              <input type="number" style={{ ...IS(), flex: '0 0 80px' }} value={itemForm.ilosc}
                onChange={e => setItemForm(f => ({ ...f, ilosc: e.target.value }))} min={0} step="any" placeholder="1" />
              <input style={{ ...IS(), flex: 1 }} value={itemForm.jednostka}
                onChange={e => setItemForm(f => ({ ...f, jednostka: e.target.value }))}
                placeholder="szt., kg, m, opak." />
            </div>
            <input style={IS()} value={itemForm.notatka}
              onChange={e => setItemForm(f => ({ ...f, notatka: e.target.value }))}
              placeholder="Notatka (opcjonalnie)" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAddItem(false)}
                className="flex-1 rounded-lg text-sm"
                style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 44 }}>
                Anuluj
              </button>
              <button type="submit" disabled={addingSaving}
                className="flex-1 rounded-lg text-sm font-medium text-white"
                style={{ background: '#3b82f6', minHeight: 44, opacity: addingSaving ? 0.7 : 1 }}>
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
                style={{ width: 44, height: 44, background: p.wydano ? '#22c55e' : 'var(--border)', color: '#fff', border: 'none' }}
                title={p.wydano ? 'Oznacz jako niewydane' : 'Oznacz jako wydane'}
              >
                {p.wydano && <Check size={14} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text)', textDecoration: p.wydano ? 'line-through' : 'none', opacity: p.wydano ? 0.6 : 1 }}>
                  {p.nazwa_pozycji}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {p.ilosc} {p.jednostka || ''}
                  {p.notatka ? ` · ${p.notatka}` : ''}
                </p>
                {p.notatka === 'Z pakietu (auto)' && !p.wydano && (
                  <DemandExplanation steps={[{ label: 'Standard pakietu', value: p.ilosc }]} ilosc={p.ilosc} jednostka={p.jednostka || 'szt.'} />
                )}
              </div>
              <button onClick={() => handleDeleteItem(p.id)} disabled={deletingId === p.id}
                className="flex-shrink-0 flex items-center justify-center rounded-lg"
                style={{ color: '#dc2626', minWidth: 44, minHeight: 44, opacity: deletingId === p.id ? 0.5 : 1 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* ─── CHECKLISTA ──────────────────────────────────────────────────── */}
      <div className="rounded-xl mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: checklistTotal > 0 ? '1px solid var(--border)' : 'none' }}>
          <div className="flex items-center gap-2">
            <CheckSquare size={15} style={{ color: 'var(--c-action)' }} />
            <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>
              Checklista {checklistTotal > 0 && `(${checklistChecked}/${checklistTotal})`}
            </p>
            {checklistTotal > 0 && (
              <span className="text-xs rounded-full px-2 py-0.5"
                style={{ background: checklistChecked === checklistTotal ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)', color: checklistChecked === checklistTotal ? 'var(--c-success)' : 'var(--c-critical)' }}>
                {checklistPct}%
              </span>
            )}
          </div>
          <button onClick={() => setShowAddChecklist(v => !v)}
            className="flex items-center gap-1 text-sm font-medium rounded-lg px-3"
            style={{ color: '#3b82f6', minHeight: 36 }}>
            <Plus size={14} /> Dodaj punkt
          </button>
        </div>

        {/* Progress bar checklisty */}
        {checklistTotal > 0 && (
          <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${checklistPct}%`, height: '100%', background: checklistChecked === checklistTotal ? '#22c55e' : '#3b82f6', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* Dodaj punkt */}
        {showAddChecklist && (
          <div className="px-4 py-3 flex gap-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)' }}>
            <input
              style={{ ...IS(), minHeight: 44, flex: 1 }}
              value={newChecklistLabel}
              onChange={e => setNewChecklistLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklistItem() } }}
              placeholder="Opis punktu checklisty"
              autoFocus
            />
            <button onClick={handleAddChecklistItem} disabled={checklistSaving || !newChecklistLabel.trim()}
              className="rounded-lg text-sm font-medium text-white px-4 flex-shrink-0"
              style={{ background: '#3b82f6', minHeight: 44, opacity: (checklistSaving || !newChecklistLabel.trim()) ? 0.6 : 1 }}>
              {checklistSaving ? '…' : 'Dodaj'}
            </button>
            <button onClick={() => { setShowAddChecklist(false); setNewChecklistLabel('') }}
              className="rounded-lg px-3 flex-shrink-0"
              style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 44 }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Lista punktów */}
        {checklistError ? (
          <div className="text-center py-6 text-sm px-4" style={{ color: 'var(--c-critical)' }}>
            Uruchom migrację checklist_zdjecia_migration.sql w Supabase, aby włączyć checklisty.
          </div>
        ) : checklistItems.length === 0 && !showAddChecklist ? (
          <div className="text-center py-6 text-sm" style={{ color: 'var(--muted)' }}>
            Brak punktów – dodaj punkt powyżej
          </div>
        ) : (
          checklistItems.map((item, i) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: i < checklistItems.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
              onClick={() => toggleChecklistItem(item)}>
              <div className="flex-shrink-0" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.checked
                  ? <CheckSquare size={22} style={{ color: 'var(--c-success)' }} />
                  : <Square size={22} style={{ color: 'var(--muted)' }} />
                }
              </div>
              <p className="flex-1 text-sm" style={{ color: item.checked ? 'var(--muted)' : 'var(--text)', textDecoration: item.checked ? 'line-through' : 'none' }}>
                {item.label}
              </p>
              <button
                onClick={e => { e.stopPropagation(); handleDeleteChecklistItem(item.id) }}
                disabled={deletingChecklistId === item.id}
                className="flex-shrink-0 flex items-center justify-center rounded-lg"
                style={{ color: 'var(--muted)', minWidth: 36, minHeight: 36, opacity: deletingChecklistId === item.id ? 0.5 : 1 }}
              >
                <X size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* ─── ZDJĘCIA ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Image size={15} style={{ color: 'var(--c-action)' }} />
            <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>Zdjęcia {photos.length > 0 && `(${photos.length})`}</p>
          </div>
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={photoUploading}
            className="flex items-center gap-1 text-sm font-medium rounded-lg px-3"
            style={{ color: '#3b82f6', minHeight: 36, opacity: photoUploading ? 0.6 : 1 }}>
            <Camera size={14} /> {photoUploading ? 'Wysyłam…' : '+ Dodaj zdjęcie'}
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handlePhotoUpload(file)
            }}
          />
        </div>

        {/* Etykieta przed uplodem */}
        <div className="px-4 py-2 flex items-center gap-2 flex-wrap" style={{ borderBottom: '1px solid var(--border)', background: 'var(--hover-bg)' }}>
          <span className="text-xs" style={{ color: 'var(--text-2)' }}>Etykieta:</span>
          {['', ...PHOTO_LABELS].map(lbl => (
            <button key={lbl} onClick={() => setSelectedPhotoLabel(lbl)}
              className="rounded-full px-3 text-xs font-medium"
              style={{ minHeight: 28, background: selectedPhotoLabel === lbl ? 'var(--c-action)' : 'var(--table-sub)', color: selectedPhotoLabel === lbl ? '#fff' : 'var(--text-2)', border: 'none', cursor: 'pointer' }}>
              {lbl || 'brak'}
            </button>
          ))}
        </div>

        {/* Siatka zdjęć */}
        {photos.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>Brak zdjęć — dodaj dokumentację stanu</div>
        ) : (
          <div className="p-4 grid grid-cols-3 md:grid-cols-4 gap-2">
            {photos.map(photo => (
              <div key={photo.id} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: '1', background: 'var(--border)' }}>
                <img
                  src={getPhotoUrl(photo.storage_path)}
                  alt={photo.label || 'zdjęcie'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                  onClick={() => setLightboxPhoto(photo)}
                  onError={e => { e.target.style.display = 'none' }}
                />
                {photo.label && (
                  <span className="absolute bottom-0 left-0 right-0 text-center text-xs font-medium py-0.5"
                    style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                    {photo.label}
                  </span>
                )}
                <button
                  onClick={() => handleDeletePhoto(photo)}
                  disabled={deletingPhotoId === photo.id}
                  className="absolute top-1 right-1 rounded-full flex items-center justify-center"
                  style={{ width: 24, height: 24, background: 'rgba(220,38,38,0.85)', color: '#fff', border: 'none', cursor: 'pointer', opacity: deletingPhotoId === photo.id ? 0.5 : 1 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── GOTOWOŚĆ (gate) ─────────────────────────────────────────────── */}
      <div className="rounded-xl mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <ShieldCheck size={15} style={{ color: gate.ok ? 'var(--c-success)' : 'var(--c-attention)' }} />
          <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>Gotowość do zamknięcia</p>
          {gate.ok && <span className="text-xs rounded-full px-2 py-0.5" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--c-success)' }}>Spełnione</span>}
        </div>
        <div className="px-4 py-3 space-y-2">
          {/* Warunki gate */}
          <GateCondition ok={total === 0 || wydano === total} label={total === 0 ? 'Brak pozycji (OK)' : `Wszystkie pozycje wydane (${wydano}/${total})`} />
          <GateCondition ok={checklistTotal === 0 || checklistChecked === checklistTotal}
            label={checklistTotal === 0 ? 'Brak checklisty (OK)' : `Checklista ukończona (${checklistChecked}/${checklistTotal})`} />
          {(zlecenie.required_photos || 0) > 0 && (
            <GateCondition ok={photos.length >= zlecenie.required_photos}
              label={`Wymagane zdjęcia (${photos.length}/${zlecenie.required_photos})`} />
          )}
          <GateCondition ok={readinessChecked} label="Potwierdzenie gotowości pracownika" />

          {/* Checkbox potwierdzenia */}
          <div
            className="flex items-center gap-3 mt-3 rounded-lg px-3 py-3 cursor-pointer"
            style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)' }}
            onClick={toggleReadiness}
          >
            <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {readinessChecked
                ? <CheckSquare size={24} style={{ color: 'var(--c-success)' }} />
                : <Square size={24} style={{ color: 'var(--muted)' }} />
              }
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Potwierdzam gotowość obiektu na przyjazd gości
            </p>
          </div>
        </div>
      </div>

      {/* Usuń */}
      <div className="mb-8">
        <button onClick={handleDelete} className="w-full rounded-lg text-sm font-medium"
          style={{ background: '#fee2e2', color: '#dc2626', minHeight: 48 }}>
          Usuń {config.singularLabel.toLowerCase()}
        </button>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <Modal title={`Edytuj ${config.singularLabel.toLowerCase()}`} onClose={() => setShowEdit(false)}>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>{config.nameLabel} *</label>
              <input style={IS(editErrors.nazwa)} value={editForm.nazwa}
                onChange={e => setEditForm(f => ({ ...f, nazwa: e.target.value }))}
                placeholder={config.namePlaceholder} />
              {editErrors.nazwa && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>Pole wymagane</p>}
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>{config.descriptionLabel}</label>
              <textarea style={{ ...IS(), minHeight: 72, height: 72, resize: 'vertical' }}
                value={editForm.opis}
                onChange={e => setEditForm(f => ({ ...f, opis: e.target.value }))}
                placeholder="Opcjonalne notatki..." />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>{config.dateLabel}</label>
              <input type="date" style={IS()} value={editForm.data_realizacji}
                onChange={e => setEditForm(f => ({ ...f, data_realizacji: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Priorytet</label>
              <div className="flex gap-2">
                {['niski', 'normalny', 'pilny'].map(p => {
                  const pc2 = PRIORITY_COLORS[p]
                  const active = editForm.priorytet === p
                  return (
                    <button key={p} type="button" onClick={() => setEditForm(f => ({ ...f, priorytet: p }))}
                      className="flex-1 rounded-lg text-sm font-medium"
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
                <select style={{ ...IS(), cursor: 'pointer' }} value={editForm.kontrahent_id}
                  onChange={e => setEditForm(f => ({ ...f, kontrahent_id: e.target.value }))}>
                  <option value="">— brak —</option>
                  {kontrahenci.map(k => <option key={k.id} value={k.id}>{k.nazwa}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-2)' }}>Status</label>
              <select style={{ ...IS(), cursor: 'pointer' }} value={editForm.status}
                onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                {Object.entries(config.statusLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowEdit(false)}
                className="flex-1 rounded-lg text-sm font-medium"
                style={{ background: 'var(--table-sub)', color: 'var(--text-2)', minHeight: 48 }}>
                Anuluj
              </button>
              <button type="submit" disabled={editSaving}
                className="flex-1 rounded-lg text-sm font-medium text-white"
                style={{ background: '#3b82f6', minHeight: 48, opacity: editSaving ? 0.7 : 1 }}>
                {editSaving ? 'Zapisywanie…' : 'Zapisz zmiany'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setLightboxPhoto(null)}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }}>
            <img src={getPhotoUrl(lightboxPhoto.storage_path)} alt={lightboxPhoto.label || 'zdjęcie'}
              style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
            {lightboxPhoto.label && (
              <span className="absolute bottom-2 left-1/2 text-sm font-medium px-3 py-1 rounded-full"
                style={{ transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                {lightboxPhoto.label}
              </span>
            )}
            <button onClick={() => setLightboxPhoto(null)}
              className="absolute top-2 right-2 rounded-full flex items-center justify-center"
              style={{ width: 32, height: 32, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function GateCondition({ ok, label }) {
  return (
    <div className="flex items-center gap-2">
      {ok
        ? <Check size={15} style={{ color: 'var(--c-success)', flexShrink: 0 }} />
        : <X size={15} style={{ color: 'var(--c-critical)', flexShrink: 0 }} />
      }
      <p className="text-sm" style={{ color: ok ? 'var(--text-2)' : 'var(--text)' }}>{label}</p>
    </div>
  )
}
