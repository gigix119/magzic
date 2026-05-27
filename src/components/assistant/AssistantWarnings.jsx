export default function AssistantWarnings({ warnings }) {
  if (!warnings?.length) return null
  return warnings.map((w, i) => (
    <div
      key={i}
      className="rounded-lg px-3 py-2 text-xs"
      style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', color: '#ca8a04' }}
    >
      {w}
    </div>
  ))
}
