// Usage: <Input label="Nazwa" placeholder="..." value={v} onChange={fn} error="Pole wymagane" />

export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
          {label}
        </label>
      )}
      <input
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
          transition: 'border-color 0.15s, box-shadow 0.15s',
          minHeight: '44px',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--c-action)')}
        onBlur={e => (e.currentTarget.style.borderColor = error ? 'var(--c-critical)' : 'var(--border)')}
        {...props}
      />
      {error && (
        <span className="text-xs" style={{ color: 'var(--c-critical)' }}>{error}</span>
      )}
    </div>
  )
}
