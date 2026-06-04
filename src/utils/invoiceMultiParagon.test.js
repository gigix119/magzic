import { describe, it, expect } from 'vitest'
import { parseParagon } from './invoiceParagonParser.js'
import { quickParseInvoiceHeader, splitMultiInvoicePdf, parseInvoiceItemsLP } from './invoiceExtractor.js'

// ── parseParagon ──────────────────────────────────────────────────────────────

const PARAGON_TEXT = `Przedsiębiorstwo Handlowe "TEXTIL-MAR"
Marek Nawrocki
Morska 7A / 81
84-240 Reda
BDO: 000307064
NIP: 848-107-70-54   W002908
PARAGON FISKALNY
ZAMEK 2 szt.*6.00   12.00A
NICI 1 szt.*5.00   5.00A
Sprzedaż opodatkowana A:   17.00
Kwota PTU A 23%   3.18
SUMA PTU   3.18
SUMA:   PLN 17.00
DO ZAPŁATY:   17.00
NIP nabywcy:
6912507795
05-05-2026 13:20
Nr Sys.:   PA 2816/PU/2026`

describe('parseParagon', () => {
  it('parses 2 items', () => {
    const r = parseParagon(PARAGON_TEXT)
    expect(r.lines).toHaveLength(2)
  })

  it('ZAMEK: qty=2, unitPriceGross=6.00, lineTotalGross=12.00, vat=23', () => {
    const r = parseParagon(PARAGON_TEXT)
    const zamek = r.lines[0]
    expect(zamek.rawName).toBe('ZAMEK')
    expect(zamek.quantity).toBe(2)
    expect(zamek.unitPriceGross).toBeCloseTo(6.00, 2)
    expect(zamek.lineTotalGross).toBeCloseTo(12.00, 2)
    expect(zamek.vat).toBe(23)
    expect(zamek.mathValid).toBe(true)
  })

  it('NICI: qty=1, lineTotalGross=5.00', () => {
    const r = parseParagon(PARAGON_TEXT)
    const nici = r.lines[1]
    expect(nici.rawName).toBe('NICI')
    expect(nici.quantity).toBe(1)
    expect(nici.lineTotalGross).toBeCloseTo(5.00, 2)
  })

  it('totals: gross=17.00, vat≈3.18', () => {
    const r = parseParagon(PARAGON_TEXT)
    expect(r.totalGross).toBeCloseTo(17.00, 2)
    expect(r.totalVat).toBeCloseTo(3.18, 2)
  })

  it('metadata: seller NIP, buyer NIP, doc number, documentType', () => {
    const r = parseParagon(PARAGON_TEXT)
    expect(r.sellerNip).toBe('8481077054')
    expect(r.buyerNip).toBe('6912507795')
    expect(r.invoiceNumber).toContain('2816')
    expect(r.documentType).toBe('paragon')
    expect(r.priceMode).toBe('gross')
  })

  it('net prices derived from gross + VAT', () => {
    const r = parseParagon(PARAGON_TEXT)
    const zamek = r.lines[0]
    // 12.00 / 1.23 ≈ 9.76
    expect(zamek.lineTotalNet).toBeCloseTo(12.00 / 1.23, 2)
    expect(zamek.unitPriceNet).toBeCloseTo(6.00 / 1.23, 2)
  })

  it('empty text returns 0 items with low confidence', () => {
    const r = parseParagon('PARAGON FISKALNY\nSUMA: PLN 0.00')
    expect(r.lines).toHaveLength(0)
    expect(r.confidence).toBeLessThan(50)
  })
})

// ── quickParseInvoiceHeader ───────────────────────────────────────────────────

describe('quickParseInvoiceHeader', () => {
  it('extracts invoice number from FAKTURA VAT line', () => {
    const h = quickParseInvoiceHeader('FAKTURA VAT S596/F001032/05/2026\nData: 10.05.2026\n')
    expect(h.invoiceNumber).toContain('S596')
  })

  it('extracts NR variant', () => {
    const h = quickParseInvoiceHeader('FAKTURA VAT NR FV 00867/2026\nData: 15.05.2026\n')
    expect(h.invoiceNumber).toMatch(/FV\s*00867/)
  })

  it('detects paragon docType', () => {
    const h = quickParseInvoiceHeader('PARAGON FISKALNY\nNr Sys.: PA 123/2026\n')
    expect(h.docType).toBe('paragon')
    expect(h.invoiceNumber).toMatch(/123/)
  })

  it('extracts seller NIP', () => {
    const h = quickParseInvoiceHeader('FAKTURA VAT FV/001/2026\nNIP: 123-456-78-90\n')
    expect(h.sellerNip).toBe('1234567890')
  })

  it('detects gross priceMode', () => {
    const h = quickParseInvoiceHeader('FAKTURA VAT FV/001/2026\nCena jdn. brutto\nWartość brutto\n')
    expect(h.priceMode).toBe('gross')
  })

  it('detects net priceMode', () => {
    const h = quickParseInvoiceHeader('FAKTURA VAT FV/001/2026\nCena jdn. netto\nWartość netto\n')
    expect(h.priceMode).toBe('net')
  })

  it('extracts total from Razem brutto', () => {
    const h = quickParseInvoiceHeader('FAKTURA VAT FV/001/2026\nRazem brutto: 698,92\n')
    expect(h.totalAmount).toBeCloseTo(698.92, 2)
  })

  it('handles null/empty input without crash', () => {
    expect(() => quickParseInvoiceHeader(null)).not.toThrow()
    expect(() => quickParseInvoiceHeader('')).not.toThrow()
  })
})

// ── splitMultiInvoicePdf + quickParseInvoiceHeader integration ────────────────

describe('multi-invoice PDF integration', () => {
  const multi = [
    'FAKTURA VAT S596/F001032/05/2026',
    'Sprzedawca: Sklep ABC Sp. z o.o. NIP: 1234567890',
    'KABEL BASEUS szt 1.000 14,99 0,00 23 14,99',
    '',
    'FAKTURA VAT NR FV 00867/2026',
    'Sprzedawca: Biuro XYZ Sp. z o.o. NIP: 9876543210',
    'rolka 57/15 termo SZT 50.000 1,16 0,00 23 58,00',
  ].join('\n')

  it('splits into 2 segments', () => {
    const parts = splitMultiInvoicePdf(multi)
    expect(parts.length).toBe(2)
  })

  it('each segment has correct invoice number via quickParseInvoiceHeader', () => {
    const parts = splitMultiInvoicePdf(multi)
    const h0 = quickParseInvoiceHeader(parts[0])
    const h1 = quickParseInvoiceHeader(parts[1])
    expect(h0.invoiceNumber).toMatch(/S596/)
    expect(h1.invoiceNumber).toMatch(/00867/)
  })

  it('skips SaldeoSMART junk pages (no dedicated marker = stays in segment)', () => {
    const withJunk = multi + '\n\nWizualizacja faktury pochodzi z SaldeoSMART.\n'
    const parts = splitMultiInvoicePdf(withJunk)
    expect(parts.length).toBe(2)
  })
})

// ── Quantity suggestions ──────────────────────────────────────────────────────
// suggestedQuantity fires in makeItem() when ilosc=1, cenaNetto>0,
// wartoscNetto > cenaNetto*1.5, AND round(wartoscNetto/cenaNetto)*cenaNetto ≈ wartoscNetto.
// The LP parser's Strategy C usually fixes the total so ilosc*price=total —
// these tests verify: correct qty→no suggestion, and a paragon item → no spurious suggestion.

describe('quantity suggestions', () => {
  it('EPTA qty=10: no suggestion when total correctly parsed', () => {
    // LP parser correctly returns qty=10, cenaNetto=76, wartoscNetto=760
    const text = ['FAKTURA', 'Lp.', '1 Ultramax mop szt 10.000 76,00 0,00 23 760,00', 'RAZEM'].join('\n')
    const items = parseInvoiceItemsLP(text)
    expect(items.length).toBeGreaterThan(0)
    const item = items[0]
    expect(item.ilosc).toBe(10)
    expect(item.suggestedQuantity).toBeFalsy()
  })

  it('paragon item: no suggestion (price=total for qty=1)', () => {
    const r = parseParagon(PARAGON_TEXT)
    // NICI: qty=1, price=5, total=5 → 5 not > 5*1.5 → no suggestion
    const nici = r.lines[1]
    expect(nici.quantity).toBe(1)
    expect(nici.suggestedQuantity).toBeFalsy()
  })

  it('paragon item ZAMEK qty=2: no suggestion', () => {
    const r = parseParagon(PARAGON_TEXT)
    const zamek = r.lines[0]
    // qty=2 ≠ 1 → suggestion condition not met
    expect(zamek.quantity).toBe(2)
    expect(zamek.suggestedQuantity).toBeFalsy()
  })

  it('suggestedQuantity field not present on well-parsed items (FV00867 fixture)', () => {
    // All items in FV00867 have qty correctly parsed via KSeF qty format
    const FV00867 = [
      'FAKTURA VAT NR FV 00867/2026',
      'Lp. Nazwa Jdn. Ilość Cena netto Rabat VAT Wartość netto',
      '1 rolka 57/15 termo SZT 50.000 1,16 0,00 23 58,00',
      '2 rolka 57/20m szt 50.000 1,24 0,00 23 62,00',
      'PODSUMOWANIE',
    ].join('\n')
    const items = parseInvoiceItemsLP(FV00867)
    expect(items.length).toBe(2)
    // qty=50 for both → no suggestion
    items.forEach(item => expect(item.suggestedQuantity).toBeFalsy())
  })
})
