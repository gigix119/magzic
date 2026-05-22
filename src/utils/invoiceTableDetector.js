// Improved table detection: multiple candidates, column boundary midpoints, diacritics normalization

function normHeader(text) {
  return String(text)
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, c => ({ ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z' })[c] || c)
    .replace(/[.\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const COL_KEYWORDS = {
  LP:             ['lp', 'l p', 'poz', 'poz ', 'nr', '#'],
  NAZWA:          ['nazwa', 'nazwa towaru', 'nazwa uslugi', 'towar', 'produkt',
                   'opis', 'asortyment', 'towar uslugi', 'nazwa opis',
                   'nazwa towaru uslugi', 'towar lub usluga'],
  ILOSC:          ['ilosc', 'qty', 'quantity', 'liczba', 'il ', 'il'],
  JEDNOSTKA:      ['jm', 'j m', 'jednostka', 'miara', 'jedn', 'unit'],
  CENA_NETTO:     ['cena', 'cena j', 'cena jedn', 'cena jednostkowa',
                   'cena netto', 'cena netto j', 'cena jedn netto'],
  WARTOSC_NETTO:  ['wartosc netto', 'netto', 'razem netto', 'kwota netto', 'wart netto'],
  VAT:            ['vat', 'stawka vat', 'vat ', 'podatek', 'staw vat', 'staw'],
  KWOTA_VAT:      ['kwota vat', 'wartosc vat', 'podatek vat', 'wart vat'],
  WARTOSC_BRUTTO: ['wartosc brutto', 'brutto', 'razem brutto', 'kwota brutto', 'wart brutto'],
  CENA_BRUTTO:    ['cena brutto', 'cena brutto j', 'cena jedn brutto'],
}

function getLineText(line) {
  if (typeof line.text === 'string') return line.text
  if (Array.isArray(line.items)) return line.items.map(i => i.text || i.str || '').join(' ')
  return ''
}

export function detectTableHeader(line) {
  const text = normHeader(getLineText(line))
  let matchCount = 0
  const found = {}

  for (const [col, keywords] of Object.entries(COL_KEYWORDS)) {
    for (const kw of keywords) {
      const nkw = normHeader(kw)
      if (text === nkw || text.includes(' ' + nkw + ' ') ||
          text.startsWith(nkw + ' ') || text.endsWith(' ' + nkw) || text === nkw) {
        matchCount++
        found[col] = true
        break
      }
    }
  }

  return { isHeader: matchCount >= 2, score: matchCount, foundColumns: found }
}

export function detectColumnBoundaries(items) {
  const map = {}

  for (const item of (items || [])) {
    const normalized = normHeader(item.text || item.str || '')
    for (const [col, keywords] of Object.entries(COL_KEYWORDS)) {
      if (map[col]) continue
      for (const kw of keywords) {
        if (normalized === normHeader(kw) || normalized.includes(normHeader(kw))) {
          map[col] = { x: item.x, text: item.text || item.str }
          break
        }
      }
    }
  }

  // Right boundary = midpoint between adjacent columns
  const sorted = Object.entries(map).sort((a, b) => a[1].x - b[1].x)
  const boundaries = {}
  for (let i = 0; i < sorted.length; i++) {
    const [col, { x }] = sorted[i]
    const nextX = sorted[i + 1]?.[1].x ?? Infinity
    boundaries[col] = { x, rightBound: nextX === Infinity ? Infinity : (x + nextX) / 2 }
  }

  return boundaries
}

function isTableEnd(text) {
  const t = normHeader(text)
  return /^(razem|suma|do zaplaty|lacznie|podsumowanie|zaplacono|pozostalo|slownie)/.test(t)
}

function isProbablyProductLine(line) {
  const text = getLineText(line)
  if (!text || text.trim().length < 3) return false
  if (isTableEnd(text)) return false
  if (/^\s*\d{1,3}\s*$/.test(text)) return false  // lone LP number
  return /\d/.test(text)
}

export function findTableCandidates(layout) {
  const candidates = []

  for (const page of layout.pages) {
    const lines = page.lines || []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Ensure .text exists on line
      if (!line.text) line.text = getLineText(line)

      const headerResult = detectTableHeader(line)
      if (!headerResult.isHeader) continue

      const columnMap = detectColumnBoundaries(line.items || [])
      const rows = []

      for (let j = i + 1; j < lines.length; j++) {
        const row = lines[j]
        if (!row.text) row.text = getLineText(row)
        if (isTableEnd(row.text)) break
        // Skip repeated headers (score ≥ 3 means it's another header row)
        if (detectTableHeader(row).score >= 3) continue
        if (isProbablyProductLine(row)) rows.push(row)
      }

      candidates.push({
        pageNum: page.pageNum,
        headerLineIndex: i,
        headerLine: line,
        rows,
        headerScore: headerResult.score,
        foundColumns: headerResult.foundColumns,
        rowCount: rows.length,
        columnMap,
      })
    }
  }

  return candidates
}

export function chooseBestTableCandidate(candidates) {
  if (!candidates.length) return null
  return candidates.reduce((best, c) => {
    const score = c.headerScore * 10 + c.rowCount * 2
    const bestScore = best.headerScore * 10 + best.rowCount * 2
    return score > bestScore ? c : best
  })
}
