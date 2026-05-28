export async function copyTextToClipboard(text) {
  if (!text) return { ok: false, error: 'Brak tekstu do skopiowania' }

  if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return { ok: true }
    } catch {
      // fall through to textarea fallback
    }
  }

  try {
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok ? { ok: true } : { ok: false, error: 'execCommand copy failed' }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
