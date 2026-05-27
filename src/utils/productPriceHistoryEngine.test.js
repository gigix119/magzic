import { describe, it, expect } from 'vitest'
import { buildProductPriceHistory } from './productPriceHistoryEngine'

function makeInvoice(id, date, contractor = 'Firma A') {
  return {
    id,
    numer: `FV/${id}/2025`,
    data_zakupu: date,
    kontrahent_id: 1,
    kontrahenci: { id: 1, nazwa: contractor },
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

describe('buildProductPriceHistory', () => {
  it('wykrywa brak productQuery', () => {
    const r = buildProductPriceHistory({})
    expect(r.hasEnoughData).toBe(false)
    expect(r.summaryText).toMatch(/Podaj nazwę produktu/i)
  })

  it('znajduje historię po towar_id / nazwie towaru', () => {
    const invoices = [makeInvoice(1, '2025-01-01')]
    const invoiceLines = [makeLine(1, { towary: { id: 1, nazwa: 'Domestos 1L' }, cena_netto: 9 })]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(r.priceHistory).toHaveLength(1)
    expect(r.hasEnoughData).toBe(true)
  })

  it('znajduje historię po raw_name pozycji', () => {
    const invoices = [makeInvoice(1, '2025-01-01')]
    const invoiceLines = [makeLine(1, { towar_id: null, raw_name: 'Kret 1L', towary: null, cena_netto: 7 })]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'kret' })
    expect(r.priceHistory).toHaveLength(1)
  })

  it('sortuje historię rosnąco po dacie', () => {
    const invoices = [makeInvoice(1, '2025-03-01'), makeInvoice(2, '2025-01-01')]
    const invoiceLines = [makeLine(1, { cena_netto: 12 }), makeLine(2, { cena_netto: 9 })]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(r.priceHistory[0].date).toBe('2025-01-01')
    expect(r.priceHistory[1].date).toBe('2025-03-01')
  })

  it('ignoruje ceny zerowe/null', () => {
    const invoices = [makeInvoice(1, '2025-01-01'), makeInvoice(2, '2025-02-01')]
    const invoiceLines = [
      makeLine(1, { cena_netto: 0 }),
      makeLine(2, { cena_netto: 10 }),
    ]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(r.priceHistory).toHaveLength(1)
    expect(r.priceHistory[0].price).toBe(10)
  })

  it('liczy pierwszą cenę', () => {
    const invoices = [makeInvoice(1, '2025-01-01'), makeInvoice(2, '2025-03-01')]
    const invoiceLines = [makeLine(1, { cena_netto: 8 }), makeLine(2, { cena_netto: 11 })]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(r.kpis.firstPrice).toBe(8)
  })

  it('liczy ostatnią cenę', () => {
    const invoices = [makeInvoice(1, '2025-01-01'), makeInvoice(2, '2025-03-01')]
    const invoiceLines = [makeLine(1, { cena_netto: 8 }), makeLine(2, { cena_netto: 11 })]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(r.kpis.lastPrice).toBe(11)
  })

  it('liczy najniższą cenę', () => {
    const invoices = [makeInvoice(1, '2025-01-01'), makeInvoice(2, '2025-03-01'), makeInvoice(3, '2025-05-01')]
    const invoiceLines = [makeLine(1, { cena_netto: 8 }), makeLine(2, { cena_netto: 6 }), makeLine(3, { cena_netto: 11 })]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(r.kpis.minPrice).toBe(6)
  })

  it('liczy najwyższą cenę', () => {
    const invoices = [makeInvoice(1, '2025-01-01'), makeInvoice(2, '2025-03-01'), makeInvoice(3, '2025-05-01')]
    const invoiceLines = [makeLine(1, { cena_netto: 8 }), makeLine(2, { cena_netto: 6 }), makeLine(3, { cena_netto: 11 })]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(r.kpis.maxPrice).toBe(11)
  })

  it('liczy średnią cenę', () => {
    const invoices = [makeInvoice(1, '2025-01-01'), makeInvoice(2, '2025-03-01')]
    const invoiceLines = [makeLine(1, { cena_netto: 8 }), makeLine(2, { cena_netto: 12 })]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(r.kpis.avgPrice).toBeCloseTo(10, 1)
  })

  it('liczy zmianę PLN', () => {
    const invoices = [makeInvoice(1, '2025-01-01'), makeInvoice(2, '2025-03-01')]
    const invoiceLines = [makeLine(1, { cena_netto: 8 }), makeLine(2, { cena_netto: 10 })]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(r.kpis.diffPLN).toBeCloseTo(2, 1)
  })

  it('liczy zmianę procentową', () => {
    const invoices = [makeInvoice(1, '2025-01-01'), makeInvoice(2, '2025-03-01')]
    const invoiceLines = [makeLine(1, { cena_netto: 10 }), makeLine(2, { cena_netto: 12 })]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(r.kpis.diffPct).toBeCloseTo(20, 1)
  })

  it('buduje supplierBreakdown', () => {
    const invoices = [makeInvoice(1, '2025-01-01', 'Firma A'), makeInvoice(2, '2025-03-01', 'Firma B')]
    const invoiceLines = [makeLine(1, { cena_netto: 10 }), makeLine(2, { cena_netto: 12 })]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(r.supplierBreakdown).toHaveLength(2)
    expect(r.supplierBreakdown[0]).toHaveProperty('supplier')
    expect(r.supplierBreakdown[0]).toHaveProperty('avgPrice')
  })

  it('obsługuje tylko jeden zakup', () => {
    const invoices = [makeInvoice(1, '2025-01-01')]
    const invoiceLines = [makeLine(1, { cena_netto: 9.5 })]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(r.hasEnoughData).toBe(true)
    expect(r.warnings.some(w => /jeden zakup/i.test(w))).toBe(true)
    expect(r.kpis.purchaseCount).toBe(1)
  })

  it('obsługuje brak dopasowań', () => {
    const invoices = [makeInvoice(1, '2025-01-01')]
    const invoiceLines = [makeLine(1, { cena_netto: 10, towary: { id: 1, nazwa: 'Zupełnie inny produkt' }, raw_name: 'Zupełnie inny produkt' })]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(r.hasEnoughData).toBe(false)
    expect(r.priceHistory).toHaveLength(0)
  })

  it('nie zwraca NaN ani Infinity', () => {
    const invoices = [makeInvoice(1, '2025-01-01')]
    const invoiceLines = [makeLine(1, { cena_netto: 5 })]
    const r = buildProductPriceHistory({ invoices, invoiceLines, productQuery: 'Domestos' })
    expect(isNaN(r.kpis.purchaseCount)).toBe(false)
    expect(isFinite(r.kpis.firstPrice)).toBe(true)
    expect(isFinite(r.kpis.diffPct ?? 0)).toBe(true)
  })
})
