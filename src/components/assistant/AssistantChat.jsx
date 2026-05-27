import { useState, useRef, useEffect } from 'react'
import { Send, MessageCircle } from 'lucide-react'
import { useWorkspace } from '../../context/WorkspaceContext'
import { parseAssistantIntent, getAssistantResponse } from '../../utils/assistantIntentParser'
import { fetchAssistantPurchaseDashboardData, fetchAssistantPriceChangesData, fetchAssistantInvoiceComparisonData, fetchAssistantLowStockData, fetchAssistantOrderRecommendationData, fetchAssistantInvoicesNeedingReviewData, fetchAssistantProductPriceHistoryData } from '../../utils/assistantQueryEngine'
import { buildPurchaseDashboard } from '../../utils/purchaseAnalyticsEngine'
import { buildLatestPriceChanges } from '../../utils/priceAnalyticsEngine'
import { compareInvoices } from '../../utils/invoiceComparisonEngine'
import { buildLowStockAnalysis } from '../../utils/lowStockAnalyticsEngine'
import { buildOrderRecommendations } from '../../utils/orderRecommendationEngine'
import { buildInvoicesNeedingReview } from '../../utils/invoiceReviewEngine'
import { buildProductPriceHistory } from '../../utils/productPriceHistoryEngine'
import { formatPurchaseDashboardResponse, formatLatestPriceChangesResponse, formatInvoiceComparisonResponse, formatLowStockResponse, formatOrderRecommendationResponse, formatInvoicesNeedingReviewResponse, formatProductPriceHistoryResponse } from '../../utils/assistantResponseFormatter'
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

export default function AssistantChat() {
  const { workspaceId } = useWorkspace()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text) {
    if (isLoading) return
    const trimmed = text.trim()
    if (!trimmed) return

    const userMsg = { id: nextId(), role: 'user', text: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')

    const parsed = parseAssistantIntent(trimmed)

    if (parsed.intent === 'purchase_dashboard') {
      await handlePurchaseDashboard()
    } else if (parsed.intent === 'latest_price_changes') {
      await handleLatestPriceChanges()
    } else if (parsed.intent === 'compare_invoices') {
      await handleCompareInvoices()
    } else if (parsed.intent === 'low_stock') {
      await handleLowStock()
    } else if (parsed.intent === 'order_recommendation') {
      await handleOrderRecommendation()
    } else if (parsed.intent === 'invoices_needing_review') {
      await handleInvoicesNeedingReview()
    } else if (parsed.intent === 'product_price_history') {
      await handleProductPriceHistory(parsed.entities?.productQuery ?? null)
    } else {
      const responseText = getAssistantResponse(parsed)
      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', text: responseText, intent: parsed.intent }])
    }

    textareaRef.current?.focus()
  }

  async function handlePurchaseDashboard() {
    const loadingId = nextId()
    setIsLoading(true)
    setMessages(prev => [...prev, { id: loadingId, role: 'assistant', text: '', loading: true, intent: 'purchase_dashboard' }])

    try {
      if (!workspaceId) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: 'Nie mogę wykonać analizy, bo nie wykryłem aktywnego workspace.' }
            : m
        ))
        return
      }

      const rawData = await fetchAssistantPurchaseDashboardData({ workspaceId })

      if (rawData.errors.length > 0) {
        const errMsg = rawData.errors.join(' ')
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: `Błąd pobierania danych: ${errMsg}` }
            : m
        ))
        return
      }

      if (!rawData.invoices.length) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: 'Nie znalazłem faktur zakupowych z ostatnich 30 dni dla tego workspace.' }
            : m
        ))
        return
      }

      const dashboard = buildPurchaseDashboard(rawData)
      const responseText = formatPurchaseDashboardResponse(dashboard)

      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: responseText, structuredData: dashboard }
          : m
      ))
    } catch (err) {
      console.error('AssistantChat handlePurchaseDashboard:', err)
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: `Wystąpił błąd podczas pobierania danych. Spróbuj ponownie za chwilę.` }
          : m
      ))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLatestPriceChanges() {
    const loadingId = nextId()
    setIsLoading(true)
    setMessages(prev => [...prev, { id: loadingId, role: 'assistant', text: '', loading: true, intent: 'latest_price_changes' }])

    try {
      if (!workspaceId) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: 'Nie mogę wykonać analizy, bo nie wykryłem aktywnego workspace.' }
            : m
        ))
        return
      }

      const rawData = await fetchAssistantPriceChangesData({ workspaceId })

      if (rawData.errors.length > 0) {
        const errMsg = rawData.errors.join(' ')
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: `Błąd pobierania danych: ${errMsg}` }
            : m
        ))
        return
      }

      if (!rawData.invoices.length) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: 'Nie znalazłem faktur zakupowych z ostatnich 180 dni dla tego workspace.' }
            : m
        ))
        return
      }

      const priceChanges = buildLatestPriceChanges(rawData)
      const responseText = formatLatestPriceChangesResponse(priceChanges)

      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: responseText, structuredData: priceChanges }
          : m
      ))
    } catch (err) {
      console.error('AssistantChat handleLatestPriceChanges:', err)
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: 'Wystąpił błąd podczas pobierania danych. Spróbuj ponownie za chwilę.' }
          : m
      ))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCompareInvoices() {
    const loadingId = nextId()
    setIsLoading(true)
    setMessages(prev => [...prev, { id: loadingId, role: 'assistant', text: '', loading: true, intent: 'compare_invoices' }])

    try {
      if (!workspaceId) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: 'Nie mogę wykonać porównania, bo nie wykryłem aktywnego workspace.' }
            : m
        ))
        return
      }

      const rawData = await fetchAssistantInvoiceComparisonData({ workspaceId })

      if (rawData.errors.length > 0) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: `Błąd pobierania danych: ${rawData.errors.join(' ')}` }
            : m
        ))
        return
      }

      if (!rawData.invoiceA || !rawData.invoiceB) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: 'Nie mam jeszcze dwóch faktur zakupowych do porównania w tym workspace.' }
            : m
        ))
        return
      }

      const comparison = compareInvoices(rawData)
      const responseText = formatInvoiceComparisonResponse(comparison)

      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: responseText, structuredData: comparison }
          : m
      ))
    } catch (err) {
      console.error('AssistantChat handleCompareInvoices:', err)
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: 'Wystąpił błąd podczas pobierania danych. Spróbuj ponownie za chwilę.' }
          : m
      ))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLowStock() {
    const loadingId = nextId()
    setIsLoading(true)
    setMessages(prev => [...prev, { id: loadingId, role: 'assistant', text: '', loading: true, intent: 'low_stock' }])

    try {
      if (!workspaceId) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: 'Nie mogę wykonać analizy stanów, bo nie wykryłem aktywnego workspace.' }
            : m
        ))
        return
      }

      const rawData = await fetchAssistantLowStockData({ workspaceId })

      if (rawData.errors.length > 0) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: `Błąd pobierania danych: ${rawData.errors.join(' ')}` }
            : m
        ))
        return
      }

      if (!rawData.products.length) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: 'Nie znalazłem aktywnych towarów w tym workspace.' }
            : m
        ))
        return
      }

      const analysis = buildLowStockAnalysis(rawData)
      const responseText = formatLowStockResponse(analysis)

      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: responseText, structuredData: analysis }
          : m
      ))
    } catch (err) {
      console.error('AssistantChat handleLowStock:', err)
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: 'Wystąpił błąd podczas pobierania danych. Spróbuj ponownie za chwilę.' }
          : m
      ))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleOrderRecommendation() {
    const loadingId = nextId()
    setIsLoading(true)
    setMessages(prev => [...prev, { id: loadingId, role: 'assistant', text: '', loading: true, intent: 'order_recommendation' }])

    try {
      if (!workspaceId) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: 'Nie mogę wykonać analizy, bo nie wykryłem aktywnego workspace.' }
            : m
        ))
        return
      }

      const rawData = await fetchAssistantOrderRecommendationData({ workspaceId })

      if (rawData.errors.length > 0) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: `Błąd pobierania danych: ${rawData.errors.join(' ')}` }
            : m
        ))
        return
      }

      if (!rawData.products.length) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: 'Nie znalazłem aktywnych towarów w tym workspace.' }
            : m
        ))
        return
      }

      const recommendations = buildOrderRecommendations(rawData)
      const responseText = formatOrderRecommendationResponse(recommendations)

      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: responseText, structuredData: recommendations }
          : m
      ))
    } catch (err) {
      console.error('AssistantChat handleOrderRecommendation:', err)
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: 'Wystąpił błąd podczas pobierania danych. Spróbuj ponownie za chwilę.' }
          : m
      ))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleProductPriceHistory(productQuery) {
    const loadingId = nextId()
    setIsLoading(true)
    setMessages(prev => [...prev, { id: loadingId, role: 'assistant', text: '', loading: true, intent: 'product_price_history' }])

    try {
      if (!workspaceId) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: 'Nie mogę sprawdzić historii ceny, bo nie wykryłem aktywnego workspace.' }
            : m
        ))
        return
      }

      if (!productQuery) {
        const noQuery = buildProductPriceHistory({ productQuery: null })
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: noQuery.summaryText, structuredData: noQuery }
            : m
        ))
        return
      }

      const rawData = await fetchAssistantProductPriceHistoryData({ workspaceId, productQuery })

      if (rawData.errors.length > 0) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: `Błąd pobierania danych: ${rawData.errors.join(' ')}` }
            : m
        ))
        return
      }

      const history = buildProductPriceHistory(rawData)
      const responseText = formatProductPriceHistoryResponse(history)

      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: responseText, structuredData: history }
          : m
      ))
    } catch (err) {
      console.error('AssistantChat handleProductPriceHistory:', err)
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: 'Wystąpił błąd podczas pobierania danych. Spróbuj ponownie za chwilę.' }
          : m
      ))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleInvoicesNeedingReview() {
    const loadingId = nextId()
    setIsLoading(true)
    setMessages(prev => [...prev, { id: loadingId, role: 'assistant', text: '', loading: true, intent: 'invoices_needing_review' }])

    try {
      if (!workspaceId) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: 'Nie mogę sprawdzić faktur, bo nie wykryłem aktywnego workspace.' }
            : m
        ))
        return
      }

      const rawData = await fetchAssistantInvoicesNeedingReviewData({ workspaceId })

      if (rawData.errors.length > 0) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: `Błąd pobierania danych: ${rawData.errors.join(' ')}` }
            : m
        ))
        return
      }

      if (!rawData.invoices.length) {
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { ...m, loading: false, text: 'Nie znalazłem faktur do analizy w tym workspace.' }
            : m
        ))
        return
      }

      const review = buildInvoicesNeedingReview(rawData)
      const responseText = formatInvoicesNeedingReviewResponse(review)

      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: responseText, structuredData: review }
          : m
      ))
    } catch (err) {
      console.error('AssistantChat handleInvoicesNeedingReview:', err)
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, text: 'Wystąpił błąd podczas pobierania danych. Spróbuj ponownie za chwilę.' }
          : m
      ))
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
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
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
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
            onClick={() => sendMessage(prompt)}
            disabled={isLoading}
            className="text-xs rounded-lg px-3 py-1.5 font-medium transition-opacity hover:opacity-80 active:opacity-60 disabled:opacity-40"
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
        style={{ minHeight: 80, maxHeight: 520, background: 'var(--bg)' }}
      >
        {messages.length === 0 ? (
          <p className="text-sm text-center my-4" style={{ color: 'var(--muted)' }}>
            Wybierz szybki prompt lub wpisz pytanie poniżej
          </p>
        ) : (
          messages.map(msg =>
            msg.role === 'user' ? (
              <AssistantMessage key={msg.id} role="user" text={msg.text} />
            ) : (
              <div key={msg.id} className="flex gap-2.5">
                <div
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                  style={{ background: 'var(--table-sub)', border: '1px solid var(--border)' }}
                >
                  <MessageCircle size={12} style={{ color: '#3b82f6' }} />
                </div>
                <div
                  className="flex-1 min-w-0 rounded-xl px-3.5 py-2.5"
                  style={{
                    background: 'var(--table-sub)',
                    border: '1px solid var(--border)',
                    borderTopLeftRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  {msg.loading ? (
                    <div className="flex items-center gap-1.5 py-1">
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
                  ) : (
                    <AssistantResult
                      intent={msg.intent}
                      text={msg.text}
                      structuredData={msg.structuredData}
                    />
                  )}
                </div>
              </div>
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
          disabled={isLoading}
          placeholder="Wpisz pytanie… (Enter = wyślij, Shift+Enter = nowa linia)"
          className="flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-60"
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
          disabled={!input.trim() || isLoading}
          className="flex-shrink-0 rounded-lg p-2.5 flex items-center justify-center transition-opacity disabled:opacity-40"
          style={{
            background: input.trim() && !isLoading ? '#3b82f6' : 'var(--table-sub)',
            color: input.trim() && !isLoading ? '#ffffff' : 'var(--muted)',
            border: '1px solid var(--border)',
            minHeight: 38,
            minWidth: 38,
          }}
          title="Wyślij (Enter)"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
