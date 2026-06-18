import { useState } from 'react'
import Modal from '../../components/Modal'
import { Trash2, Archive, CheckCircle2, Circle, X } from 'lucide-react'
import { TABLICA_COLORS } from './tablicaTokens'

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

export default function CardDetailModal({ card, onClose, onSave, onArchive, onDelete }) {
  const [tytul, setTytul] = useState(card.tytul || '')
  const [opis, setOpis] = useState(card.opis || '')
  const [termin, setTermin] = useState(toLocalDatetimeValue(card.termin))
  const [zakonczona, setZakonczona] = useState(!!card.zakonczona)
  const [etykiety, setEtykiety] = useState(Array.isArray(card.etykiety) ? card.etykiety : [])
  const [przypisaniText, setPrzypisaniText] = useState((card.przypisani || []).join(', '))
  const [confirmingDelete, setConfirmingDelete] = useState(false)

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

  function handleDeleteClick() {
    if (!confirmingDelete) { setConfirmingDelete(true); return }
    onDelete(card.id)
    onClose()
  }

  async function handleArchive() {
    await onArchive(card.id)
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
