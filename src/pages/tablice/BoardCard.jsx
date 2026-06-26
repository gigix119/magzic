import { useState, memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CheckCircle2, Calendar, ListChecks, AlignLeft, Pencil } from 'lucide-react'
import { formatTermin, terminStatus, hashColor } from './tablicaTokens'

const TERMIN_STYLE = {
  overdue: { color: '#FF6B6B', background: 'rgba(255,107,107,0.12)' },
  soon: { color: '#F5A524', background: 'rgba(245,165,36,0.14)' },
  neutral: { color: '#A9BBC9', background: 'transparent' },
}

function BoardCard({ card, onOpen, onRename, removing, hidden }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', listaId: card.lista_id },
  })

  const [hovered, setHovered] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(card.tytul || '')

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    display: hidden ? 'none' : undefined,
  }

  const etykiety = Array.isArray(card.etykiety) ? card.etykiety : []
  const przypisani = Array.isArray(card.przypisani) ? card.przypisani : []
  const checklista = Array.isArray(card.checklista) ? card.checklista : []
  const checklistDone = checklista.filter(it => it.done).length
  const status = terminStatus(card.termin, card.zakonczona)

  function startEdit(e) {
    e.stopPropagation()
    setTitleDraft(card.tytul || '')
    setEditingTitle(true)
  }

  function commitEdit() {
    setEditingTitle(false)
    const t = titleDraft.trim()
    if (t && t !== card.tytul) onRename(card.id, t)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, position: 'relative', overflow: 'hidden' }}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !isDragging && !editingTitle && onOpen(card)}
      className={`board-card rounded-[8px] cursor-pointer select-none${removing ? ' board-card-removing' : ''}`}
    >
      {card.cover_url && (
        <div style={{ width: '100%', height: 100, overflow: 'hidden' }}>
          <img src={card.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      {etykiety.length > 0 && (
        <div style={{ display: 'flex', gap: 4, padding: card.cover_url ? '6px 10px 0' : '8px 10px 0', flexWrap: 'wrap' }}>
          {etykiety.map((et, i) => (
            <span key={i} title={et.nazwa || ''} style={{ height: 8, minWidth: 40, borderRadius: 4, background: et.color || '#5B8DEF', opacity: 0.9 }} />
          ))}
        </div>
      )}

      <div style={{ padding: '8px 10px', position: 'relative' }}>
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitEdit}
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingTitle(false) }}
            style={{
              width: '100%', fontSize: 14, fontWeight: 400, padding: '2px 4px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(0,0,0,0.30)', color: '#F4F8FB', outline: 'none',
            }}
          />
        ) : (
          <p
            onDoubleClick={startEdit}
            style={{
              fontSize: 14, fontWeight: 400, lineHeight: 1.45, color: '#F4F8FB', margin: 0,
              wordBreak: 'break-word', fontFamily: "'Inter', sans-serif",
            }}
          >
            {card.tytul}
          </p>
        )}

        {(card.termin || card.opis || przypisani.length > 0 || card.zakonczona || checklista.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {card.zakonczona && <CheckCircle2 size={13} style={{ color: '#2BD17E' }} />}
            {checklista.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: checklistDone === checklista.length ? '#2BD17E' : '#A9BBC9' }}>
                <ListChecks size={11} /> {checklistDone}/{checklista.length}
              </span>
            )}
            {card.termin && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, borderRadius: 4,
                color: TERMIN_STYLE[status].color, background: TERMIN_STYLE[status].background,
                padding: status === 'overdue' ? '1px 5px' : 0,
              }}>
                <Calendar size={11} /> {formatTermin(card.termin)}
              </span>
            )}
            {card.opis && <AlignLeft size={12} style={{ color: '#A9BBC9' }} />}
            {przypisani.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                {przypisani.slice(0, 3).map((p, i) => (
                  <span
                    key={i}
                    style={{
                      width: 20, height: 20, fontSize: 9, fontWeight: 600, color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%', background: hashColor(String(p)),
                      border: '1.5px solid #22272B', marginLeft: i > 0 ? -6 : 0,
                    }}
                  >
                    {String(p).slice(0, 2).toUpperCase()}
                  </span>
                ))}
              </span>
            )}
          </div>
        )}
      </div>

      {hovered && !isDragging && !editingTitle && (
        <button
          onClick={startEdit}
          onPointerDown={e => e.stopPropagation()}
          title="Edytuj tytuł"
          style={{
            position: 'absolute', top: 4, right: 4, width: 26, height: 26, borderRadius: 6,
            background: 'rgba(255,255,255,0.12)', border: 'none', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#A9BBC9',
          }}
        >
          <Pencil size={12} />
        </button>
      )}
    </div>
  )
}

export default memo(BoardCard)
