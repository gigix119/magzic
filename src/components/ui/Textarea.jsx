// Usage: <Textarea label="Notatki" rows={4} value={v} onChange={fn} />

export default function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
          {label}
        </label>
      )}
      <textarea
        className={`w-full resize-y ${className}`}
        style={{
          fontSize: '16px',
          lineHeight: 1.6,
          padding: '10px 12px',
          borderRadius: 'var(--radius-control)',
          border: `1px solid ${error ? 'var(--c-critical)' : 'var(--border)'}`,
          background: 'var(--input-bg)',
          color: 'var(--text)',
          outline: 'none',
          transition: 'border-color 0.15s',
          fontFamily: 'inherit',
          minHeight: '80px',
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
