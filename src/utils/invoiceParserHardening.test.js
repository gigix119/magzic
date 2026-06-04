// Parser hardening regression tests
// Covers: FV00867 (net+Jdn), S596 (gross no-Jdn), IKEA (gross+Jdn+codes),
//         EPTA (gross+Jdn), CarShine (service), FS/3871 (single gross),
//         detectColumnSchema (5 schemas), splitMultiInvoicePdf

import { describe, it, expect } from 'vitest'
import { parseInvoiceItemsLP, splitMultiInvoicePdf } from './invoiceExtractor.js'
import { detectColumnSchema, validateInvoiceTotals } from './invoiceMath.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function eps(a, b, d = 0.02) { return Math.abs(a - b) <= d }

// ── Fixtures ─────────────────────────────────────────────────────────────────

// FV 00867/2026 – netto, z Jdn., 5 pozycji
// quantities use KSeF format (50.000 → 50)
const FV00867 = `
FAKTURA VAT NR FV 00867/2026
Data wystawienia: 15.05.2026
Sprzedawca: BIURO-TEST Sp. z o.o. NIP: 1234567890

Lp. Nazwa towaru/usługi Jdn. Ilość Cena jdn. netto Rabat VAT Wartość netto

1 rolka 57/15 termo SZT 50.000 1,16 0,00 23 58,00
2 rolka 57/20m szt 50.000 1,24 0,00 23 62,00
3 zakreślacz GRANIT szt 10.000 2,39 0,00 23 23,90
4 notes samp. 76/127 szt 12.000 2,94 0,00 23 35,28
5 płyn do usuwania etykiet 400ml szt 1.000 19,31 0,00 23 19,31

PODSUMOWANIE
Razem netto: 198,49
VAT: 45,65
Razem brutto: 244,14
`.trim()

// S596/F001032/05/2026 – brutto, bez Jdn., 9 pozycji
// Multi-line name for item 9 (MONITOR): in text fixture it's one line; test checks for "100H" substring
const S596 = `
FAKTURA VAT S596/F001032/05/2026
Data: 10.05.2026
NIP: 9876543210

Lp. Nazwa towaru/usługi Ilość Cena jdn. brutto Rabat VAT Wartość brutto

1 KABEL BASEUS USB USB-C DURA FAST CHARGING 60W 1M szt 1.000 14,99 0,00 23 14,99
2 KABEL BASEUS USB USB-C DURA DYNAMIC 60W CZARNY 1M szt 1.000 14,99 0,00 23 14,99
3 KABEL BASEUS USB USB-C 0.3M szt 1.000 14,99 0,00 23 14,99
4 SLUCHAWKI MAXCOM MH31 szt 1.000 14,99 0,00 23 14,99
5 SLUCHAWKI MAXCOM MH32 szt 1.000 14,99 0,00 23 14,99
6 SLUCHAWKI JABRA EVOLVE 40 szt 1.000 14,99 0,00 23 14,99
7 CZAJNIK TEFAL KO250830 LOFT CZARNY 1.7L szt 1.000 149,99 0,00 23 149,99
8 ZELAZKO TEFAL ULTRAGLIDE EASYCORD szt 1.000 149,99 0,00 23 149,99
9 MONITOR LED SAMSUNG 24 LS24F330EAUXEN FHD VA 100HZ szt 1.000 309,00 0,00 23 309,00

PODSUMOWANIE
Razem brutto: 698,92
`.trim()

// IKEA PLFV/00203/FY26/0072284 – brutto, z Jdn., kody IKEA w nazwie
// Kody NNN.NNN.NN umieszczone po nazwie (LP parser wymaga liter na początku)
// qty=4 dla 3. pozycji → total=1 180,00 (Polish thousands) → Strategy D
const IKEA = `
FAKTURA VAT PLFV/00203/FY26/0072284
Data: 20.04.2026
NIP: 5260001478

Lp. Nazwa towaru/usługi Jdn. Ilość Cena jdn. brutto Rabat VAT Wartość brutto

1 ALEX komoda 36x70 ciemnoszary 605.888.94 szt 1.000 345,00 0,00 23 345,00
2 HELMER szafka z szufladami 006.199.02 szt 2.000 199,00 0,00 23 398,00
3 ALEX komoda 36x70 bialy 004.735.46 szt 4.000 295,00 0,00 23 1 180,00

PODSUMOWANIE
Razem brutto: 1 923,00
`.trim()

// EPTA 1109/2026 – brutto, z Jdn., 1 pozycja
const EPTA = `
FAKTURA VAT 1109/2026
Data: 05.05.2026
NIP: 5678901234

Lp. Nazwa towaru/usługi Jdn. Ilość Cena jdn. brutto Rabat VAT Wartość brutto

1 Ultramax mop szt 10.000 76,00 0,00 23 760,00

PODSUMOWANIE
Razem brutto: 760,00
Razem netto: 617,89
`.trim()

// CarShine 1/05/2026 – usługa brutto, 1 pozycja
const CARSHINE = `
FAKTURA VAT 1/05/2026
Data: 03.05.2026
NIP: 1122334455

Lp. Nazwa towaru/usługi Jdn. Ilość Cena jdn. brutto Rabat VAT Wartość brutto

1 Pranie dywanów i wykładzin usł. 1.000 525,00 0,00 23 525,00

PODSUMOWANIE
Razem brutto: 525,00
Razem netto: 426,83
`.trim()

// FS/3871/2026 – brutto, z Jdn., 1 pozycja (IKEA SKURUP)
const FS3871 = `
FAKTURA VAT FS/3871/2026
Data: 12.05.2026
NIP: 9988776655

Lp. Nazwa towaru/usługi Jdn. Ilość Cena jdn. brutto Rabat VAT Wartość brutto

1 SKURUP Lampa biurkowa czarna szt 1.000 83,98 0,00 23 83,98

PODSUMOWANIE
Razem brutto: 83,98
Razem netto: 68,28
`.trim()

// ── FV 00867/2026 ─────────────────────────────────────────────────────────────

describe('FV 00867/2026 — net + Jdn, 5 items', () => {
  const items = parseInvoiceItemsLP(FV00867)

  it('returns 5 items', () => expect(items.length).toBe(5))

  it('names contain correct product names (numbers in names stay)', () => {
    expect(items[0].rawName).toMatch(/rolka.*57\/15/i)
    expect(items[1].rawName).toMatch(/rolka.*57\/20/i)
    expect(items[2].rawName).toMatch(/zakre/i)    // zakreślacz
    expect(items[3].rawName).toMatch(/notes.*76\/127/i)
    expect(items[4].rawName).toMatch(/p[łl]yn.*400ml/i)
  })

  it('quantities parsed correctly (KSeF 50.000 → 50)', () => {
    expect(items[0].ilosc).toBe(50)
    expect(items[1].ilosc).toBe(50)
    expect(items[2].ilosc).toBe(10)
    expect(items[3].ilosc).toBe(12)
    expect(items[4].ilosc).toBe(1)
  })

  it('unit prices correct', () => {
    expect(eps(items[0].cenaNetto, 1.16)).toBe(true)
    expect(eps(items[1].cenaNetto, 1.24)).toBe(true)
    expect(eps(items[2].cenaNetto, 2.39)).toBe(true)
    expect(eps(items[3].cenaNetto, 2.94)).toBe(true)
    expect(eps(items[4].cenaNetto, 19.31)).toBe(true)
  })

  it('line totals correct', () => {
    expect(eps(items[0].wartoscNetto, 58.00)).toBe(true)
    expect(eps(items[1].wartoscNetto, 62.00)).toBe(true)
    expect(eps(items[2].wartoscNetto, 23.90)).toBe(true)
    expect(eps(items[3].wartoscNetto, 35.28)).toBe(true)
    expect(eps(items[4].wartoscNetto, 19.31)).toBe(true)
  })

  it('math validation: sum of lineTotals = 198.49', () => {
    const sum = items.reduce((s, i) => s + (i.wartoscNetto || 0), 0)
    expect(eps(sum, 198.49, 0.05)).toBe(true)
  })

  it('PODSUMOWANIE not in items', () => {
    const names = items.map(i => i.rawName.toLowerCase())
    expect(names.every(n => !n.includes('podsumowanie'))).toBe(true)
    expect(names.every(n => !n.includes('razem'))).toBe(true)
  })
})

// ── S596/F001032/05/2026 ──────────────────────────────────────────────────────

describe('S596/F001032/05/2026 — gross no-Jdn, 9 items', () => {
  const items = parseInvoiceItemsLP(S596)

  it('returns 9 items', () => expect(items.length).toBe(9))

  it('item[0] is KABEL BASEUS (not containing raw numbers from data)', () => {
    expect(items[0].rawName).toMatch(/kabel.*baseus/i)
    expect(items[0].rawName).not.toMatch(/14,99/)
    expect(items[0].rawName).not.toMatch(/1\.0000/)
  })

  it('item[6] is CZAJNIK TEFAL with KO250830 code', () => {
    expect(items[6].rawName).toMatch(/czajnik.*tefal/i)
    expect(items[6].rawName).toMatch(/ko250830/i)
  })

  it('item[8] MONITOR contains LS24F330EAUXEN and 100H', () => {
    expect(items[8].rawName).toMatch(/monitor/i)
    expect(items[8].rawName).toMatch(/ls24f330eauxen/i)
    expect(items[8].rawName).toMatch(/100h/i)
  })

  it('all quantities are 1', () => {
    items.forEach((item, i) => expect(item.ilosc).toBe(1))
  })

  it('prices 1-6: 14.99 brutto', () => {
    for (let i = 0; i < 6; i++) expect(eps(items[i].cenaNetto, 14.99)).toBe(true)
  })

  it('prices 7-8: 149.99 brutto', () => {
    expect(eps(items[6].cenaNetto, 149.99)).toBe(true)
    expect(eps(items[7].cenaNetto, 149.99)).toBe(true)
  })

  it('price 9: 309.00 brutto', () => {
    expect(eps(items[8].cenaNetto, 309.00)).toBe(true)
  })

  it('math: sum = 698.92', () => {
    const sum = items.reduce((s, i) => s + (i.wartoscNetto || 0), 0)
    expect(eps(sum, 698.92, 0.05)).toBe(true)
  })
})

// ── IKEA PLFV/00203/FY26/0072284 ─────────────────────────────────────────────

describe('IKEA PLFV/00203/FY26/0072284 — gross + Jdn + IKEA codes, thousands total', () => {
  const items = parseInvoiceItemsLP(IKEA)

  it('returns 3 items', () => expect(items.length).toBe(3))

  it('item[0] contains IKEA code 605.888.94 and ALEX', () => {
    expect(items[0].rawName).toMatch(/alex/i)
    expect(items[0].rawName).toMatch(/605\.888\.94/)
  })

  it('item[1] contains IKEA code 006.199.02 and HELMER', () => {
    expect(items[1].rawName).toMatch(/helmer/i)
    expect(items[1].rawName).toMatch(/006\.199\.02/)
  })

  it('item[2] contains IKEA code 004.735.46 and ALEX', () => {
    expect(items[2].rawName).toMatch(/alex/i)
    expect(items[2].rawName).toMatch(/004\.735\.46/)
  })

  it('quantities: 1, 2, 4', () => {
    expect(items[0].ilosc).toBe(1)
    expect(items[1].ilosc).toBe(2)
    expect(items[2].ilosc).toBe(4)
  })

  it('unit prices brutto: 345, 199, 295', () => {
    expect(eps(items[0].cenaNetto, 345.00)).toBe(true)
    expect(eps(items[1].cenaNetto, 199.00)).toBe(true)
    expect(eps(items[2].cenaNetto, 295.00)).toBe(true)
  })

  it('line totals brutto: 345, 398, 1180 (Strategy D — thousands-split total)', () => {
    expect(eps(items[0].wartoscNetto, 345.00)).toBe(true)
    expect(eps(items[1].wartoscNetto, 398.00)).toBe(true)
    expect(eps(items[2].wartoscNetto, 1180.00, 0.05)).toBe(true)
  })

  it('math: sum = 1923.00', () => {
    const sum = items.reduce((s, i) => s + (i.wartoscNetto || 0), 0)
    expect(eps(sum, 1923.00, 0.10)).toBe(true)
  })
})

// ── EPTA 1109/2026 ────────────────────────────────────────────────────────────

describe('EPTA 1109/2026 — gross + Jdn, qty=10', () => {
  const items = parseInvoiceItemsLP(EPTA)

  it('returns 1 item', () => expect(items.length).toBe(1))

  it('name contains "Ultramax"', () => {
    expect(items[0].rawName).toMatch(/ultramax/i)
  })

  it('quantity = 10 (not 1)', () => {
    expect(items[0].ilosc).toBe(10)
  })

  it('unit price brutto = 76.00', () => {
    expect(eps(items[0].cenaNetto, 76.00)).toBe(true)
  })

  it('line total brutto = 760.00', () => {
    expect(eps(items[0].wartoscNetto, 760.00)).toBe(true)
  })
})

// ── CarShine 1/05/2026 ────────────────────────────────────────────────────────

describe('CarShine 1/05/2026 — service, brutto', () => {
  const items = parseInvoiceItemsLP(CARSHINE)

  it('returns 1 item', () => expect(items.length).toBe(1))

  it('name contains "Pranie"', () => {
    expect(items[0].rawName).toMatch(/pranie/i)
  })

  it('unit is usł (service)', () => {
    const unit = items[0].unit || items[0].jednostka
    expect(unit).toMatch(/^us[łl]/i)
  })

  it('quantity = 1', () => {
    expect(items[0].ilosc).toBe(1)
  })

  it('price brutto = 525.00', () => {
    expect(eps(items[0].cenaNetto, 525.00)).toBe(true)
  })

  it('total brutto = 525.00', () => {
    expect(eps(items[0].wartoscNetto, 525.00)).toBe(true)
  })
})

// ── FS/3871/2026 ──────────────────────────────────────────────────────────────

describe('FS/3871/2026 — single item gross, SKURUP lamp', () => {
  const items = parseInvoiceItemsLP(FS3871)

  it('returns 1 item', () => expect(items.length).toBe(1))

  it('name contains SKURUP', () => {
    expect(items[0].rawName).toMatch(/skurup/i)
  })

  it('name contains Lampa', () => {
    expect(items[0].rawName).toMatch(/lampa/i)
  })

  it('quantity = 1', () => {
    expect(items[0].ilosc).toBe(1)
  })

  it('price brutto = 83.98', () => {
    expect(eps(items[0].cenaNetto, 83.98)).toBe(true)
  })

  it('total brutto = 83.98', () => {
    expect(eps(items[0].wartoscNetto, 83.98)).toBe(true)
  })
})

// ── detectColumnSchema ────────────────────────────────────────────────────────

describe('detectColumnSchema — 5 known schemas', () => {
  it('Schema 1: Net + Jdn + Discount', () => {
    const s = detectColumnSchema('Lp. Nazwa towaru/usługi Jdn. Ilość Cena jdn. netto Rabat [PLN] VAT Wartość netto')
    expect(s.priceType).toBe('net')
    expect(s.hasLp).toBe(true)
    expect(s.hasJdn).toBe(true)
    expect(s.hasDiscount).toBe(true)
    expect(s.hasVat).toBe(true)
    expect(s.numericColumnsFromRight).toEqual(['total', 'vat', 'discount', 'unitPrice', 'qty'])
  })

  it('Schema 2: Gross + no-Jdn + Discount', () => {
    const s = detectColumnSchema('Lp. Nazwa towaru/usługi Ilość Cena jdn. brutto Rabat [PLN] VAT Wartość brutto')
    expect(s.priceType).toBe('gross')
    expect(s.hasJdn).toBe(false)
    expect(s.hasDiscount).toBe(true)
    expect(s.numericColumnsFromRight).toEqual(['total', 'vat', 'discount', 'unitPrice', 'qty'])
  })

  it('Schema 3: Gross + Jdn + Discount', () => {
    const s = detectColumnSchema('Lp. Nazwa towaru/usługi Jdn. Ilość Cena jdn. brutto Rabat VAT Wartość brutto')
    expect(s.priceType).toBe('gross')
    expect(s.hasJdn).toBe(true)
    expect(s.hasDiscount).toBe(true)
    expect(s.numericColumnsFromRight).toEqual(['total', 'vat', 'discount', 'unitPrice', 'qty'])
  })

  it('Schema 4: Gross + Jdn + no-Discount', () => {
    const s = detectColumnSchema('Lp. Nazwa towaru/usługi Jdn. Ilość Cena jdn. brutto VAT Wartość brutto')
    expect(s.priceType).toBe('gross')
    expect(s.hasJdn).toBe(true)
    expect(s.hasDiscount).toBe(false)
    expect(s.numericColumnsFromRight).toEqual(['total', 'vat', 'unitPrice', 'qty'])
  })

  it('Schema 5: Net + no-Jdn + no-Discount', () => {
    const s = detectColumnSchema('Lp. Nazwa towaru/usługi Ilość Cena jdn. netto VAT Wartość netto')
    expect(s.priceType).toBe('net')
    expect(s.hasJdn).toBe(false)
    expect(s.hasDiscount).toBe(false)
    expect(s.numericColumnsFromRight).toEqual(['total', 'vat', 'unitPrice', 'qty'])
  })

  it('mixed headers → priceType mixed', () => {
    const s = detectColumnSchema('Cena netto VAT Wartość brutto')
    expect(s.priceType).toBe('mixed')
  })

  it('null input → no crash, unknown priceType', () => {
    const s = detectColumnSchema(null)
    expect(s.priceType).toBe('unknown')
    expect(Array.isArray(s.numericColumnsFromRight)).toBe(true)
  })
})

// ── splitMultiInvoicePdf ──────────────────────────────────────────────────────

describe('splitMultiInvoicePdf — multi-invoice detection', () => {
  it('single invoice → returns array of 1', () => {
    const text = 'FAKTURA VAT FV/001/2026\nData: 01.01.2026\nPozycja 1 szt 1 10,00 23 10,00\n'
    const parts = splitMultiInvoicePdf(text)
    expect(parts.length).toBe(1)
  })

  it('two FAKTURA VAT markers → splits into 2 segments', () => {
    const text = [
      'FAKTURA VAT S596/F001032/05/2026',
      'Data wystawienia: 10.05.2026',
      'Sprzedawca: Firma Testowa Sp. z o.o. NIP: 1234567890',
      'Produkt A szt 1 100,00 23 100,00',
      '',
      'FAKTURA VAT FV 00867/2026',
      'Data wystawienia: 15.05.2026',
      'Sprzedawca: Biuro Papiernicze Sp. z o.o. NIP: 9876543210',
      'Produkt B szt 2 50,00 23 100,00',
    ].join('\n')
    const parts = splitMultiInvoicePdf(text)
    expect(parts.length).toBe(2)
    expect(parts[0]).toMatch(/S596/)
    expect(parts[1]).toMatch(/00867/)
  })

  it('three invoices → 3 segments', () => {
    const text = [
      'FAKTURA VAT A/001/2026',
      'Sprzedawca: Firma A Sp. z o.o. NIP: 1111111111',
      'Data wystawienia: 01.05.2026',
      'Produkt A szt 1 10,00 23 10,00',
      '',
      'FAKTURA VAT B/002/2026',
      'Sprzedawca: Firma B Sp. z o.o. NIP: 2222222222',
      'Data wystawienia: 02.05.2026',
      'Produkt B szt 2 20,00 23 40,00',
      '',
      'FAKTURA VAT C/003/2026',
      'Sprzedawca: Firma C Sp. z o.o. NIP: 3333333333',
      'Data wystawienia: 03.05.2026',
      'Produkt C szt 3 30,00 23 90,00',
    ].join('\n')
    const parts = splitMultiInvoicePdf(text)
    expect(parts.length).toBe(3)
  })

  it('KSeF podgląd headers → split on each', () => {
    const text = [
      'Podgląd wygenerowany na podstawie danych pobranych z KSeF',
      'FAKTURA VAT NR FS/3871/2026',
      'Pozycja A szt 1 83,98',
      '',
      'Podgląd wygenerowany na podstawie danych pobranych z KSeF',
      'FAKTURA VAT NR CarShine/1/05/2026',
      'Pozycja B usł. 1 525,00',
    ].join('\n')
    const parts = splitMultiInvoicePdf(text)
    expect(parts.length).toBeGreaterThanOrEqual(2)
  })

  it('SaldeoSMART junk text between two invoices does not create a third segment', () => {
    const text = [
      'FAKTURA VAT FV/001/2026',
      'Sprzedawca: Firma A Sp. z o.o. NIP: 1234567890',
      'Produkt testowy szt 1 10,00 23 10,00',
      '',
      'Wizualizacja faktury pochodzi z SaldeoSMART. Ad.1. Kod wewnętrzny towaru.',
      '',
      'FAKTURA VAT FV/002/2026',
      'Sprzedawca: Firma B Sp. z o.o. NIP: 9876543210',
      'Inny produkt szt 2 5,00 23 10,00',
    ].join('\n')
    const parts = splitMultiInvoicePdf(text)
    // Only 2 FAKTURA VAT markers → 2 segments (SaldeoSMART is in body of segment 1)
    expect(parts.length).toBe(2)
    // No segment should START with the saldeo text
    const noJunkStart = parts.every(p => !p.match(/^wizualizacja.*saldeo/i))
    expect(noJunkStart).toBe(true)
  })

  it('empty input → returns empty array', () => {
    expect(splitMultiInvoicePdf('')).toEqual([])
    expect(splitMultiInvoicePdf(null)).toEqual([])
  })

  it('each segment from multi-invoice contains original invoice numbers', () => {
    const combined = [
      'FAKTURA VAT S596/F001032/05/2026',
      'Sprzedawca: Sklep Elektroniczny Sp. z o.o. NIP: 1234567890',
      'KABEL BASEUS USB-C szt 1.000 14,99 0,00 23 14,99',
      '',
      'FAKTURA VAT NR FV 00867/2026',
      'Sprzedawca: Biuro Papiernicze Sp. z o.o. NIP: 9876543210',
      'rolka 57/15 termo SZT 50.000 1,16 0,00 23 58,00',
      '',
      'FAKTURA VAT FS/3871/2026',
      'Sprzedawca: IKEA Retail Sp. z o.o. NIP: 5260001478',
      'SKURUP Lampa biurkowa czarna szt 1.000 83,98 0,00 23 83,98',
    ].join('\n')
    const parts = splitMultiInvoicePdf(combined)
    expect(parts.length).toBe(3)
    expect(parts.some(p => p.includes('S596'))).toBe(true)
    expect(parts.some(p => p.includes('00867'))).toBe(true)
    expect(parts.some(p => p.includes('3871'))).toBe(true)
  })
})

// ── validateInvoiceTotals regression (from invoiceMath) ──────────────────────

describe('validateInvoiceTotals — FV00867 net totals', () => {
  it('5 line totals sum to 198.49, valid', () => {
    // Net-only lines (no gross — gross validation skipped when sumGross=0)
    const lines = [
      { lineTotalNet: 58.00 },
      { lineTotalNet: 62.00 },
      { lineTotalNet: 23.90 },
      { lineTotalNet: 35.28 },
      { lineTotalNet: 19.31 },
    ]
    const r = validateInvoiceTotals(lines, { totalNet: 198.49 })
    expect(r.valid).toBe(true)
    expect(Math.abs(r.sumNet - 198.49)).toBeLessThan(0.02)
  })

  it('when gross lines provided, gross summary must also be provided', () => {
    const lines = [
      { lineTotalNet: 58.00, lineTotalGross: 71.34 },
    ]
    // totalGross not provided → diff = |71.34 - 0| > tol → valid=false
    const r = validateInvoiceTotals(lines, { totalNet: 58.00 })
    expect(r.valid).toBe(false)
    // but supplying totalGross makes it valid
    const r2 = validateInvoiceTotals(lines, { totalNet: 58.00, totalGross: 71.34 })
    expect(r2.valid).toBe(true)
  })
})
