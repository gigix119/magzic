import { useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, MoreHorizontal, Archive, Palette } from 'lucide-react'
import BoardCard from './BoardCard'
import { TABLICA_COLORS } from './tablicaTokens'

export default function BoardColumn({ column, cards, onOpenCard, onAddCard, onArchiveList, onRenameList, onRenameCard, onChangeListColor }) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(column.nazwa)
  const textareaRef = useRef(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'list' },
  })

  const { setNodeRef: setBodyRef } = useDroppable({ id: `colbody:${column.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  function submitDraft() {
    const text = draft.trim()
    if (text) onAddCard(column.id, text)
    setDraft('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitDraft()
    } else if (e.key === 'Escape') {
      setComposerOpen(false)
      setDraft('')
    }
  }

  function commitName() {
    setEditingName(false)
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== column.nazwa) onRenameList(column.id, trimmed)
    else setNameDraft(column.nazwa)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="board-column flex-shrink-0 flex flex-col rounded-[var(--radius-card)]"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center gap-2 px-3 py-2.5 rounded-t-[var(--radius-card)] cursor-grab"
        style={{ borderTop: `3px solid ${column.kolor || 'var(--c-action)'}` }}
      >
        {editingName ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameDraft(column.nazwa); setEditingName(false) } }}
            onPointerDown={e => e.stopPropagation()}
            style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '2px 6px', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', width: '100%' }}
          />
        ) : (
          <span
            onClick={() => setEditingName(true)}
            className="text-[13.5px] font-semibold flex-1 truncate"
            style={{ color: 'var(--text)' }}
          >
            {column.nazwa}
          </span>
        )}
        <span
          className="text-[11px] font-medium rounded-full px-1.5"
          style={{ background: 'var(--hover-bg)', color: 'var(--text-2)', minWidth: 20, textAlign: 'center' }}
        >
          {cards.length}
        </span>
        <div className="relative">
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => setMenuOpen(o => !o)}
            className="p-1 rounded"
            style={{ color: 'var(--muted)' }}
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-7 z-10 rounded-lg py-1 text-sm"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', minWidth: 180 }}
              onMouseLeave={() => { setMenuOpen(false); setColorPickerOpen(false) }}
            >
              {colorPickerOpen ? (
                <div className="px-3 py-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {TABLICA_COLORS.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        title={c.label}
                        onClick={() => { onChangeListColor(column.id, c.value); setMenuOpen(false); setColorPickerOpen(false) }}
                        className="rounded-full"
                        style={{
                          width: 22, height: 22, background: c.value,
                          outline: column.kolor === c.value ? '2px solid var(--text)' : 'none',
                          outlineOffset: 2,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setColorPickerOpen(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left"
                    style={{ color: 'var(--text)' }}
                  >
                    <Palette size={14} /> Zmień kolor listy
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onArchiveList(column.id) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left"
                    style={{ color: 'var(--text)' }}
                  >
                    <Archive size={14} /> Archiwizuj listę
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div ref={setBodyRef} className="board-column-body flex-1 px-2 pt-2 overflow-y-auto">
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <BoardCard key={card.id} card={card} onOpen={onOpenCard} onRename={onRenameCard} />
          ))}
        </SortableContext>

        {composerOpen ? (
          <div className="mb-2">
            <textarea
              ref={textareaRef}
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => { if (!draft.trim()) setComposerOpen(false) }}
              placeholder="Tytuł karty…"
              rows={2}
              style={{
                width: '100%', fontSize: 16, padding: '8px 10px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)',
                resize: 'none', outline: 'none',
              }}
            />
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={submitDraft}
                className="px-3 rounded-[var(--radius-control)] text-sm font-medium text-white"
                style={{ background: 'var(--c-action)', minHeight: 36 }}
              >
                Dodaj
              </button>
              <button
                onClick={() => { setComposerOpen(false); setDraft('') }}
                className="px-2 text-sm"
                style={{ color: 'var(--muted)' }}
              >
                Anuluj
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setComposerOpen(true)}
            className="flex items-center gap-1.5 w-full px-2 py-2 rounded-[10px] text-sm mb-2 transition-colors"
            style={{ color: 'var(--text-2)', minHeight: 40 }}
          >
            <Plus size={15} /> Dodaj kartę
          </button>
        )}
      </div>
    </div>
  )
}
