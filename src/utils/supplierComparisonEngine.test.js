import { describe, it, expect } from 'vitest'
import { buildSupplierComparison } from './supplierComparisonEngine'

function makeInvoice(id, date, contractor = 'Firma A', contractorId = 1) {
  return {
    id,
    numer: `FV/${id}/2025`,
    data_zakupu: date,
    kontrahent_id: contractorId,
    kontrahenci: contractorId ? { id: contractorId, nazwa: contractor } : null,
  }
}

function makeLine(faktura_id, overrides = {}) {
  return {
    id: Math.random(),
    faktura_id,
    towar_id: 1,
    ilosc: 1,
    cena_netto: 10,
    raw_name: 'Domestos 1L',
    towary: { id: 1, nazwa: 'Domestos 1L' },
    ...overrides,
  }
}

describe('buildSupplierComparison', () => {
  it('obsługuje pusty input', () => {
    const r = buildSupplierComparison({})
    expect(r.hasEnoughData).toBe(false)
    expect(r.comparableProducts).toHaveLength(0)
    expect(r.supplierRanking).toHaveLength(0)
  })

  it('ignoruje pozycje bez ceny', () => {
    const invoices = [makeInvoice(1, '2025-01-01')]
    const invoiceLines = [makeLine(1, { cena_netto: 0 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(r.hasEnoughData).toBe(false)
    expect(r.supplierSpendBreakdown).toHaveLength(0)
  })

  it('ignoruje faktury bez kontrahenta', () => {
    const invoices = [makeInvoice(1, '2025-01-01', null, null)]
    const invoiceLines = [makeLine(1, { cena_netto: 10 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(r.hasEnoughData).toBe(false)
    expect(r.supplierSpendBreakdown).toHaveLength(0)
  })

  it('grupuje produkty po towar_id', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma B', 2)]
    const invoiceLines = [
      makeLine(1, { towar_id: 5, cena_netto: 10, towary: { id: 5, nazwa: 'Produkt X' } }),
      makeLine(2, { towar_id: 5, cena_netto: 12, towary: { id: 5, nazwa: 'Produkt X' } }),
    ]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(r.comparableProducts).toHaveLength(1)
    expect(r.comparableProducts[0].name).toBe('Produkt X')
  })

  it('fallback grupowania po znormalizowanej nazwie pozycji', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma B', 2)]
    const invoiceLines = [
      makeLine(1, { towar_id: null, raw_name: 'Rękawice M', towary: null, cena_netto: 5 }),
      makeLine(2, { towar_id: null, raw_name: 'Rękawice M', towary: null, cena_netto: 7 }),
    ]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(r.comparableProducts).toHaveLength(1)
    expect(r.comparableProducts[0].name).toBe('Rękawice M')
  })

  it('wykrywa produkt kupowany u minimum dwóch dostawców', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma B', 2)]
    const invoiceLines = [makeLine(1, { cena_netto: 10 }), makeLine(2, { cena_netto: 12 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(r.comparableProducts).toHaveLength(1)
    expect(r.hasEnoughData).toBe(true)
  })

  it('nie traktuje produktu z jednym dostawcą jako porównywalnego', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma A', 1)]
    const invoiceLines = [makeLine(1, { cena_netto: 10 }), makeLine(2, { cena_netto: 12 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(r.comparableProducts).toHaveLength(0)
    expect(r.hasEnoughData).toBe(false)
  })

  it('liczy średnią cenę per dostawca dla produktu', () => {
    const invoices = [
      makeInvoice(1, '2025-01-01', 'Firma A', 1),
      makeInvoice(2, '2025-02-01', 'Firma A', 1),
      makeInvoice(3, '2025-03-01', 'Firma B', 2),
    ]
    const invoiceLines = [
      makeLine(1, { cena_netto: 8 }),
      makeLine(2, { cena_netto: 12 }),
      makeLine(3, { cena_netto: 15 }),
    ]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(r.comparableProducts).toHaveLength(1)
    // Firma A avg = (8+12)/2 = 10, Firma B avg = 15
    expect(r.comparableProducts[0].minAvgPrice).toBeCloseTo(10, 1)
    expect(r.comparableProducts[0].maxAvgPrice).toBeCloseTo(15, 1)
  })

  it('wykrywa najtańszego dostawcę dla produktu', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma B', 2)]
    const invoiceLines = [makeLine(1, { cena_netto: 8 }), makeLine(2, { cena_netto: 12 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(r.comparableProducts[0].cheapestSupplier).toBe('Firma A')
  })

  it('wykrywa najdroższego dostawcę dla produktu', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma B', 2)]
    const invoiceLines = [makeLine(1, { cena_netto: 8 }), makeLine(2, { cena_netto: 12 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(r.comparableProducts[0].mostExpensiveSupplier).toBe('Firma B')
  })

  it('liczy różnicę PLN', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma B', 2)]
    const invoiceLines = [makeLine(1, { cena_netto: 8 }), makeLine(2, { cena_netto: 12 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(r.comparableProducts[0].diffPLN).toBeCloseTo(4, 1)
  })

  it('liczy różnicę procentową', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma B', 2)]
    const invoiceLines = [makeLine(1, { cena_netto: 10 }), makeLine(2, { cena_netto: 12 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    // diff = 2, base = 10 → 20%
    expect(r.comparableProducts[0].diffPct).toBeCloseTo(20, 1)
  })

  it('buduje supplierRanking', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma B', 2)]
    const invoiceLines = [makeLine(1, { cena_netto: 10 }), makeLine(2, { cena_netto: 12 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(r.supplierRanking).toHaveLength(2)
    expect(r.supplierRanking[0]).toHaveProperty('supplier')
    expect(r.supplierRanking[0]).toHaveProperty('priceIndex')
  })

  it('liczy priceIndex względem mediany', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma B', 2)]
    const invoiceLines = [makeLine(1, { cena_netto: 10 }), makeLine(2, { cena_netto: 12 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    // median([10,12]) = 11
    // A: 10/11 ≈ 0.909, B: 12/11 ≈ 1.091
    const rankA = r.supplierRanking.find(s => s.supplier === 'Firma A')
    const rankB = r.supplierRanking.find(s => s.supplier === 'Firma B')
    expect(rankA.priceIndex).toBeCloseTo(10 / 11, 2)
    expect(rankB.priceIndex).toBeCloseTo(12 / 11, 2)
  })

  it('wykrywa najtańszego dostawcę wg priceIndex', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma B', 2)]
    const invoiceLines = [makeLine(1, { cena_netto: 10 }), makeLine(2, { cena_netto: 12 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(r.kpis.cheapestSupplier).toBe('Firma A')
    expect(r.kpis.cheapestPriceIndex).toBeLessThan(1)
  })

  it('wykrywa najdroższego dostawcę wg priceIndex', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma B', 2)]
    const invoiceLines = [makeLine(1, { cena_netto: 10 }), makeLine(2, { cena_netto: 12 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(r.kpis.mostExpensiveSupplier).toBe('Firma B')
    expect(r.kpis.mostExpensivePriceIndex).toBeGreaterThan(1)
  })

  it('buduje savingsOpportunities', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma B', 2)]
    const invoiceLines = [makeLine(1, { cena_netto: 8 }), makeLine(2, { cena_netto: 12 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    // diff = 4 PLN, 50% — should trigger savings
    expect(r.savingsOpportunities).toHaveLength(1)
    expect(r.savingsOpportunities[0].suggestion).toContain('Rozważ zakup u')
  })

  it('buduje supplierSpendBreakdown', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma B', 2)]
    const invoiceLines = [makeLine(1, { cena_netto: 10, ilosc: 2 }), makeLine(2, { cena_netto: 12, ilosc: 1 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(r.supplierSpendBreakdown).toHaveLength(2)
    expect(r.supplierSpendBreakdown[0]).toHaveProperty('supplier')
    expect(r.supplierSpendBreakdown[0]).toHaveProperty('totalSpend')
    // Firma A: 10*2=20, Firma B: 12*1=12 → A is biggest
    expect(r.supplierSpendBreakdown[0].supplier).toBe('Firma A')
    expect(r.supplierSpendBreakdown[0].totalSpend).toBeCloseTo(20, 1)
  })

  it('obsługuje productQuery — filtruje do pasujących produktów', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1), makeInvoice(2, '2025-02-01', 'Firma B', 2)]
    const invoiceLines = [
      makeLine(1, { towar_id: 1, cena_netto: 8, towary: { id: 1, nazwa: 'Domestos 1L' } }),
      makeLine(2, { towar_id: 1, cena_netto: 10, towary: { id: 1, nazwa: 'Domestos 1L' } }),
    ]
    const r = buildSupplierComparison({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(r.comparableProducts).toHaveLength(1)
    expect(r.productQuery).toBe('Domestos')
  })

  it('obsługuje productQuery bez wyników', () => {
    const invoices = [makeInvoice(1, '2025-01-01')]
    const invoiceLines = [makeLine(1, { cena_netto: 10 })]
    const r = buildSupplierComparison({ invoices, invoiceLines, productQuery: 'NieistniejącyProdukt' })
    expect(r.hasEnoughData).toBe(false)
    expect(r.summaryText).toMatch(/nie znalazłem/i)
  })

  it('nie zwraca NaN ani Infinity', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A', 1)]
    const invoiceLines = [makeLine(1, { cena_netto: 5 })]
    const r = buildSupplierComparison({ invoices, invoiceLines })
    expect(isNaN(r.kpis.supplierCount)).toBe(false)
    expect(isFinite(r.kpis.totalSpend)).toBe(true)
    expect(isFinite(r.kpis.cheapestPriceIndex ?? 0)).toBe(true)
    expect(isFinite(r.kpis.mostExpensivePriceIndex ?? 0)).toBe(true)
  })
})
