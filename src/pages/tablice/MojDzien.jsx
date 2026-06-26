import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, PartyPopper } from 'lucide-react'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { useTablicaTheme } from '../../lib/useTablicaTheme'
import EmptyState from '../../components/ui/EmptyState'
import BottomNav from './BottomNav'
import CardDetailModal from './CardDetailModal'
import { STATUS_COLORS, classifyKarta } from './tablicaTokens'

const SECTION_LABELS = {
  bez_terminu: 'Bez terminu',
  rano: 'Rano',
  poludnie: 'Południe',
  wieczor: 'Popołudnie / wieczór',
}
const SECTION_ORDER = ['bez_terminu', 'rano', 'poludnie', 'wieczor']

function bucketFor(card) {
  if (!card.termin) return 'bez_terminu'
  const h = new Date(card.termin).getHours()
  if (h < 12) return 'rano'
  if (h < 17) return 'poludnie'
  return 'wieczor'
}

function ChecklistRing({ done, total, color }) {
  const size = 32
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const percent = total ? done / total : 0
  const offset = c - percent * c
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={3} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="51%" textAnchor="middle" dy="0.32em" fontSize={9} fontWeight={600} fill="var(--tb-text, #F4F8FB)" fontFamily="'Inter', sans-serif">
        {done}/{total}
      </text>
    </svg>
  )
}

function AgendaRow({ card, onOpen }) {
  const checklista = Array.isArray(card.checklista) ? card.checklista : []
  const doneCount = checklista.filter(it => it.done).length
  const classification = classifyKarta(card.tytul)
  const spineColor = classification ? STATUS_COLORS[classification] : 'rgba(255,255,255,0.18)'
  const overdue = card.termin && !card.zakonczona && new Date(card.termin).getTime() < Date.now()
  const d = card.termin ? new Date(card.termin) : null
  const pad = n => String(n).padStart(2, '0')

  return (
    <div className="agenda-row" onClick={() => onOpen(card)}>
      <div className="agenda-hour">
        {d ? (
          <>
            <span className="agenda-hour-big">{d.getHours()}</span>
            <span className="agenda-hour-small">:{pad(d.getMinutes())}</span>
          </>
        ) : (
          <span className="agenda-hour-small">—</span>
        )}
      </div>

      <span className="agenda-spine" style={{ background: spineColor }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tb-text, #F4F8FB)', fontFamily: "'Space Grotesk', sans-serif" }}>{card.tytul}</span>
          {classification && (
            <span
              className="card-detail-chip"
              style={{ height: 20, color: STATUS_COLORS[classification], borderColor: `${STATUS_COLORS[classification]}66`, background: `${STATUS_COLORS[classification]}22` }}
            >
              {classification === 'zmiana' ? 'Zmiana' : classification === 'przyjazd' ? 'Przyjazd' : 'Wyjazd'}
            </span>
          )}
        </div>
        {card.opis && (
          <p className="truncate" style={{ fontSize: 12.5, color: 'var(--tb-text-muted, #A9BBC9)', margin: '2px 0 0' }}>{card.opis}</p>
        )}
        {overdue && (
          <p style={{ fontSize: 12, color: '#FF6B6B', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} /> Przekroczony termin
          </p>
        )}
      </div>

      {checklista.length > 0 && (
        <ChecklistRing done={doneCount} total={checklista.length} color={doneCount === checklista.length ? '#2BD17E' : 'var(--tb-accent, #37A0C9)'} />
      )}
    </div>
  )
}

export default function MojDzien() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { wsQuery, addWsFilter } = useWorkspace()
  const { user } = useAuth()
  const { theme } = useTablicaTheme()

  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [openCard, setOpenCard] = useState(null)

  const fetchAgenda = useCallback(async () => {
    if (!user) return
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    const { data, error } = await addWsFilter(
      wsQuery('karty').select('*, listy(nazwa)')
    )
      .eq('archiwum', false)
      .or(`przypisany_do.eq.${user.id},and(termin.gte.${todayStart.toISOString()},termin.lt.${todayEnd.toISOString()})`)
      .order('termin', { ascending: true, nullsFirst: false })

    if (error) addToast(error.message, 'error')
    setCards(data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => { fetchAgenda() }, [fetchAgenda])

  async function handleSave(cardId, fields) {
    setCards(prev => prev.map(c => (c.id === cardId ? { ...c, ...fields } : c)))
    const { error } = await supabase.from('karty').update(fields).eq('id', cardId)
    if (error) addToast(error.message, 'error')
  }

  async function handleArchive(cardId) {
    setCards(prev => prev.filter(c => c.id !== cardId))
    const { error } = await supabase.from('karty').update({ archiwum: true }).eq('id', cardId)
    if (error) addToast(error.message, 'error')
  }

  async function handleDelete(cardId) {
    setCards(prev => prev.filter(c => c.id !== cardId))
    const { error } = await supabase.from('karty').delete().eq('id', cardId)
    if (error) addToast(error.message, 'error')
  }

  const buckets = { bez_terminu: [], rano: [], poludnie: [], wieczor: [] }
  for (const card of cards) buckets[bucketFor(card)].push(card)

  const todayLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div
      className="moj-dzien-page"
      style={{ background: `linear-gradient(135deg, ${theme.bg.deep} 0%, ${theme.bg.mid} 55%, ${theme.bg.tide} 100%)` }}
    >
      <header className="board-header-interior">
        <button onClick={() => navigate('/tablice')} className="board-header-btn" title="Wróć do tablic" style={{ width: 36, padding: 0, justifyContent: 'center' }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--tb-text, #F4F8FB)' }}>Mój dzień</span>
          <span style={{ fontSize: 12, color: 'var(--tb-text-muted, #A9BBC9)', marginLeft: 10 }}>{todayLabel}</span>
        </div>
      </header>

      {!loading && cards.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title="Brak zadań na dziś"
          description="Miłego dnia! Wróć do tablicy, by zobaczyć pozostałe karty."
          className="flex-1"
          action={(
            <button
              onClick={() => navigate('/tablice')}
              className="px-4 rounded-[10px] text-sm font-medium text-white"
              style={{ background: 'var(--tb-accent, #37A0C9)', minHeight: 40 }}
            >
              Wróć do tablicy
            </button>
          )}
        />
      ) : (
        <div className="moj-dzien-scroll">
          {SECTION_ORDER.filter(key => buckets[key].length > 0).map(key => (
            <div key={key}>
              <div className="agenda-section-label">{SECTION_LABELS[key]}</div>
              {buckets[key].map(card => (
                <AgendaRow key={card.id} card={card} onOpen={setOpenCard} />
              ))}
            </div>
          ))}
        </div>
      )}

      <BottomNav
        active="planner"
        onInbox={() => addToast('Skrzynka odbiorcza — wkrótce', 'info')}
        onBoard={() => navigate('/tablice')}
        onSwitch={() => navigate('/tablice')}
      />

      {openCard && (
        <CardDetailModal
          card={openCard}
          lists={[]}
          onClose={() => setOpenCard(null)}
          onSave={handleSave}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onMove={() => {}}
          onCopy={() => {}}
        />
      )}
    </div>
  )
}
