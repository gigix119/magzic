import { useState } from 'react'
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * Expandable demand-explanation panel shown next to a zlecenie pozycja.
 * steps: Array<{ label: string, value: number|string }>
 * Prepared for future per-guest/per-night rules — just add more steps.
 */
export default function DemandExplanation({ steps = [], ilosc, jednostka = 'szt.' }) {
  const [open, setOpen] = useState(false)
  if (!steps.length) return null
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1"
        style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11 }}
      >
        <HelpCircle size={11} />
        Dlaczego tyle?
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {open && (
        <div
          className="mt-1.5 rounded-lg px-3 py-2 space-y-1"
          style={{ background: 'var(--table-sub)', border: '1px solid var(--border)', fontSize: 11 }}
        >
          {steps.map((step, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span style={{ color: 'var(--text-2)' }}>
                {i > 0 && <span style={{ color: 'var(--muted)', marginRight: 4 }}>+</span>}
                {step.label}
              </span>
              <span style={{ color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>
                {step.value} {jednostka}
              </span>
            </div>
          ))}
          {steps.length > 0 && (
            <div
              className="flex items-center justify-between gap-2"
              style={{ borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 4 }}
            >
              <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>= do zabrania</span>
              <span style={{ color: 'var(--c-action)', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>
                {ilosc} {jednostka}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
