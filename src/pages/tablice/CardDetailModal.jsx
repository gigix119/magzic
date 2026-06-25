import { useState } from 'react'
import Modal from '../../components/Modal'
import { Trash2, Archive, CheckCircle2, Circle, X, ArrowRightLeft, Copy, ChevronUp, ChevronDown, ListChecks, Plus } from 'lucide-react'
import { TABLICA_COLORS, CHECKLIST_TEMPLATES } from './tablicaTokens'

const inputStyle = {
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-control)',
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: 16,
  width: '100%',
  outline: 'none',
  minHeight: 44,
  boxSizing: 'border-box',
}

function toLocalDatetimeValue(termin) {
  if (!termin) return ''
  const d = new Date(termin)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function CardDetailModal({ card, lists, onClose, onSave, onArchive, onDelete, onMove, onCopy }) {
  const [tytul, setTytul] = useState(card.tytul || '')
  const [opis, setOpis] = useState(card.opis || '')
  const [termin, setTermin] = useState(toLocalDatetimeValue(card.termin))
  const [zakonczona, setZakonczona] = useState(!!card.zakonczona)
  const [etykiety, setEtykiety] = useState(Array.isArray(card.etykiety) ? card.etykiety : [])
  const [przypisaniText, setPrzypisaniText] = useState((card.przypisani || []).join(', '))
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
    <Modal title="Karta" onClose={onClose} maxWidth={520}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Tytuł</label>
          <input autoFocus style={inputStyle} value={tytul} onChange={e => setTytul(e.target.value)} onBlur={commitTytul} />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Opis</label>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
            value={opis}
            onChange={e => setOpis(e.target.value)}
            onBlur={commitOpis}
            placeholder="Szczegóły, notatki…"
          />
        </div>

        <button
          type="button"
          onClick={toggleZakonczona}
          className="flex items-center gap-2 text-sm font-medium self-start"
          style={{ color: zakonczona ? 'var(--c-success)' : 'var(--text-2)', minHeight: 44 }}
        >
          {zakonczona ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          Zakończona
        </button>

        <div className="grid grid-cols-2 gap-3 modal-2col">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Termin</label>
            <input type="datetime-local" style={inputStyle} value={termin} onChange={e => commitTermin(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Przypisani</label>
            <input style={inputStyle} value={przypisaniText} onChange={e => setPrzypisaniText(e.target.value)} onBlur={commitPrzypisani} placeholder="Jan, Anna" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Etykiety</label>
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
                    width: 28, height: 28,
                    background: c.value,
                    outline: active ? '2px solid var(--text)' : 'none',
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
                  <span style={{ width: 16, height: 16, borderRadius: 4, background: e.color, flexShrink: 0 }} />
                  <input
                    defaultValue={e.nazwa || ''}
                    onBlur={ev => renameLabel(e.color, ev.target.value.trim())}
                    placeholder="Nazwa (opcjonalnie)"
                    style={{ ...inputStyle, minHeight: 36, padding: '6px 10px', fontSize: 13.5 }}
                  />
                  <button type="button" onClick={() => toggleLabel(e.color)} style={{ color: 'var(--muted)', flexShrink: 0 }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-2)' }}>
              <ListChecks size={14} />
              Checklista{checklista.length > 0 ? ` ${doneCount}/${checklista.length} (${percent}%)` : ''}
            </label>
            <button
              type="button"
              onClick={() => setTemplatesOpen(o => !o)}
              className="text-xs font-medium"
              style={{ color: 'var(--c-action)', minHeight: 28 }}
            >
              Wstaw szablon
            </button>
          </div>

          {checklista.length > 0 && (
            <div className="rounded-full overflow-hidden mb-2.5" style={{ height: 6, background: 'var(--hover-bg)' }}>
              <div
                style={{
                  height: '100%', width: `${percent}%`,
                  background: percent === 100 ? 'var(--c-success)' : 'var(--c-action)',
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
                  className="text-left text-sm px-3 rounded-[var(--radius-control)]"
                  style={{ background: 'var(--hover-bg)', color: 'var(--text)', minHeight: 40 }}
                >
                  {t.nazwa} <span style={{ color: 'var(--text-2)' }}>({t.items.length})</span>
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
                    style={{ color: item.done ? 'var(--c-success)' : 'var(--text-2)', width: 40, height: 44 }}
                  >
                    {item.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </button>

                  {editingItemId === item.id ? (
                    <input
                      autoFocus
                      defaultValue={item.tekst}
                      onBlur={ev => commitItemText(item.id, ev.target.value)}
                      onKeyDown={ev => { if (ev.key === 'Enter') ev.target.blur(); if (ev.key === 'Escape') setEditingItemId(null) }}
                      style={{ ...inputStyle, minHeight: 36, padding: '6px 10px', fontSize: 13.5, flex: 1 }}
                    />
                  ) : (
                    <span
                      onClick={() => setEditingItemId(item.id)}
                      className="text-[13.5px] flex-1"
                      style={{
                        color: item.done ? 'var(--text-2)' : 'var(--text)',
                        textDecoration: item.done ? 'line-through' : 'none',
                        opacity: item.done ? 0.7 : 1,
                        cursor: 'text',
                        minHeight: 44,
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
                      style={{ color: 'var(--muted)', opacity: i === 0 ? 0.3 : 1, width: 26, height: 44 }}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveChecklistItem(item.id, 1)}
                      disabled={i === checklista.length - 1}
                      style={{ color: 'var(--muted)', opacity: i === checklista.length - 1 ? 0.3 : 1, width: 26, height: 44 }}
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(item.id)}
                      onBlur={() => setConfirmingRemoveId(null)}
                      title={confirmingRemoveId === item.id ? 'Na pewno?' : 'Usuń'}
                      style={{ color: confirmingRemoveId === item.id ? 'var(--c-critical)' : 'var(--muted)', width: 30, height: 44, flexShrink: 0 }}
                    >
                      <X size={14} />
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
              style={{ ...inputStyle, minHeight: 40, padding: '8px 10px', fontSize: 14, flex: 1 }}
            />
            <button
              type="submit"
              className="flex items-center justify-center rounded-[var(--radius-control)] flex-shrink-0"
              style={{ background: 'var(--hover-bg)', color: 'var(--text)', width: 40, height: 40 }}
            >
              <Plus size={16} />
            </button>
          </form>
        </div>

        {otherLists.length > 0 && (
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Przenieś / kopiuj do listy</label>
            <div className="flex items-center gap-2 flex-wrap">
              <select style={{ ...inputStyle, minHeight: 40, flex: '1 1 140px' }} value={targetListaId} onChange={e => setTargetListaId(e.target.value)}>
                {otherLists.map(l => <option key={l.id} value={l.id}>{l.nazwa}</option>)}
              </select>
              <button
                type="button"
                onClick={handleMove}
                title="Przenieś do wybranej listy"
                className="flex items-center gap-1.5 px-3 rounded-[var(--radius-control)] text-sm font-medium flex-shrink-0"
                style={{ background: 'var(--hover-bg)', color: 'var(--text)', minHeight: 40 }}
              >
                <ArrowRightLeft size={14} /> Przenieś
              </button>
              <button
                type="button"
                onClick={handleCopy}
                title="Skopiuj do wybranej listy"
                className="flex items-center gap-1.5 px-3 rounded-[var(--radius-control)] text-sm font-medium flex-shrink-0"
                style={{ background: 'var(--hover-bg)', color: 'var(--text)', minHeight: 40 }}
              >
                <Copy size={14} /> Kopiuj
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-3">
            <button
              onClick={handleArchive}
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: 'var(--text-2)', minHeight: 44 }}
            >
              <Archive size={15} /> Archiwizuj
            </button>
            <button
              onClick={handleDeleteClick}
              onBlur={() => setConfirmingDelete(false)}
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: 'var(--c-critical)', minHeight: 44 }}
            >
              <Trash2 size={15} /> {confirmingDelete ? 'Na pewno?' : 'Usuń'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-5 rounded-[var(--radius-control)] text-sm font-medium text-white"
            style={{ background: 'var(--c-action)', minHeight: 44 }}
          >
            Gotowe
          </button>
        </div>
      </div>
    </Modal>
  )
}
