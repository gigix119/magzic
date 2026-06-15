// Usage: <StatusPill status="success" icon={CheckCircle}>Opłacona</StatusPill>
// Pill variant with optional Lucide icon. Same status tokens as Badge.

const palette = {
  success:    { bg: 'var(--c-success-subtle)',    color: 'var(--c-success)' },
  attention:  { bg: 'var(--c-attention-subtle)',  color: 'var(--c-attention)' },
  critical:   { bg: 'var(--c-critical-subtle)',   color: 'var(--c-critical)' },
  action:     { bg: 'var(--c-action-subtle)',     color: 'var(--c-action)' },
  automation: { bg: 'var(--c-automation-subtle)', color: 'var(--c-automation)' },
  default:    { bg: 'var(--hover-bg)',            color: 'var(--text-2)' },
}

export default function StatusPill({ status = 'default', icon: Icon, children, className = '' }) {
  const { bg, color } = palette[status] ?? palette.default
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold badge-nowrap ${className}`}
      style={{ background: bg, color }}
    >
      {Icon && <Icon size={12} strokeWidth={2.5} />}
      {children}
    </span>
  )
}
