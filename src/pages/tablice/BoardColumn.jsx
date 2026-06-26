import { useState, useRef, useImperativeHandle, forwardRef, memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, MoreHorizontal, Archive, Palette, ChevronsLeftRight, ChevronRight, FileText, X } from 'lucide-react'
import BoardCard from './BoardCard'
import { LISTA_HEADER_COLORS } from './tablicaTokens'

function BoardColumn({ column, cards, onOpenCard, onAddCard, onArchiveList, onRenameList, onRenameCard, onChangeListColor, isDropTarget, removingCardIds, searchQuery }, ref) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(column.nazwa)
  const [collapsed, setCollapsed] = useState(false)
  const textareaRef = useRef(null)

  useImperativeHandle(ref, () => ({
    openComposer: () => { setCollapsed(false); setComposerOpen(true) },
  }))

  const visibleCount = searchQuery
    ? cards.filter(c => c.tytul?.toLowerCase().includes(searchQuery)).length
    : cards.length

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

  function autoGrow(el) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  function submitDraft() {
    const text = draft.trim()
    if (text) onAddCard(column.id, text)
    setDraft('')
    requestAnimationFrame(() => autoGrow(textareaRef.current))
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

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="board-column-collapsed flex-shrink-0 flex flex-col items-center rounded-[12px] cursor-pointer"
        onClick={() => setCollapsed(false)}
        title={`Rozwiń „${column.nazwa}"`}
      >
        <button
          onClick={e => { e.stopPropagation(); setCollapsed(false) }}
          className="p-1 mt-2 rounded"
          style={{ color: '#A9BBC9' }}
        >
          <ChevronRight size={15} />
        </button>
        <span
          className="text-[13px] font-semibold mt-2"
          style={{ color: '#F4F8FB', writingMode: 'vertical-rl', fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {column.nazwa}
        </span>
        <span
          className="text-[11px] font-medium rounded-full px-1.5 mb-3 mt-auto"
          style={{ background: 'rgba(255,255,255,0.18)', color: '#F4F8FB' }}
        >
          {cards.length}
        </span>
      </div>
    )
  }

  const accent = column.kolor || null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`board-column${isDropTarget ? ' board-column-droptarget' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex flex-col cursor-grab flex-shrink-0"
        style={{
          padding: '10px 10px 8px',
          borderRadius: '12px 12px 0 0',
          background: accent || 'transparent',
          touchAction: 'none',
        }}
      >
        <div className="flex items-center gap-1.5">
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameDraft(column.nazwa); setEditingName(false) } }}
              onPointerDown={e => e.stopPropagation()}
              style={{
                background: 'rgba(0,0,0,0.30)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6,
                padding: '2px 6px', fontSize: 14, fontWeight: 600, color: '#F4F8FB', width: '100%',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            />
          ) : (
            <span
              onClick={() => setEditingName(true)}
              className="flex-1 truncate"
              style={{
                fontSize: 14, fontWeight: 600, color: '#F4F8FB',
                fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.3, wordBreak: 'break-word',
              }}
            >
              {column.nazwa}
            </span>
          )}
          <span
            className="flex-shrink-0"
            style={{
              fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.18)', color: '#F4F8FB',
              borderRadius: 999, padding: '1px 7px', fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {searchQuery ? `${visibleCount}/${cards.length}` : cards.length}
          </span>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => setCollapsed(true)}
            title="Zwiń listę"
            className="flex items-center justify-center flex-shrink-0 rounded-md"
            style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.55)' }}
          >
            <ChevronsLeftRight size={13} />
          </button>
          <div className="relative flex-shrink-0">
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center justify-center rounded-md"
              style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.55)' }}
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-8 z-10 rounded-lg py-1 text-sm"
                style={{ background: 'rgba(10,20,36,0.97)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 32px rgba(0,0,0,0.50)', minWidth: 190, backdropFilter: 'blur(20px)' }}
                onMouseLeave={() => { setMenuOpen(false); setColorPickerOpen(false) }}
              >
                {colorPickerOpen ? (
                  <div className="px-3 py-2">
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        type="button"
                        title="Brak"
                        onClick={() => { onChangeListColor(column.id, null); setMenuOpen(false); setColorPickerOpen(false) }}
                        className="rounded-full flex items-center justify-center"
                        style={{
                          width: 22, height: 22, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)',
                          outline: !column.kolor ? '2px solid #F4F8FB' : 'none', outlineOffset: 2,
                        }}
                      >
                        <X size={11} style={{ color: '#A9BBC9' }} />
                      </button>
                      {LISTA_HEADER_COLORS.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          title={c.label}
                          onClick={() => { onChangeListColor(column.id, c.value); setMenuOpen(false); setColorPickerOpen(false) }}
                          className="rounded-full"
                          style={{
                            width: 22, height: 22, background: c.value,
                            outline: column.kolor === c.value ? '2px solid #F4F8FB' : 'none',
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
                      className="board-menu-item"
                      style={{ minHeight: 36, fontSize: 13.5 }}
                    >
                      <Palette size={14} style={{ color: '#A9BBC9' }} /> Zmień kolor listy
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); onArchiveList(column.id) }}
                      className="board-menu-item"
                      style={{ minHeight: 36, fontSize: 13.5 }}
                    >
                      <Archive size={14} style={{ color: '#A9BBC9' }} /> Archiwizuj listę
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        ref={setBodyRef}
        className="board-column-body flex-1 overflow-y-auto"
        style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <BoardCard
              key={card.id}
              card={card}
              onOpen={onOpenCard}
              onRename={onRenameCard}
              removing={removingCardIds?.has(card.id)}
              hidden={!!searchQuery && !card.tytul?.toLowerCase().includes(searchQuery)}
            />
          ))}
        </SortableContext>

        {composerOpen && (
          <div>
            <textarea
              ref={textareaRef}
              autoFocus
              value={draft}
              onChange={e => { setDraft(e.target.value); autoGrow(e.target) }}
              onKeyDown={handleKeyDown}
              onBlur={() => { if (!draft.trim()) setComposerOpen(false) }}
              placeholder="Tytuł karty…"
              rows={1}
              style={{
                width: '100%', fontSize: 16, padding: '8px 10px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.30)', color: '#F4F8FB',
                resize: 'none', outline: 'none', overflow: 'hidden', minHeight: 38,
              }}
            />
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={submitDraft}
                className="px-3 rounded-lg text-sm font-medium text-white"
                style={{ background: '#37A0C9', minHeight: 36 }}
              >
                Dodaj kartę
              </button>
              <button
                onClick={() => { setComposerOpen(false); setDraft('') }}
                className="p-1.5 rounded"
                title="Zamknij"
                style={{ color: '#A9BBC9' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {!composerOpen && (
        <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '6px 8px 8px' }}>
          <button
            onClick={() => setComposerOpen(true)}
            className="flex items-center gap-1.5 flex-1 text-left rounded-lg"
            style={{ height: 36, padding: '0 6px', color: 'rgba(255,255,255,0.50)', fontSize: 13, fontFamily: "'Inter', sans-serif" }}
          >
            <Plus size={14} /><span>Dodaj kartę</span>
          </button>
          <button
            title="Szablony kart (wkrótce)"
            className="flex items-center justify-center rounded-md flex-shrink-0"
            style={{ width: 32, height: 32, color: 'rgba(255,255,255,0.40)' }}
          >
            <FileText size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

export default memo(forwardRef(BoardColumn))
