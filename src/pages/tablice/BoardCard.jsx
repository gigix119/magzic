import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CheckCircle2, Calendar } from 'lucide-react'
import { formatTermin, terminStatus } from './tablicaTokens'

const TERMIN_COLOR = {
  overdue: 'var(--c-critical)',
  soon: 'var(--c-attention)',
  neutral: 'var(--text-2)',
}

export default function BoardCard({ card, onOpen, onRename }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', listaId: card.lista_id },
  })

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(card.tytul || '')

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const etykiety = Array.isArray(card.etykiety) ? card.etykiety : []
  const przypisani = Array.isArray(card.przypisani) ? card.przypisani : []
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
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && !editingTitle && onOpen(card)}
      className="board-card rounded-[12px] p-3 mb-2 cursor-pointer select-none"
    >
      {etykiety.length > 0 && (
        <div className="flex gap-1 mb-1.5 flex-wrap">
          {etykiety.map((et, i) => (
            <span key={i} title={et.nazwa || ''} style={{ width: 28, height: 6, borderRadius: 3, background: et.color || '#5B8DEF' }} />
          ))}
        </div>
      )}

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
            width: '100%', fontSize: 13.5, fontWeight: 500, padding: '2px 4px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none',
          }}
        />
      ) : (
        <p
          className="text-[13.5px] leading-snug font-medium"
          style={{ color: 'var(--text)' }}
          onDoubleClick={startEdit}
        >
          {card.tytul}
        </p>
      )}

      {(card.termin || przypisani.length > 0 || card.zakonczona) && (
        <div className="flex items-center gap-3 mt-2 text-[11.5px]" style={{ color: 'var(--text-2)' }}>
          {card.zakonczona && <CheckCircle2 size={14} style={{ color: 'var(--c-success)' }} />}
          {card.termin && (
            <span className="flex items-center gap-1" style={{ color: TERMIN_COLOR[status] }}>
              <Calendar size={12} /> {formatTermin(card.termin)}
            </span>
          )}
          {przypisani.length > 0 && (
            <span className="flex items-center -space-x-1.5 ml-auto">
              {przypisani.slice(0, 3).map((p, i) => (
                <span
                  key={i}
                  className="flex items-center justify-center rounded-full text-white font-semibold"
                  style={{
                    width: 20, height: 20, fontSize: 9,
                    background: 'var(--c-action)',
                    border: '1.5px solid var(--c-surface)',
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
  )
}
