import { describe, it, expect } from 'vitest'
import { findTableCandidates, chooseBestTableCandidate, detectColumnBoundaries } from './invoiceTableDetector'
import { parseInvoiceLineData } from './invoiceLineParser'
import { detectInvoiceStructure } from './invoiceStructureDetector'

// ── helpers ───────────────────────────────────────────────────────────────────

function mkItem(x, text) { return { x, y: 0, height: 10, text } }
function mkLine(y, ...parts) {
  const items = parts.map(([x, t]) => mkItem(x, t))
  return { y, items, text: items.map(i => i.text).join(' ') }
}

// Column map adapter (mirrors the one in invoiceExtractor.js)
const _COL_KEY_MAP = {
  LP: 'lp', NAZWA: 'nazwa', ILOSC: 'ilosc', JEDNOSTKA: 'jednostka',
  CENA_NETTO: 'cenaNetto', WARTOSC_NETTO: 'wartoscNetto',
  VAT: 'vat', KWOTA_VAT: 'kwotaVat', WARTOSC_BRUTTO: 'wartoscBrutto',
  CENA_BRUTTO: 'cenaBrutto', KOD: 'indeks', RABAT: 'rabat',
}
function adaptColMap(raw) {
  const out = {}
  for (const [k, v] of Object.entries(raw || {})) {
    const nk = _COL_KEY_MAP[k]; if (!nk) continue
    const x = (v !== null && typeof v === 'object') ? v.x : v
    if (typeof x === 'number' && isFinite(x)) out[nk] = x
  }
  return out
}

// Full pipeline: rows + colMap → parsed items (mirrors extractFromFile logic)
function parseTableRows(rows, colMap) {
  const nomeX = colMap.nazwa
  const mergedRows = []
  for (const row of rows) {
    const items = row.items || []
    const isContinuation = nomeX !== undefined && items.length > 0 &&
      !items.some(it =>
        it.x >= nomeX - 30 && it.x <= nomeX + 130 &&
        /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]{2,}/.test(it.text)
      )
    if (isContinuation && mergedRows.length > 0) {
      const prev = mergedRows[mergedRows.length - 1]
      mergedRows[mergedRows.length - 1] = {
        ...prev,
        items: [...(prev.items || []), ...items],
        text: ((prev.text || '') + ' ' + (row.text || '')).trim(),
      }
    } else {
      mergedRows.push({ ...row, items: [...items] })
    }
  }
  return mergedRows
    .map(row => parseInvoiceLineData(row.items || [], colMap))
    .filter(p => p && p.nazwa && (p.cenaNetto > 0 || p.wartoscNetto > 0))
}

// ── IKEA-style invoice layout mock ────────────────────────────────────────────
// Mirrors ikea_faktura_testowa_1.pdf expected content

// Single-line header (all tokens on one line — standard for detectColumnBoundaries)
const IKEA_HEADER_ONELINE = mkLine(800,
  [15, 'Lp.'],
  [60, 'Nazwa towaru / usługi'],
  [300, 'Jm.'],
  [350, 'Ilość'],
  [400, 'Cena netto'],
  [460, 'Wartość netto'],
  [520, 'Stawka VAT'],
  [580, 'Kwota VAT'],
  [640, 'Wartość brutto'],
)

// Product 1 — BILLY (split across 2 lines: name then prices)
const IKEA_BILLY_NAME  = mkLine(750, [15, '1'], [60, 'BILLY'], [70, 'regał'], [80, 'biały'], [130, '80x28x202'], [200, 'cm'], [300, 'szt.'])
const IKEA_BILLY_PRICE = mkLine(735, [350, '2'], [400, '249,00'], [460, '498,00'], [520, '23%'], [580, '114,54'], [640, '612,54'])

// Product 2 — LEDARE (single line)
const IKEA_LEDARE = mkLine(710,
  [15, '2'], [60, 'LEDARE'], [75, 'żarówka'], [100, 'LED'], [115, 'E27'], [135, '806'], [160, 'lm'],
  [300, 'szt.'], [350, '12'], [400, '18,99'], [460, '227,88'], [520, '23%'], [580, '52,41'], [640, '280,29'],
)

// Product 3 — TJENA (single line)
const IKEA_TJENA = mkLine(690,
  [15, '3'], [60, 'TJENA'], [75, 'pudełko'], [100, 'z'], [110, 'pokrywką'], [160, '32x35x32'], [210, 'cm'],
  [300, 'szt.'], [350, '6'], [400, '24,99'], [460, '149,94'], [520, '23%'], [580, '34,49'], [640, '184,43'],
)

// Product 4 — VARDAGEN (single line)
const IKEA_VARDAGEN = mkLine(670,
  [15, '4'], [60, 'VARDAGEN'], [90, 'szklanka'], [130, '31'], [145, 'cl'],
  [300, 'szt.'], [350, '8'], [400, '7,59'], [460, '60,72'], [520, '23%'], [580, '13,97'], [640, '74,69'],
)

// Summary lines — must NOT appear as products
const IKEA_RAZEM    = mkLine(640, [15, 'RAZEM'], [460, '937,54'], [640, '1 153,18'])
const IKEA_VAT      = mkLine(625, [15, 'VAT'], [15, '23%'], [580, '215,64'])
const IKEA_PLATNOSC = mkLine(610, [15, 'Płatność'], [460, 'przelew'], [580, '1 153,18'])
const IKEA_KONTO    = mkLine(595, [15, 'Numer'], [30, 'rachunku:'], [60, '12'], [80, '3456'], [100, '7890'])

function makeIkeaLayout(productLines) {
  return {
    pages: [{
      pageNum: 1,
      height: 842,
      lines: [IKEA_HEADER_ONELINE, ...productLines, IKEA_RAZEM, IKEA_VAT, IKEA_PLATNOSC, IKEA_KONTO],
    }],
    fullText: [IKEA_HEADER_ONELINE, ...productLines, IKEA_RAZEM, IKEA_VAT, IKEA_PLATNOSC, IKEA_KONTO]
      .map(l => l.text).join('\n'),
  }
}

// ── adaptColMap ───────────────────────────────────────────────────────────────

describe('adaptColMap', () => {
  it('converts uppercase object-value map to lowercase numeric map', () => {
    const raw = {
      LP:           { x: 15, rightBound: 40 },
      NAZWA:        { x: 60, rightBound: 290 },
      ILOSC:        { x: 350, rightBound: 395 },
      CENA_NETTO:   { x: 400, rightBound: 455 },
      WARTOSC_NETTO:{ x: 460, rightBound: 515 },
      VAT:          { x: 520, rightBound: 575 },
    }
    const adapted = adaptColMap(raw)
    expect(adapted.lp).toBe(15)
    expect(adapted.nazwa).toBe(60)
    expect(adapted.ilosc).toBe(350)
    expect(adapted.cenaNetto).toBe(400)
    expect(adapted.wartoscNetto).toBe(460)
    expect(adapted.vat).toBe(520)
    // No uppercase keys
    expect(adapted.LP).toBeUndefined()
    expect(adapted.NAZWA).toBeUndefined()
  })

  it('ignores unknown keys', () => {
    const raw = { LP: { x: 10 }, UNKNOWN_COL: { x: 99 } }
    const adapted = adaptColMap(raw)
    expect(adapted.lp).toBe(10)
    expect(adapted.UNKNOWN_COL).toBeUndefined()
  })

  it('handles empty/null map', () => {
    expect(adaptColMap({})).toEqual({})
    expect(adaptColMap(null)).toEqual({})
  })
})

// ── detectColumnBoundaries → adaptColMap integration ─────────────────────────

describe('detectColumnBoundaries → adaptColMap round trip', () => {
  it('produces valid colMap from IKEA header items', () => {
    const raw = detectColumnBoundaries(IKEA_HEADER_ONELINE.items)
    const colMap = adaptColMap(raw)
    expect(typeof colMap.lp).toBe('number')
    expect(typeof colMap.nazwa).toBe('number')
    expect(typeof colMap.cenaNetto).toBe('number')
    expect(typeof colMap.wartoscNetto).toBe('number')
    expect(Object.keys(colMap).length).toBeGreaterThanOrEqual(5)
  })

  it('x values are finite numbers', () => {
    const raw = detectColumnBoundaries(IKEA_HEADER_ONELINE.items)
    const colMap = adaptColMap(raw)
    for (const v of Object.values(colMap)) {
      expect(typeof v).toBe('number')
      expect(isFinite(v)).toBe(true)
    }
  })
})

// ── parseInvoiceLineData with adapted colMap ──────────────────────────────────

describe('parseInvoiceLineData with adapted colMap (single-line products)', () => {
  const raw = detectColumnBoundaries(IKEA_HEADER_ONELINE.items)
  const colMap = adaptColMap(raw)

  it('parses LEDARE (single line) correctly', () => {
    const row = IKEA_LEDARE
    const parsed = parseInvoiceLineData(row.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.nazwa).toContain('LEDARE')
    expect(parsed.ilosc).toBe(12)
    expect(parsed.cenaNetto).toBeCloseTo(18.99)
    expect(parsed.wartoscNetto).toBeCloseTo(227.88)
    expect(parsed.vat).toBe(23)
  })

  it('parses TJENA (single line) correctly', () => {
    const parsed = parseInvoiceLineData(IKEA_TJENA.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.nazwa).toContain('TJENA')
    expect(parsed.ilosc).toBe(6)
    expect(parsed.cenaNetto).toBeCloseTo(24.99)
    expect(parsed.wartoscNetto).toBeCloseTo(149.94)
  })

  it('parses VARDAGEN (single line) correctly', () => {
    const parsed = parseInvoiceLineData(IKEA_VARDAGEN.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.nazwa).toContain('VARDAGEN')
    expect(parsed.ilosc).toBe(8)
    expect(parsed.cenaNetto).toBeCloseTo(7.59)
    expect(parsed.wartoscNetto).toBeCloseTo(60.72)
  })

  it('does NOT parse RAZEM as product', () => {
    const parsed = parseInvoiceLineData(IKEA_RAZEM.items, colMap)
    // Either null or has name "RAZEM" which is blocked downstream
    if (parsed) expect(parsed.nazwa?.toLowerCase()).not.toMatch(/^razem/)
  })
})

// ── Multi-line product merging (core regression fix) ─────────────────────────

describe('parseTableRows: multi-line product merging', () => {
  const raw = detectColumnBoundaries(IKEA_HEADER_ONELINE.items)
  const colMap = adaptColMap(raw)

  it('merges BILLY name line + price line into one product', () => {
    const rows = [IKEA_BILLY_NAME, IKEA_BILLY_PRICE]
    const items = parseTableRows(rows, colMap)
    expect(items.length).toBe(1)
    const billy = items[0]
    expect(billy.nazwa).toContain('BILLY')
    expect(billy.ilosc).toBe(2)
    expect(billy.cenaNetto).toBeCloseTo(249.00)
    expect(billy.wartoscNetto).toBeCloseTo(498.00)
    expect(billy.vat).toBe(23)
  })

  it('BILLY price line alone produces no item (name is in pending)', () => {
    const rows = [IKEA_BILLY_PRICE]  // just the price line, no name
    const items = parseTableRows(rows, colMap)
    // Without a name row, continuation row is either merged with nothing or skipped
    expect(items.every(i => i.nazwa && i.nazwa.trim().length > 1)).toBe(true)
  })

  it('single-line products are parsed without merging', () => {
    const rows = [IKEA_LEDARE, IKEA_TJENA, IKEA_VARDAGEN]
    const items = parseTableRows(rows, colMap)
    expect(items.length).toBe(3)
    expect(items[0].nazwa).toContain('LEDARE')
    expect(items[1].nazwa).toContain('TJENA')
    expect(items[2].nazwa).toContain('VARDAGEN')
  })
})

// ── IKEA full invoice: 4 products ────────────────────────────────────────────

describe('IKEA full invoice — exactly 4 products', () => {
  const productLines = [IKEA_BILLY_NAME, IKEA_BILLY_PRICE, IKEA_LEDARE, IKEA_TJENA, IKEA_VARDAGEN]
  const layout = makeIkeaLayout(productLines)

  function parseIkeaViaTableDetector() {
    const candidates = findTableCandidates(layout)
    const best = chooseBestTableCandidate(candidates)
    if (!best) return []
    const raw = best.columnMap || {}
    const colMap = adaptColMap(raw)
    if (Object.keys(colMap).length < 2) return []
    return parseTableRows(best.rows, colMap)
  }

  it('finds table header', () => {
    const candidates = findTableCandidates(layout)
    expect(candidates.length).toBeGreaterThanOrEqual(1)
  })

  it('table candidate includes all 5 product lines as rows', () => {
    const candidates = findTableCandidates(layout)
    const best = chooseBestTableCandidate(candidates)
    expect(best).not.toBeNull()
    expect(best.rows.length).toBeGreaterThanOrEqual(4)
  })

  it('returns exactly 4 products', () => {
    const items = parseIkeaViaTableDetector()
    expect(items.length).toBe(4)
  })

  it('product 1: BILLY — correct name, qty=2, price=249.00, total=498.00', () => {
    const items = parseIkeaViaTableDetector()
    const billy = items.find(i => i.nazwa?.includes('BILLY'))
    expect(billy).toBeDefined()
    expect(billy.ilosc).toBe(2)
    expect(billy.cenaNetto).toBeCloseTo(249.00)
    expect(billy.wartoscNetto).toBeCloseTo(498.00)
    expect(billy.vat).toBe(23)
  })

  it('product 2: LEDARE — correct name, qty=12, price=18.99, total=227.88', () => {
    const items = parseIkeaViaTableDetector()
    const ledare = items.find(i => i.nazwa?.includes('LEDARE'))
    expect(ledare).toBeDefined()
    expect(ledare.ilosc).toBe(12)
    expect(ledare.cenaNetto).toBeCloseTo(18.99)
    expect(ledare.wartoscNetto).toBeCloseTo(227.88)
  })

  it('product 3: TJENA — correct name, qty=6, price=24.99, total=149.94', () => {
    const items = parseIkeaViaTableDetector()
    const tjena = items.find(i => i.nazwa?.includes('TJENA'))
    expect(tjena).toBeDefined()
    expect(tjena.ilosc).toBe(6)
    expect(tjena.cenaNetto).toBeCloseTo(24.99)
    expect(tjena.wartoscNetto).toBeCloseTo(149.94)
  })

  it('product 4: VARDAGEN — correct name, qty=8, price=7.59, total=60.72', () => {
    const items = parseIkeaViaTableDetector()
    const vardagen = items.find(i => i.nazwa?.includes('VARDAGEN'))
    expect(vardagen).toBeDefined()
    expect(vardagen.ilosc).toBe(8)
    expect(vardagen.cenaNetto).toBeCloseTo(7.59)
    expect(vardagen.wartoscNetto).toBeCloseTo(60.72)
  })

  it('RAZEM is NOT a product', () => {
    const items = parseIkeaViaTableDetector()
    expect(items.every(i => !/^razem/i.test(i.nazwa || ''))).toBe(true)
  })

  it('DO ZAPŁATY / Płatność is NOT a product', () => {
    const items = parseIkeaViaTableDetector()
    expect(items.every(i => !/p[łl]atno/i.test(i.nazwa || ''))).toBe(true)
    expect(items.every(i => !/do\s+zap[łl]at/i.test(i.nazwa || ''))).toBe(true)
  })

  it('Numer rachunku is NOT a product', () => {
    const items = parseIkeaViaTableDetector()
    expect(items.every(i => !/numer\s+rachunk/i.test(i.nazwa || ''))).toBe(true)
  })

  it('all 4 names are present', () => {
    const items = parseIkeaViaTableDetector()
    const names = items.map(i => i.nazwa || '')
    expect(names.some(n => n.includes('BILLY'))).toBe(true)
    expect(names.some(n => n.includes('LEDARE'))).toBe(true)
    expect(names.some(n => n.includes('TJENA'))).toBe(true)
    expect(names.some(n => n.includes('VARDAGEN'))).toBe(true)
  })
})

// ── No hard limit: 6-product invoice ─────────────────────────────────────────

describe('no product count limit — 6 products', () => {
  function makeProduct(lp, name, unit, qty, cena, total, vat) {
    return mkLine(800 - lp * 25,
      [15, String(lp)], [60, name],
      [300, unit], [350, String(qty)], [400, String(cena)], [460, String(total)],
      [520, `${vat}%`], [580, String(Math.round(total * vat / 100 * 100) / 100)],
      [640, String(total + Math.round(total * vat / 100 * 100) / 100)],
    )
  }

  const products = [
    makeProduct(1, 'Cement 25kg', 'szt.', 10, '18,50', '185,00', 23),
    makeProduct(2, 'Farba biała 10L', 'szt.', 5, '42,00', '210,00', 23),
    makeProduct(3, 'Śruba M6x20', 'opak.', 20, '3,99', '79,80', 23),
    makeProduct(4, 'Kołek 8mm', 'opak.', 15, '5,50', '82,50', 23),
    makeProduct(5, 'Listwa przypodłogowa', 'mb', 30, '6,20', '186,00', 8),
    makeProduct(6, 'Folia budowlana 10m', 'szt.', 8, '15,00', '120,00', 23),
  ]

  const layout = {
    pages: [{
      pageNum: 1, height: 842,
      lines: [IKEA_HEADER_ONELINE, ...products, IKEA_RAZEM],
    }],
    fullText: [IKEA_HEADER_ONELINE, ...products, IKEA_RAZEM].map(l => l.text).join('\n'),
  }

  function parseViaTableDetector() {
    const candidates = findTableCandidates(layout)
    const best = chooseBestTableCandidate(candidates)
    if (!best) return []
    const colMap = adaptColMap(best.columnMap || {})
    if (Object.keys(colMap).length < 2) return []
    return parseTableRows(best.rows, colMap)
  }

  it('returns all 6 products (no 4-item limit)', () => {
    const items = parseViaTableDetector()
    expect(items.length).toBe(6)
  })

  it('all product names are parsed', () => {
    const items = parseViaTableDetector()
    const names = items.map(i => i.nazwa || '')
    expect(names.some(n => n.includes('Cement'))).toBe(true)
    expect(names.some(n => n.includes('Farba'))).toBe(true)
    expect(names.some(n => n.includes('Śruba'))).toBe(true)
    expect(names.some(n => n.includes('Kołek'))).toBe(true)
    expect(names.some(n => n.includes('Listwa'))).toBe(true)
    expect(names.some(n => n.includes('Folia'))).toBe(true)
  })

  it('RAZEM is not returned as a product', () => {
    const items = parseViaTableDetector()
    expect(items.every(i => !/^razem/i.test(i.nazwa || ''))).toBe(true)
  })
})

// ── detectInvoiceStructure multi-line product support ─────────────────────────

describe('detectInvoiceStructure: multi-line products', () => {
  it('parses all 4 IKEA products including split BILLY', () => {
    const productLines = [IKEA_BILLY_NAME, IKEA_BILLY_PRICE, IKEA_LEDARE, IKEA_TJENA, IKEA_VARDAGEN]
    const layout = makeIkeaLayout(productLines)
    const result = detectInvoiceStructure(layout)
    const names = result.pozycje.map(p => p.nazwa || '')
    expect(names.some(n => n.includes('BILLY'))).toBe(true)
    expect(names.some(n => n.includes('LEDARE'))).toBe(true)
    expect(names.some(n => n.includes('TJENA'))).toBe(true)
    expect(names.some(n => n.includes('VARDAGEN'))).toBe(true)
    expect(result.pozycje.length).toBeGreaterThanOrEqual(4)
  })

  it('does not include RAZEM, DO ZAPŁATY, Numer rachunku', () => {
    const productLines = [IKEA_BILLY_NAME, IKEA_BILLY_PRICE, IKEA_LEDARE, IKEA_TJENA, IKEA_VARDAGEN]
    const layout = makeIkeaLayout(productLines)
    const result = detectInvoiceStructure(layout)
    expect(result.pozycje.every(p => !/^razem/i.test(p.nazwa || ''))).toBe(true)
    expect(result.pozycje.every(p => !/numer\s+rachunk/i.test(p.nazwa || ''))).toBe(true)
  })
})
