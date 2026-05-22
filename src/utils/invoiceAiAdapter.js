// Safe AI adapter — NEVER imports or uses any AI API key.
// Frontend only knows about VITE_INVOICE_AI_ENDPOINT (a public URL, no secret).
// The actual AI key lives server-side only (Cloudflare Worker / Supabase Edge Function).

export function isInvoiceAiAvailable() {
  const endpoint = import.meta.env.VITE_INVOICE_AI_ENDPOINT
  return !!(endpoint && typeof endpoint === 'string' && endpoint.trim().startsWith('http'))
}

export function getInvoiceAiEndpoint() {
  return import.meta.env.VITE_INVOICE_AI_ENDPOINT || null
}

// Calls server-side AI endpoint with sanitized invoice data.
// Returns { available: true, result: {...} } or { available: false, reason: '...' }.
// Never sends API keys — those are handled server-side.
export async function analyzeInvoiceWithAi(input) {
  if (!isInvoiceAiAvailable()) {
    return { available: false, reason: 'AI backend not configured (VITE_INVOICE_AI_ENDPOINT missing)' }
  }

  const endpoint = getInvoiceAiEndpoint()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return {
        available: false,
        reason: `AI backend returned HTTP ${response.status}${body ? ': ' + body.slice(0, 100) : ''}`,
      }
    }

    const result = await response.json()
    return { available: true, result }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { available: false, reason: 'AI backend timeout (>30s)' }
    }
    return { available: false, reason: `AI backend unreachable: ${err.message}` }
  }
}
