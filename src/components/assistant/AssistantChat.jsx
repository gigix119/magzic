import { useState, useRef, useEffect } from 'react'
import { Send, MessageCircle } from 'lucide-react'
import { parseAssistantIntent, getAssistantResponse } from '../../utils/assistantIntentParser'
import AssistantMessage from './AssistantMessage'
import AssistantResult from './AssistantResult'

const QUICK_PROMPTS = [
  'Pokaż dashboard zakupów z ostatniego miesiąca',
  'Porównaj dwie ostatnie faktury',
  'Co najbardziej podrożało?',
  'Pokaż faktury do weryfikacji',
  'Porównaj dostawców',
  'Pokaż historię ceny produktu',
  'Pokaż towary z niskim stanem',
  'Co powinienem zamówić?',
]

let msgCounter = 0
function nextId() { return ++msgCounter }

function buildAssistantMessage(userText) {
  const parsed = parseAssistantIntent(userText)
  const responseText = getAssistantResponse(parsed)
  return { id: nextId(), role: 'assistant', text: responseText, intent: parsed.intent }
}

export default function AssistantChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function sendMessage(text) {
    const trimmed = text.trim()
    if (!trimmed) return

    const userMsg = { id: nextId(), role: 'user', text: trimmed }
    const assistantMsg = buildAssistantMessage(trimmed)
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function handleQuickPrompt(prompt) {
    sendMessage(prompt)
  }

  return (
    <div
      className="rounded-xl overflow-hidden mt-6"
      style={{ border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-5 py-3"
        style={{ background: 'var(--table-head)', borderBottom: '1px solid var(--border)' }}
      >
        <MessageCircle size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
        <div className="min-w-0">
          <h2 className="font-semibold" style={{ fontSize: 14, color: 'var(--text)' }}>
            Asystent Magzic
          </h2>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-2)' }}>
            Zapytaj o faktury, ceny, dostawców, magazyn i anomalie zakupowe
          </p>
        </div>
      </div>

      {/* Quick prompts */}
      <div
        className="px-4 py-3 flex flex-wrap gap-2"
        style={{ background: 'var(--table-sub)', borderBottom: '1px solid var(--border)' }}
      >
        {QUICK_PROMPTS.map(prompt => (
          <button
            key={prompt}
            onClick={() => handleQuickPrompt(prompt)}
            className="text-xs rounded-lg px-3 py-1.5 font-medium transition-opacity hover:opacity-80 active:opacity-60"
            style={{
              background: 'var(--card)',
              color: 'var(--text-2)',
              border: '1px solid var(--border)',
              whiteSpace: 'nowrap',
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div
        className="px-4 py-4 flex flex-col gap-3 overflow-y-auto"
        style={{
          minHeight: 80,
          maxHeight: 340,
          background: 'var(--bg)',
        }}
      >
        {messages.length === 0 ? (
          <p className="text-sm text-center my-4" style={{ color: 'var(--muted)' }}>
            Wybierz szybki prompt lub wpisz pytanie poniżej
          </p>
        ) : (
          messages.map(msg =>
            msg.role === 'assistant' ? (
              <div key={msg.id} className="flex gap-2.5">
                <div
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                  style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}
                >
                  <MessageCircle size={12} style={{ color: '#3b82f6' }} />
                </div>
                <div
                  className="rounded-xl px-3.5 py-2.5"
                  style={{
                    maxWidth: 'min(82%, 500px)',
                    background: 'var(--table-sub)',
                    border: '1px solid var(--border)',
                    borderTopLeftRadius: 4,
                  }}
                >
                  <AssistantResult intent={msg.intent} text={msg.text} />
                </div>
              </div>
            ) : (
              <AssistantMessage key={msg.id} role={msg.role} text={msg.text} />
            )
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="px-4 py-3 flex gap-2 items-end"
        style={{ background: 'var(--card)', borderTop: '1px solid var(--border)' }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Wpisz pytanie… (Enter = wyślij, Shift+Enter = nowa linia)"
          className="flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            minHeight: 38,
            maxHeight: 120,
            lineHeight: '1.5',
            overflowY: 'auto',
          }}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim()}
          className="flex-shrink-0 rounded-lg p-2.5 flex items-center justify-center transition-opacity"
          style={{
            background: input.trim() ? '#3b82f6' : 'var(--table-sub)',
            color: input.trim() ? '#ffffff' : 'var(--muted)',
            border: '1px solid var(--border)',
            minHeight: 38,
            minWidth: 38,
            opacity: input.trim() ? 1 : 0.6,
          }}
          title="Wyślij (Enter)"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
