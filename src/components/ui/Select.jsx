// Usage: <Select label="Kategoria" value={v} onChange={fn}><option value="x">X</option></Select>

export default function Select({ label, error, className = '', children, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
          {label}
        </label>
      )}
      <select
        className={`w-full ${className}`}
        style={{
          fontSize: '16px',
          lineHeight: 1.5,
          padding: '10px 12px',
          borderRadius: 'var(--radius-control)',
          border: `1px solid ${error ? 'var(--c-critical)' : 'var(--border)'}`,
          background: 'var(--input-bg)',
          color: 'var(--text)',
          outline: 'none',
          transition: 'border-color 0.15s',
          minHeight: '44px',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
          paddingRight: '36px',
        }}
        {...props}
      >
        {children}
      </select>
      {error && (
        <span className="text-xs" style={{ color: 'var(--c-critical)' }}>{error}</span>
      )}
    </div>
  )
}
