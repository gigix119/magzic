import { AlertTriangle } from 'lucide-react'

export default function AssistantWarnings({ warnings }) {
  if (!warnings?.length) return null
  return (
    <div className="flex flex-col gap-1.5">
      {warnings.map((w, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-lg px-3 py-2"
          style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)', color: '#b45309' }}
        >
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2, color: '#d97706' }} />
          <span style={{ fontSize: 12, lineHeight: 1.5 }}>{w}</span>
        </div>
      ))}
    </div>
  )
}
