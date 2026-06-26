import { useEffect, useState } from 'react'
import {
  Trash2, Archive, CheckCircle2, Circle, X, ArrowRightLeft, Copy, ChevronUp, ChevronDown,
  ListChecks, Plus, LayoutList, UserRound, Image, Paperclip, MessageSquare, History,
} from 'lucide-react'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { TABLICA_COLORS, CHECKLIST_TEMPLATES, STATUS_COLORS, STATUS_LABELS, classifyKarta, hashColor, terminStatus } from './tablicaTokens'
import CardPhotos from './CardPhotos'
import CardPhotoGallery from './CardPhotoGallery'
import CardAttachments from './CardAttachments'
import CardComments from './CardComments'
import CardActivity from './CardActivity'
import TerminPicker from './TerminPicker'

function toLocalDatetimeValue(termin) {
  if (!termin) return ''
  const d = new Date(termin)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function CardDetailModal({ card, lists, onClose, onSave, onArchive, onDelete, onMove, onCopy }) {
  const { workspaceId } = useWorkspace()
  const { user } = useAuth()

  const [tytul, setTytul] = useState(card.tytul || '')
  const [opis, setOpis] = useState(card.opis || '')
  const [termin, setTermin] = useState(toLocalDatetimeValue(card.termin))
  const [zakonczona, setZakonczona] = useState(!!card.zakonczona)
  const [etykiety, setEtykiety] = useState(Array.isArray(card.etykiety) ? card.etykiety : [])
  const [przypisaniText, setPrzypisaniText] = useState((card.przypisani || []).join(', '))
  const [przypisanyDo, setPrzypisanyDo] = useState(card.przypisany_do || null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const otherLists = (lists || []).filter(l => l.id !== card.lista_id)
  const [targetListaId, setTargetListaId] = useState(otherLists[0]?.id || '')
  const [checklista, setChecklista] = useState(Array.isArray(card.checklista) ? card.checklista : [])
  const [newItemText, setNewItemText] = useState('')
  const [editingItemId, setEditingItemId] = useState(null)
  const [confirmingRemoveId, setConfirmingRemoveId] = useState(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const doneCount = checklista.filter(it => it.done).length
  const percent = checklista.length ? Math.round((doneCount / checklista.length) * 100) : 0

  const sourceListName = (lists || []).find(l => l.id === card.lista_id)?.nazwa
  const classification = classifyKarta(tytul)
  const przypisani = przypisaniText.split(',').map(s => s.trim()).filter(Boolean)
  const overdue = terminStatus(termin ? new Date(termin).toISOString() : null, zakonczona) === 'overdue'

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function save(fields) {
    onSave(card.id, fields)
  }

  function commitTytul() {
    const t = tytul.trim()
    if (!t) { setTytul(card.tytul || ''); return }
    if (t !== card.tytul) save({ tytul: t })
  }

  function commitOpis() {
    const o = opis.trim() || null
    if (o !== (card.opis || null)) save({ opis: o })
  }

  function commitTermin(value) {
    setTermin(value)
    const iso = value ? new Date(value).toISOString() : null
    save({ termin: iso })
  }

  function commitPrzypisani() {
    const arr = przypisaniText.split(',').map(s => s.trim()).filter(Boolean)
    save({ przypisani: arr })
  }

  function toggleAssignToMe() {
    const next = przypisanyDo === user?.id ? null : (user?.id || null)
    setPrzypisanyDo(next)
    save({ przypisany_do: next })
  }

  function toggleZakonczona() {
    const next = !zakonczona
    setZakonczona(next)
    save({ zakonczona: next })
  }

  function toggleLabel(color) {
    setEtykiety(prev => {
      const exists = prev.some(e => e.color === color)
      const next = exists ? prev.filter(e => e.color !== color) : [...prev, { color, nazwa: '' }]
      save({ etykiety: next })
      return next
    })
  }

  function renameLabel(color, nazwa) {
    setEtykiety(prev => {
      const next = prev.map(e => (e.color === color ? { ...e, nazwa } : e))
      save({ etykiety: next })
      return next
    })
  }

  function saveChecklist(next) {
    const withPositions = next.map((it, i) => ({ ...it, pozycja: i }))
    setChecklista(withPositions)
    save({ checklista: withPositions })
  }

  function toggleItemDone(itemId) {
    saveChecklist(checklista.map(it => (it.id === itemId ? { ...it, done: !it.done } : it)))
  }

  function addChecklistItem(text) {
    const tekst = text.trim()
    if (!tekst) return
    saveChecklist([...checklista, { id: crypto.randomUUID(), tekst, done: false, pozycja: checklista.length }])
  }

  function handleAddItemSubmit(e) {
    e.preventDefault()
    addChecklistItem(newItemText)
    setNewItemText('')
  }

  function addTemplate(items) {
    const additions = items.map((tekst, i) => ({ id: crypto.randomUUID(), tekst, done: false, pozycja: checklista.length + i }))
    saveChecklist([...checklista, ...additions])
    setTemplatesOpen(false)
  }

  function commitItemText(itemId, text) {
    const tekst = text.trim()
    setEditingItemId(null)
    if (!tekst) return
    saveChecklist(checklista.map(it => (it.id === itemId ? { ...it, tekst } : it)))
  }

  function removeChecklistItem(itemId) {
    if (confirmingRemoveId !== itemId) { setConfirmingRemoveId(itemId); return }
    setConfirmingRemoveId(null)
    saveChecklist(checklista.filter(it => it.id !== itemId))
  }

  function moveChecklistItem(itemId, direction) {
    const index = checklista.findIndex(it => it.id === itemId)
    const target = index + direction
    if (index === -1 || target < 0 || target >= checklista.length) return
    const next = [...checklista]
    ;[next[index], next[target]] = [next[target], next[index]]
    saveChecklist(next)
  }

  function handleDeleteClick() {
    if (!confirmingDelete) { setConfirmingDelete(true); return }
    onDelete(card.id)
    onClose()
  }

  async function handleArchive() {
    await onArchive(card.id)
    onClose()
  }

  function handleMove() {
    if (!targetListaId) return
    onMove(card.id, targetListaId)
    onClose()
  }

  function handleCopy() {
    if (!targetListaId) return
    onCopy(card.id, targetListaId)
    onClose()
  }

  return (
    <div className="card-detail-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card-detail-panel">
        <div className="card-detail-grabber" />

        <div className="card-detail-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              autoFocus
              className="card-detail-input"
              style={{ fontSize: 16, fontWeight: 600, padding: '8px 10px' }}
              value={tytul}
              onChange={e => setTytul(e.target.value)}
              onBlur={commitTytul}
            />
            <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 8 }}>
              {classification && (
                <span
                  className="card-detail-chip"
                  style={{ color: STATUS_COLORS[classification], borderColor: `${STATUS_COLORS[classification]}66`, background: `${STATUS_COLORS[classification]}22` }}
                >
                  {STATUS_LABELS[classification]}
                </span>
              )}
              {przypisani.length > 0 && (
                <span className="flex items-center" style={{ marginLeft: 2 }}>
                  {przypisani.slice(0, 4).map((p, i) => (
                    <span
                      key={i}
                      title={p}
                      style={{
                        width: 22, height: 22, fontSize: 9.5, fontWeight: 600, color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '50%', background: hashColor(p),
                        border: '2px solid rgba(12,24,44,0.97)', marginLeft: i > 0 ? -7 : 0,
                      }}
                    >
                      {p.slice(0, 2).toUpperCase()}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)', color: 'var(--tb-text-muted, #A9BBC9)' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="card-detail-body">
          <div className="flex items-center gap-2 flex-wrap">
            <TerminPicker value={termin} overdue={overdue} onConfirm={commitTermin} />

            {sourceListName && (
              <span className="card-detail-chip">
                <LayoutList size={12} /> w liście: {sourceListName}
              </span>
            )}

            <button
              type="button"
              onClick={toggleAssignToMe}
              className="card-detail-chip"
              style={{
                cursor: 'pointer',
                color: przypisanyDo === user?.id ? 'var(--tb-accent, #37A0C9)' : 'var(--tb-text-muted, #A9BBC9)',
                borderColor: przypisanyDo === user?.id ? 'rgba(55,160,201,0.55)' : undefined,
                background: przypisanyDo === user?.id ? 'rgba(55,160,201,0.18)' : undefined,
              }}
            >
              <UserRound size={12} /> {przypisanyDo === user?.id ? 'Przypisany: Ja' : 'Przypisz do mnie'}
            </button>
          </div>

          <button
            type="button"
            onClick={toggleZakonczona}
            className="flex items-center gap-2 text-sm font-medium self-start"
            style={{ color: zakonczona ? '#2BD17E' : 'var(--tb-text-muted, #A9BBC9)', minHeight: 36 }}
          >
            {zakonczona ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            Zakończona
          </button>

          <div>
            <label className="card-detail-section-label">Opis</label>
            <textarea
              className="card-detail-input"
              style={{ minHeight: 70, resize: 'vertical' }}
              value={opis}
              onChange={e => setOpis(e.target.value)}
              onBlur={commitOpis}
              placeholder="Szczegóły, notatki…"
            />
          </div>

          <div>
            <label className="card-detail-section-label">Przypisani (tekst)</label>
            <input
              className="card-detail-input"
              style={{ minHeight: 40 }}
              value={przypisaniText}
              onChange={e => setPrzypisaniText(e.target.value)}
              onBlur={commitPrzypisani}
              placeholder="Jan, Anna"
            />
          </div>

          <div>
            <label className="card-detail-section-label">Etykiety</label>
            <div className="flex gap-2 flex-wrap">
              {TABLICA_COLORS.map(c => {
                const active = etykiety.some(e => e.color === c.value)
                return (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => toggleLabel(c.value)}
                    className="rounded-full transition-transform"
                    style={{
                      width: 26, height: 26,
                      background: c.value,
                      outline: active ? '2px solid var(--tb-text, #F4F8FB)' : 'none',
                      outlineOffset: 2,
                      transform: active ? 'scale(1.1)' : 'none',
                    }}
                  />
                )
              })}
            </div>

            {etykiety.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2.5">
                {etykiety.map(e => (
                  <div key={e.color} className="flex items-center gap-2">
                    <span style={{ width: 14, height: 14, borderRadius: 4, background: e.color, flexShrink: 0 }} />
                    <input
                      defaultValue={e.nazwa || ''}
                      onBlur={ev => renameLabel(e.color, ev.target.value.trim())}
                      placeholder="Nazwa (opcjonalnie)"
                      className="card-detail-input"
                      style={{ minHeight: 32, padding: '5px 9px', fontSize: 13 }}
                    />
                    <button type="button" onClick={() => toggleLabel(e.color)} style={{ color: 'var(--tb-text-muted, #A9BBC9)', flexShrink: 0 }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="card-detail-section-label" style={{ margin: 0 }}>
                <ListChecks size={13} />
                Checklista{checklista.length > 0 ? ` ${doneCount}/${checklista.length} (${percent}%)` : ''}
              </label>
              <button
                type="button"
                onClick={() => setTemplatesOpen(o => !o)}
                className="text-xs font-medium"
                style={{ color: 'var(--tb-accent, #37A0C9)', minHeight: 26 }}
              >
                Wstaw szablon
              </button>
            </div>

            {checklista.length > 0 && (
              <div className="rounded-full overflow-hidden mb-2.5" style={{ height: 6, background: 'rgba(255,255,255,0.10)' }}>
                <div
                  style={{
                    height: '100%', width: `${percent}%`,
                    background: percent === 100 ? '#2BD17E' : 'var(--tb-accent, #37A0C9)',
                    transition: 'width 0.2s',
                  }}
                />
              </div>
            )}

            {templatesOpen && (
              <div className="flex flex-col gap-1.5 mb-2.5">
                {CHECKLIST_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => addTemplate(t.items)}
                    className="text-left text-sm px-3 rounded-[10px]"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--tb-text, #F4F8FB)', minHeight: 38 }}
                  >
                    {t.nazwa} <span style={{ color: 'var(--tb-text-muted, #A9BBC9)' }}>({t.items.length})</span>
                  </button>
                ))}
              </div>
            )}

            {checklista.length > 0 && (
              <div className="flex flex-col gap-0.5 mb-2">
                {checklista.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleItemDone(item.id)}
                      className="flex items-center justify-center flex-shrink-0"
                      style={{ color: item.done ? '#2BD17E' : 'var(--tb-text-muted, #A9BBC9)', width: 36, height: 38 }}
                    >
                      {item.done ? <CheckCircle2 size={19} /> : <Circle size={19} />}
                    </button>

                    {editingItemId === item.id ? (
                      <input
                        autoFocus
                        defaultValue={item.tekst}
                        onBlur={ev => commitItemText(item.id, ev.target.value)}
                        onKeyDown={ev => { if (ev.key === 'Enter') ev.target.blur(); if (ev.key === 'Escape') setEditingItemId(null) }}
                        className="card-detail-input"
                        style={{ minHeight: 32, padding: '5px 9px', fontSize: 13, flex: 1 }}
                      />
                    ) : (
                      <span
                        onClick={() => setEditingItemId(item.id)}
                        className="text-[13.5px] flex-1"
                        style={{
                          color: item.done ? 'var(--tb-text-muted, #A9BBC9)' : 'var(--tb-text, #F4F8FB)',
                          textDecoration: item.done ? 'line-through' : 'none',
                          opacity: item.done ? 0.7 : 1,
                          cursor: 'text',
                          minHeight: 38,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {item.tekst}
                      </span>
                    )}

                    <div className="flex items-center flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => moveChecklistItem(item.id, -1)}
                        disabled={i === 0}
                        style={{ color: 'var(--tb-text-muted, #A9BBC9)', opacity: i === 0 ? 0.3 : 1, width: 24, height: 38 }}
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveChecklistItem(item.id, 1)}
                        disabled={i === checklista.length - 1}
                        style={{ color: 'var(--tb-text-muted, #A9BBC9)', opacity: i === checklista.length - 1 ? 0.3 : 1, width: 24, height: 38 }}
                      >
                        <ChevronDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(item.id)}
                        onBlur={() => setConfirmingRemoveId(null)}
                        title={confirmingRemoveId === item.id ? 'Na pewno?' : 'Usuń'}
                        style={{ color: confirmingRemoveId === item.id ? '#FF6B6B' : 'var(--tb-text-muted, #A9BBC9)', width: 28, height: 38, flexShrink: 0 }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddItemSubmit} className="flex items-center gap-2">
              <input
                value={newItemText}
                onChange={ev => setNewItemText(ev.target.value)}
                placeholder="Dodaj element…"
                className="card-detail-input"
                style={{ minHeight: 38, padding: '7px 9px', fontSize: 13.5, flex: 1 }}
              />
              <button
                type="submit"
                className="flex items-center justify-center rounded-[10px] flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.10)', color: 'var(--tb-text, #F4F8FB)', width: 38, height: 38 }}
              >
                <Plus size={15} />
              </button>
            </form>
          </div>

          <div>
            <label className="card-detail-section-label"><Image size={13} /> Zdjęcia</label>
            <CardPhotoGallery card={card} workspaceId={workspaceId} userId={user?.id} />
          </div>

          <div>
            <label className="card-detail-section-label"><Image size={13} /> Zdjęcia przed/po</label>
            <CardPhotos card={card} workspaceId={workspaceId} onSave={onSave} />
          </div>

          <div>
            <label className="card-detail-section-label"><Paperclip size={13} /> Załączniki</label>
            <CardAttachments card={card} workspaceId={workspaceId} />
          </div>

          {otherLists.length > 0 && (
            <div>
              <label className="card-detail-section-label">Przenieś / kopiuj do listy</label>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="card-detail-input"
                  style={{ minHeight: 38, flex: '1 1 140px' }}
                  value={targetListaId}
                  onChange={e => setTargetListaId(e.target.value)}
                >
                  {otherLists.map(l => <option key={l.id} value={l.id}>{l.nazwa}</option>)}
                </select>
                <button
                  type="button"
                  onClick={handleMove}
                  title="Przenieś do wybranej listy"
                  className="flex items-center gap-1.5 px-3 rounded-[10px] text-sm font-medium flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--tb-text, #F4F8FB)', minHeight: 38 }}
                >
                  <ArrowRightLeft size={13} /> Przenieś
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Skopiuj do wybranej listy"
                  className="flex items-center gap-1.5 px-3 rounded-[10px] text-sm font-medium flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--tb-text, #F4F8FB)', minHeight: 38 }}
                >
                  <Copy size={13} /> Kopiuj
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="card-detail-section-label"><MessageSquare size={13} /> Komentarze</label>
            <CardComments card={card} workspaceId={workspaceId} />
          </div>

          <div>
            <label className="card-detail-section-label"><History size={13} /> Aktywność</label>
            <CardActivity card={card} />
          </div>
        </div>

        <div className="card-detail-footer">
          <div className="flex items-center gap-3">
            <button
              onClick={handleArchive}
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: 'var(--tb-text-muted, #A9BBC9)', minHeight: 40 }}
            >
              <Archive size={14} /> Archiwizuj
            </button>
            <button
              onClick={handleDeleteClick}
              onBlur={() => setConfirmingDelete(false)}
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: '#FF6B6B', minHeight: 40 }}
            >
              <Trash2 size={14} /> {confirmingDelete ? 'Na pewno?' : 'Usuń'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-5 rounded-[10px] text-sm font-medium text-white"
            style={{ background: 'var(--tb-accent, #37A0C9)', minHeight: 38 }}
          >
            Gotowe
          </button>
        </div>
      </div>
    </div>
  )
}
