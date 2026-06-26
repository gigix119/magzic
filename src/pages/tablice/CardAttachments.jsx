import { useEffect, useRef, useState } from 'react'
import { Paperclip, Plus, X, FileText } from 'lucide-react'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'

const STORAGE_BUCKET = 'karty-zalaczniki'

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CardAttachments({ card, workspaceId }) {
  const { addToast } = useToast()
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    let active = true
    supabase
      .from('karta_zalaczniki')
      .select('*')
      .eq('karta_id', card.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error) addToast(error.message, 'error')
        setItems(data || [])
        setLoading(false)
      })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id])

  async function handleFile(file) {
    if (!file || !workspaceId) return
    setUploading(true)
    const path = `${workspaceId}/${card.id}/${crypto.randomUUID()}_${file.name}`
    const { data: up, error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false })
    if (upErr) {
      addToast(`Upload: ${upErr.message}`, 'error')
      setUploading(false)
      return
    }
    const { data, error } = await supabase
      .from('karta_zalaczniki')
      .insert([{
        karta_id: card.id, workspace_id: workspaceId, nazwa: file.name,
        storage_path: up.path, rozmiar: file.size, typ: file.type, created_by: user?.id,
      }])
      .select()
      .single()
    if (error) addToast(error.message, 'error')
    else setItems(prev => [data, ...prev])
    setUploading(false)
  }

  async function handleRemove(item) {
    await supabase.storage.from(STORAGE_BUCKET).remove([item.storage_path])
    const { error } = await supabase.from('karta_zalaczniki').delete().eq('id', item.id)
    if (error) { addToast(error.message, 'error'); return }
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  function getUrl(path) {
    return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl
  }

  if (loading) return null

  return (
    <div>
      {items.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2" style={{ minHeight: 40 }}>
              <a
                href={getUrl(item.storage_path)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 flex-1"
                style={{ minWidth: 0, color: '#F4F8FB', textDecoration: 'none' }}
              >
                <FileText size={15} style={{ color: '#A9BBC9', flexShrink: 0 }} />
                <span className="truncate" style={{ fontSize: 13.5 }}>{item.nazwa}</span>
                <span style={{ fontSize: 11, color: '#6E7E8C', flexShrink: 0 }}>{formatSize(item.rozmiar)}</span>
              </a>
              <button type="button" onClick={() => handleRemove(item)} style={{ color: '#A9BBC9', width: 26, height: 26, flexShrink: 0 }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 text-sm font-medium"
        style={{ color: '#A9BBC9', minHeight: 36 }}
      >
        {uploading ? <Paperclip size={14} /> : <Plus size={14} />}
        {uploading ? 'Wysyłanie…' : 'Dodaj załącznik'}
      </button>
    </div>
  )
}
