import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { hashColor } from './tablicaTokens'

function formatWhen(iso) {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'teraz'
  if (min < 60) return `${min} min temu`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} godz. temu`
  const sameYear = d.getFullYear() === new Date().getFullYear()
  if (h < 48) return 'wczoraj'
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: sameYear ? undefined : 'numeric' })
}

export default function CardActivity({ card }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('aktywnosc_kart')
      .select('*')
      .eq('karta_id', card.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (!active) return
        if (!error) setItems(data || [])
        setLoading(false)
      })
    return () => { active = false }
  }, [card.id])

  if (loading) return null
  if (items.length === 0) {
    return <p style={{ fontSize: 12.5, color: '#6E7E8C' }}>Brak historii zmian.</p>
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.map(item => (
        <div key={item.id} className="flex items-start gap-2.5">
          <span
            style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
              background: hashColor(item.autor_nazwa || item.uzytkownik_id || ''),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 600, color: 'white',
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
  )
}
