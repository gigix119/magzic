// Usage: <EmptyState icon={Inbox} title="Brak wyników" description="Dodaj pierwszy element." action={<Button>Dodaj</Button>} />

import { Inbox } from 'lucide-react'

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-12 px-4 text-center ${className}`}
    >
      <div
        className="flex items-center justify-center w-12 h-12 rounded-[var(--radius-control)]"
        style={{ background: 'var(--hover-bg)', color: 'var(--muted)' }}
      >
        <Icon size={24} strokeWidth={1.5} />
      </div>
      {title && (
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title}</p>
      )}
      {description && (
        <p className="text-xs max-w-[260px]" style={{ color: 'var(--text-2)' }}>{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
