import { useEffect, useRef, useState } from 'react'
import { Camera, Image as ImageIcon, Trash2, X } from 'lucide-react'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { capturePhoto, ZDJECIA_BUCKET } from './photoUpload'

export default function CardPhotoGallery({ card, workspaceId, userId }) {
  const { addToast } = useToast()
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  useEffect(() => {
    let active = true
    async function load() {
      const { data, error } = await supabase
        .from('karta_zdjecia')
        .select('*')
        .eq('karta_id', card.id)
        .order('created_at', { ascending: false })
      if (!active) return
      if (error) addToast(error.message, 'error')
      setPhotos(data || [])
      setLoading(false)
    }
    load()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id])

  async function handleFile(e, typ) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !workspaceId) return
    setUploading(true)
    const { row, offline } = await capturePhoto({ file, workspaceId, kartaId: card.id, tablicaId: card.tablica_id, typ, userId })
    setUploading(false)
    if (offline) { addToast('📷 Zdjęcie zapisane lokalnie — wyślę gdy wrócisz online', 'warning'); return }
    if (row) { setPhotos(prev => [row, ...prev]); addToast('📷 Zdjęcie zapisane', 'success') }
  }

  async function handleDelete(photo) {
    if (confirmingId !== photo.id) { setConfirmingId(photo.id); return }
    setConfirmingId(null)
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
    setPreview(null)
    const { error } = await supabase.from('karta_zdjecia').delete().eq('id', photo.id)
    if (error) addToast(error.message, 'error')
    if (photo.storage_path) await supabase.storage.from(ZDJECIA_BUCKET).remove([photo.storage_path])
  }

  if (loading) return null

  return (
    <div>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleFile(e, 'aparat')} />
      <input ref={galleryInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e, 'galeria')} />

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
          {photos.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreview(p)}
              style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', border: 'none', padding: 0, display: 'block' }}
            >
              <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 rounded-[10px] text-sm font-medium text-white"
          style={{ background: '#37A0C9', minHeight: 38 }}
        >
          <Camera size={14} /> Zrób zdjęcie
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 rounded-[10px] text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#F4F8FB', minHeight: 38 }}
        >
          <ImageIcon size={14} /> Z galerii
        </button>
      </div>

      {preview && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.85)', zIndex: 100, padding: 20 }}
          onClick={() => setPreview(null)}
        >
          <button
            onClick={() => setPreview(null)}
            className="flex items-center justify-center rounded-lg"
            style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none' }}
          >
            <X size={18} />
          </button>
          <img src={preview.url} alt="" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
          <div
            className="flex items-center gap-3"
            style={{ position: 'absolute', bottom: 24, left: 0, right: 0, justifyContent: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <span style={{ color: '#A9BBC9', fontSize: 12 }}>
              {new Date(preview.created_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              {preview.created_by ? ` · ${preview.created_by === userId ? 'Ty' : 'Współpracownik'}` : ''}
            </span>
            <button
              onClick={() => handleDelete(preview)}
              className="flex items-center gap-1.5 px-3 rounded-lg text-sm font-medium"
              style={{ background: confirmingId === preview.id ? '#FF6B6B' : 'rgba(255,255,255,0.12)', color: '#fff', minHeight: 36, border: 'none' }}
            >
              <Trash2 size={13} /> {confirmingId === preview.id ? 'Na pewno?' : 'Usuń'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
