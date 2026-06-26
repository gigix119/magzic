import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { hashColor } from './tablicaTokens'
import { logActivity } from './activityLog'

function displayName(profile, user) {
  if (profile?.first_name || profile?.last_name) {
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
  }
  if (profile?.display_name) return profile.display_name
  return user?.email || 'Użytkownik'
}

function formatWhen(iso) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return time
  return `${d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} ${time}`
}

export default function CardComments({ card, workspaceId }) {
  const { addToast } = useToast()
  const { user, profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let active = true
    supabase
      .from('komentarze_kart')
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

  async function handleSubmit(e) {
    e.preventDefault()
    const tresc = draft.trim()
    if (!tresc || !workspaceId || !user) return
    setSending(true)
    const { data, error } = await supabase
      .from('komentarze_kart')
      .insert([{ karta_id: card.id, workspace_id: workspaceId, autor_id: user.id, autor_nazwa: displayName(profile, user), tresc }])
      .select()
      .single()
    if (error) addToast(error.message, 'error')
    else {
      setItems(prev => [data, ...prev])
      setDraft('')
      logActivity({ workspaceId, kartaId: card.id, tablicaId: card.tablica_id, user, profile, typ: 'komentarz', opis: 'dodano komentarz' })
    }
    setSending(false)
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-3">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Napisz komentarz…"
          className="card-detail-input"
          style={{ minHeight: 40, padding: '8px 10px', fontSize: 14, flex: 1 }}
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex items-center justify-center rounded-[10px] flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.10)', color: 'var(--tb-text, #F4F8FB)', width: 40, height: 40, opacity: draft.trim() ? 1 : 0.5 }}
        >
          <Send size={15} />
        </button>
      </form>

      {!loading && items.length === 0 && (
        <p style={{ fontSize: 12.5, color: '#6E7E8C' }}>Brak komentarzy.</p>
      )}

      <div className="flex flex-col gap-3">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-2.5">
            <span
              style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: hashColor(item.autor_nazwa || item.autor_id),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 600, color: 'white',
              }}
            >
              {(item.autor_nazwa || '?').slice(0, 2).toUpperCase()}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tb-text, #F4F8FB)' }}>{item.autor_nazwa || 'Użytkownik'}</span>
                <span style={{ fontSize: 11, color: '#6E7E8C' }}>{formatWhen(item.created_at)}</span>
              </div>
              <p style={{ fontSize: 13.5, color: '#D7E1E8', margin: 0, wordBreak: 'break-word' }}>{item.tresc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
