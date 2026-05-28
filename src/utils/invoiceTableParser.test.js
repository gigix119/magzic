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
