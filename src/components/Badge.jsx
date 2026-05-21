const variants = {
  green:  { background: 'rgba(34,197,94,0.15)',   color: '#16a34a' },
  red:    { background: 'rgba(239,68,68,0.15)',    color: '#dc2626' },
  blue:   { background: 'rgba(59,130,246,0.15)',   color: '#2563eb' },
  yellow: { background: 'rgba(234,179,8,0.15)',    color: '#ca8a04' },
  zinc:   { background: 'rgba(113,113,122,0.15)',  color: '#71717a' },
  purple: { background: 'rgba(168,85,247,0.15)',   color: '#9333ea' },
}

export default function Badge({ variant = 'zinc', children }) {
  const style = variants[variant] || variants.zinc
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
      style={style}
    >
      {children}
    </span>
  )
}
