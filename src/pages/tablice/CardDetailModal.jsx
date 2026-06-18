import { useState } from 'react'
import Modal from '../../components/Modal'
import { Trash2, CheckCircle2, Circle } from 'lucide-react'
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

export default function CardDetailModal({ card, onClose, onSave, onDelete }) {
  const [tytul, setTytul] = useState(card.tytul || '')
  const [opis, setOpis] = useState(card.opis || '')
  const [termin, setTermin] = useState(card.termin ? card.termin.slice(0, 10) : '')
  const [zakonczona, setZakonczona] = useState(!!card.zakonczona)
  const [etykiety, setEtykiety] = useState(Array.isArray(card.etykiety) ? card.etykiety : [])
  const [przypisaniText, setPrzypisaniText] = useState((card.przypisani || []).join(', '))
  const [saving, setSaving] = useState(false)

  function toggleLabel(color) {
    setEtykiety(prev => {
      const exists = prev.some(e => e.color === color)
      return exists ? prev.filter(e => e.color !== color) : [...prev, { color }]
    })
  }

  async function handleSave() {
    if (!tytul.trim()) return
    setSaving(true)
    await onSave(card.id, {
      tytul: tytul.trim(),
      opis: opis.trim() || null,
      termin: termin ? new Date(termin).toISOString() : null,
      zakonczona,
      etykiety,
      przypisani: przypisaniText.split(',').map(s => s.trim()).filter(Boolean),
    })
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    await onDelete(card.id)
    onClose()
  }

  return (
    <Modal title="Karta" onClose={onClose} maxWidth={520}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Tytuł</label>
          <input autoFocus style={inputStyle} value={tytul} onChange={e => setTytul(e.target.value)} />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Opis</label>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
            value={opis}
            onChange={e => setOpis(e.target.value)}
            placeholder="Szczegóły, notatki…"
          />
        </div>

        <button
          type="button"
          onClick={() => setZakonczona(z => !z)}
          className="flex items-center gap-2 text-sm font-medium self-start"
          style={{ color: zakonczona ? 'var(--c-success)' : 'var(--text-2)' }}
        >
          {zakonczona ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          Zakończona
        </button>

        <div className="grid grid-cols-2 gap-3 modal-2col">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Termin</label>
            <input type="date" style={inputStyle} value={termin} onChange={e => setTermin(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Przypisani</label>
            <input style={inputStyle} value={przypisaniText} onChange={e => setPrzypisaniText(e.target.value)} placeholder="Jan, Anna" />
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
        </div>

        <div className="flex items-center justify-between mt-1">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: 'var(--c-critical)', minHeight: 44 }}
          >
            <Trash2 size={15} /> Usuń
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !tytul.trim()}
            className="px-5 rounded-[var(--radius-control)] text-sm font-medium text-white"
            style={{ background: 'var(--c-action)', minHeight: 44, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
