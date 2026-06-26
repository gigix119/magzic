import { useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'

const STORAGE_BUCKET = 'karty-zdjecia'

function Tile({ label, slot, url, uploading, onPick, onRemove }) {
  const inputRef = useRef(null)

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(slot, f); e.target.value = '' }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          width: '100%', height: 96, borderRadius: 10, overflow: 'hidden', position: 'relative',
          border: url ? '1px solid rgba(255,255,255,0.16)' : '1px dashed rgba(255,255,255,0.25)',
          background: url ? 'transparent' : 'rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4,
          cursor: uploading ? 'wait' : 'pointer', padding: 0,
        }}
      >
        {url ? (
          <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <>
            <Camera size={18} style={{ color: '#A9BBC9' }} />
            <span style={{ fontSize: 11, color: '#A9BBC9' }}>{uploading ? 'Wysyłanie…' : label}</span>
          </>
        )}
      </button>
      {url && (
        <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
          <span style={{ fontSize: 11, color: '#A9BBC9' }}>{label}</span>
          <button
            type="button"
            onClick={() => onRemove(slot)}
            title="Usuń zdjęcie"
            style={{ color: '#A9BBC9', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function CardPhotos({ card, workspaceId, onSave }) {
  const { addToast } = useToast()
  const [urls, setUrls] = useState({ przed: card.foto_przed || null, po: card.foto_po || null })
  const [uploadingSlot, setUploadingSlot] = useState(null)

  async function handlePick(slot, file) {
    if (!workspaceId) return
    setUploadingSlot(slot)
    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const path = `${workspaceId}/${card.id}/${slot}_${Date.now()}.${ext}`
    const { data: up, error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false })
    if (upErr) {
      addToast(`Upload: ${upErr.message}`, 'error')
      setUploadingSlot(null)
      return
    }
    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(up.path)
    const field = slot === 'przed' ? 'foto_przed' : 'foto_po'
    setUrls(prev => ({ ...prev, [slot]: pub.publicUrl }))
    onSave(card.id, { [field]: pub.publicUrl })
    setUploadingSlot(null)
  }

  function handleRemove(slot) {
    const field = slot === 'przed' ? 'foto_przed' : 'foto_po'
    setUrls(prev => ({ ...prev, [slot]: null }))
    onSave(card.id, { [field]: null })
  }

  return (
    <div className="flex gap-3">
      <Tile label="Przed" slot="przed" url={urls.przed} uploading={uploadingSlot === 'przed'} onPick={handlePick} onRemove={handleRemove} />
      <Tile label="Po" slot="po" url={urls.po} uploading={uploadingSlot === 'po'} onPick={handlePick} onRemove={handleRemove} />
    </div>
  )
}
