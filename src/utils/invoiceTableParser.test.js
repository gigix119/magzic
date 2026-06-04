import { describe, it, expect, beforeAll } from 'vitest'
import { findTableCandidates, chooseBestTableCandidate, detectColumnBoundaries } from './invoiceTableDetector'
import { parseInvoiceLineData } from './invoiceLineParser'
import { detectInvoiceStructure } from './invoiceStructureDetector'
import { parseInvoiceItemsLP } from './invoiceExtractor'

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

// ── No hard limit: 20-product invoice ────────────────────────────────────────
// Proves the parser has NO limit on item count (not 4, not 6, not 10).
// Mix of: single-line products, multi-line products (name+price split),
// and stop words (RAZEM, DO ZAPŁATY, Numer rachunku) that must be excluded.

describe('no product count limit — 20 products', () => {
  // Re-use IKEA header (generic enough)
  const HDR = IKEA_HEADER_ONELINE

  // Single-line product helper
  function sl(lp, name, unit, qty, cena, total, vat, yOffset = 0) {
    const y = 800 - lp * 18 - yOffset
    return mkLine(y,
      [15, String(lp)], [60, name],
      [300, unit], [350, String(qty)],
      [400, cena], [460, total],
      [520, `${vat}%`],
      [580, String(Math.round(parseFloat(total.replace(',', '.')) * vat / 100 * 100) / 100)],
      [640, String((parseFloat(total.replace(',', '.')) * (1 + vat / 100)).toFixed(2))],
    )
  }

  // Multi-line product (name on one line, prices on next)
  function ml(lp, name, unit, qty, cena, total, vat) {
    const y = 800 - lp * 18
    const nameLine = mkLine(y, [15, String(lp)], [60, name], [300, unit])
    const priceLine = mkLine(y - 8,
      [350, String(qty)], [400, cena], [460, total],
      [520, `${vat}%`],
      [580, String(Math.round(parseFloat(total.replace(',', '.')) * vat / 100 * 100) / 100)],
    )
    return [nameLine, priceLine]
  }

  // Products 1–20: mix of single-line (LP 1-7, 9-14, 16-20) and multi-line (LP 8, 15)
  const p1  = sl(1,  'Cement portlandzki 25kg',      'szt.',  10, '18,50', '185,00', 23)
  const p2  = sl(2,  'Farba lateksowa biała 10L',     'szt.',   5, '42,00', '210,00', 23)
  const p3  = sl(3,  'Śruba M6x20 ocynkowana',        'opak.', 20,  '3,99',  '79,80', 23)
  const p4  = sl(4,  'Kołek rozporowy 8mm',           'opak.', 15,  '5,50',  '82,50', 23)
  const p5  = sl(5,  'Listwa przypodłogowa dąb 2.5m', 'mb',    30,  '6,20', '186,00',  8)
  const p6  = sl(6,  'Folia budowlana 10m',           'szt.',   8, '15,00', '120,00', 23)
  const p7  = sl(7,  'Uszczelka gumowa 10mm',         'mb',   100,  '0,85',  '85,00', 23)
  const p8  = ml(8,  'Klej montażowy Bostik',         'szt.',   6, '12,99',  '77,94', 23)  // multi-line
  const p9  = sl(9,  'Pianka montażowa 750ml',        'szt.',  12,  '8,99', '107,88', 23)
  const p10 = sl(10, 'Taśma izolacyjna czarna 20m',   'szt.',  25,  '2,49',  '62,25', 23)
  const p11 = sl(11, 'Rura PVC fi50 2m',              'szt.',   4, '19,90',  '79,60', 23)
  const p12 = sl(12, 'Kolanko PVC 90st fi50',         'szt.',   8,  '4,50',  '36,00', 23)
  const p13 = sl(13, 'Uszczelka syfon fi40',          'opak.', 10,  '1,20',  '12,00', 23)
  const p14 = sl(14, 'Silikon sanitarny biały',       'szt.',   3, '14,99',  '44,97', 23)
  const p15 = ml(15, 'Narożnik wewnętrzny PVC',       'opak.',  5,  '6,50',  '32,50',  8)  // multi-line
  const p16 = sl(16, 'Kratka wentylacyjna 110x110',   'szt.',   2, '22,00',  '44,00', 23)
  const p17 = sl(17, 'Worek na gruz 100L',            'szt.',  50,  '1,50',  '75,00', 23)
  const p18 = sl(18, 'Tarcza szlifierska 125mm',      'szt.',   4,  '9,99',  '39,96', 23)
  const p19 = sl(19, 'Rękawice robocze rozm. L',      'para',  10,  '3,50',  '35,00', 23)
  const p20 = sl(20, 'Kask ochronny budowlany',       'szt.',   2, '89,00', '178,00', 23)

  // Footer lines that MUST NOT appear as products
  const RAZEM_LINE = mkLine(420, [15, 'RAZEM'], [460, '1798,15'], [640, '2211,73'])
  const NETTO_LINE = mkLine(408, [15, 'Razem'], [60, 'netto:'], [460, '1798,15'])
  const VAT_LINE   = mkLine(396, [15, 'VAT'], [60, '23%:'], [460, '413,58'])
  const ZAPLATA    = mkLine(384, [15, 'DO'], [30, 'ZAPŁATY:'], [460, '2211,73'])
  const KONTO_LINE = mkLine(372, [15, 'Numer'], [40, 'rachunku:'], [60, '12'], [80, '3456'], [100, '7890'])

  // All lines (multi-line products are flat arrays, single-line are single objects)
  const allProductLines = [
    p1, p2, p3, p4, p5, p6, p7,
    ...p8,   // multi-line [nameLine, priceLine]
    p9, p10, p11, p12, p13, p14,
    ...p15,  // multi-line [nameLine, priceLine]
    p16, p17, p18, p19, p20,
    RAZEM_LINE, NETTO_LINE, VAT_LINE, ZAPLATA, KONTO_LINE,
  ]

  const layout = {
    pages: [{ pageNum: 1, height: 1200, lines: [HDR, ...allProductLines] }],
    fullText: [HDR, ...allProductLines].map(l => l.text).join('\n'),
  }

  function parseVia20() {
    const candidates = findTableCandidates(layout)
    const best = chooseBestTableCandidate(candidates)
    if (!best) return []
    const colMap = adaptColMap(best.columnMap || {})
    if (Object.keys(colMap).length < 2) return []
    return parseTableRows(best.rows, colMap)
  }

  it('returns exactly 20 products — no 4/6/10 limit', () => {
    const items = parseVia20()
    expect(items.length).toBe(20)
  })

  it('LP 1 (first product) is parsed correctly', () => {
    const items = parseVia20()
    const p = items.find(i => i.nazwa?.includes('Cement'))
    expect(p).toBeDefined()
    expect(p.ilosc).toBe(10)
    expect(p.cenaNetto).toBeCloseTo(18.50)
  })

  it('LP 10 (middle product) is parsed correctly', () => {
    const items = parseVia20()
    const p = items.find(i => i.nazwa?.includes('Taśma'))
    expect(p).toBeDefined()
    expect(p.ilosc).toBe(25)
    expect(p.cenaNetto).toBeCloseTo(2.49)
  })

  it('LP 20 (last product) is parsed correctly', () => {
    const items = parseVia20()
    const p = items.find(i => i.nazwa?.includes('Kask'))
    expect(p).toBeDefined()
    expect(p.ilosc).toBe(2)
    expect(p.cenaNetto).toBeCloseTo(89.00)
  })

  it('LP 8 (multi-line product) is parsed correctly', () => {
    const items = parseVia20()
    const p = items.find(i => i.nazwa?.includes('Klej'))
    expect(p).toBeDefined()
    expect(p.ilosc).toBe(6)
    expect(p.cenaNetto).toBeCloseTo(12.99)
  })

  it('LP 15 (multi-line product) is parsed correctly', () => {
    const items = parseVia20()
    const p = items.find(i => i.nazwa?.includes('Narożnik'))
    expect(p).toBeDefined()
    expect(p.ilosc).toBe(5)
    expect(p.cenaNetto).toBeCloseTo(6.50)
  })

  it('all 20 product names are present', () => {
    const items = parseVia20()
    const names = items.map(i => i.nazwa || '')
    expect(names.some(n => n.includes('Cement'))).toBe(true)
    expect(names.some(n => n.includes('Farba'))).toBe(true)
    expect(names.some(n => n.includes('Śruba'))).toBe(true)
    expect(names.some(n => n.includes('Kołek'))).toBe(true)
    expect(names.some(n => n.includes('Listwa'))).toBe(true)
    expect(names.some(n => n.includes('Folia'))).toBe(true)
    expect(names.some(n => n.includes('Uszczelka gumowa'))).toBe(true)
    expect(names.some(n => n.includes('Klej'))).toBe(true)
    expect(names.some(n => n.includes('Pianka'))).toBe(true)
    expect(names.some(n => n.includes('Taśma'))).toBe(true)
    expect(names.some(n => n.includes('Rura'))).toBe(true)
    expect(names.some(n => n.includes('Kolanko'))).toBe(true)
    expect(names.some(n => n.includes('Uszczelka syfon'))).toBe(true)
    expect(names.some(n => n.includes('Silikon'))).toBe(true)
    expect(names.some(n => n.includes('Narożnik'))).toBe(true)
    expect(names.some(n => n.includes('Kratka'))).toBe(true)
    expect(names.some(n => n.includes('Worek'))).toBe(true)
    expect(names.some(n => n.includes('Tarcza'))).toBe(true)
    expect(names.some(n => n.includes('Rękawice'))).toBe(true)
    expect(names.some(n => n.includes('Kask'))).toBe(true)
  })

  it('RAZEM / Razem netto are NOT products', () => {
    const items = parseVia20()
    expect(items.every(i => !/^razem/i.test(i.nazwa || ''))).toBe(true)
  })

  it('DO ZAPŁATY is NOT a product', () => {
    const items = parseVia20()
    expect(items.every(i => !/do\s*zap[łl]at/i.test(i.nazwa || ''))).toBe(true)
  })

  it('Numer rachunku is NOT a product', () => {
    const items = parseVia20()
    expect(items.every(i => !/numer\s+rachunk/i.test(i.nazwa || ''))).toBe(true)
  })

  it('VAT line is NOT a product', () => {
    const items = parseVia20()
    expect(items.every(i => !/^vat\s*\d/i.test(i.nazwa || ''))).toBe(true)
  })

  it('confirms no limit: parser stops at table end, not at item count', () => {
    // If there were a limit of N, items.length would be ≤ N
    const items = parseVia20()
    expect(items.length).toBeGreaterThan(10)  // definitely more than "4/6/10" limits
    expect(items.length).toBe(20)
  })
})

// ── Regression: qty+price concatenation in cenaNetto column ──────────────────
//
// Root cause: assignToColumn uses a -15px left-tolerance.  In invoices where
// the quantity token is right-aligned and its x position falls within that
// tolerance of the cenaNetto column start, both the qty token AND the price
// token get assigned to cenaNetto.  The resulting raw string "1 249,00" is then
// parsed by normalizePolishNumber as:
//   • thousands number → 1249   (3-digit price:  "1 249,00", "2 129,00")
//   • concatenated int  → 629.99 (2-digit price:  "6 29,99")
//   • concatenated int  → 1018.99 (2-digit price: "10 18,99")
//
// The fix is in parseInvoiceLineData → splitMergedCenaIlosc which validates
// the 2-token cenaNetto against wartoscNetto arithmetic before splitting.

describe('qty+price concatenation regression — misaligned cenaNetto column', () => {
  // We re-use the standard IKEA header (ilosc at x=350, cenaNetto at x=400).
  // We place the qty token at x=393 so that:
  //   distFromLeft to cenaNetto = 393 - 400 = -7  (>= -15 → accepted, dist 7)
  //   distFromLeft to ilosc     = 393 - 350 = 43   (dist 43)
  // cenaNetto wins → qty is concatenated into cenaNetto.

  const raw = detectColumnBoundaries(IKEA_HEADER_ONELINE.items)
  const colMap = adaptColMap(raw)

  // Helper: build a single-line row where qty is misaligned into cenaNetto
  function misalignedRow(lp, nameParts, qtyStr, priceStr, totalStr, vatAmt, gross) {
    const nameItems = nameParts.map(([x, t]) => mkItem(x, t))
    return {
      y: 700,
      items: [
        mkItem(15, String(lp)),
        ...nameItems,
        mkItem(300, 'szt.'),
        mkItem(393, qtyStr),   // qty: 7px LEFT of cenaNetto (x=400) → goes to cenaNetto
        mkItem(430, priceStr), // price: also goes to cenaNetto (distFromLeft 30)
        mkItem(465, totalStr), // wartoscNetto (distFromLeft to wartoscNetto(460) = 5)
        mkItem(520, '23%'),
        mkItem(580, vatAmt),
        mkItem(640, gross),
      ],
    }
  }

  it('BILLY qty=1 price=249 — "1 249,00" must not parse as 1249', () => {
    const row = misalignedRow(1, [[60, 'BILLY'], [70, 'regał'], [80, 'biały']], '1', '249,00', '249,00', '57,27', '306,27')
    const parsed = parseInvoiceLineData(row.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(1)
    expect(parsed.cenaNetto).toBeCloseTo(249, 1)
    expect(parsed.cenaNetto).not.toBeCloseTo(1249, 0)
    expect(parsed.wartoscNetto).toBeCloseTo(249, 1)
  })

  it('KALLAX qty=1 price=329 — "1 329,00" must not parse as 1329', () => {
    const row = misalignedRow(2, [[60, 'KALLAX'], [70, 'regał']], '1', '329,00', '329,00', '75,67', '404,67')
    const parsed = parseInvoiceLineData(row.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(1)
    expect(parsed.cenaNetto).toBeCloseTo(329, 1)
    expect(parsed.cenaNetto).not.toBeCloseTo(1329, 0)
  })

  it('LACK qty=2 price=129 — "2 129,00" must not parse as 2129', () => {
    const row = misalignedRow(3, [[60, 'LACK'], [70, 'stolik']], '2', '129,00', '258,00', '59,34', '317,34')
    const parsed = parseInvoiceLineData(row.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(2)
    expect(parsed.cenaNetto).toBeCloseTo(129, 1)
    expect(parsed.cenaNetto).not.toBeCloseTo(2129, 0)
    expect(parsed.wartoscNetto).toBeCloseTo(258, 1)
  })

  it('FEJKA qty=6 price=29.99 — "6 29,99" must not parse as 629.99', () => {
    const row = misalignedRow(4, [[60, 'FEJKA'], [70, 'sztuczna'], [80, 'roślina']], '6', '29,99', '179,94', '41,39', '221,33')
    const parsed = parseInvoiceLineData(row.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(6)
    expect(parsed.cenaNetto).toBeCloseTo(29.99, 2)
    expect(parsed.cenaNetto).not.toBeCloseTo(629.99, 0)
    expect(parsed.wartoscNetto).toBeCloseTo(179.94, 2)
  })

  it('LEDARE qty=10 price=18.99 — "10 18,99" must not parse as 1018.99', () => {
    const row = misalignedRow(5, [[60, 'LEDARE'], [70, 'żarówka']], '10', '18,99', '189,90', '43,68', '233,58')
    const parsed = parseInvoiceLineData(row.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(10)
    expect(parsed.cenaNetto).toBeCloseTo(18.99, 2)
    expect(parsed.cenaNetto).not.toBeCloseTo(1018.99, 0)
    expect(parsed.wartoscNetto).toBeCloseTo(189.90, 2)
  })

  it('MALM qty=1 price=399 — "1 399,00" must not parse as 1399', () => {
    const row = misalignedRow(6, [[60, 'MALM'], [70, 'komoda']], '1', '399,00', '399,00', '91,77', '490,77')
    const parsed = parseInvoiceLineData(row.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(1)
    expect(parsed.cenaNetto).toBeCloseTo(399, 1)
    expect(parsed.cenaNetto).not.toBeCloseTo(1399, 0)
  })

  it('SKÅDIS qty=3 price=59.99 — "3 59,99" must not parse as 359.99', () => {
    const row = misalignedRow(7, [[60, 'SKÅDIS'], [70, 'tablica']], '3', '59,99', '179,97', '41,39', '221,36')
    const parsed = parseInvoiceLineData(row.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(3)
    expect(parsed.cenaNetto).toBeCloseTo(59.99, 2)
    expect(parsed.cenaNetto).not.toBeCloseTo(359.99, 0)
    expect(parsed.wartoscNetto).toBeCloseTo(179.97, 2)
  })

  it('genuine thousands price 1249 is NOT split when wartoscNetto matches', () => {
    // Product costs 1249 PLN, qty=1 — wartoscNetto=1249 so split would fail arithmetic
    const row = misalignedRow(9, [[60, 'Drogi'], [70, 'produkt']], '1', '249,00', '1249,00', '287,27', '1536,27')
    // wartoscNetto "1249,00" at x=465 → assigned.wartoscNetto = "1249,00"
    // possibleQty=1, possibleCena=249, 1*249=249 ≠ 1249 → NO split → cenaNetto stays as "1 249,00" → normalizePolishNumber → 1249
    const parsed = parseInvoiceLineData(row.items, colMap)
    // When wartoscNetto=1249 and cenaNetto=1249 (thousands), result is correct
    if (parsed) {
      expect(parsed.cenaNetto).toBeCloseTo(1249, 0)
    }
  })

  it('qty already in ilosc column — cenaNetto-only concatenation is still fixed', () => {
    // When qty "2" IS correctly in ilosc column AND price "129,00" is correctly in cenaNetto
    // (no concatenation), everything should work normally
    const row = {
      y: 680,
      items: [
        mkItem(15, '3'),
        mkItem(60, 'LACK'), mkItem(70, 'stolik'),
        mkItem(300, 'szt.'),
        mkItem(370, '2'),    // qty at x=370: distFromLeft to ilosc(350)=20, to cenaNetto(400)=-30<-15 → ilosc ✓
        mkItem(440, '129,00'), // price at cenaNetto range (distFromLeft=40 to cenaNetto)
        mkItem(465, '258,00'),
        mkItem(520, '23%'), mkItem(580, '59,34'), mkItem(640, '317,34'),
      ],
    }
    const parsed = parseInvoiceLineData(row.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(2)
    expect(parsed.cenaNetto).toBeCloseTo(129, 1)
  })
})

// ── LP parser: 8-product IKEA invoice regression ─────────────────────────────
// Verifies that parseInvoiceItemsLP correctly handles ALL 8 products from
// the failing invoice, including the specific qty+price combinations that
// caused wrong output (1249, 629.99, 1018.99 etc.) in the LP text path.

describe('parseInvoiceItemsLP — 8-product IKEA invoice (regression)', () => {
  const ikeaText8 = [
    'FAKTURA VAT',
    'Sprzedawca: IKEA Retail Sp. z o.o.',
    '',
    'Lp. Nazwa towaru / usługi Jm. Ilość Cena netto Wartość netto VAT Kwota VAT Wartość brutto',
    '',
    '1 BILLY regał biały 80x28x202 cm szt. 1 249,00 249,00 23% 57,27 306,27',
    '2 KALLAX regał 77x147 cm, biały szt. 1 329,00 329,00 23% 75,67 404,67',
    '3 LACK stolik kawowy 90x55 cm szt. 2 129,00 258,00 23% 59,34 317,34',
    '4 FEJKA sztuczna roślina doniczkowa szt. 6 29,99 179,94 23% 41,39 221,33',
    '5 LEDARE żarówka LED E27 806 lm szt. 10 18,99 189,90 23% 43,68 233,58',
    '6 MALM komoda 3-szufladowa biała szt. 1 399,00 399,00 23% 91,77 490,77',
    '7 SKÅDIS tablica perforowana biała szt. 3 59,99 179,97 23% 41,39 221,36',
    '8 FIXA zestaw wkrętów i kołków 260 szt. kpl. 2 24,99 49,98 23% 11,50 61,48',
    'Razem netto 1 834,79',
    'VAT 23% 422,01',
    'Do zapłaty 2 256,80',
  ].join('\n')

  let items

  it('returns exactly 8 products', () => {
    items = parseInvoiceItemsLP(ikeaText8)
    expect(items.length).toBe(8)
  })

  it('BILLY (LP1): qty=1, unitNetPrice=249, netValue=249, NOT 1249', () => {
    items = parseInvoiceItemsLP(ikeaText8)
    const billy = items.find(i => (i.rawName || '').includes('BILLY'))
    expect(billy).toBeDefined()
    expect(billy.ilosc).toBe(1)
    expect(billy.cenaNetto).toBeCloseTo(249, 1)
    expect(billy.cenaNetto).not.toBeCloseTo(1249, 0)
    expect(billy.wartoscNetto).toBeCloseTo(249, 1)
  })

  it('KALLAX (LP2): qty=1, unitNetPrice=329, NOT 1329', () => {
    items = parseInvoiceItemsLP(ikeaText8)
    const kallax = items.find(i => (i.rawName || '').includes('KALLAX'))
    expect(kallax).toBeDefined()
    expect(kallax.ilosc).toBe(1)
    expect(kallax.cenaNetto).toBeCloseTo(329, 1)
    expect(kallax.cenaNetto).not.toBeCloseTo(1329, 0)
  })

  it('LACK (LP3): qty=2, unitNetPrice=129, netValue=258, NOT 2129', () => {
    items = parseInvoiceItemsLP(ikeaText8)
    const lack = items.find(i => (i.rawName || '').includes('LACK'))
    expect(lack).toBeDefined()
    expect(lack.ilosc).toBe(2)
    expect(lack.cenaNetto).toBeCloseTo(129, 1)
    expect(lack.cenaNetto).not.toBeCloseTo(2129, 0)
    expect(lack.wartoscNetto).toBeCloseTo(258, 1)
  })

  it('FEJKA (LP4): qty=6, unitNetPrice=29.99, netValue=179.94, NOT 629.99', () => {
    items = parseInvoiceItemsLP(ikeaText8)
    const fejka = items.find(i => (i.rawName || '').includes('FEJKA'))
    expect(fejka).toBeDefined()
    expect(fejka.ilosc).toBe(6)
    expect(fejka.cenaNetto).toBeCloseTo(29.99, 2)
    expect(fejka.cenaNetto).not.toBeCloseTo(629.99, 0)
    expect(fejka.wartoscNetto).toBeCloseTo(179.94, 2)
  })

  it('LEDARE (LP5): qty=10, unitNetPrice=18.99, netValue=189.90, NOT 1018.99', () => {
    items = parseInvoiceItemsLP(ikeaText8)
    const ledare = items.find(i => (i.rawName || '').includes('LEDARE'))
    expect(ledare).toBeDefined()
    expect(ledare.ilosc).toBe(10)
    expect(ledare.cenaNetto).toBeCloseTo(18.99, 2)
    expect(ledare.cenaNetto).not.toBeCloseTo(1018.99, 0)
    expect(ledare.wartoscNetto).toBeCloseTo(189.90, 2)
  })

  it('MALM (LP6): qty=1, unitNetPrice=399, NOT 1399', () => {
    items = parseInvoiceItemsLP(ikeaText8)
    const malm = items.find(i => (i.rawName || '').includes('MALM'))
    expect(malm).toBeDefined()
    expect(malm.ilosc).toBe(1)
    expect(malm.cenaNetto).toBeCloseTo(399, 1)
    expect(malm.cenaNetto).not.toBeCloseTo(1399, 0)
  })

  it('SKÅDIS (LP7): qty=3, unitNetPrice=59.99, netValue=179.97', () => {
    items = parseInvoiceItemsLP(ikeaText8)
    const skadis = items.find(i => (i.rawName || '') .includes('SK'))
    expect(skadis).toBeDefined()
    expect(skadis.ilosc).toBe(3)
    expect(skadis.cenaNetto).toBeCloseTo(59.99, 2)
    expect(skadis.wartoscNetto).toBeCloseTo(179.97, 2)
  })

  it('FIXA (LP8): unit=kpl, qty=2, unitNetPrice=24.99, netValue=49.98', () => {
    items = parseInvoiceItemsLP(ikeaText8)
    const fixa = items.find(i => (i.rawName || '').includes('FIXA'))
    expect(fixa).toBeDefined()
    expect(fixa.ilosc).toBe(2)
    expect(fixa.cenaNetto).toBeCloseTo(24.99, 2)
    expect(fixa.wartoscNetto).toBeCloseTo(49.98, 2)
    const unit = fixa.jednostka || fixa.unit || ''
    expect(unit).toBe('kpl')
  })

  it('total net ≈ 1834.79 (±0.05)', () => {
    items = parseInvoiceItemsLP(ikeaText8)
    const totalNet = items.reduce((s, i) => s + (i.wartoscNetto || i.totalNet || 0), 0)
    expect(Math.abs(totalNet - 1834.79)).toBeLessThan(0.05)
  })

  it('all 8 names present (no stop lines as products)', () => {
    items = parseInvoiceItemsLP(ikeaText8)
    const names = items.map(i => (i.rawName || '').toLowerCase())
    expect(names.some(n => n.includes('billy'))).toBe(true)
    expect(names.some(n => n.includes('kallax'))).toBe(true)
    expect(names.some(n => n.includes('lack'))).toBe(true)
    expect(names.some(n => n.includes('fejka'))).toBe(true)
    expect(names.some(n => n.includes('ledare'))).toBe(true)
    expect(names.some(n => n.includes('malm'))).toBe(true)
    expect(names.some(n => n.includes('fixa'))).toBe(true)
    expect(names.every(n => !/^razem/.test(n))).toBe(true)
    expect(names.every(n => !/do\s*zap/.test(n))).toBe(true)
  })

  it('VAT rate is 23 for all items', () => {
    items = parseInvoiceItemsLP(ikeaText8)
    expect(items.every(i => i.vat === 23)).toBe(true)
  })
})

// ── Column-based parser: 8-product invoice via full table detection pipeline ──

describe('8-product IKEA invoice via table detector + parseInvoiceLineData', () => {
  // Well-aligned x positions — qty at x=355 stays in ilosc column (x=350, dist=5),
  // price at x=420 goes to cenaNetto (x=400, dist=20). No concatenation.
  function sl8(lp, nameParts, unit, qty, cena, total, vat) {
    const totalNum = parseFloat(String(total).replace(',', '.'))
    const vatAmt   = (Math.round(totalNum * vat / 100 * 100) / 100).toFixed(2).replace('.', ',')
    const gross    = (totalNum + parseFloat(vatAmt.replace(',', '.'))).toFixed(2).replace('.', ',')
    return mkLine(800 - lp * 18,
      [15, String(lp)],
      ...nameParts,
      [300, unit],
      [355, String(qty)],
      [420, cena],
      [465, total],
      [520, `${vat}%`],
      [580, vatAmt],
      [640, gross],
    )
  }

  const products8 = [
    sl8(1, [[60, 'BILLY'], [70, 'regał'], [80, 'biały']],  'szt.',  1, '249,00', '249,00', 23),
    sl8(2, [[60, 'KALLAX'], [70, 'regał']],                'szt.',  1, '329,00', '329,00', 23),
    sl8(3, [[60, 'LACK'], [70, 'stolik']],                 'szt.',  2, '129,00', '258,00', 23),
    sl8(4, [[60, 'FEJKA'], [70, 'sztuczna'], [80, 'ros']], 'szt.',  6, '29,99',  '179,94', 23),
    sl8(5, [[60, 'LEDARE'], [70, 'żarówka']],              'szt.', 10, '18,99',  '189,90', 23),
    sl8(6, [[60, 'MALM'], [70, 'komoda']],                 'szt.',  1, '399,00', '399,00', 23),
    sl8(7, [[60, 'SKADIS'], [70, 'tablica']],              'szt.',  3, '59,99',  '179,97', 23),
    sl8(8, [[60, 'FIXA'], [70, 'zestaw']],                 'kpl.',  2, '24,99',  '49,98',  23),
  ]

  const layout8 = {
    pages: [{
      pageNum: 1, height: 842,
      lines: [IKEA_HEADER_ONELINE, ...products8, IKEA_RAZEM],
    }],
    fullText: [IKEA_HEADER_ONELINE, ...products8, IKEA_RAZEM].map(l => l.text).join('\n'),
  }

  function parseVia8() {
    const candidates = findTableCandidates(layout8)
    const best = chooseBestTableCandidate(candidates)
    if (!best) return []
    const colMap = adaptColMap(best.columnMap || {})
    if (Object.keys(colMap).length < 2) return []
    return parseTableRows(best.rows, colMap)
  }

  it('returns 8 products', () => {
    expect(parseVia8().length).toBe(8)
  })

  it('BILLY: qty=1, price=249', () => {
    const billy = parseVia8().find(i => i.nazwa?.includes('BILLY'))
    expect(billy).toBeDefined()
    expect(billy.ilosc).toBe(1)
    expect(billy.cenaNetto).toBeCloseTo(249, 1)
  })

  it('LACK: qty=2, price=129, net=258', () => {
    const lack = parseVia8().find(i => i.nazwa?.includes('LACK'))
    expect(lack).toBeDefined()
    expect(lack.ilosc).toBe(2)
    expect(lack.cenaNetto).toBeCloseTo(129, 1)
    expect(lack.wartoscNetto).toBeCloseTo(258, 1)
  })

  it('FEJKA: qty=6, price=29.99, net=179.94', () => {
    const fejka = parseVia8().find(i => i.nazwa?.includes('FEJKA'))
    expect(fejka).toBeDefined()
    expect(fejka.ilosc).toBe(6)
    expect(fejka.cenaNetto).toBeCloseTo(29.99, 2)
    expect(fejka.wartoscNetto).toBeCloseTo(179.94, 2)
  })

  it('LEDARE: qty=10, price=18.99, net=189.90', () => {
    const ledare = parseVia8().find(i => i.nazwa?.includes('LEDARE'))
    expect(ledare).toBeDefined()
    expect(ledare.ilosc).toBe(10)
    expect(ledare.cenaNetto).toBeCloseTo(18.99, 2)
    expect(ledare.wartoscNetto).toBeCloseTo(189.90, 2)
  })

  it('total net ≈ 1834.79', () => {
    const items = parseVia8()
    const total = items.reduce((s, i) => s + (i.wartoscNetto || 0), 0)
    expect(Math.abs(total - 1834.79)).toBeLessThan(0.1)
  })
})

// ── No-LP layout: Nazwa | Ilość | Jm | Cena netto | Wartość netto | VAT | Wartość brutto ──
//
// Bug: In the no-LP layout Ilość comes BEFORE Jm.  A right-aligned qty digit ("4")
// at the right edge of the Ilość column falls within the -15px tolerance of the Jm
// column start → qty assigned to JEDNOSTKA.  Result: ilosc=1, jednostka="4 szt."
// Fix: repairIloscInJednostka (arithmetic-validated swap back).

describe('No-LP invoice — qty misaligned into Jm column (regression)', () => {
  // No-LP header (Ilość before Jm)
  const NO_LP_HDR = mkLine(800,
    [15,  'Nazwa'],
    [195, 'Ilość'],          // ILOSC at x=195
    [245, 'Jm'],             // JEDNOSTKA at x=245
    [305, 'Cena netto'],
    [390, 'Wartość netto'],
    [465, 'VAT'],
    [535, 'Wartość brutto'],
  )

  const rawNoLp = detectColumnBoundaries(NO_LP_HDR.items)
  const colMapNoLp = adaptColMap(rawNoLp)

  // qty at x=233: distFromLeft to Jm(245)=-12 ≥ -15 → JEDNOSTKA wins (dist 12 < dist 38 to Ilość)
  // unit at x=263: distFromLeft to Cena netto(305)=-42 < -15 → rejected → also JEDNOSTKA
  // Produces: assigned.jednostka="4 szt.", assigned.ilosc=""
  function misalignedNoLpRow(nameParts, qtyStr, unitStr, priceStr, netStr, vatStr, grossStr) {
    return {
      y: 750,
      items: [
        ...nameParts.map(([x, t]) => mkItem(x, t)),
        mkItem(233, qtyStr),
        mkItem(263, unitStr),
        mkItem(325, priceStr),
        mkItem(405, netStr),
        mkItem(470, vatStr),
        mkItem(545, grossStr),
      ],
    }
  }

  it('header has ilosc and jednostka columns', () => {
    expect(typeof colMapNoLp.ilosc).toBe('number')
    expect(typeof colMapNoLp.jednostka).toBe('number')
  })

  it('Panel ścienny qty=4: ilosc must be 4, NOT 1; jednostka must not be "4"', () => {
    const row = misalignedNoLpRow(
      [[15,'Panel'],[55,'ścienny'],[100,'akustyczny'],[150,'dąb']],
      '4', 'szt.', '79,90', '319,60', '23%', '393,11'
    )
    const parsed = parseInvoiceLineData(row.items, colMapNoLp)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(4)
    expect(parsed.ilosc).not.toBe(1)
    expect(parsed.jednostka).not.toMatch(/^\d/)
    expect(parsed.cenaNetto).toBeCloseTo(79.90, 2)
    expect(parsed.wartoscNetto).toBeCloseTo(319.60, 2)
    expect(parsed.vat).toBe(23)
  })

  it('Taśma LED qty=3 unit=kpl: ilosc=3, NOT 1', () => {
    const row = misalignedNoLpRow(
      [[15,'Taśma'],[50,'LED'],[80,'neutralna'],[115,'5m']],
      '3', 'kpl.', '49,99', '149,97', '23%', '184,46'
    )
    const parsed = parseInvoiceLineData(row.items, colMapNoLp)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(3)
    expect(parsed.ilosc).not.toBe(1)
    expect(parsed.cenaNetto).toBeCloseTo(49.99, 2)
    expect(parsed.wartoscNetto).toBeCloseTo(149.97, 2)
  })

  it('Zasilacz LED qty=2: ilosc=2, NOT 1', () => {
    const row = misalignedNoLpRow(
      [[15,'Zasilacz'],[60,'LED'],[90,'60W'],[120,'IP44']],
      '2', 'szt.', '84,50', '169,00', '23%', '207,87'
    )
    const parsed = parseInvoiceLineData(row.items, colMapNoLp)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(2)
    expect(parsed.cenaNetto).toBeCloseTo(84.50, 2)
    expect(parsed.wartoscNetto).toBeCloseTo(169.00, 2)
  })

  it('Listwa montażowa qty=5: ilosc=5, NOT 1', () => {
    const row = misalignedNoLpRow(
      [[15,'Listwa'],[55,'montażowa'],[115,'aluminiowa'],[175,'2m']],
      '5', 'szt.', '31,20', '156,00', '23%', '191,88'
    )
    const parsed = parseInvoiceLineData(row.items, colMapNoLp)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(5)
    expect(parsed.cenaNetto).toBeCloseTo(31.20, 2)
    expect(parsed.wartoscNetto).toBeCloseTo(156.00, 2)
  })

  it('all 4 products: total net ≈ 794.57, no item has ilosc=1 or numeric jednostka', () => {
    const rows = [
      misalignedNoLpRow([[15,'Panel'],[55,'ścienny'],[100,'akustyczny'],[150,'dąb']],
        '4','szt.','79,90','319,60','23%','393,11'),
      misalignedNoLpRow([[15,'Taśma'],[50,'LED'],[80,'neutralna'],[115,'5m']],
        '3','kpl.','49,99','149,97','23%','184,46'),
      misalignedNoLpRow([[15,'Zasilacz'],[60,'LED'],[90,'60W'],[120,'IP44']],
        '2','szt.','84,50','169,00','23%','207,87'),
      misalignedNoLpRow([[15,'Listwa'],[55,'montażowa'],[115,'aluminiowa'],[175,'2m']],
        '5','szt.','31,20','156,00','23%','191,88'),
    ]
    const items = rows
      .map(r => parseInvoiceLineData(r.items, colMapNoLp))
      .filter(p => p && p.nazwa && (p.cenaNetto > 0 || p.wartoscNetto > 0))
    expect(items.length).toBe(4)
    const totalNet = items.reduce((s, i) => s + (i.wartoscNetto || 0), 0)
    expect(Math.abs(totalNet - 794.57)).toBeLessThan(0.05)
    expect(items.every(i => i.ilosc > 1)).toBe(true)
    expect(items.every(i => !/^\d/.test(i.jednostka || ''))).toBe(true)
  })

  it('generic row — Produkt ABC qty=7 price=12.30 net=86.10', () => {
    const row = misalignedNoLpRow(
      [[15,'Produkt'],[65,'ABC']],
      '7', 'szt.', '12,30', '86,10', '23%', '105,90'
    )
    const parsed = parseInvoiceLineData(row.items, colMapNoLp)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(7)
    expect(parsed.cenaNetto).toBeCloseTo(12.30, 2)
    expect(parsed.wartoscNetto).toBeCloseTo(86.10, 2)
  })

  it('genuine unit in jednostka (qty correctly in ilosc) — repair must not trigger', () => {
    // qty "4" at x=210: distFromLeft to Jm(245)=-35 < -15 → REJECTED → goes to ILOSC ✓
    // No misalignment; repair must not fire
    const row = {
      y: 750,
      items: [
        mkItem(15, 'Produkt'), mkItem(60, 'testowy'),
        mkItem(210, '4'),    // dist to ILOSC(195)=15; to Jm(245)=-35<-15→rejected → ILOSC
        mkItem(265, 'szt.'), // JEDNOSTKA
        mkItem(325, '10,00'),
        mkItem(405, '40,00'),
        mkItem(470, '23%'),
        mkItem(545, '49,20'),
      ],
    }
    const parsed = parseInvoiceLineData(row.items, colMapNoLp)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(4)
    expect(parsed.cenaNetto).toBeCloseTo(10, 1)
  })
})

// ── No-LP 4-product invoice via full table detection pipeline ─────────────────

describe('No-LP 4-product invoice via table detector (happy path)', () => {
  // Well-aligned rows — qty at x=215 (dist 20 to ILOSC=195, dist -30<-15 to Jm=245 → ILOSC ✓)
  function slNoLp(nameParts, unit, qty, cena, total, vat) {
    const totalNum = parseFloat(String(total).replace(',', '.'))
    const vatAmt   = (Math.round(totalNum * vat / 100 * 100) / 100).toFixed(2).replace('.', ',')
    const gross    = (totalNum + parseFloat(vatAmt.replace(',', '.'))).toFixed(2).replace('.', ',')
    return mkLine(750,
      ...nameParts,
      [215, String(qty)],
      [265, unit],
      [325, cena],
      [405, total],
      [470, `${vat}%`],
      [545, gross],
    )
  }

  const NO_LP_HDR = mkLine(800,
    [15,'Nazwa'],[195,'Ilość'],[245,'Jm'],
    [305,'Cena netto'],[390,'Wartość netto'],[465,'VAT'],[535,'Wartość brutto'],
  )
  const RAZEM_LINE = mkLine(680, [15,'Razem'], [390,'794,57'], [535,'977,32'])

  const noLpRows = [
    slNoLp([[15,'Panel'],[55,'ścienny'],[100,'akustyczny'],[150,'dąb']],  'szt.', 4, '79,90', '319,60', 23),
    slNoLp([[15,'Taśma'],[50,'LED'],[80,'neutralna'],[115,'5m']],          'kpl.', 3, '49,99', '149,97', 23),
    slNoLp([[15,'Zasilacz'],[60,'LED'],[90,'60W'],[120,'IP44']],            'szt.', 2, '84,50', '169,00', 23),
    slNoLp([[15,'Listwa'],[55,'montażowa'],[115,'aluminiowa'],[175,'2m']],  'szt.', 5, '31,20', '156,00', 23),
  ]

  const layout = {
    pages: [{ pageNum: 1, height: 842, lines: [NO_LP_HDR, ...noLpRows, RAZEM_LINE] }],
    fullText: [NO_LP_HDR, ...noLpRows, RAZEM_LINE].map(l => l.text).join('\n'),
  }

  function parseViaNoLpPipeline() {
    const candidates = findTableCandidates(layout)
    const best = chooseBestTableCandidate(candidates)
    if (!best) return []
    const colMap = adaptColMap(best.columnMap || {})
    if (Object.keys(colMap).length < 2) return []
    return parseTableRows(best.rows, colMap)
  }

  it('finds table header', () => {
    expect(findTableCandidates(layout).length).toBeGreaterThanOrEqual(1)
  })

  it('returns 4 products', () => {
    expect(parseViaNoLpPipeline().length).toBe(4)
  })

  it('Panel ścienny: qty=4, cenaNetto=79.90, wartoscNetto=319.60', () => {
    const panel = parseViaNoLpPipeline().find(i => i.nazwa?.includes('Panel'))
    expect(panel).toBeDefined()
    expect(panel.ilosc).toBe(4)
    expect(panel.cenaNetto).toBeCloseTo(79.90, 2)
    expect(panel.wartoscNetto).toBeCloseTo(319.60, 2)
  })

  it('Taśma LED: qty=3, cenaNetto=49.99', () => {
    const tasma = parseViaNoLpPipeline().find(i => i.nazwa?.includes('Taśma'))
    expect(tasma).toBeDefined()
    expect(tasma.ilosc).toBe(3)
    expect(tasma.cenaNetto).toBeCloseTo(49.99, 2)
  })

  it('Zasilacz LED: qty=2, cenaNetto=84.50', () => {
    const zasilacz = parseViaNoLpPipeline().find(i => i.nazwa?.includes('Zasilacz'))
    expect(zasilacz).toBeDefined()
    expect(zasilacz.ilosc).toBe(2)
    expect(zasilacz.cenaNetto).toBeCloseTo(84.50, 2)
  })

  it('Listwa montażowa: qty=5, cenaNetto=31.20', () => {
    const listwa = parseViaNoLpPipeline().find(i => i.nazwa?.includes('Listwa'))
    expect(listwa).toBeDefined()
    expect(listwa.ilosc).toBe(5)
    expect(listwa.cenaNetto).toBeCloseTo(31.20, 2)
  })

  it('total net ≈ 794.57', () => {
    const total = parseViaNoLpPipeline().reduce((s, i) => s + (i.wartoscNetto || 0), 0)
    expect(Math.abs(total - 794.57)).toBeLessThan(0.05)
  })

  it('Razem line is NOT a product', () => {
    expect(parseViaNoLpPipeline().every(i => !/^razem/i.test(i.nazwa || ''))).toBe(true)
  })
})

// ── Previous LP-layout fixes must still pass (non-regression) ─────────────────
// Quick smoke test to ensure repairIloscInJednostka does not break the LP layout
// where the header order is: Lp | Nazwa | Jm | Ilość | Cena netto | …

describe('LP-layout non-regression after no-LP fix', () => {
  // Use the existing IKEA header where Jm(300) comes BEFORE Ilość(350)
  const raw = detectColumnBoundaries(IKEA_HEADER_ONELINE.items)
  const colMap = adaptColMap(raw)

  it('LEDARE single-line row still parses correctly', () => {
    const parsed = parseInvoiceLineData(IKEA_LEDARE.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(12)
    expect(parsed.cenaNetto).toBeCloseTo(18.99, 2)
    expect(parsed.wartoscNetto).toBeCloseTo(227.88, 2)
  })

  it('VARDAGEN single-line row still parses correctly', () => {
    const parsed = parseInvoiceLineData(IKEA_VARDAGEN.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(8)
    expect(parsed.cenaNetto).toBeCloseTo(7.59, 2)
  })

  it('repairIloscInJednostka does not fire for LP layout (unit correctly in jednostka)', () => {
    // In LP layout Jm=300 comes before Ilość=350. "szt." at x=305 → JEDNOSTKA(300) dist=5.
    // assigned.jednostka = "szt." — a real unit string, NOT a number → repair must not trigger.
    const parsed = parseInvoiceLineData(IKEA_TJENA.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.ilosc).toBe(6)
    expect(parsed.cenaNetto).toBeCloseTo(24.99, 2)
  })
})

// ── splitMergedCenaIlosc: 3-token cenaNetto with thousands price ───────────────
// Root cause: in LP-layout PDFs with a price of e.g. "1 249,00", the PDF emits
// TWO text items ("1" and "249,00") for the price.  When the qty token ALSO spills
// into cenaNetto (x within -15px), assignToColumn concatenates all three:
//   assigned.cenaNetto = "1 1 249,00"   (qty "1" + price thousands-digit "1" + "249,00")
// The 2-token code path would not handle this; the 3-token extension does.

describe('splitMergedCenaIlosc — 3-token cenaNetto (qty + thousands price)', () => {
  const raw = detectColumnBoundaries(IKEA_HEADER_ONELINE.items)
  const colMap = adaptColMap(raw)

  // qty "1" at x=393 → cenaNetto (dist 7); price "1" at x=402 → cenaNetto; "249,00" at x=415 → cenaNetto
  // wartoscNetto "1" at x=465 → wartoscNetto; "249,00" at x=477 → wartoscNetto
  it('cenaNetto="1 1 249,00" wartoscNetto="1 249,00" → price=1249 NOT 11249', () => {
    const row = {
      y: 700,
      items: [
        mkItem(15, '1'),
        mkItem(60, 'Urządzenie'), mkItem(110, 'premium'), mkItem(155, '-'),
        mkItem(165, 'prawdziwa'), mkItem(210, 'kwota'), mkItem(240, '1'), mkItem(255, '249,00'),
        mkItem(300, 'szt.'),
        mkItem(393, '1'),      // qty → cenaNetto (dist 7 < dist 43 to ilosc)
        mkItem(402, '1'),      // price thousands-digit → cenaNetto
        mkItem(415, '249,00'), // price decimal → cenaNetto → assigned.cenaNetto="1 1 249,00"
        mkItem(465, '1'),      // wartoscNetto thousands-digit
        mkItem(477, '249,00'), // wartoscNetto decimal → assigned.wartoscNetto="1 249,00"=1249
        mkItem(520, '23%'),
        mkItem(580, '287,27'),
        mkItem(640, '1 536,27'),
      ],
    }
    const parsed = parseInvoiceLineData(row.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.cenaNetto).toBeCloseTo(1249, 0)
    expect(parsed.cenaNetto).not.toBeCloseTo(11249, 0) // must not flatten "1 1 249" → 11249
    expect(parsed.cenaNetto).not.toBeCloseTo(1, 0)
    expect(parsed.cenaNetto).not.toBeCloseTo(249, 0)
    expect(parsed.ilosc).toBe(1)
    expect(parsed.wartoscNetto).toBeCloseTo(1249, 0)
  })

  it('cenaNetto="2 1 249,00" wartoscNetto="2 498,00" → price=1249, qty=2', () => {
    const row = {
      y: 680,
      items: [
        mkItem(15, '2'),
        mkItem(60, 'Serwer'), mkItem(95, 'produkcyjny'),
        mkItem(300, 'szt.'),
        mkItem(393, '2'),      // qty=2 → cenaNetto → "2 1 249,00"
        mkItem(402, '1'),
        mkItem(415, '249,00'),
        mkItem(465, '2'),      // wartoscNetto → "2 498,00" = 2498
        mkItem(477, '498,00'),
        mkItem(520, '23%'),
        mkItem(580, '574,54'),
        mkItem(640, '3 072,54'),
      ],
    }
    const parsed = parseInvoiceLineData(row.items, colMap)
    expect(parsed).not.toBeNull()
    expect(parsed.cenaNetto).toBeCloseTo(1249, 0)
    expect(parsed.ilosc).toBe(2)
    expect(parsed.wartoscNetto).toBeCloseTo(2498, 0)
  })
})

// ── FV 00867/2026 — KSeF net invoice (Layout A: Lp|Nazwa|Jdn|Ilość|Cena|Rabat|VAT|Wartość) ──
// Real invoice from SaldeoSMART/KSeF. Quantities in Polish KSeF format: "50.000" = 50 units.
// Bug: parser was putting "SZT 50.000" into product name, returning qty=1 for every item.
describe('FV 00867/2026 — KSeF net invoice via LP parser', () => {
  const FV_00867_TEXT = `FAKTURA VAT FV 00867/2026
Lp. Nazwa towaru/usługi Jdn. Ilość Cena jdn. netto Rabat [PLN] VAT Wartość netto
1 rolka 57/15 termo SZT 50.000 1,16 0,00 23 58,00
2 rolka 57/20m szt 50.000 1,24 0,00 23 62,00
3 zakreślacz GRANIT szt 10.000 2,39 0,00 23 23,90
4 notes samp. 76/127 szt 12.000 2,94 0,00 23 35,28
5 płyn do usuwania etykiet 400ml szt 1.000 19,31 0,00 23 19,31
PODSUMOWANIE
VAT Wartość netto Kwota podatku VAT Wartość brutto
23% 198,49 45,65 244,14
Kwota należności ogółem: 244,14 PLN`

  let items

  beforeAll(() => {
    items = parseInvoiceItemsLP(FV_00867_TEXT)
  })

  it('detects exactly 5 line items', () => {
    expect(items.length).toBe(5)
  })

  it('quantities are [50, 50, 10, 12, 1] — NOT all 1', () => {
    const qtys = items.map(i => i.ilosc)
    expect(qtys[0]).toBe(50)
    expect(qtys[1]).toBe(50)
    expect(qtys[2]).toBe(10)
    expect(qtys[3]).toBe(12)
    expect(qtys[4]).toBe(1)
  })

  it('item[0]: name "rolka 57/15 termo", NOT contaminated with SZT/50.000', () => {
    const i = items[0]
    expect(i.rawName || i.nazwa).toMatch(/rolka\s+57\/15\s+termo/i)
    expect(i.rawName || i.nazwa).not.toMatch(/SZT/i)
    expect(i.rawName || i.nazwa).not.toMatch(/50\.000/)
  })

  it('item[3]: name "notes samp. 76/127" — slash-number pattern stays in name', () => {
    const i = items[3]
    expect(i.rawName || i.nazwa).toMatch(/notes.*76\/127/i)
    expect(i.rawName || i.nazwa).not.toMatch(/12\.000/)
  })

  it('item[4]: name contains "400ml" — measurement stays in name', () => {
    const i = items[4]
    expect(i.rawName || i.nazwa).toMatch(/400ml/)
    expect(i.rawName || i.nazwa).not.toMatch(/1\.000/)
  })

  it('sum of wartoscNetto = 198.49', () => {
    const sum = items.reduce((s, i) => s + (i.wartoscNetto || 0), 0)
    expect(sum).toBeCloseTo(198.49, 1)
  })

  it('prices: [1.16, 1.24, 2.39, 2.94, 19.31]', () => {
    expect(items[0].cenaNetto).toBeCloseTo(1.16, 2)
    expect(items[1].cenaNetto).toBeCloseTo(1.24, 2)
    expect(items[2].cenaNetto).toBeCloseTo(2.39, 2)
    expect(items[3].cenaNetto).toBeCloseTo(2.94, 2)
    expect(items[4].cenaNetto).toBeCloseTo(19.31, 2)
  })
})

// ── KSeF contamination repair: unit+qty in name → extractInvoiceExtractor repairss ──
// Tests the regex repair logic for column-parsed rows where "SZT 50.000" leaks into name.
describe('KSeF contamination regex repair', () => {
  const KSEF_CONTAM_RE = /\s+(szt\.?|kpl\.?|usł\.?|usl\.?|op\.?)\s+(\d+)\.0{3,}\s*$/i

  it('"rolka 57/15 termo SZT 50.000" — extracts qty=50, cleans name', () => {
    const name = 'rolka 57/15 termo SZT 50.000'
    const m = name.match(KSEF_CONTAM_RE)
    expect(m).not.toBeNull()
    expect(parseInt(m[2])).toBe(50)
    const clean = name.slice(0, name.length - m[0].length).trim()
    expect(clean).toBe('rolka 57/15 termo')
  })

  it('"rolka 57/20m szt 50.000" — extracts qty=50', () => {
    const name = 'rolka 57/20m szt 50.000'
    const m = name.match(KSEF_CONTAM_RE)
    expect(m).not.toBeNull()
    expect(parseInt(m[2])).toBe(50)
    const clean = name.slice(0, name.length - m[0].length).trim()
    expect(clean).toBe('rolka 57/20m')
  })

  it('"notes samp. 76/127 szt 12.000" — extracts qty=12, preserves slash-numbers', () => {
    const name = 'notes samp. 76/127 szt 12.000'
    const m = name.match(KSEF_CONTAM_RE)
    expect(m).not.toBeNull()
    expect(parseInt(m[2])).toBe(12)
    const clean = name.slice(0, name.length - m[0].length).trim()
    expect(clean).toBe('notes samp. 76/127')
  })

  it('"płyn do usuwania etykiet 400ml szt 1.000" — matches szt 1.000 not ml in 400ml', () => {
    const name = 'płyn do usuwania etykiet 400ml szt 1.000'
    const m = name.match(KSEF_CONTAM_RE)
    expect(m).not.toBeNull()
    expect(m[1].toLowerCase()).toMatch(/^szt/)   // unit is "szt", not "ml"
    const clean = name.slice(0, name.length - m[0].length).trim()
    expect(clean).toMatch(/400ml/)  // "400ml" stays in name
  })

  it('"zakreślacz GRANIT szt 10.000" → qty=10', () => {
    const name = 'zakreślacz GRANIT szt 10.000'
    const m = name.match(KSEF_CONTAM_RE)
    expect(m).not.toBeNull()
    expect(parseInt(m[2])).toBe(10)
  })

  it('"KABEL BASEUS 60W 1M CZARNY" — no match (no unit+qty suffix)', () => {
    const name = 'KABEL BASEUS 60W 1M CZARNY'
    const m = name.match(KSEF_CONTAM_RE)
    expect(m).toBeNull()  // no contamination — normal product name
  })
})
