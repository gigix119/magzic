import { Calendar } from 'lucide-react'

function isoTomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
}

export function isoToday() { return new Date().toISOString().split('T')[0] }

export function resolveFilterDate(value) {
  if (value === 'today') return isoToday()
  if (value === 'tomorrow') return isoTomorrow()
  if (value === 'all') return null
  return value || null
}

const chipStyle = (active) => ({
  minHeight: 36,
  background: active ? 'var(--c-action)' : 'var(--card)',
  color: active ? '#fff' : 'var(--text-2)',
  border: `1px solid ${active ? 'var(--c-action)' : 'var(--border)'}`,
  borderRadius: 999,
  padding: '0 12px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  flexShrink: 0,
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
})

// value: 'today' | 'tomorrow' | 'all' | ISO date string
// onChange: (value) => void
// showAll: whether to show "Wszystkie" chip
export default function DateFilter({ value, onChange, showAll = true }) {
  const isCustomDate = value && value !== 'today' && value !== 'tomorrow' && value !== 'all'

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {[
        { key: 'today', label: 'Dziś' },
        { key: 'tomorrow', label: 'Jutro' },
        ...(showAll ? [{ key: 'all', label: 'Wszystkie' }] : []),
      ].map(chip => (
        <button key={chip.key} onClick={() => onChange(chip.key)} style={chipStyle(value === chip.key)}>
          {chip.label}
        </button>
      ))}
      <label style={{ ...chipStyle(isCustomDate), gap: 4, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
        <Calendar size={12} />
        {isCustomDate
          ? new Date(value + 'T00:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
          : 'Data'}
        <input
          type="date"
          style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer', fontSize: 16 }}
          value={isCustomDate ? value : ''}
          onChange={e => e.target.value && onChange(e.target.value)}
        />
      </label>
    </div>
  )
}
