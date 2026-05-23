import { normalizePolishNumber } from './polishInvoicePatterns.js'

// Patterns that mark a number as non-price
const NON_PRICE_CONTEXT_PATTERNS = [
  /\b(nip|regon|krs|pesel|iban|konto|rachunek)\b/i,
  /\b(numer\s+faktury|nr\s+faktury|faktura\s+nr)\b/i,
  /\b(ksef|ustrukturyzowana)\b/i,
]

function looksLikeYear(val) {
  return Number.isInteger(val) && val >= 2000 && val <= 2100
}

function looksLikeLp(val) {
  return Number.isInteger(val) && val >= 1 && val <= 999 && val === Math.round(val)
}

function looksLikeNip(raw) {
  const digits = String(raw).replace(/\D/g, '')
  return digits.length === 10 || digits.length === 11
}

/**
 * Extract monetary-looking values from a single text string.
 * Returns [{raw, value, position}]
 */
export function extractMonetaryCandidates(line) {
  if (!line) return []
  const candidates = []

  // Matches Polish price formats:
  //   1 234,56  |  1234,56  |  1234.56  |  1.234,56  |  7,-  |  699,99
  const moneyRe = /\b(\d{1,3}(?:\s\d{3})*(?:[.,]\d{1,2})?|\d+[.,]\d{2}|\d+,-)\b/g
  let m
  while ((m = moneyRe.exec(line)) !== null) {
    const raw = m[1].trim()
    if (!raw) continue
    const val = normalizePolishNumber(raw)
    if (isNaN(val) || val <= 0) continue
    if (val > 1_000_000) continue     // unreasonably large
    if (looksLikeYear(val)) continue
    if (looksLikeNip(raw)) continue

    candidates.push({ raw, value: val, position: m.index })
  }

  return candidates
}

/**
 * Choose the best price candidate from a list.
 * Prefers values with decimal part; among those prefers larger (total > unit),
 * but for recovery we want unit price so we take the smaller decimal value.
 */
export function chooseBestAmountCandidate(candidates) {
  if (!candidates || candidates.length === 0) return null

  // Filter non-prices
  const filtered = candidates.filter(c => {
    if (!c || c.value <= 0) return false
    if (c.value > 500_000) return false
    if (looksLikeYear(c.value)) return false
    // If context line has NIP/IBAN keywords, be suspicious of integers
    const lineCtx = c.lineText || ''
    if (NON_PRICE_CONTEXT_PATTERNS.some(p => p.test(lineCtx)) && looksLikeLp(c.value)) return false
    return true
  })

  if (filtered.length === 0) return null

  // Prefer values with non-zero decimal part (proper price format)
  const withDecimals = filtered.filter(c => !Number.isInteger(c.value))
  if (withDecimals.length > 0) {
    // Prefer closest to item line, then smallest (unit price < total)
    withDecimals.sort((a, b) => {
      const distDiff = (a.distFromItem ?? 99) - (b.distFromItem ?? 99)
      if (distDiff !== 0) return distDiff
      return a.value - b.value  // prefer smaller (unit price)
    })
    return withDecimals[0]
  }

  // All integers — reasonable price range
  const inRange = filtered.filter(c => c.value >= 1 && c.value <= 50_000 && !looksLikeLp(c.value))
  if (inRange.length > 0) return inRange[0]

  return filtered[0]
}

/**
 * Try to recover a price for an item from nearby layout lines.
 * Returns { recoveredValue, recoverySource, recoveryMethod, warning } or null.
 */
export function recoverAmountsForItem(item, layoutLines) {
  if (!layoutLines || layoutLines.length === 0) return null

  const itemName = (item.rawName || item.nazwa || '').toLowerCase().trim()
  if (!itemName || itemName.length < 3) return null

  // Find the line that contains this item's name
  const searchKey = itemName.slice(0, Math.min(itemName.length, 25))
  let itemLineIdx = -1
  for (let i = 0; i < layoutLines.length; i++) {
    const lt = (layoutLines[i].text || '').toLowerCase()
    if (lt.includes(searchKey)) { itemLineIdx = i; break }
  }
  if (itemLineIdx === -1) return null

  const searchStart = Math.max(0, itemLineIdx - 3)
  const searchEnd = Math.min(layoutLines.length - 1, itemLineIdx + 5)

  const allCandidates = []
  for (let i = searchStart; i <= searchEnd; i++) {
    const lineText = layoutLines[i].text || ''
    // Skip context lines that are obviously NIP/IBAN/date lines
    if (NON_PRICE_CONTEXT_PATTERNS.some(p => p.test(lineText))) continue

    const cands = extractMonetaryCandidates(lineText)
    cands.forEach(c => allCandidates.push({
      ...c,
      lineIdx: i,
      lineText,
      distFromItem: Math.abs(i - itemLineIdx),
    }))
  }

  const best = chooseBestAmountCandidate(allCandidates)
  if (!best || best.value <= 0) return null

  return {
    recoveredValue: best.value,
    recoverySource: best.lineText,
    recoveryMethod: 'nearby_lines',
    warning: 'Cena odzyskana heurystycznie — sprawdź przed zatwierdzeniem.',
  }
}

/**
 * Given an item and found amount candidates, infer unitPrice and total.
 */
export function inferQuantityUnitPriceTotal(item, amountCandidates) {
  if (!amountCandidates || amountCandidates.length === 0) return {}
  const values = amountCandidates.map(c => c.value).sort((a, b) => a - b)
  const qty = item.ilosc || item.quantity || 1

  if (values.length === 1) {
    return { cenaNetto: values[0], wartoscNetto: values[0] * qty, ambiguous: true }
  }

  // If val[i] * qty ≈ val[j], then val[i]=unitPrice, val[j]=total
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (values[j] > 0 && Math.abs(values[i] * qty - values[j]) / values[j] < 0.05) {
        return { cenaNetto: values[i], wartoscNetto: values[j] }
      }
    }
  }

  return { cenaNetto: values[0], wartoscNetto: values[values.length - 1], ambiguous: true }
}
