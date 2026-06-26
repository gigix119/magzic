import { useState } from 'react'
import { Calendar } from 'lucide-react'

function pad(n) { return String(n).padStart(2, '0') }

function nowAsLocalValue() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TerminPicker({ value, onConfirm, overdue }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value || '')

  function openPicker() {
    setDraft(value || '')
    setOpen(true)
  }

  function handleClear() { onConfirm(''); setOpen(false) }
  function handleToday() { setDraft(nowAsLocalValue()) }
  function handleConfirm() { onConfirm(draft); setOpen(false) }

  const label = value
    ? new Date(value).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'Ustaw termin'

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={openPicker}
        className="card-detail-chip"
        style={{ cursor: 'pointer', color: overdue ? '#FF6B6B' : '#A9BBC9', borderColor: overdue ? 'rgba(255,107,107,0.5)' : undefined }}
      >
        <Calendar size={12} /> {label}
      </button>

      {open && (
        <>
          <div className="termin-picker-overlay" onClick={() => setOpen(false)} />
          <div className="termin-picker-panel">
            <input
              autoFocus
              type="datetime-local"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="card-detail-input"
              style={{ minHeight: 44 }}
            />
            <div className="flex items-center gap-2" style={{ marginTop: 10 }}>
              <button type="button" onClick={handleClear} className="termin-picker-btn">Wyczyść</button>
              <button type="button" onClick={handleToday} className="termin-picker-btn">Dzisiaj</button>
              <button type="button" onClick={handleConfirm} className="termin-picker-btn termin-picker-btn-confirm">Zatwierdź</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
