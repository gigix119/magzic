import { supabase } from '../../supabase'

export const ZDJECIA_BUCKET = 'karty-zdjecia'
const PENDING_KEY = 'magzic_karta_zdjecia_pending'

export function compressImage(file, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ratio = Math.min(maxWidth / img.width, 1)
      canvas.width = img.width * ratio
      canvas.height = img.height * ratio
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => { URL.revokeObjectURL(img.src); blob ? resolve(blob) : reject(new Error('compress_failed')) },
        'image/jpeg', quality,
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function getPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') } catch { return [] }
}

function setPending(list) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(list))
}

export function pendingPhotoCount() {
  return getPending().length
}

export async function uploadKartaZdjecie({ workspaceId, kartaId, tablicaId, blob, typ = 'aparat', userId }) {
  const path = `${workspaceId}/${kartaId}/${Date.now()}.jpg`
  const { error: upErr } = await supabase.storage.from(ZDJECIA_BUCKET).upload(path, blob, { upsert: false, contentType: 'image/jpeg' })
  if (upErr) throw upErr
  const { data: pub } = supabase.storage.from(ZDJECIA_BUCKET).getPublicUrl(path)
  const { data, error } = await supabase
    .from('karta_zdjecia')
    .insert([{ workspace_id: workspaceId, karta_id: kartaId, tablica_id: tablicaId, url: pub.publicUrl, storage_path: path, typ, created_by: userId || null }])
    .select()
    .single()
  if (error) throw error
  return data
}

// Kompresuje + wysyła zdjęcie. Gdy upload się nie powiedzie (offline/RLS), zapisuje
// base64 w localStorage jako fallback — patrz flushPendingPhotos().
export async function capturePhoto({ file, workspaceId, kartaId, tablicaId, typ = 'aparat', userId }) {
  const blob = await compressImage(file)
  try {
    const row = await uploadKartaZdjecie({ workspaceId, kartaId, tablicaId, blob, typ, userId })
    return { row, offline: false }
  } catch (err) {
    const dataUrl = await blobToDataUrl(blob)
    const entry = { id: crypto.randomUUID(), workspaceId, kartaId, tablicaId, typ, userId, dataUrl, createdAt: Date.now() }
    setPending([...getPending(), entry])
    return { row: null, offline: true, error: err }
  }
}

export async function flushPendingPhotos() {
  const list = getPending()
  if (!list.length) return { synced: 0, rows: [] }
  const remaining = []
  const rows = []
  for (const entry of list) {
    try {
      const blob = await (await fetch(entry.dataUrl)).blob()
      const row = await uploadKartaZdjecie({
        workspaceId: entry.workspaceId, kartaId: entry.kartaId, tablicaId: entry.tablicaId,
        blob, typ: entry.typ, userId: entry.userId,
      })
      rows.push(row)
    } catch {
      remaining.push(entry)
    }
  }
  setPending(remaining)
  return { synced: list.length - remaining.length, rows }
}
