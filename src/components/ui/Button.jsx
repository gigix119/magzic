// Usage: <Button variant="action" size="md" onClick={fn}>Label</Button>
// Variants: action | ghost | danger | automation   Sizes: sm | md

const variantCls = {
  action:     'bg-[var(--c-action)] text-white hover:opacity-90',
  ghost:      'bg-transparent text-[var(--text)] border border-[var(--border)] hover:bg-[var(--hover-bg)]',
  danger:     'bg-[var(--c-critical)] text-white hover:opacity-90',
  automation: 'bg-[var(--c-automation)] text-white hover:opacity-90',
}

const sizeCls = {
  sm: 'px-3 text-[13px] min-h-[44px] md:min-h-[32px]',
  md: 'px-4 text-[14px] min-h-[44px]',
}

export default function Button({
  variant = 'action',
  size = 'md',
  children,
  className = '',
  ...props
}) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-1.5 font-medium',
        'rounded-[var(--radius-control)] transition-all',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variantCls[variant] ?? variantCls.action,
        sizeCls[size] ?? sizeCls.md,
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
