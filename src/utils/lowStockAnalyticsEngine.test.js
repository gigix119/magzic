import { describe, it, expect } from 'vitest'
import { buildLowStockAnalysis } from './lowStockAnalyticsEngine'

function makeProduct(id, nazwa, stan_minimalny, jednostka = 'szt.') {
  return { id, nazwa, jednostka, stan_minimalny, kategorie: null }
}

function makeStock(towar_id, ilosc, magazyn_id = 1) {
  return { towar_id, ilosc, magazyn_id, magazyny: { id: magazyn_id, nazwa: `Magazyn ${magazyn_id}` } }
}

function makeInvoice(id, date, contractor = 'Dostawca A') {
  return { id, data_zakupu: date, kontrahent_id: 1, kontrahenci: { id: 1, nazwa: contractor } }
}

function makeLine(faktura_id, towar_id, cena_netto, raw_name = null) {
  return {
    id: Math.random(),
    faktura_id,
    towar_id,
    cena_netto,
    ilosc: 1,
    raw_name,
    towary: towar_id ? { id: towar_id, nazwa: `Towar ${towar_id}` } : null,
  }
}

describe('buildLowStockAnalysis', () => {
  it('wykrywa produkt poniżej minimum', () => {
    const products = [makeProduct(1, 'Towar A', 50)]
    const stockRows = [makeStock(1, 20)]
    const r = buildLowStockAnalysis({ products, stockRows })
    expect(r.belowMinimum).toHaveLength(1)
    expect(r.belowMinimum[0].name).toBe('Towar A')
  })

  it('wykrywa produkt krytyczny (stan 0)', () => {
    const products = [makeProduct(1, 'Towar A', 50)]
    const stockRows = []
    const r = buildLowStockAnalysis({ products, stockRows })
    expect(r.criticalItems).toHaveLength(1)
    expect(r.criticalItems[0].isCritical).toBe(true)
  })

  it('wykrywa produkt krytyczny (stan < 25% minimum)', () => {
    const products = [makeProduct(1, 'Towar A', 100)]
    const stockRows = [makeStock(1, 20)]  // 20 < 25 → critical
    const r = buildLowStockAnalysis({ products, stockRows })
    expect(r.criticalItems).toHaveLength(1)
  })

  it('wykrywa produkt blisko minimum', () => {
    const products = [makeProduct(1, 'Towar A', 50)]
    const stockRows = [makeStock(1, 55)]  // 55 >= 50, 55 <= 50*1.2=60 → near
    const r = buildLowStockAnalysis({ products, stockRows })
    expect(r.nearMinimum).toHaveLength(1)
    expect(r.belowMinimum).toHaveLength(0)
  })

  it('liczy brakującą ilość', () => {
    const products = [makeProduct(1, 'Towar A', 50)]
    const stockRows = [makeStock(1, 30)]
    const r = buildLowStockAnalysis({ products, stockRows })
    expect(r.belowMinimum[0].missing).toBe(20)
  })

  it('liczy procent realizacji minimum', () => {
    const products = [makeProduct(1, 'Towar A', 100)]
    const stockRows = [makeStock(1, 40)]
    const r = buildLowStockAnalysis({ products, stockRows })
    expect(r.belowMinimum[0].fillPct).toBeCloseTo(40, 0)
  })

  it('sortuje poniżej minimum według braku (największy brak pierwszy)', () => {
    const products = [makeProduct(1, 'A', 100), makeProduct(2, 'B', 50)]
    const stockRows = [makeStock(1, 10), makeStock(2, 5)]  // A brakuje 90, B brakuje 45
    const r = buildLowStockAnalysis({ products, stockRows })
    expect(r.belowMinimum[0].name).toBe('A')
    expect(r.belowMinimum[0].missing).toBe(90)
  })

  it('wyciąga ostatnią cenę zakupu po towar_id', () => {
    const products = [makeProduct(1, 'Towar A', 50)]
    const stockRows = [makeStock(1, 10)]
    const recentInvoices = [makeInvoice(10, '2025-03-01', 'Firma X')]
    const recentInvoiceLines = [makeLine(10, 1, 75)]
    const r = buildLowStockAnalysis({ products, stockRows, recentInvoices, recentInvoiceLines })
    expect(r.belowMinimum[0].lastPrice).toBe(75)
  })

  it('fallback do ostatniej ceny po nazwie (raw_name)', () => {
    const products = [makeProduct(1, 'Jabłka świeże', 50)]
    const stockRows = [makeStock(1, 10)]
    const recentInvoices = [makeInvoice(10, '2025-03-01', 'Firma X')]
    const recentInvoiceLines = [makeLine(10, null, 8, 'Jabłka świeże')]
    const r = buildLowStockAnalysis({ products, stockRows, recentInvoices, recentInvoiceLines })
    expect(r.belowMinimum[0].lastPrice).toBe(8)
  })

  it('wyciąga ostatniego dostawcę z faktury', () => {
    const products = [makeProduct(1, 'Towar A', 50)]
    const stockRows = [makeStock(1, 10)]
    const recentInvoices = [makeInvoice(10, '2025-03-01', 'Firma Kowalski')]
    const recentInvoiceLines = [makeLine(10, 1, 50)]
    const r = buildLowStockAnalysis({ products, stockRows, recentInvoices, recentInvoiceLines })
    expect(r.belowMinimum[0].lastSupplier).toBe('Firma Kowalski')
  })

  it('liczy szacowany koszt uzupełnienia', () => {
    const products = [makeProduct(1, 'Towar A', 50)]
    const stockRows = [makeStock(1, 10)]  // missing = 40
    const recentInvoices = [makeInvoice(10, '2025-03-01')]
    const recentInvoiceLines = [makeLine(10, 1, 5)]  // price = 5
    const r = buildLowStockAnalysis({ products, stockRows, recentInvoices, recentInvoiceLines })
    expect(r.belowMinimum[0].estimatedCost).toBeCloseTo(200, 0)  // 40 * 5
  })

  it('ignoruje produkty bez minimum albo z minimum 0', () => {
    const products = [
      makeProduct(1, 'Towar A', null),
      makeProduct(2, 'Towar B', 0),
      makeProduct(3, 'Towar C', 50),
    ]
    const stockRows = [makeStock(1, 5), makeStock(2, 0), makeStock(3, 10)]
    const r = buildLowStockAnalysis({ products, stockRows })
    // Only Towar C has minimum > 0
    expect(r.belowMinimum).toHaveLength(1)
    expect(r.belowMinimum[0].name).toBe('Towar C')
  })

  it('obsługuje pusty input', () => {
    const r = buildLowStockAnalysis({})
    expect(r.hasEnoughData).toBe(false)
    expect(typeof r.summaryText).toBe('string')
    expect(r.belowMinimum).toHaveLength(0)
  })

  it('nie zwraca NaN ani Infinity', () => {
    const products = [makeProduct(1, 'A', 100)]
    const stockRows = []
    const r = buildLowStockAnalysis({ products, stockRows })
    expect(isFinite(r.kpis.totalMissing)).toBe(true)
    expect(isFinite(r.kpis.belowCount)).toBe(true)
    expect(isNaN(r.belowMinimum[0]?.missing ?? 0)).toBe(false)
    expect(isNaN(r.belowMinimum[0]?.fillPct ?? 0)).toBe(false)
  })
})
