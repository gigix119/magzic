import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, HelpCircle, X } from 'lucide-react'
import { useWorkspace } from '../../context/WorkspaceContext'
import { parseAssistantIntent } from '../../utils/assistantIntentParser'
import { runAssistantIntent } from '../../utils/assistantHandlers'
import AssistantMessage from './AssistantMessage'
import AssistantResult from './AssistantResult'
import AssistantCommandHelp from './AssistantCommandHelp'

const QUICK_PROMPTS = [
  'Pokaż dashboard zakupów',
  'Co najbardziej podrożało?',
  'Porównaj dwie ostatnie faktury',
  'Pokaż niskie stany',
  'Co powinienem zamówić?',
  'Pokaż faktury do weryfikacji',
  'Historia ceny Domestos',
  'Porównaj dostawców',
  'Znajdź towar Domestos',
  'Ustaw alert na Domestos 15%',
]

let msgCounter = 0
function nextId() { return ++msgCounter }

function AssistantAvatar() {
  return (
    <div
      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
      style={{
        background: 'rgba(59,130,246,0.12)',
        border: '1px solid rgba(59,130,246,0.22)',
      }}
    >
      <Sparkles size={11} style={{ color: '#3b82f6' }} />
    </div>
  )
}

export default function AssistantChat() {
  const { workspaceId } = useWorkspace()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text) {
    if (isLoading) return
    const trimmed = text.trim()
    if (!trimmed) return

    setShowHelp(false)
    const userMsg = { id: nextId(), role: 'user', text: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')

    const parsed = parseAssistantIntent(trimmed, messages)
    const loadingId = nextId()
    setIsLoading(true)
    setMessages(prev => [...prev, { id: loadingId, role: 'assistant', text: '', loading: true, intent: parsed.intent }])

    try {
      const result = await runAssistantIntent({ intentResult: parsed, workspaceId })
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: result.text, structuredData: result.structuredData, intent: result.intent }
          : m
      ))
    } catch (err) {
      console.error('AssistantChat sendMessage:', err)
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: 'Wystąpił błąd. Spróbuj ponownie za chwilę.' }
          : m
      ))
    } finally {
      setIsLoading(false)
    }

    textareaRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div
      className="mt-6 rounded-2xl overflow-hidden"
      style={{
        border: '1px solid var(--border)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ background: 'var(--table-head)', borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
          style={{
            background: 'rgba(59,130,246,0.12)',
            border: '1px solid rgba(59,130,246,0.22)',
          }}
        >
          <Sparkles size={15} style={{ color: '#3b82f6' }} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold" style={{ fontSize: 15, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            Asystent Magzic
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
            Analizuj faktury, ceny, dostawców, magazyn i rekomendacje zakupowe
          </p>
        </div>
        <button
          onClick={() => setShowHelp(v => !v)}
          className="flex-shrink-0 flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 transition-opacity hover:opacity-80"
          style={{
            background: showHelp ? 'rgba(59,130,246,0.10)' : 'var(--table-sub)',
            border: `1px solid ${showHelp ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
            color: showHelp ? '#3b82f6' : 'var(--text-2)',
          }}
          title={showHelp ? 'Ukryj pomoc' : 'Przykłady pytań'}
        >
          {showHelp
            ? <><X size={12} /><span className="hidden sm:inline">Ukryj</span></>
            : <><HelpCircle size={12} /><span>Przykłady pytań</span></>
          }
        </button>
      </div>

      {/* Quick prompts */}
      <div
        className="px-4 pt-2.5 pb-3"
        style={{ background: 'var(--table-sub)', borderBottom: '1px solid var(--border)' }}
      >
        <p
          className="font-medium mb-2"
          style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
        >
          Szybkie analizy
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map(prompt => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              disabled={isLoading}
              className="rounded-lg px-2.5 py-1 font-medium transition-all hover:opacity-80 active:scale-95 disabled:opacity-40"
              style={{
                background: 'var(--card)',
                color: 'var(--text-2)',
                border: '1px solid var(--border)',
                fontSize: 11,
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Help panel */}
      {showHelp && (
        <AssistantCommandHelp onExampleClick={text => sendMessage(text)} />
      )}

      {/* Messages */}
      <div
        className="px-4 py-4 flex flex-col gap-4 overflow-y-auto"
        style={{ minHeight: 80, maxHeight: 560, background: 'var(--bg)' }}
      >
        {messages.length === 0 ? (
          <p className="text-sm text-center my-6" style={{ color: 'var(--muted)' }}>
            Wybierz szybki prompt lub wpisz pytanie poniżej
          </p>
        ) : (
          messages.map(msg => {
            if (msg.role === 'user') {
              return <AssistantMessage key={msg.id} text={msg.text} />
            }

            if (msg.loading) {
              return (
                <div key={msg.id} className="flex gap-2">
                  <AssistantAvatar />
                  <div
                    className="rounded-xl px-3.5 py-2.5"
                    style={{
                      background: 'var(--table-sub)',
                      border: '1px solid var(--border)',
                      borderTopLeftRadius: 4,
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="rounded-full animate-pulse"
                          style={{
                            width: 6, height: 6,
                            background: 'var(--muted)',
                            animationDelay: `${i * 180}ms`,
                          }}
                        />
                      ))}
                      <span className="text-xs ml-1" style={{ color: 'var(--muted)' }}>Analizuję dane…</span>
                    </div>
                  </div>
                </div>
              )
            }

            // structured result: small text bubble + full-width result panel
            if (msg.structuredData) {
              return (
                <div key={msg.id} className="flex flex-col gap-2">
                  {msg.text ? (
                    <div className="flex gap-2">
                      <AssistantAvatar />
                      <div
                        className="rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
                        style={{
                          background: 'var(--table-sub)',
                          border: '1px solid var(--border)',
                          borderTopLeftRadius: 4,
                          color: 'var(--text)',
                          maxWidth: 'min(84%, 560px)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ) : null}
                  <AssistantResult
                    intent={msg.intent}
                    text=""
                    structuredData={msg.structuredData}
                  />
                </div>
              )
            }

            // text-only response
            return (
              <div key={msg.id} className="flex gap-2">
                <AssistantAvatar />
                <div
                  className="rounded-xl px-3.5 py-2.5 text-sm leading-relaxed"
                  style={{
                    background: 'var(--table-sub)',
                    border: '1px solid var(--border)',
                    borderTopLeftRadius: 4,
                    color: 'var(--text)',
                    maxWidth: 'min(84%, 560px)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  <AssistantResult intent={msg.intent} text={msg.text} structuredData={null} />
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
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
          disabled={isLoading}
          placeholder="Zapytaj np. 'co powinienem zamówić?' albo 'historia ceny Domestos'…"
          className="flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-60"
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            minHeight: 44,
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
          disabled={!input.trim() || isLoading}
          className="flex-shrink-0 rounded-lg p-2.5 flex items-center justify-center transition-all disabled:opacity-40 hover:opacity-90 active:scale-95"
          style={{
            background: input.trim() && !isLoading ? '#3b82f6' : 'var(--table-sub)',
            color: input.trim() && !isLoading ? '#ffffff' : 'var(--muted)',
            border: '1px solid var(--border)',
            minHeight: 44,
            minWidth: 44,
          }}
          title="Wyślij (Enter)"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
