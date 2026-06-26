import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  DndContext, closestCorners, DragOverlay,
  MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, horizontalListSortingStrategy,
  sortableKeyboardCoordinates, arrayMove,
} from '@dnd-kit/sortable'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import {
  ArrowLeft, Plus, MoreHorizontal, Zap, Search, X, LayoutGrid,
  ChevronDown, Star, PlugZap, Filter, Share2, Camera,
} from 'lucide-react'
import EmptyState from '../../components/ui/EmptyState'
import BottomSheet from '../../components/ui/BottomSheet'
import BoardColumn from './BoardColumn'
import BoardMenu from './BoardMenu'
import BottomNav from './BottomNav'
import CardDetailModal from './CardDetailModal'
import AutomationModal from './AutomationModal'
import BoardBackgroundPicker from './BoardBackgroundPicker'
import OfflineBanner from './OfflineBanner'
import { capturePhoto, flushPendingPhotos } from './photoUpload'
import { positionBetween, prefersReducedMotion, getBoardBackgroundStyle } from './tablicaTokens'

function initialsFromProfile(profile, user) {
  if (profile?.first_name || profile?.last_name) {
    return `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase() || 'U'
  }
  if (profile?.display_name) return profile.display_name.slice(0, 2).toUpperCase()
  return (user?.email || 'U').slice(0, 2).toUpperCase()
}

function findContainer(id, cardsByList) {
  if (typeof id === 'string' && id.startsWith('colbody:')) return id.slice(8)
  if (Object.prototype.hasOwnProperty.call(cardsByList, id)) return id
  for (const [listaId, arr] of Object.entries(cardsByList)) {
    if (arr.some(c => c.id === id)) return listaId
  }
  return null
}

function BoardSkeleton() {
  return (
    <div className="flex flex-col" style={{ height: '100svh', background: '#0A1A2F', padding: '12px 16px' }}>
      <div className="rounded-lg mb-3 flex-shrink-0" style={{ height: 56, background: 'rgba(255,255,255,0.08)' }} />
      <div className="flex gap-3 flex-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex-shrink-0 flex flex-col rounded-[12px] p-2.5" style={{ width: 272, background: 'rgba(255,255,255,0.06)' }}>
            <div className="skeleton-shimmer rounded mb-3" style={{ height: 16, width: '60%' }} />
            {[0, 1, 2].map(j => (
              <div key={j} className="skeleton-shimmer rounded-[8px] mb-2" style={{ height: 58 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TablicaBoard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { workspaceId, wsQuery, addWsFilter, wsData } = useWorkspace()
  const { user, profile } = useAuth()

  const [board, setBoard] = useState(null)
  const [lists, setLists] = useState([])
  const [cardsByList, setCardsByList] = useState({})
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)

  const [activeId, setActiveId] = useState(null)
  const [activeType, setActiveType] = useState(null)
  const [openCard, setOpenCard] = useState(null)
  const [dragOverList, setDragOverList] = useState(null)
  const [removingCardIds, setRemovingCardIds] = useState(() => new Set())

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [boardMenuOpen, setBoardMenuOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [bgPickerOpen, setBgPickerOpen] = useState(false)

  const [addingList, setAddingList] = useState(false)
  const [listDraft, setListDraft] = useState('')
  const [automationOpen, setAutomationOpen] = useState(false)

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const searchQuery = searchInput.trim().toLowerCase()

  const [cardPhotos, setCardPhotos] = useState({})
  const [fabMenuOpen, setFabMenuOpen] = useState(false)
  const fabPhotoInputRef = useRef(null)

  const [activeColumnIndex, setActiveColumnIndex] = useState(0)
  const scrollRef = useRef(null)
  const columnRefs = useRef({})

  const [pulsingCardIds, setPulsingCardIds] = useState(() => new Set())
  const recentLocalEditsRef = useRef(new Map())
  const realtimeQueueRef = useRef([])
  const realtimeTimerRef = useRef(null)

  const listsRef = useRef(lists)
  const cardsByListRef = useRef(cardsByList)
  useEffect(() => { listsRef.current = lists }, [lists])
  useEffect(() => { cardsByListRef.current = cardsByList }, [cardsByList])

  function markLocalEdit(cardId) {
    recentLocalEditsRef.current.set(cardId, Date.now())
  }

  function pulseCards(ids) {
    if (!ids.length) return
    setPulsingCardIds(prev => { const s = new Set(prev); ids.forEach(id => s.add(id)); return s })
    setTimeout(() => {
      setPulsingCardIds(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s })
    }, 650)
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const fetchData = useCallback(async () => {
    const [{ data: b, error: be }, { data: l }, { data: k }, { data: allBoards }, { data: photos }] = await Promise.all([
      addWsFilter(wsQuery('tablice').select('*')).eq('id', id).maybeSingle(),
      addWsFilter(wsQuery('listy').select('*')).eq('tablica_id', id).eq('archiwum', false).order('pozycja'),
      addWsFilter(wsQuery('karty').select('*')).eq('tablica_id', id).eq('archiwum', false).order('pozycja'),
      addWsFilter(wsQuery('tablice').select('id,nazwa,kolor_tla,tlo_typ')).eq('archiwum', false).order('pozycja'),
      addWsFilter(wsQuery('karta_zdjecia').select('karta_id,url,created_at')).eq('tablica_id', id).order('created_at', { ascending: false }),
    ])
    if (be) addToast(be.message, 'error')
    setBoard(b || null)
    setLists(l || [])
    setBoards(allBoards || [])
    const grouped = {}
    for (const list of l || []) grouped[list.id] = []
    for (const c of k || []) { (grouped[c.lista_id] ??= []).push(c) }
    setCardsByList(grouped)
    const photoMap = {}
    for (const p of photos || []) {
      const entry = photoMap[p.karta_id] || { count: 0, latestUrl: p.url }
      entry.count += 1
      photoMap[p.karta_id] = entry
    }
    setCardPhotos(photoMap)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (board) setTitleDraft(board.nazwa) }, [board])

  // ── Realtime: synchronizacja kart/list między wszystkimi otwartymi sesjami tablicy ──
  function applyRealtimeBatch(events) {
    const listaEvents = events.filter(e => e.type === 'lista')
    const kartaEvents = events.filter(e => e.type === 'karta')

    if (listaEvents.length) {
      setLists(prev => {
        let next = [...prev]
        for (const { payload } of listaEvents) {
          const { eventType, new: newRow, old: oldRow } = payload
          if (eventType === 'DELETE') {
            next = next.filter(l => l.id !== oldRow.id)
            continue
          }
          if (newRow.archiwum) { next = next.filter(l => l.id !== newRow.id); continue }
          const idx = next.findIndex(l => l.id === newRow.id)
          if (idx === -1) next = [...next, newRow]
          else next[idx] = { ...next[idx], ...newRow }
        }
        return next.sort((a, b) => a.pozycja - b.pozycja)
      })
      setCardsByList(prev => {
        const next = { ...prev }
        for (const { payload } of listaEvents) {
          const { eventType, new: newRow, old: oldRow } = payload
          if (eventType === 'DELETE' && oldRow?.id) delete next[oldRow.id]
          else if (newRow && !(newRow.id in next)) next[newRow.id] = []
        }
        return next
      })
    }

    if (kartaEvents.length) {
      const toPulse = []
      setCardsByList(prev => {
        const next = { ...prev }
        for (const { payload } of kartaEvents) {
          const { eventType, new: newRow, old: oldRow } = payload

          if (eventType === 'DELETE') {
            const container = findContainer(oldRow.id, next)
            if (container) next[container] = next[container].filter(c => c.id !== oldRow.id)
            continue
          }

          if (newRow.archiwum) {
            const container = findContainer(newRow.id, next)
            if (container) next[container] = next[container].filter(c => c.id !== newRow.id)
            continue
          }

          const targetListaId = newRow.lista_id
          const existingContainer = findContainer(newRow.id, next)
          if (existingContainer && existingContainer !== targetListaId) {
            next[existingContainer] = next[existingContainer].filter(c => c.id !== newRow.id)
          }
          if (!next[targetListaId]) next[targetListaId] = []
          const idx = next[targetListaId].findIndex(c => c.id === newRow.id)
          if (idx === -1) {
            next[targetListaId] = [...next[targetListaId], newRow].sort((a, b) => a.pozycja - b.pozycja)
          } else {
            next[targetListaId] = next[targetListaId].map(c => (c.id === newRow.id ? { ...c, ...newRow } : c))
          }

          const lastLocal = recentLocalEditsRef.current.get(newRow.id)
          const isOwnEcho = lastLocal && Date.now() - lastLocal < 1200
          if (eventType === 'UPDATE' && !isOwnEcho) toPulse.push(newRow.id)
        }
        return next
      })
      pulseCards(toPulse)
    }
  }

  function queueRealtimeEvent(evt) {
    realtimeQueueRef.current.push(evt)
    if (realtimeTimerRef.current) return
    realtimeTimerRef.current = setTimeout(() => {
      const batch = realtimeQueueRef.current
      realtimeQueueRef.current = []
      realtimeTimerRef.current = null
      applyRealtimeBatch(batch)
    }, 150)
  }

  useEffect(() => {
    if (!id) return
    const channel = supabase.channel(`tablica-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'karty', filter: `tablica_id=eq.${id}` }, payload => {
        queueRealtimeEvent({ type: 'karta', payload })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listy', filter: `tablica_id=eq.${id}` }, payload => {
        queueRealtimeEvent({ type: 'lista', payload })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function commitTitle() {
    setEditingTitle(false)
    const t = titleDraft.trim()
    if (!t || t === board.nazwa) { setTitleDraft(board.nazwa); return }
    setBoard(prev => ({ ...prev, nazwa: t }))
    const { error } = await supabase.from('tablice').update({ nazwa: t }).eq('id', id)
    if (error) addToast(error.message, 'error')
  }

  async function changeBackground(kolorTla, tloTyp) {
    setBoard(prev => ({ ...prev, kolor_tla: kolorTla, tlo_typ: tloTyp }))
    const { error } = await supabase.from('tablice').update({ kolor_tla: kolorTla, tlo_typ: tloTyp }).eq('id', id)
    if (error) addToast(error.message, 'error')
  }

  async function toggleStar() {
    const next = !board.ulubiona
    setBoard(prev => ({ ...prev, ulubiona: next }))
    const { error } = await supabase.from('tablice').update({ ulubiona: next }).eq('id', id)
    if (error) { addToast(error.message, 'error'); setBoard(prev => ({ ...prev, ulubiona: !next })) }
  }

  function handlePlaceholder(label) {
    addToast(`${label} — wkrótce`, 'info')
  }

  const handleAddCard = useCallback(async (listaId, tytul) => {
    const items = cardsByListRef.current[listaId] || []
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
  }, [id, addToast, wsData])

  const handleRenameList = useCallback(async (listaId, nazwa) => {
    setLists(prev => prev.map(l => (l.id === listaId ? { ...l, nazwa } : l)))
    const { error } = await supabase.from('listy').update({ nazwa }).eq('id', listaId)
    if (error) addToast(error.message, 'error')
  }, [addToast])

  const handleArchiveList = useCallback(async (listaId) => {
    const snapshot = listsRef.current
    setLists(prev => prev.filter(l => l.id !== listaId))
    const { error } = await supabase.from('listy').update({ archiwum: true }).eq('id', listaId)
    if (error) { addToast(error.message, 'error'); setLists(snapshot) }
  }, [addToast])

  const handleChangeListColor = useCallback(async (listaId, kolor) => {
    setLists(prev => prev.map(l => (l.id === listaId ? { ...l, kolor } : l)))
    const { error } = await supabase.from('listy').update({ kolor }).eq('id', listaId)
    if (error) addToast(error.message, 'error')
  }, [addToast])

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

  const handleSaveCard = useCallback(async (cardId, fields) => {
    const container = findContainer(cardId, cardsByListRef.current)
    if (!container) return
    markLocalEdit(cardId)
    setCardsByList(prev => ({
      ...prev,
      [container]: prev[container].map(c => (c.id === cardId ? { ...c, ...fields } : c)),
    }))
    const { error } = await supabase.from('karty').update(fields).eq('id', cardId)
    if (error) addToast(error.message, 'error')
  }, [addToast])

  const handleRenameCard = useCallback((cardId, tytul) => {
    handleSaveCard(cardId, { tytul })
  }, [handleSaveCard])

  const handleToggleDone = useCallback((cardId, current) => {
    handleSaveCard(cardId, { zakonczona: !current })
  }, [handleSaveCard])

  const handlePhotoAdded = useCallback((cardId, row) => {
    setCardPhotos(prev => ({ ...prev, [cardId]: { count: (prev[cardId]?.count || 0) + 1, latestUrl: row.url } }))
  }, [])

  const handleFabQuickPhoto = useCallback(async (file) => {
    const targetList = listsRef.current[0]
    if (!targetList || !file) return
    const items = cardsByListRef.current[targetList.id] || []
    const lastPos = items.length ? items[items.length - 1].pozycja : null
    const newPos = positionBetween(lastPos, null)
    const tytul = `Zdjęcie ${new Date().toLocaleDateString('pl-PL')}`
    const { data, error } = await supabase
      .from('karty')
      .insert([{ tytul, lista_id: targetList.id, tablica_id: id, pozycja: newPos, ...wsData() }])
      .select()
      .single()
    if (error) { addToast(error.message, 'error'); return }
    setCardsByList(prev => ({ ...prev, [targetList.id]: [...(prev[targetList.id] || []), data] }))
    const { row, offline } = await capturePhoto({ file, workspaceId, kartaId: data.id, tablicaId: id, typ: 'aparat', userId: user?.id })
    if (offline) addToast('📷 Karta dodana, zdjęcie zapisane lokalnie — wyślę gdy wrócisz online', 'warning')
    else if (row) { handlePhotoAdded(data.id, row); addToast('📷 Zdjęcie zapisane', 'success') }
  }, [id, addToast, wsData, workspaceId, user, handlePhotoAdded])

  function handleFabPhotoCapture(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    setFabMenuOpen(false)
    if (file) handleFabQuickPhoto(file)
  }

  useEffect(() => {
    async function flush() {
      const { synced } = await flushPendingPhotos()
      if (synced > 0) {
        addToast(`📷 Wysłano ${synced} oczekujące zdjęcie(a)`, 'success')
        fetchData()
      }
    }
    flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function restoreCard(container, index, card) {
    setCardsByList(prev => {
      const arr = [...(prev[container] || [])]
      arr.splice(Math.min(index, arr.length), 0, card)
      return { ...prev, [container]: arr }
    })
  }

  function animateRemoval(cardId) {
    const ms = prefersReducedMotion() ? 0 : 180
    return new Promise(resolve => {
      setRemovingCardIds(prev => new Set(prev).add(cardId))
      setTimeout(() => {
        setRemovingCardIds(prev => { const next = new Set(prev); next.delete(cardId); return next })
        resolve()
      }, ms)
    })
  }

  const handleArchiveCard = useCallback(async (cardId) => {
    const container = findContainer(cardId, cardsByListRef.current)
    if (!container) return
    const items = cardsByListRef.current[container]
    const index = items.findIndex(c => c.id === cardId)
    const snapshot = items[index]
    await animateRemoval(cardId)
    setCardsByList(prev => ({ ...prev, [container]: prev[container].filter(c => c.id !== cardId) }))
    const { error } = await supabase.from('karty').update({ archiwum: true }).eq('id', cardId)
    if (error) { addToast(error.message, 'error'); restoreCard(container, index, snapshot); return }
    addToast('Karta zarchiwizowana', 'success', {
      duration: 5000,
      action: {
        label: 'Cofnij',
        onClick: async () => {
          restoreCard(container, index, snapshot)
          const { error: ue } = await supabase.from('karty').update({ archiwum: false }).eq('id', cardId)
          if (ue) addToast(ue.message, 'error')
        },
      },
    })
  }, [addToast])

  const handleDeleteCard = useCallback(async (cardId) => {
    const container = findContainer(cardId, cardsByListRef.current)
    if (!container) return
    const items = cardsByListRef.current[container]
    const index = items.findIndex(c => c.id === cardId)
    const snapshot = items[index]
    await animateRemoval(cardId)
    setCardsByList(prev => ({ ...prev, [container]: prev[container].filter(c => c.id !== cardId) }))
    const { error } = await supabase.from('karty').delete().eq('id', cardId)
    if (error) { addToast(error.message, 'error'); restoreCard(container, index, snapshot); return }
    addToast('Karta usunięta', 'success', {
      duration: 5000,
      action: {
        label: 'Cofnij',
        onClick: async () => {
          restoreCard(container, index, snapshot)
          const { error: ue } = await supabase.from('karty').insert([snapshot])
          if (ue) addToast(ue.message, 'error')
        },
      },
    })
  }, [addToast])

  const handleMoveCard = useCallback(async (cardId, targetListaId) => {
    const container = findContainer(cardId, cardsByListRef.current)
    if (!container || container === targetListaId) return
    const card = cardsByListRef.current[container].find(c => c.id === cardId)
    if (!card) return
    markLocalEdit(cardId)
    const targetItems = cardsByListRef.current[targetListaId] || []
    const newPos = positionBetween(targetItems.length ? targetItems[targetItems.length - 1].pozycja : null, null)
    setCardsByList(prev => ({
      ...prev,
      [container]: prev[container].filter(c => c.id !== cardId),
      [targetListaId]: [...(prev[targetListaId] || []), { ...card, lista_id: targetListaId, pozycja: newPos }],
    }))
    const { error } = await supabase.rpc('przenies_karte', { p_karta_id: cardId, p_lista_id: targetListaId, p_pozycja: newPos })
    const targetName = listsRef.current.find(l => l.id === targetListaId)?.nazwa
    if (error) addToast('Nie udało się przenieść karty', 'error')
    else addToast(targetName ? `Przeniesiono do „${targetName}"` : 'Karta przeniesiona', 'success')
  }, [addToast])

  const handleCopyCard = useCallback(async (cardId, targetListaId) => {
    const container = findContainer(cardId, cardsByListRef.current)
    if (!container) return
    const card = cardsByListRef.current[container].find(c => c.id === cardId)
    if (!card) return
    const targetItems = cardsByListRef.current[targetListaId] || []
    const newPos = positionBetween(targetItems.length ? targetItems[targetItems.length - 1].pozycja : null, null)
    const { data, error } = await supabase
      .from('karty')
      .insert([{
        tytul: card.tytul, opis: card.opis, termin: card.termin, etykiety: card.etykiety,
        przypisani: card.przypisani, zakonczona: card.zakonczona,
        tablica_id: id, lista_id: targetListaId, pozycja: newPos, ...wsData(),
      }])
      .select()
      .single()
    if (error) { addToast(error.message, 'error'); return }
    setCardsByList(prev => ({ ...prev, [targetListaId]: [...(prev[targetListaId] || []), data] }))
    const targetName = listsRef.current.find(l => l.id === targetListaId)?.nazwa
    addToast(targetName ? `Skopiowano do „${targetName}"` : 'Karta skopiowana', 'success')
  }, [id, addToast, wsData])

  function handleDragStart(event) {
    setActiveId(event.active.id)
    setActiveType(event.active.data.current?.type ?? null)
  }

  function handleDragOver(event) {
    const { active, over } = event
    if (!over || active.data.current?.type !== 'card') { setDragOverList(null); return }
    const activeContainer = findContainer(active.id, cardsByList)
    const overContainer = findContainer(over.id, cardsByList)
    setDragOverList(overContainer)
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
    setDragOverList(null)
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

      markLocalEdit(active.id)
      const snapshot = cardsByList
      const updatedItems = reorderedItems.map(c => (c.id === active.id ? { ...c, pozycja: newPos, lista_id: container } : c))
      setCardsByList(prev => ({ ...prev, [container]: updatedItems }))

      const { error } = await supabase.rpc('przenies_karte', {
        p_karta_id: active.id, p_lista_id: container, p_pozycja: newPos,
      })
      if (error) { setCardsByList(snapshot); addToast('Nie udało się przenieść karty', 'error') }
    }
  }

  function handleBoardScroll() {
    const el = scrollRef.current
    if (!el || lists.length === 0) return
    const colWidth = el.clientWidth * 0.85 + 12
    const idx = Math.round(el.scrollLeft / colWidth)
    setActiveColumnIndex(Math.min(Math.max(idx, 0), lists.length - 1))
  }

  function handleFabAddCard() {
    setFabMenuOpen(false)
    const list = lists[activeColumnIndex] || lists[0]
    if (list) columnRefs.current[list.id]?.openComposer()
  }

  function handleFabAddList() {
    setFabMenuOpen(false)
    setAddingList(true)
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' }))
  }

  if (loading) return <BoardSkeleton />
  if (!board) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{ height: '100svh', background: '#0A1A2F', color: '#A9BBC9', fontFamily: "'Inter', sans-serif" }}
      >
        Tablica nie znaleziona. <Link to="/tablice" style={{ color: '#37A0C9', marginLeft: 4 }}>Wróć do listy tablic</Link>
      </div>
    )
  }

  const activeCard = activeType === 'card'
    ? Object.values(cardsByList).flat().find(c => c.id === activeId)
    : null
  const activeList = activeType === 'list' ? lists.find(l => l.id === activeId) : null

  return (
    <div className="board-interior" style={getBoardBackgroundStyle(board.kolor_tla, board.tlo_typ)}>
      <OfflineBanner />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.08)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <header className="board-header-interior">
          <button onClick={() => navigate('/tablice')} className="board-header-btn" title="Wróć do tablic" style={{ width: 36, padding: 0, justifyContent: 'center' }}>
            <ArrowLeft size={16} />
          </button>

          <div className="flex items-center gap-1" style={{ minWidth: 0 }}>
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(board.nazwa); setEditingTitle(false) } }}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
                  padding: '4px 10px', fontSize: 16, fontWeight: 700, color: '#fff',
                  fontFamily: "'Space Grotesk', sans-serif", maxWidth: 280,
                }}
              />
            ) : (
              <span
                onClick={() => setEditingTitle(true)}
                className="truncate cursor-text"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: '#F4F8FB',
                  whiteSpace: 'nowrap', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {board.nazwa}
              </span>
            )}
            <button onClick={() => setSwitcherOpen(true)} title="Przełącz tablicę" className="flex items-center justify-center rounded-md flex-shrink-0" style={{ width: 26, height: 26 }}>
              <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.55)' }} />
            </button>
            <button onClick={toggleStar} title={board.ulubiona ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'} className="flex items-center justify-center rounded-md flex-shrink-0" style={{ width: 30, height: 30 }}>
              <Star size={16} fill={board.ulubiona ? '#F5A524' : 'none'} stroke={board.ulubiona ? '#F5A524' : 'rgba(255,255,255,0.60)'} />
            </button>
          </div>

          <div style={{ flex: 1 }} />

          <div className="flex items-center gap-1.5">
            <button onClick={() => handlePlaceholder('Power-Upy')} className="board-header-btn board-header-action">
              <PlugZap size={14} /><span className="hidden lg:inline">Power-Ups</span>
            </button>
            <button onClick={() => setAutomationOpen(true)} className="board-header-btn board-header-action">
              <Zap size={14} /><span className="hidden lg:inline">Automatyzacja</span>
            </button>
            <button onClick={() => setSearchOpen(o => !o)} className="board-header-btn board-header-action" title="Filtruj karty">
              <Filter size={14} /><span className="hidden lg:inline">Filtruj</span>
            </button>
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 32, height: 32, borderRadius: '50%', background: '#37A0C9',
                fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, color: 'white',
                border: '1px solid rgba(255,255,255,0.16)',
              }}
              title={profile?.display_name || user?.email}
            >
              {initialsFromProfile(profile, user)}
            </div>
            <button onClick={() => handlePlaceholder('Udostępnij')} className="board-header-btn board-header-action">
              <Share2 size={14} /><span className="hidden lg:inline">Udostępnij</span>
            </button>
            <button onClick={() => setBoardMenuOpen(true)} className="board-header-btn" title="Menu tablicy" style={{ width: 36, padding: 0, justifyContent: 'center' }}>
              <MoreHorizontal size={16} />
            </button>
          </div>
        </header>

        {searchOpen && (
          <div className="flex items-center gap-2 flex-shrink-0" style={{ padding: '10px 16px 0' }}>
            <div className="relative flex-1" style={{ maxWidth: 360 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#A9BBC9' }} />
              <input
                autoFocus
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Szukaj kart po tytule…"
                style={{
                  width: '100%', fontSize: 16, padding: '8px 10px 8px 30px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.30)', color: '#F4F8FB', outline: 'none',
                }}
              />
            </div>
            <button
              onClick={() => { setSearchOpen(false); setSearchInput('') }}
              className="p-1.5 rounded-lg flex-shrink-0"
              style={{ color: '#A9BBC9' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {lists.length > 1 && (
          <div className="board-dots flex-shrink-0">
            {lists.map((l, i) => (
              <span
                key={l.id}
                className="board-dot"
                style={{ background: i === activeColumnIndex ? '#37A0C9' : 'rgba(255,255,255,0.25)' }}
              />
            ))}
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div ref={scrollRef} onScroll={handleBoardScroll} className="board-scroll">
            {lists.length === 0 && !addingList && (
              <EmptyState
                icon={LayoutGrid}
                title="Brak list"
                description="Dodaj pierwszą listę, by zacząć organizować karty."
                className="flex-1"
              />
            )}

            <SortableContext items={lists.map(l => l.id)} strategy={horizontalListSortingStrategy}>
              {lists.map(list => (
                <BoardColumn
                  key={list.id}
                  ref={el => { columnRefs.current[list.id] = el }}
                  column={list}
                  cards={cardsByList[list.id] || []}
                  onOpenCard={setOpenCard}
                  onAddCard={handleAddCard}
                  onArchiveList={handleArchiveList}
                  onRenameList={handleRenameList}
                  onRenameCard={handleRenameCard}
                  onChangeListColor={handleChangeListColor}
                  onToggleDone={handleToggleDone}
                  onPhotoAdded={handlePhotoAdded}
                  cardPhotos={cardPhotos}
                  isDropTarget={dragOverList === list.id}
                  removingCardIds={removingCardIds}
                  pulsingCardIds={pulsingCardIds}
                  searchQuery={searchQuery}
                />
              ))}
            </SortableContext>

            <div className="flex-shrink-0" style={{ width: 272 }}>
              {addingList ? (
                <form onSubmit={handleAddList} className="rounded-[12px] p-2.5" style={{ background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(8px)' }}>
                  <input
                    autoFocus
                    value={listDraft}
                    onChange={e => setListDraft(e.target.value)}
                    onBlur={() => { if (!listDraft.trim()) setAddingList(false) }}
                    onKeyDown={e => { if (e.key === 'Escape') { setAddingList(false); setListDraft('') } }}
                    placeholder="Nazwa listy…"
                    style={{
                      width: '100%', fontSize: 16, padding: '8px 10px', borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.30)', color: '#F4F8FB', outline: 'none',
                    }}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button type="submit" className="px-3 rounded-lg text-sm font-medium text-white" style={{ background: '#37A0C9', minHeight: 36 }}>
                      Dodaj listę
                    </button>
                    <button type="button" onClick={() => { setAddingList(false); setListDraft('') }} className="px-2 text-sm" style={{ color: '#A9BBC9' }}>
                      Anuluj
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setAddingList(true)}
                  className="flex items-center gap-2"
                  style={{
                    width: 272, height: 44, padding: '0 14px', background: 'rgba(255,255,255,0.14)',
                    border: '1px dashed rgba(255,255,255,0.25)', borderRadius: 12, cursor: 'pointer',
                    color: 'rgba(255,255,255,0.70)', fontSize: 14, fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <Plus size={16} /><span>Dodaj listę</span>
                </button>
              )}
            </div>
          </div>

          <DragOverlay>
            {activeCard && (
              <div className="board-card board-card-overlay rounded-[8px] p-2.5" style={{ width: 248 }}>
                <p style={{ fontSize: 14, lineHeight: 1.45, color: '#F4F8FB', fontFamily: "'Inter', sans-serif" }}>{activeCard.tytul}</p>
              </div>
            )}
            {activeList && (
              <div
                className="board-card-overlay"
                style={{ width: 272, borderRadius: 12, padding: '10px 10px 8px', background: activeList.kolor || 'rgba(0,0,0,0.30)' }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: '#F4F8FB', fontFamily: "'Space Grotesk', sans-serif" }}>{activeList.nazwa}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {lists.length > 0 && (
          <button
            onClick={() => setFabMenuOpen(true)}
            className="board-fab-add"
            aria-label="Szybka akcja"
          >
            <Plus size={22} />
          </button>
        )}

        <input
          ref={fabPhotoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFabPhotoCapture}
        />

        <BottomNav
          active="board"
          onInbox={() => handlePlaceholder('Skrzynka odbiorcza')}
          onPlanner={() => navigate('/tablice/moj-dzien')}
          onSwitch={() => setSwitcherOpen(true)}
        />
      </div>

      {openCard && (
        <CardDetailModal
          card={openCard}
          lists={lists}
          onClose={() => setOpenCard(null)}
          onSave={handleSaveCard}
          onArchive={handleArchiveCard}
          onDelete={handleDeleteCard}
          onMove={handleMoveCard}
          onCopy={handleCopyCard}
        />
      )}

      {automationOpen && (
        <AutomationModal
          tablicaId={id}
          lists={lists}
          onClose={() => setAutomationOpen(false)}
        />
      )}

      {boardMenuOpen && (
        <BoardMenu
          onClose={() => setBoardMenuOpen(false)}
          onAutomation={() => { setBoardMenuOpen(false); setAutomationOpen(true) }}
          onChangeBackground={() => { setBoardMenuOpen(false); setBgPickerOpen(true) }}
          onFilter={() => { setBoardMenuOpen(false); setSearchOpen(o => !o) }}
          onPlaceholder={label => { setBoardMenuOpen(false); handlePlaceholder(label) }}
        />
      )}

      <BottomSheet open={fabMenuOpen} onClose={() => setFabMenuOpen(false)} title="Szybka akcja">
        <div className="flex flex-col gap-2">
          <button onClick={() => fabPhotoInputRef.current?.click()} className="fab-menu-item">
            <Camera size={17} style={{ color: '#37A0C9' }} /> Szybkie zdjęcie
          </button>
          <button onClick={handleFabAddCard} className="fab-menu-item">
            <Plus size={17} style={{ color: '#A9BBC9' }} /> Dodaj kartę
          </button>
          <button onClick={handleFabAddList} className="fab-menu-item">
            <Plus size={17} style={{ color: '#A9BBC9' }} /> Dodaj listę
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} title="Przełącz tablicę">
        <div className="flex flex-col gap-1">
          {boards.map(b => (
            <button
              key={b.id}
              onClick={() => { setSwitcherOpen(false); if (b.id !== id) navigate(`/tablice/${b.id}`) }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left"
              style={{ background: b.id === id ? 'var(--hover-bg)' : 'transparent', minHeight: 44 }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, ...getBoardBackgroundStyle(b.kolor_tla, b.tlo_typ) }} />
              <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text)' }}>{b.nazwa}</span>
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={bgPickerOpen} onClose={() => setBgPickerOpen(false)} title="Zmień tło">
        <BoardBackgroundPicker
          kolorTla={board.kolor_tla}
          tloTyp={board.tlo_typ}
          onChange={changeBackground}
        />
      </BottomSheet>
    </div>
  )
}
