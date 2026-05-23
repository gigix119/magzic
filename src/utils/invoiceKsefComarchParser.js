import { isForbiddenAsInvoiceItem } from './invoiceLineGuards.js'
import { isLikelyInventoryProductName } from './invoiceProductLineHeuristics.js'
import { extractMonetaryCandidates, chooseBestAmountCandidate } from './invoiceAmountRecovery.js'
import { normalizePolishNumber } from './polishInvoicePatterns.js'

const KSEF_DETECTION_SIGNALS = [
  'comarch', 'ksef', 'faktura ustrukturyzowana', 'nr wiersza', 'line number',
  'klucz', 'uwagi', 'remarks', 'powered by comarch', 'plu',
]

const KSEF_METADATA_PHRASES = [
  'uwagi', 'remarks', 'uwagi / remarks', 'nr wiersza', 'line number',
  'klucz', 'key', 'wartość', 'value', 'value line number',
  'powered by comarch', 'ksef', 'faktura ustrukturyzowana',
  'opis pola', 'pole', 'field description',
]

export function isKsefMetadataLine(lineText) {
  if (!lineText) return false
  const lower = lineText.toLowerCase().trim()

  if (KSEF_METADATA_PHRASES.some(p =>
    lower === p ||
    lower.startsWith(p + ' ') ||
    lower.startsWith(p + ':') ||
    lower.startsWith(p + '/')
  )) return true

  // Slash-separated bilingual metadata ≥3 slashes + metadata keyword
  const slashCount = (lower.match(/\//g) || []).length
  if (slashCount >= 3) {
    const metaWords = ['wiersz', 'line', 'klucz', 'key', 'uwagi', 'remarks', 'wartość', 'value', 'opis']
    if (metaWords.some(w => lower.includes(w))) return true
  }

  return false
}

/**
 * Returns true when the document exhibits ≥2 KSeF/Comarch signals.
 */
export function detectKsefComarchDocument(layout, rawText) {
  if (!rawText) return false
  const lower = rawText.toLowerCase()
  let count = 0
  for (const signal of KSEF_DETECTION_SIGNALS) {
    if (lower.includes(signal)) {
      count++
      if (count >= 2) return true
    }
  }
  return false
}

function getAllLayoutLines(layout) {
  if (!layout || !layout.pages) return []
  return layout.pages.flatMap(page =>
    (page.lines || []).map(line => ({
      ...line,
      pageNum: page.pageNum,
      text: line.text || (line.items || []).map(i => i.text || '').join(' '),
    }))
  )
}

/**
 * Search nearby layout lines for numeric values for an item.
 */
export function findNearbyNumericValuesForItem(itemLine, layoutLines) {
  const itemIdx = layoutLines.findIndex(l => l === itemLine || l.text === itemLine.text)
  if (itemIdx === -1) return []

  const searchStart = Math.max(0, itemIdx - 3)
  const searchEnd = Math.min(layoutLines.length - 1, itemIdx + 5)

  const allCandidates = []
  for (let i = searchStart; i <= searchEnd; i++) {
    const line = layoutLines[i]
    const lineText = line.text || ''
    if (isKsefMetadataLine(lineText)) continue
    if (isForbiddenAsInvoiceItem(lineText, {})) continue

    const cands = extractMonetaryCandidates(lineText)
    cands.forEach(c => allCandidates.push({
      ...c,
      lineIdx: i,
      lineText,
      distFromItem: Math.abs(i - itemIdx),
    }))
  }

  return allCandidates.sort((a, b) => a.distFromItem - b.distFromItem)
}

/**
 * Merge product lines with their recovered amounts.
 */
export function mergeKsefProductLinesWithAmounts(productLines) {
  return productLines.map(prodLine => {
    const item = { ...prodLine }
    if (prodLine.candidates && prodLine.candidates.length > 0) {
      const best = chooseBestAmountCandidate(prodLine.candidates)
      if (best) {
        item.cenaNetto = best.value
        item.unitPriceNet = best.value
        item.wartoscNetto = best.value * (item.ilosc || 1)
        item.totalNet = item.wartoscNetto
        item.recoveredAmount = true
        item.warnings = [
          ...(item.warnings || []),
          'Cena odzyskana heurystycznie — sprawdź przed zatwierdzeniem.',
        ]
      }
    }
    return item
  })
}

/**
 * Parse product items from a KSeF/Comarch layout.
 * Skips metadata lines, searches nearby lines for prices.
 */
export function parseKsefComarchItems(layout) {
  const allLines = getAllLayoutLines(layout)
  const productItems = []
  const seenNames = new Set()

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i]
    const lineText = line.text || ''

    if (isKsefMetadataLine(lineText)) continue
    if (isForbiddenAsInvoiceItem(lineText, {})) continue
    if (!isLikelyInventoryProductName(lineText)) continue

    // Deduplicate: skip if a very similar name was already added
    const nameKey = lineText.toLowerCase().trim().slice(0, 30)
    if (seenNames.has(nameKey)) continue
    seenNames.add(nameKey)

    // Same-line candidates
    const sameLine = extractMonetaryCandidates(lineText)
      .map(c => ({ ...c, distFromItem: 0 }))

    // Nearby-line candidates
    const nearby = findNearbyNumericValuesForItem(line, allLines)

    const allCandidates = [...sameLine, ...nearby]
    const best = chooseBestAmountCandidate(allCandidates)

    // Look for quantity + unit in ±2 lines
    let ilosc = 1
    let jednostka = 'szt'
    for (let j = Math.max(0, i - 1); j <= Math.min(allLines.length - 1, i + 2); j++) {
      const nearText = allLines[j].text || ''
      const qtyMatch = nearText.match(/\b(\d+(?:[.,]\d+)?)\s*(szt\.?|opak\.?|kpl\.?|m2|mb|l|kg|ml|g)\b/i)
      if (qtyMatch) {
        const q = normalizePolishNumber(qtyMatch[1])
        if (!isNaN(q) && q > 0 && q < 10000) {
          ilosc = q
          jednostka = qtyMatch[2].toLowerCase().replace(/\.$/, '')
          break
        }
      }
    }

    productItems.push({
      rawName: lineText.trim(),
      nazwa: lineText.trim(),
      ilosc,
      quantity: ilosc,
      jednostka,
      unit: jednostka,
      cenaNetto: best ? best.value : 0,
      unitPriceNet: best ? best.value : 0,
      wartoscNetto: best ? best.value * ilosc : 0,
      totalNet: best ? best.value * ilosc : 0,
      vat: null,
      confidence: best ? 0.5 : 0.3,
      warnings: best
        ? ['Cena odzyskana heurystycznie — sprawdź przed zatwierdzeniem.']
        : ['Nie znaleziono ceny — uzupełnij ręcznie.'],
      recoveredAmount: !!best,
      candidates: allCandidates,
      source: 'ksef_parser',
    })
  }

  return productItems
}
