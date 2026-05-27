import { describe, it, expect } from 'vitest'
import { compareInvoices } from './invoiceComparisonEngine'

function makeInv(id, numer, date, kontrahent_id = 1, kontrahentNazwa = 'Dostawca A') {
  return { id, numer, data_zakupu: date, typ: 'zakup', status: 'zatwierdzona', kontrahent_id, kontrahenci: { id: kontrahent_id, nazwa: kontrahentNazwa } }
}

function makeLine(id, faktura_id, towar_id, ilosc, cena_netto, vat_procent = 23, raw_name = null, nazwa = null) {
  return {
    id, faktura_id, towar_id, ilosc, cena_netto, vat_procent, raw_name,
    towary: towar_id ? { id: towar_id, nazwa: nazwa ?? `Towar ${towar_id}`, jednostka: 'szt' } : null,
  }
}

const invA = makeInv(1, 'F/001/2025', '2025-01-10')
const invB = makeInv(2, 'F/002/2025', '2025-02-10')

describe('compareInvoices', () => {
  it('porównuje sumy brutto', () => {
    const linesA = [makeLine(1, 1, 10, 2, 100, 23)]   // netto=200, brutto=246
    const linesB = [makeLine(2, 2, 10, 2, 120, 23)]   // netto=240, brutto=295.2
    const r = compareInvoices({ invoiceA: invA, invoiceB: invB, invoiceALines: linesA, invoiceBLines: linesB })
    expect(r.kpis.bruttoA).toBeCloseTo(246, 0)
    expect(r.kpis.bruttoB).toBeCloseTo(295.2, 0)
  })

  it('porównuje sumy netto', () => {
    const linesA = [makeLine(1, 1, 10, 2, 100)]
    const linesB = [makeLine(2, 2, 10, 2, 130)]
    const r = compareInvoices({ invoiceA: invA, invoiceB: invB, invoiceALines: linesA, invoiceBLines: linesB })
    expect(r.invoiceAInfo.netto).toBeCloseTo(200, 1)
    expect(r.invoiceBInfo.netto).toBeCloseTo(260, 1)
  })

  it('liczy różnicę PLN (diffBrutto)', () => {
    const linesA = [makeLine(1, 1, 10, 1, 100, 0)]  // brutto=100
    const linesB = [makeLine(2, 2, 10, 1, 150, 0)]  // brutto=150
    const r = compareInvoices({ invoiceA: invA, invoiceB: invB, invoiceALines: linesA, invoiceBLines: linesB })
    expect(r.kpis.diffBrutto).toBeCloseTo(50, 1)
  })

  it('liczy różnicę procentową (diffBruttoPct)', () => {
    const linesA = [makeLine(1, 1, 10, 1, 100, 0)]
    const linesB = [makeLine(2, 2, 10, 1, 125, 0)]
    const r = compareInvoices({ invoiceA: invA, invoiceB: invB, invoiceALines: linesA, invoiceBLines: linesB })
    expect(r.kpis.diffBruttoPct).toBeCloseTo(25, 0)
  })

  it('dopasowuje pozycje po towar_id', () => {
    const linesA = [makeLine(1, 1, 10, 1, 100)]
    const linesB = [makeLine(2, 2, 10, 1, 120)]
    const r = compareInvoices({ invoiceA: invA, invoiceB: invB, invoiceALines: linesA, invoiceBLines: linesB })
    expect(r.matchedLines).toHaveLength(1)
    expect(r.matchedLines[0].priceA).toBe(100)
    expect(r.matchedLines[0].priceB).toBe(120)
  })

  it('fallback dopasowania po znormalizowanej nazwie', () => {
    const linesA = [{ id: 1, faktura_id: 1, towar_id: null, ilosc: 1, cena_netto: 50, vat_procent: 23, raw_name: 'Jabłka Świeże', towary: null }]
    const linesB = [{ id: 2, faktura_id: 2, towar_id: null, ilosc: 1, cena_netto: 60, vat_procent: 23, raw_name: 'jabłka świeże', towary: null }]
    const r = compareInvoices({ invoiceA: invA, invoiceB: invB, invoiceALines: linesA, invoiceBLines: linesB })
    expect(r.matchedLines).toHaveLength(1)
  })

  it('wykrywa pozycje tylko w fakturze A (onlyInA)', () => {
    const linesA = [makeLine(1, 1, 10, 1, 100), makeLine(2, 1, 20, 1, 50)]
    const linesB = [makeLine(3, 2, 10, 1, 100)]
    const r = compareInvoices({ invoiceA: invA, invoiceB: invB, invoiceALines: linesA, invoiceBLines: linesB })
    expect(r.onlyInA).toHaveLength(1)
    expect(r.onlyInA[0].key).toBe('id:20')
  })

  it('wykrywa pozycje tylko w fakturze B (onlyInB)', () => {
    const linesA = [makeLine(1, 1, 10, 1, 100)]
    const linesB = [makeLine(2, 2, 10, 1, 100), makeLine(3, 2, 30, 1, 75)]
    const r = compareInvoices({ invoiceA: invA, invoiceB: invB, invoiceALines: linesA, invoiceBLines: linesB })
    expect(r.onlyInB).toHaveLength(1)
    expect(r.onlyInB[0].key).toBe('id:30')
  })

  it('wykrywa wzrost ceny jednostkowej', () => {
    const linesA = [makeLine(1, 1, 10, 1, 100)]
    const linesB = [makeLine(2, 2, 10, 1, 130)]
    const r = compareInvoices({ invoiceA: invA, invoiceB: invB, invoiceALines: linesA, invoiceBLines: linesB })
    expect(r.priceChanges).toHaveLength(1)
    expect(r.priceChanges[0].priceDiff).toBeCloseTo(30, 1)
    expect(r.priceChanges[0].priceDiffPct).toBeCloseTo(30, 0)
  })

  it('wykrywa spadek ceny jednostkowej', () => {
    const linesA = [makeLine(1, 1, 10, 1, 200)]
    const linesB = [makeLine(2, 2, 10, 1, 160)]
    const r = compareInvoices({ invoiceA: invA, invoiceB: invB, invoiceALines: linesA, invoiceBLines: linesB })
    expect(r.priceChanges[0].priceDiff).toBeCloseTo(-40, 1)
    expect(r.priceChanges[0].priceDiffPct).toBeCloseTo(-20, 0)
  })

  it('ostrzeżenie gdy inny kontrahent', () => {
    const invA2 = makeInv(1, 'F/001', '2025-01-10', 1, 'Firma A')
    const invB2 = makeInv(2, 'F/002', '2025-02-10', 2, 'Firma B')
    const linesA = [makeLine(1, 1, 10, 1, 100)]
    const linesB = [makeLine(2, 2, 10, 1, 100)]
    const r = compareInvoices({ invoiceA: invA2, invoiceB: invB2, invoiceALines: linesA, invoiceBLines: linesB })
    expect(r.warnings.some(w => w.includes('kontrahent'))).toBe(true)
  })

  it('obsługuje brak dwóch faktur (null)', () => {
    const r = compareInvoices({ invoiceA: null, invoiceB: null })
    expect(r.hasEnoughData).toBe(false)
    expect(typeof r.summaryText).toBe('string')
    expect(r.summaryText.length).toBeGreaterThan(5)
  })

  it('nie zwraca NaN ani Infinity', () => {
    const linesA = [makeLine(1, 1, null, 0, 0, 0)]
    const linesB = [makeLine(2, 2, null, 0, 0, 0)]
    const r = compareInvoices({ invoiceA: invA, invoiceB: invB, invoiceALines: linesA, invoiceBLines: linesB })
    expect(isFinite(r.kpis?.diffBrutto ?? 0)).toBe(true)
    expect(isFinite(r.kpis?.diffBruttoPct ?? 0)).toBe(true)
    expect(isNaN(r.kpis?.bruttoA ?? 0)).toBe(false)
  })
})
