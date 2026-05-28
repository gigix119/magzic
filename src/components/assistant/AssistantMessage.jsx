export default function AssistantMessage({ text }) {
  return (
    <div className="flex justify-end">
      <div
        className="rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
        style={{
          maxWidth: 'min(84%, 520px)',
          background: '#3b82f6',
          color: '#ffffff',
          borderTopRightRadius: 4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
    </div>
  )
}
