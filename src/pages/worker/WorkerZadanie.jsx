import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import Spinner from '../../components/Spinner'
import { sortWorkerTasks, suggestPhotoLabel } from '../../utils/workerTasks'
import {
  ArrowLeft, MapPin, Users, CalendarDays, Navigation, Check, Square,
  CheckSquare, Camera, X, ShieldCheck,
} from 'lucide-react'

const STORAGE_BUCKET = 'przygotowania-zdjecia'

function isoToday() { return new Date().toISOString().split('T')[0] }

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
  if (!readinessChecked) issues.push('Potwierdź gotowość obiektu')
  return { ok: issues.length === 0, issues }
}

export default function WorkerZadanie() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { workspaceId, wsQuery, addWsFilter } = useWorkspace()
  const photoInputRef = useRef(null)

  const [zlecenie, setZlecenie] = useState(null)
  const [pozycje, setPozycje] = useState([])
  const [checklistItems, setChecklistItems] = useState([])
  const [photos, setPhotos] = useState([])
  const [rez, setRez] = useState(null)
  const [readinessChecked, setReadinessChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [finishing, setFinishing] = useState(false)

  async function fetchData() {
    const [{ data: z }, { data: p }, { data: cl }, { data: ph }, { data: r }] = await Promise.all([
      supabase.from('zlecenia').select('*').eq('id', id).single(),
      supabase.from('zlecenia_pozycje').select('*').eq('zlecenie_id', id).order('created_at'),
      supabase.from('checklist_items').select('*').eq('zlecenie_id', id).order('sort_order'),
      supabase.from('preparation_photos').select('*').eq('zlecenie_id', id).order('uploaded_at'),
      supabase.from('rezerwacje').select('liczba_gosci, checkin_at, checkout_at, lokale(nazwa, adres, lokalizacja)').eq('przygotowanie_id', id).maybeSingle(),
    ])
    if (!z) { navigate('/pracownik'); return }
    setZlecenie(z)
    setPozycje(p || [])
    setChecklistItems(cl || [])
    setPhotos(ph || [])
    setRez(r || null)
    setReadinessChecked(!!z.readiness_confirmed)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [id])

  const readOnly = zlecenie?.status === 'gotowe'

  async function toggleWydano(pozycja) {
    if (readOnly) return
    const { error } = await supabase.from('zlecenia_pozycje').update({ wydano: !pozycja.wydano }).eq('id', pozycja.id)
    if (error) { addToast(error.message, 'error'); return }
    setPozycje(pp => pp.map(p => p.id === pozycja.id ? { ...p, wydano: !p.wydano } : p))
  }

  async function toggleChecklistItem(item) {
    if (readOnly) return
    const { error } = await supabase.from('checklist_items').update({ checked: !item.checked }).eq('id', item.id)
    if (error) { addToast(error.message, 'error'); return }
    setChecklistItems(cl => cl.map(c => c.id === item.id ? { ...c, checked: !c.checked } : c))
  }

  async function toggleReadiness() {
    if (readOnly) return
    const newVal = !readinessChecked
    const { error } = await supabase.from('zlecenia').update({ readiness_confirmed: newVal }).eq('id', id)
    if (error) { addToast(error.message, 'error'); return }
    setReadinessChecked(newVal)
  }

  async function handlePhotoUpload(file) {
    if (!file || !workspaceId || readOnly) return
    setPhotoUploading(true)
    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const uuid = crypto.randomUUID()
    const path = `${workspaceId}/${id}/${uuid}.${ext}`

    const { data: up, error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false })
    if (upErr) { addToast(`Upload: ${upErr.message}`, 'error'); setPhotoUploading(false); return }

    const checklistPct = checklistItems.length > 0
      ? Math.round((checklistItems.filter(c => c.checked).length / checklistItems.length) * 100)
      : 0

    const { data: inserted, error: dbErr } = await supabase
      .from('preparation_photos')
      .insert([{ zlecenie_id: id, workspace_id: workspaceId, storage_path: up.path, label: suggestPhotoLabel(checklistPct) }])
      .select()
      .single()

    if (dbErr) { addToast(dbErr.message, 'error') }
    else { setPhotos(ph => [...ph, inserted]) }
    setPhotoUploading(false)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  function getPhotoUrl(path) {
    return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl
  }

  async function handleFinish() {
    const gate = checkGate(zlecenie, pozycje, checklistItems, photos, readinessChecked)
    if (!gate.ok) { addToast(`Nie można zakończyć: ${gate.issues[0]}`, 'error'); return }

    setFinishing(true)
    const { error } = await supabase
      .from('zlecenia')
      .update({ status: 'gotowe', readiness_confirmed: true, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { addToast(error.message, 'error'); setFinishing(false); return }

    addToast('✓ Gotowe!', 'success')

    // Find next task scheduled for today
    const { data: zl } = await addWsFilter(
      wsQuery('zlecenia').select('*')
    ).eq('data_realizacji', isoToday()).in('status', ['nowe', 'w_realizacji']).neq('id', id)

    const next = sortWorkerTasks(zl || [])[0]
    setFinishing(false)
    if (next) navigate(`/pracownik/zadanie/${next.id}`)
    else navigate('/pracownik')
  }

  function openMaps() {
    const address = rez?.lokale?.adres || rez?.lokale?.lokalizacja || zlecenie?.nazwa
    if (!address) return
    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank')
  }

  if (loading) return <Spinner />
  if (!zlecenie) return null

  const wydano = pozycje.filter(p => p.wydano).length
  const total = pozycje.length
  const checklistChecked = checklistItems.filter(c => c.checked).length
  const checklistTotal = checklistItems.length
  const gate = checkGate(zlecenie, pozycje, checklistItems, photos, readinessChecked)
  const address = rez?.lokale?.adres || rez?.lokale?.lokalizacja

  return (
    <div style={{ paddingBottom: readOnly ? 0 : 96 }}>
      <button
        onClick={() => navigate('/pracownik')}
        className="flex items-center gap-1 text-sm mb-3"
        style={{ color: 'var(--text-2)', minHeight: 44 }}
      >
        <ArrowLeft size={15} /> Wróć do listy
      </button>

      {/* Header */}
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--border)' }}>
        <p className="font-bold" style={{ fontSize: 18, color: 'var(--text)' }}>{zlecenie.nazwa}</p>
        {address && (
          <p className="flex items-center gap-1.5 text-sm mt-2" style={{ color: 'var(--text-2)' }}>
            <MapPin size={13} /> {address}
          </p>
        )}
        {rez && (
          <p className="flex items-center gap-1.5 text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            <Users size={13} /> {rez.liczba_gosci ?? '—'} osoby
            {rez.checkin_at && <> · <CalendarDays size={13} className="inline" /> {rez.checkin_at}–{rez.checkout_at}</>}
          </p>
        )}
        {address && (
          <button
            onClick={openMaps}
            className="w-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium mt-3"
            style={{ background: 'var(--c-action-subtle)', color: 'var(--c-action)', minHeight: 44 }}
          >
            <Navigation size={15} /> Nawiguj
          </button>
        )}
        {readOnly && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium mt-3" style={{ background: 'rgba(5,150,105,0.1)', color: 'var(--c-success)' }}>
            ✓ Zakończone
          </span>
        )}
      </div>

      {/* Materiały */}
      {pozycje.length > 0 && (
        <div className="rounded-xl mb-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>Materiały</p>
          </div>
          {pozycje.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}
              onClick={() => toggleWydano(p)}>
              <button
                className="flex-shrink-0 flex items-center justify-center rounded-lg"
                style={{ width: 44, height: 44, background: p.wydano ? 'var(--c-success)' : 'var(--border)', color: '#fff', border: 'none', cursor: readOnly ? 'default' : 'pointer' }}
              >
                {p.wydano && <Check size={16} />}
              </button>
              <p className="flex-1 text-sm" style={{ color: p.wydano ? 'var(--muted)' : 'var(--text)', textDecoration: p.wydano ? 'line-through' : 'none' }}>
                {p.nazwa_pozycji}
              </p>
              <span className="text-sm num font-medium flex-shrink-0" style={{ color: 'var(--text-2)' }}>× {p.ilosc}</span>
            </div>
          ))}
          <div className="px-4 py-3">
            <p className="text-xs mb-1.5" style={{ color: 'var(--text-2)' }}>Wydano: {wydano}/{total}</p>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${total > 0 ? (wydano / total) * 100 : 0}%`, height: '100%', background: 'var(--c-success)', borderRadius: 4, transition: 'width 0.3s' }} />
            </div>
          </div>
        </div>
      )}

      {/* Checklista */}
      {checklistItems.length > 0 && (
        <div className="rounded-xl mb-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>Checklista</p>
          </div>
          {checklistItems.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)', cursor: readOnly ? 'default' : 'pointer' }}
              onClick={() => toggleChecklistItem(item)}>
              <div className="flex-shrink-0" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.checked
                  ? <CheckSquare size={24} style={{ color: 'var(--c-success)' }} />
                  : <Square size={24} style={{ color: 'var(--muted)' }} />}
              </div>
              <p className="flex-1 text-sm" style={{ color: item.checked ? 'var(--muted)' : 'var(--text)', textDecoration: item.checked ? 'line-through' : 'none' }}>
                {item.label}
              </p>
            </div>
          ))}
          <div className="px-4 py-3">
            <p className="text-xs mb-1.5" style={{ color: 'var(--text-2)' }}>Checklista: {checklistChecked}/{checklistTotal}</p>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${checklistTotal > 0 ? (checklistChecked / checklistTotal) * 100 : 0}%`, height: '100%', background: 'var(--c-success)', borderRadius: 4, transition: 'width 0.3s' }} />
            </div>
          </div>
        </div>
      )}

      {/* Zdjęcia */}
      <div className="rounded-xl mb-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>Zdjęcia {photos.length > 0 && `(${photos.length})`}</p>
        </div>
        {!readOnly && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              className="w-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--c-action-subtle)', color: 'var(--c-action)', minHeight: 48, opacity: photoUploading ? 0.6 : 1 }}
            >
              <Camera size={16} /> {photoUploading ? 'Wysyłam…' : 'Zrób zdjęcie'}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => { const file = e.target.files?.[0]; if (file) handlePhotoUpload(file) }}
            />
          </div>
        )}
        {photos.length > 0 && (
          <div className="p-3 grid grid-cols-3 gap-2">
            {photos.map(photo => (
              <div key={photo.id} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: '1', background: 'var(--border)' }}>
                <img src={getPhotoUrl(photo.storage_path)} alt={photo.label || 'zdjęcie'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none' }} />
                {photo.label && (
                  <span className="absolute bottom-0 left-0 right-0 text-center text-xs font-medium py-0.5" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                    {photo.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gotowość sticky footer */}
      {!readOnly && (
        <div
          className="fixed left-0 right-0 z-30 px-4 py-3"
          style={{ bottom: 64, background: 'var(--c-surface)', borderTop: '1px solid var(--border)', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)' }}
        >
          <div className="flex items-center gap-3 mb-2 cursor-pointer" onClick={toggleReadiness}>
            {readinessChecked
              ? <CheckSquare size={22} style={{ color: 'var(--c-success)', flexShrink: 0 }} />
              : <Square size={22} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Potwierdzam gotowość</p>
          </div>
          {!gate.ok && (
            <p className="text-xs mb-2 flex items-center gap-1" style={{ color: 'var(--c-critical)' }}>
              <X size={12} /> {gate.issues[0]}
            </p>
          )}
          <button
            onClick={handleFinish}
            disabled={!gate.ok || finishing}
            className="w-full flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: gate.ok ? 'var(--c-success)' : 'var(--border)', minHeight: 48, opacity: finishing ? 0.7 : 1, cursor: gate.ok ? 'pointer' : 'not-allowed' }}
          >
            <ShieldCheck size={16} /> {finishing ? 'Zapisuję…' : 'Zakończ i przejdź dalej'}
          </button>
        </div>
      )}
    </div>
  )
}
