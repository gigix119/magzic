import { Bot, User } from 'lucide-react'

export default function AssistantMessage({ role, text }) {
  const isUser = role === 'user'
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
        style={{
          background: isUser ? '#3b82f6' : 'var(--table-sub)',
          border: isUser ? 'none' : '1px solid var(--border)',
        }}
      >
        {isUser
          ? <User size={12} color="white" />
          : <Bot size={12} style={{ color: 'var(--text-2)' }} />
        }
      </div>
      <div
        className="rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
        style={{
          maxWidth: 'min(80%, 480px)',
          background: isUser ? '#3b82f6' : 'var(--table-sub)',
          color: isUser ? '#ffffff' : 'var(--text)',
          border: isUser ? 'none' : '1px solid var(--border)',
          borderTopRightRadius: isUser ? 4 : undefined,
          borderTopLeftRadius: isUser ? undefined : 4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
    </div>
  )
}
