import Badge from '../Badge'
import { File, Image, Table2 } from 'lucide-react'

export const IS = (err) => ({
  background: 'var(--input-bg)',
  border: `1px solid ${err ? '#ef4444' : 'var(--border)'}`,
  borderRadius: 8, color: 'var(--text)',
  padding: '8px 12px', fontSize: 14, width: '100%', outline: 'none',
})

export const emptyFak = {
  numer: '',
  kontrahent_id: '',
  data_zakupu: new Date().toISOString().slice(0, 10),
  typ: 'zakup',
  magazyn_id: '',
  notatki: '',
}

export const emptyPoz = { towar_id: '', ilosc: '', cena_netto: '', vat_procent: 23, magazyn_id: '' }

let _posKey = 0
export function mkPos(defaults = {}) {
  return { _key: ++_posKey, nazwa: '', typ: '', ilosc: 1, jednostka: 'szt', cena_netto: 0, magazyn_id: '', ...defaults }
}

export function fileIcon(url) {
  if (!url) return null
  const ext = url.split('?')[0].split('.').pop().toLowerCase()
  if (ext === 'pdf') return <File size={14} style={{ color: '#f87171' }} />
  if (ext === 'csv') return <Table2 size={14} style={{ color: '#4ade80' }} />
  return <Image size={14} style={{ color: '#60a5fa' }} />
}

export function typBadge(typ) {
  const map = { zakup: ['blue', 'Zakup'], sprzedaz: ['green', 'Sprzedaż'], wz: ['yellow', 'WZ'], paragon: ['zinc', 'Paragon'] }
  const [v, l] = map[typ] || ['zinc', typ]
  return <Badge variant={v}>{l}</Badge>
}

export function statusBadge(status) {
  if (status === 'zatwierdzona') return <Badge variant="green">Zatwierdzona</Badge>
  if (status === 'anulowana') return <Badge variant="red">Anulowana</Badge>
  return <Badge variant="zinc">Robocza</Badge>
}
