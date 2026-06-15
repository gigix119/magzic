// Usage: <Badge status="success">Aktywny</Badge>
// Status: success | attention | critical | action | automation | default

const palette = {
  success:    { bg: 'var(--c-success-subtle)',    color: 'var(--c-success)' },
  attention:  { bg: 'var(--c-attention-subtle)',  color: 'var(--c-attention)' },
  critical:   { bg: 'var(--c-critical-subtle)',   color: 'var(--c-critical)' },
  action:     { bg: 'var(--c-action-subtle)',     color: 'var(--c-action)' },
  automation: { bg: 'var(--c-automation-subtle)', color: 'var(--c-automation)' },
  default:    { bg: 'var(--hover-bg)',            color: 'var(--text-2)' },
}

export default function Badge({ status = 'default', children, className = '' }) {
  const { bg, color } = palette[status] ?? palette.default
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium badge-nowrap ${className}`}
      style={{ background: bg, color }}
    >
      {children}
    </span>
  )
}
