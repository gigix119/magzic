// Usage: <KpiCard label="Przychód" value="48 320 zł" delta="+12%" deltaPositive />
// delta: optional string; deltaPositive controls green vs red color

export default function KpiCard({ label, value, delta, deltaPositive, className = '' }) {
  return (
    <div
      className={`flex flex-col gap-1 p-4 ${className}`}
      style={{
        background: 'var(--c-surface)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--border)',
      }}
    >
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-2)' }}>
        {label}
      </span>
      <span
        className="text-2xl font-semibold tabular-nums leading-tight"
        style={{ color: 'var(--text)' }}
      >
        {value}
      </span>
      {delta !== undefined && (
        <span
          className="text-xs font-medium tabular-nums"
          style={{ color: deltaPositive ? 'var(--c-success)' : 'var(--c-critical)' }}
        >
          {delta}
        </span>
      )}
    </div>
  )
}
