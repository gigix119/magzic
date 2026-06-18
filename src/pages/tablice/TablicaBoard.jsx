import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  DndContext, closestCorners, DragOverlay,
  PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, horizontalListSortingStrategy,
  sortableKeyboardCoordinates, arrayMove,
} from '@dnd-kit/sortable'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { ArrowLeft, Plus, MoreHorizontal } from 'lucide-react'
import Spinner from '../../components/Spinner'
import BoardColumn from './BoardColumn'
import CardDetailModal from './CardDetailModal'
import { TABLICA_COLORS, positionBetween } from './tablicaTokens'

function findContainer(id, cardsByList) {
  if (typeof id === 'string' && id.startsWith('colbody:')) return id.slice(8)
  if (Object.prototype.hasOwnProperty.call(cardsByList, id)) return id
  for (const [listaId, arr] of Object.entries(cardsByList)) {
    if (arr.some(c => c.id === id)) return listaId
  }
  return null
}

export default function TablicaBoard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { wsQuery, addWsFilter, wsData } = useWorkspace()

  const [board, setBoard] = useState(null)
  const [lists, setLists] = useState([])
  const [cardsByList, setCardsByList] = useState({})
  const [loading, setLoading] = useState(true)

  const [activeId, setActiveId] = useState(null)
  const [activeType, setActiveType] = useState(null)
  const [openCard, setOpenCard] = useState(null)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [boardMenuOpen, setBoardMenuOpen] = useState(false)

  const [addingList, setAddingList] = useState(false)
  const [listDraft, setListDraft] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const fetchData = useCallback(async () => {
    const [{ data: b, error: be }, { data: l }, { data: k }] = await Promise.all([
      addWsFilter(wsQuery('tablice').select('*')).eq('id', id).maybeSingle(),
      addWsFilter(wsQuery('listy').select('*')).eq('tablica_id', id).eq('archiwum', false).order('pozycja'),
      addWsFilter(wsQuery('karty').select('*')).eq('tablica_id', id).eq('archiwum', false).order('pozycja'),
    ])
    if (be) addToast(be.message, 'error')
    setBoard(b || null)
    setLists(l || [])
    const grouped = {}
    for (const list of l || []) grouped[list.id] = []
    for (const c of k || []) { (grouped[c.lista_id] ??= []).push(c) }
    setCardsByList(grouped)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (board) setTitleDraft(board.nazwa) }, [board])

  async function commitTitle() {
    setEditingTitle(false)
    const t = titleDraft.trim()
    if (!t || t === board.nazwa) { setTitleDraft(board.nazwa); return }
    setBoard(prev => ({ ...prev, nazwa: t }))
    const { error } = await supabase.from('tablice').update({ nazwa: t }).eq('id', id)
    if (error) addToast(error.message, 'error')
  }

  async function changeColor(color) {
    setBoard(prev => ({ ...prev, kolor_tla: color }))
    setBoardMenuOpen(false)
    const { error } = await supabase.from('tablice').update({ kolor_tla: color }).eq('id', id)
    if (error) addToast(error.message, 'error')
  }

  async function handleAddCard(listaId, tytul) {
    const items = cardsByList[listaId] || []
    const lastPos = items.length ? items[items.length - 1].pozycja : null
    const newPos = positionBetween(lastPos, null)
    const tempId = `temp-${Date.now()}`
    const optimisticCard = {
      id: tempId, lista_id: listaId, tablica_id: id, tytul, pozycja: newPos,
      etykiety: [], przypisani: [], zakonczona: false, termin: null, opis: null,
    }
    setCardsByList(prev => ({ ...prev, [listaId]: [...(prev[listaId] || []), optimisticCard] }))
    const { data, error } = await supabase
      .from('karty')
      .insert([{ tytul, lista_id: listaId, tablica_id: id, pozycja: newPos, ...wsData() }])
      .select()
      .single()
    if (error) {
      addToast(error.message, 'error')
      setCardsByList(prev => ({ ...prev, [listaId]: prev[listaId].filter(c => c.id !== tempId) }))
    } else {
      setCardsByList(prev => ({ ...prev, [listaId]: prev[listaId].map(c => (c.id === tempId ? data : c)) }))
    }
  }

  async function handleRenameList(listaId, nazwa) {
    setLists(prev => prev.map(l => (l.id === listaId ? { ...l, nazwa } : l)))
    const { error } = await supabase.from('listy').update({ nazwa }).eq('id', listaId)
    if (error) addToast(error.message, 'error')
  }

  async function handleArchiveList(listaId) {
    const snapshot = lists
    setLists(prev => prev.filter(l => l.id !== listaId))
    const { error } = await supabase.from('listy').update({ archiwum: true }).eq('id', listaId)
    if (error) { addToast(error.message, 'error'); setLists(snapshot) }
  }

  async function handleAddList(e) {
    e.preventDefault()
    const nazwa = listDraft.trim()
    if (!nazwa) return
    const lastPos = lists.length ? lists[lists.length - 1].pozycja : null
    const newPos = positionBetween(lastPos, null)
    const { data, error } = await supabase
      .from('listy')
      .insert([{ nazwa, tablica_id: id, pozycja: newPos, ...wsData() }])
      .select()
      .single()
    if (error) { addToast(error.message, 'error'); return }
    setLists(prev => [...prev, data])
    setCardsByList(prev => ({ ...prev, [data.id]: [] }))
    setListDraft('')
    setAddingList(false)
  }

  async function handleSaveCard(cardId, fields) {
    const container = findContainer(cardId, cardsByList)
    if (!container) return
    setCardsByList(prev => ({
      ...prev,
      [container]: prev[container].map(c => (c.id === cardId ? { ...c, ...fields } : c)),
    }))
    const { error } = await supabase.from('karty').update(fields).eq('id', cardId)
    if (error) addToast(error.message, 'error')
  }

  async function handleArchiveCard(cardId) {
    const container = findContainer(cardId, cardsByList)
    if (!container) return
    setCardsByList(prev => ({ ...prev, [container]: prev[container].filter(c => c.id !== cardId) }))
    const { error } = await supabase.from('karty').update({ archiwum: true }).eq('id', cardId)
    if (error) addToast(error.message, 'error')
  }

  async function handleDeleteCard(cardId) {
    const container = findContainer(cardId, cardsByList)
    if (!container) return
    setCardsByList(prev => ({ ...prev, [container]: prev[container].filter(c => c.id !== cardId) }))
    const { error } = await supabase.from('karty').delete().eq('id', cardId)
    if (error) addToast(error.message, 'error')
  }

  function handleRenameCard(cardId, tytul) {
    handleSaveCard(cardId, { tytul })
  }

  async function handleChangeListColor(listaId, kolor) {
    setLists(prev => prev.map(l => (l.id === listaId ? { ...l, kolor } : l)))
    const { error } = await supabase.from('listy').update({ kolor }).eq('id', listaId)
    if (error) addToast(error.message, 'error')
  }

  function handleDragStart(event) {
    setActiveId(event.active.id)
    setActiveType(event.active.data.current?.type ?? null)
  }

  function handleDragOver(event) {
    const { active, over } = event
    if (!over || active.data.current?.type !== 'card') return
    const activeContainer = findContainer(active.id, cardsByList)
    const overContainer = findContainer(over.id, cardsByList)
    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    setCardsByList(prev => {
      const activeItems = prev[activeContainer]
      const overItems = prev[overContainer]
      const activeIndex = activeItems.findIndex(c => c.id === active.id)
      if (activeIndex === -1) return prev
      const movingCard = { ...activeItems[activeIndex], lista_id: overContainer }
      const newActiveItems = activeItems.filter(c => c.id !== active.id)
      let overIndex = overItems.findIndex(c => c.id === over.id)
      if (overIndex === -1) overIndex = overItems.length
      const newOverItems = [...overItems]
      newOverItems.splice(overIndex, 0, movingCard)
      return { ...prev, [activeContainer]: newActiveItems, [overContainer]: newOverItems }
    })
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    setActiveType(null)
    if (!over) return
    const type = active.data.current?.type

    if (type === 'list') {
      if (active.id === over.id) return
      const oldIndex = lists.findIndex(l => l.id === active.id)
      const newIndex = lists.findIndex(l => l.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      const reordered = arrayMove(lists, oldIndex, newIndex)
      const finalIndex = reordered.findIndex(l => l.id === active.id)
      const prevList = reordered[finalIndex - 1]
      const nextList = reordered[finalIndex + 1]
      const newPos = positionBetween(prevList?.pozycja ?? null, nextList?.pozycja ?? null)
      const snapshot = lists
      setLists(reordered.map(l => (l.id === active.id ? { ...l, pozycja: newPos } : l)))
      const { error } = await supabase.rpc('przenies_liste', { p_lista_id: active.id, p_pozycja: newPos })
      if (error) { setLists(snapshot); addToast('Nie udało się zmienić kolejności listy', 'error') }
      return
    }

    if (type === 'card') {
      const container = findContainer(over.id, cardsByList)
      if (!container) return
      const itemsInContainer = cardsByList[container]
      const activeIndex = itemsInContainer.findIndex(c => c.id === active.id)
      if (activeIndex === -1) return
      let overIndex = itemsInContainer.findIndex(c => c.id === over.id)
      if (overIndex === -1) overIndex = itemsInContainer.length - 1

      const reorderedItems = activeIndex === overIndex
        ? itemsInContainer
        : arrayMove(itemsInContainer, activeIndex, overIndex)

      const finalIndex = reorderedItems.findIndex(c => c.id === active.id)
      const prevCard = reorderedItems[finalIndex - 1]
      const nextCard = reorderedItems[finalIndex + 1]
      const newPos = positionBetween(prevCard?.pozycja ?? null, nextCard?.pozycja ?? null)

      const snapshot = cardsByList
      const updatedItems = reorderedItems.map(c => (c.id === active.id ? { ...c, pozycja: newPos, lista_id: container } : c))
      setCardsByList(prev => ({ ...prev, [container]: updatedItems }))

      const { error } = await supabase.rpc('przenies_karte', {
        p_karta_id: active.id, p_lista_id: container, p_pozycja: newPos,
      })
      if (error) { setCardsByList(snapshot); addToast('Nie udało się przenieść karty', 'error') }
    }
  }

  if (loading) return <Spinner />
  if (!board) {
    return (
      <div className="text-sm" style={{ color: 'var(--text-2)' }}>
        Tablica nie znaleziona. <Link to="/tablice" style={{ color: 'var(--c-action)' }}>Wróć do listy tablic</Link>
      </div>
    )
  }

  const activeCard = activeType === 'card'
    ? Object.values(cardsByList).flat().find(c => c.id === activeId)
    : null
  const activeList = activeType === 'list' ? lists.find(l => l.id === activeId) : null

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 96px)' }}>
      <div
        className="board-topbar flex items-center gap-3 px-4 py-3 rounded-[var(--radius-card)] mb-3 flex-shrink-0"
        style={{ background: `${board.kolor_tla || '#5B8DEF'}e6` }}
      >
        <button onClick={() => navigate('/tablice')} className="p-1 rounded-lg text-white opacity-90">
          <ArrowLeft size={18} />
        </button>
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(board.nazwa); setEditingTitle(false) } }}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
              padding: '4px 10px', fontSize: 16, fontWeight: 600, color: '#fff', flex: 1,
            }}
          />
        ) : (
          <h1
            onClick={() => setEditingTitle(true)}
            className="text-[16px] font-semibold flex-1 truncate cursor-text"
            style={{ color: '#fff' }}
          >
            {board.nazwa}
          </h1>
        )}
        <div className="relative">
          <button onClick={() => setBoardMenuOpen(o => !o)} className="p-1.5 rounded-lg text-white opacity-90">
            <MoreHorizontal size={18} />
          </button>
          {boardMenuOpen && (
            <div
              className="absolute right-0 top-9 z-20 rounded-lg p-3"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', minWidth: 200 }}
              onMouseLeave={() => setBoardMenuOpen(false)}
            >
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-2)' }}>Kolor tablicy</p>
              <div className="flex gap-2 flex-wrap">
                {TABLICA_COLORS.map(c => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => changeColor(c.value)}
                    className="rounded-full"
                    style={{
                      width: 26, height: 26, background: c.value,
                      outline: board.kolor_tla === c.value ? '2px solid var(--text)' : 'none',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="board-scroll flex gap-3 flex-1 pb-2">
          <SortableContext items={lists.map(l => l.id)} strategy={horizontalListSortingStrategy}>
            {lists.map(list => (
              <BoardColumn
                key={list.id}
                column={list}
                cards={cardsByList[list.id] || []}
                onOpenCard={setOpenCard}
                onAddCard={handleAddCard}
                onArchiveList={handleArchiveList}
                onRenameList={handleRenameList}
                onRenameCard={handleRenameCard}
                onChangeListColor={handleChangeListColor}
              />
            ))}
          </SortableContext>

          <div className="flex-shrink-0" style={{ width: 240 }}>
            {addingList ? (
              <form onSubmit={handleAddList} className="rounded-[var(--radius-card)] p-2.5" style={{ background: 'var(--hover-bg)' }}>
                <input
                  autoFocus
                  value={listDraft}
                  onChange={e => setListDraft(e.target.value)}
                  onBlur={() => { if (!listDraft.trim()) setAddingList(false) }}
                  onKeyDown={e => { if (e.key === 'Escape') { setAddingList(false); setListDraft('') } }}
                  placeholder="Nazwa listy…"
                  style={{
                    width: '100%', fontSize: 16, padding: '8px 10px', borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none',
                  }}
                />
                <div className="flex items-center gap-2 mt-2">
                  <button type="submit" className="px-3 rounded-[var(--radius-control)] text-sm font-medium text-white" style={{ background: 'var(--c-action)', minHeight: 36 }}>
                    Dodaj listę
                  </button>
                  <button type="button" onClick={() => { setAddingList(false); setListDraft('') }} className="px-2 text-sm" style={{ color: 'var(--muted)' }}>
                    Anuluj
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAddingList(true)}
                className="flex items-center gap-1.5 w-full px-3 py-2.5 rounded-[var(--radius-card)] text-sm font-medium"
                style={{ background: 'var(--hover-bg)', color: 'var(--text-2)', minHeight: 44 }}
              >
                <Plus size={15} /> Dodaj listę
              </button>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeCard && (
            <div className="board-card board-card-overlay rounded-[12px] p-3" style={{ width: 248 }}>
              <p className="text-[13.5px] leading-snug font-medium" style={{ color: 'var(--text)' }}>{activeCard.tytul}</p>
            </div>
          )}
          {activeList && (
            <div
              className="rounded-[var(--radius-card)] px-3 py-2.5 board-card-overlay"
              style={{ width: 272, borderTop: `3px solid ${activeList.kolor || 'var(--c-action)'}` }}
            >
              <span className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>{activeList.nazwa}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {openCard && (
        <CardDetailModal
          card={openCard}
          onClose={() => setOpenCard(null)}
          onSave={handleSaveCard}
          onArchive={handleArchiveCard}
          onDelete={handleDeleteCard}
        />
      )}
    </div>
  )
}
