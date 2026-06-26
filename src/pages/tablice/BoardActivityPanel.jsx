import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../supabase'
import { hashColor } from './tablicaTokens'

const FILTERS = [
  { key: 'all', label: 'Wszystkie', typy: null },
  { key: 'przeniesiono', label: 'Przeniesienia', typy: ['przeniesiono'] },
  { key: 'zdjecie', label: 'Zdjęcia', typy: ['zdjecie'] },
  { key: 'komentarz', label: 'Komentarze', typy: ['komentarz'] },
]

function formatWhen(iso) {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'teraz'
  if (min < 60) return `${min} min temu`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} godz. temu`
  if (h < 48) return 'wczoraj'
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })
}

export default function BoardActivityPanel({ tablicaId, onClose }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let active = true
    supabase
      .from('aktywnosc_kart')
      .select('*')
      .eq('tablica_id', tablicaId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!active) return
        if (!error) setItems(data || [])
        setLoading(false)
      })
    return () => { active = false }
  }, [tablicaId])

  const activeFilter = FILTERS.find(f => f.key === filter)
  const visible = activeFilter?.typy ? items.filter(i => activeFilter.typy.includes(i.typ)) : items

  return (
    <>
      <div className="board-menu-overlay" onClick={onClose} />
      <div className="board-menu-panel">
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--tb-text, #F4F8FB)' }}>
            Aktywność
          </span>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'var(--tb-text-muted, #A9BBC9)' }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0" style={{ padding: '10px 16px 0' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="text-xs font-medium rounded-full"
              style={{
                padding: '5px 11px', minHeight: 28,
                background: filter === f.key ? 'rgba(55,160,201,0.22)' : 'rgba(255,255,255,0.06)',
                color: filter === f.key ? 'var(--tb-accent, #37A0C9)' : 'var(--tb-text-muted, #A9BBC9)',
                border: filter === f.key ? '1px solid rgba(55,160,201,0.40)' : '1px solid transparent',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto" style={{ padding: '14px 16px' }}>
          {loading ? (
            <p style={{ fontSize: 12.5, color: '#6E7E8C' }}>Wczytywanie…</p>
          ) : visible.length === 0 ? (
            <p style={{ fontSize: 12.5, color: '#6E7E8C' }}>Brak aktywności.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {visible.map(item => (
                <div key={item.id} className="flex items-start gap-2.5">
                  <span
                    style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                      background: hashColor(item.autor_nazwa || item.uzytkownik_id || ''),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9.5, fontWeight: 600, color: 'white',
                    }}
                  >
                    {(item.autor_nazwa || '?').slice(0, 2).toUpperCase()}
                  </span>
                  <p style={{ fontSize: 12.5, color: '#D7E1E8', margin: 0, flex: 1 }}>
                    <strong style={{ color: 'var(--tb-text, #F4F8FB)', fontWeight: 600 }}>{item.autor_nazwa || 'Użytkownik'}</strong> {item.opis}
                    <span style={{ color: '#6E7E8C', marginLeft: 6 }}>· {formatWhen(item.created_at)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
