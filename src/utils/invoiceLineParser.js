import { normalizePolishNumber, normalizeVatRate } from './polishInvoicePatterns.js'

const UNIT_PATTERN = /^(szt\.?|opak\.?|rolka|rolki|rolek|para|pary|par|kpl\.?|litr|litry|l|kg|gram|g|ml|mb|m2|m²|godz\.?|h|op\.?|karton|kartony|puszka|puszki)$/i

export function isUnit(str) {
  return UNIT_PATTERN.test(str.trim())
}

// Map header line items to column X positions
export function detectColumnMap(headerItems) {
  const COLUMN_KEYWORDS = {
    lp:            ['lp', 'l.p.', 'lp.', 'poz', 'poz.', 'no', 'nr'],
    indeks:        ['indeks', 'index', 'sku', 'kod produktu', 'kod towaru', 'kod', 'symbol', 'nr kat', 'nr katalogowy', 'ean'],
    nazwa:         ['nazwa', 'towary', 'towar', 'produkt', 'produkty', 'opis', 'usługa', 'usługi', 'artykuł', 'asortyment'],
    ilosc:         ['ilość', 'ilosc', 'il.', 'il', 'qty', 'liczba', 'zamówiona'],
    jednostka:     ['jm', 'j.m.', 'jm.', 'jednostka', 'j.', 'jedn.'],
    cenaNetto:     ['cena', 'cena netto', 'c.j.', 'cena jedn.', 'cena jedn', 'c.j.n.', 'cena/jm', 'cena jedn'],
    wartoscNetto:  ['wartość netto', 'wartosc netto', 'wart. netto', 'suma netto', 'wartość', 'netto'],
    vat:           ['vat', 'vat%', 'stawka', 'stawka vat', 'staw.', 'staw. vat', 'vat %'],
    wartoscBrutto: ['brutto', 'wartość brutto', 'wartosc brutto', 'wart. brutto', 'kwota brutto'],
  }

  const colMap = {}
  for (const item of headerItems) {
    const text = item.text.toLowerCase().trim().replace(/\s+/g, ' ')
    for (const [colName, keywords] of Object.entries(COLUMN_KEYWORDS)) {
      if (!colMap[colName] && keywords.some(k => text === k || text.startsWith(k + ' '))) {
        colMap[colName] = item.x
      }
    }
  }
  return colMap
}

// Assign text items to columns based on X proximity
function assignToColumn(items, colMap) {
  const result = {}
  const colEntries = Object.entries(colMap).sort((a, b) => a[1] - b[1])
  if (colEntries.length === 0) return result

  for (const item of items) {
    let bestCol = null
    let bestDist = Infinity
    for (const [colName, colX] of colEntries) {
      const distFromLeft = item.x - colX
      if (distFromLeft >= -15) {
        const dist = Math.abs(distFromLeft)
        if (dist < bestDist) {
          bestDist = dist
          bestCol = colName
        }
      }
    }
    if (bestCol) {
      result[bestCol] = result[bestCol] ? result[bestCol] + ' ' + item.text : item.text
    }
  }
  return result
}

// Detect and fix qty+price concatenation in the cenaNetto column assignment.
//
// Root cause: assignToColumn uses a -15px left-tolerance so that right-aligned
// numeric tokens (e.g. qty "1" right-justified in the "Ilość" column) sometimes
// fall within the next column's (cenaNetto) range and are concatenated there:
//   "1" + " " + "249,00" → "1 249,00"
// normalizePolishNumber then treats this as a thousands number (1249) or removes
// the space via the comma-only path ("6 29,99" → 629.99).
//
// Fix: if cenaNetto has exactly two whitespace tokens and the arithmetic
// possibleQty × possibleCena ≈ wartoscNetto validates, split them back.
function splitMergedCenaIlosc(assigned) {
  const cenaRaw = (assigned.cenaNetto || '').trim()
  if (!cenaRaw) return assigned

  const tokens = cenaRaw.split(/\s+/).filter(Boolean)
  if (tokens.length !== 2) return assigned

  // First token must be a plain positive integer (quantity candidate, 1–9999)
  if (!/^\d{1,4}$/.test(tokens[0])) return assigned

  const possibleQty = parseInt(tokens[0], 10)
  const possibleCena = normalizePolishNumber(tokens[1])
  if (isNaN(possibleCena) || possibleCena <= 0 || possibleQty <= 0) return assigned

  // Arithmetic gate: only accept the split when possibleQty * possibleCena ≈ wartoscNetto
  const wartoscNettoRaw = (assigned.wartoscNetto || '').trim()
  if (!wartoscNettoRaw) return assigned

  const wartoscNetto = normalizePolishNumber(wartoscNettoRaw)
  if (isNaN(wartoscNetto) || wartoscNetto <= 0) return assigned

  const expectedTotal = Math.round(possibleQty * possibleCena * 100) / 100
  const tolerance = Math.max(0.05, wartoscNetto * 0.015) // 1.5% or 5 groszy
  if (Math.abs(expectedTotal - wartoscNetto) > tolerance) return assigned

  // Confirmed concatenation — restore the individual price field.
  // Preserve existing ilosc if it was explicitly assigned (non-trivial value).
  const hasExplicitIlosc = assigned.ilosc && assigned.ilosc !== '' && assigned.ilosc !== '1'
  return {
    ...assigned,
    cenaNetto: tokens[1],
    ilosc: hasExplicitIlosc ? assigned.ilosc : tokens[0],
  }
}

// Parse a single invoice line using known column positions
export function parseInvoiceLineData(items, colMap) {
  if (Object.keys(colMap).length < 2) {
    return parseLineHeuristic(items)
  }

  const rawAssigned = assignToColumn(items, colMap)
  const assigned = splitMergedCenaIlosc(rawAssigned)
  const nazwa = (assigned.nazwa || '').trim()
  if (!nazwa || nazwa.length < 2) return null

  // Skip lines that look like totals/summaries
  const namesLower = nazwa.toLowerCase()
  if (['razem', 'suma', 'ogółem', 'łącznie', 'do zapłaty'].some(k => namesLower.startsWith(k))) return null

  const ilosRaw = assigned.ilosc || '1'
  const ilosc = normalizePolishNumber(ilosRaw)
  const jednostka = (assigned.jednostka || 'szt').trim().toLowerCase().replace(/\.$/, '')
  const cenaNetto = normalizePolishNumber(assigned.cenaNetto || '0')
  const wartoscNettoRaw = assigned.wartoscNetto
  const wartoscNetto = wartoscNettoRaw
    ? normalizePolishNumber(wartoscNettoRaw)
    : (isNaN(ilosc) ? 0 : ilosc) * (isNaN(cenaNetto) ? 0 : cenaNetto)

  const vatRaw = (assigned.vat || '').replace('%', '').trim()
  const vat = normalizeVatRate(vatRaw) ?? 23

  const safeIlosc = isNaN(ilosc) ? 1 : ilosc
  const safeCena = isNaN(cenaNetto) ? 0 : cenaNetto

  if (safeCena <= 0 && isNaN(normalizePolishNumber(assigned.wartoscNetto))) return null

  const indeks = (assigned.indeks || '').trim() || null

  return {
    lp: parseInt(assigned.lp) || null,
    indeks,
    sku: indeks,
    nazwa,
    ilosc: safeIlosc,
    jednostka: jednostka || 'szt',
    cenaNetto: safeCena,
    wartoscNetto: isNaN(wartoscNetto) ? safeIlosc * safeCena : wartoscNetto,
    vat,
    confidence: Object.keys(colMap).length >= 4 ? 0.85 : 0.65,
  }
}

// Fallback: parse line without column map using heuristics
function parseLineHeuristic(items) {
  const texts = items.map(i => i.text.trim()).filter(Boolean)
  if (texts.length < 2) return null

  const lineStr = texts.join(' ')
  if (lineStr.length < 5) return null

  // Collect numeric values from the line
  const numbers = []
  for (const t of texts) {
    const n = normalizePolishNumber(t)
    if (!isNaN(n) && n > 0) numbers.push({ val: n, text: t })
  }
  if (numbers.length < 1) return null

  // Find unit token
  const unitToken = texts.find(t => isUnit(t))

  // Name = all non-numeric, non-unit tokens joined
  const nonNumeric = texts.filter(t => {
    if (isUnit(t)) return false
    const n = normalizePolishNumber(t)
    return isNaN(n) || n <= 0
  })
  const nazwa = nonNumeric.filter(t => t.length > 1 && !/^\d$/.test(t)).join(' ').trim()
  if (!nazwa || nazwa.length < 3) return null

  // Quantity: token immediately before unit, else 1
  let ilosc = 1
  if (unitToken) {
    const ui = texts.indexOf(unitToken)
    if (ui > 0) {
      const n = normalizePolishNumber(texts[ui - 1])
      if (!isNaN(n) && n > 0) ilosc = n
    }
  }

  // Price: second-to-last number (typically unit price), fallback to last
  let cenaNetto = 0
  if (numbers.length >= 2) {
    cenaNetto = numbers[numbers.length - 2].val
  } else if (numbers.length === 1) {
    cenaNetto = numbers[0].val
  }

  if (cenaNetto <= 0) return null

  return {
    lp: null,
    nazwa,
    ilosc,
    jednostka: unitToken?.toLowerCase().replace(/\.$/, '') || 'szt',
    cenaNetto,
    wartoscNetto: ilosc * cenaNetto,
    vat: 23,
    confidence: 0.45,
  }
}
