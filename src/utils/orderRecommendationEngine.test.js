import { describe, it, expect } from 'vitest'
import { buildOrderRecommendations } from './orderRecommendationEngine'

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

describe('buildOrderRecommendations', () => {
  it('tworzy orderItems z produktów poniżej minimum', () => {
    const products = [makeProduct(1, 'Towar A', 50)]
    const stockRows = [makeStock(1, 20)]
    const r = buildOrderRecommendations({ products, stockRows })
    expect(r.orderItems).toHaveLength(1)
    expect(r.orderItems[0].name).toBe('Towar A')
  })

  it('nie tworzy orderItems dla produktów powyżej minimum', () => {
    const products = [makeProduct(1, 'Towar A', 50)]
    const stockRows = [makeStock(1, 60)]
    const r = buildOrderRecommendations({ products, stockRows })
    expect(r.orderItems).toHaveLength(0)
    expect(r.hasEnoughData).toBe(false)
  })

  it('oznacza produkt krytyczny', () => {
    const products = [makeProduct(1, 'Towar A', 100)]
    const stockRows = []  // stan = 0 → critical
    const r = buildOrderRecommendations({ products, stockRows })
    expect(r.criticalItems).toHaveLength(1)
    expect(r.criticalItems[0].priority).toBe('critical')
  })

  it('oznacza produkt high priority', () => {
    const products = [makeProduct(1, 'Towar A', 100)]
    const stockRows = [makeStock(1, 50)]  // 50 < 100, 50 >= 25 → high
    const r = buildOrderRecommendations({ products, stockRows })
    expect(r.orderItems[0].priority).toBe('high')
    expect(r.criticalItems).toHaveLength(0)
  })

  it('dodaje produkty blisko minimum do watchList', () => {
    const products = [makeProduct(1, 'Towar A', 50)]
    const stockRows = [makeStock(1, 55)]  // 55 >= 50, 55 <= 60 → near
    const r = buildOrderRecommendations({ products, stockRows })
    expect(r.watchList).toHaveLength(1)
    expect(r.orderItems).toHaveLength(0)
  })

  it('liczy suggestedQty = min - stan', () => {
    const products = [makeProduct(1, 'Towar A', 50)]
    const stockRows = [makeStock(1, 30)]
    const r = buildOrderRecommendations({ products, stockRows })
    expect(r.orderItems[0].suggestedQty).toBe(20)
  })

  it('liczy estimatedCost = suggestedQty * cena', () => {
    const products = [makeProduct(1, 'Towar A', 50)]
    const stockRows = [makeStock(1, 30)]  // missing = 20
    const recentInvoices = [makeInvoice(1, '2025-03-01')]
    const recentInvoiceLines = [makeLine(1, 1, 5)]
    const r = buildOrderRecommendations({ products, stockRows, recentInvoices, recentInvoiceLines })
    expect(r.orderItems[0].estimatedCost).toBeCloseTo(100, 0)  // 20 * 5
  })

  it('wyciąga ostatnią cenę po towar_id', () => {
    const products = [makeProduct(1, 'Towar A', 50)]
    const stockRows = [makeStock(1, 10)]
    const recentInvoices = [makeInvoice(1, '2025-03-01', 'Firma X')]
    const recentInvoiceLines = [makeLine(1, 1, 42)]
    const r = buildOrderRecommendations({ products, stockRows, recentInvoices, recentInvoiceLines })
    expect(r.orderItems[0].lastPrice).toBe(42)
  })

  it('fallback do ostatniej ceny po nazwie', () => {
    const products = [makeProduct(1, 'Jabłka Świeże', 50)]
    const stockRows = [makeStock(1, 10)]
    const recentInvoices = [makeInvoice(1, '2025-03-01')]
    const recentInvoiceLines = [makeLine(1, null, 7, 'jabłka świeże')]
    const r = buildOrderRecommendations({ products, stockRows, recentInvoices, recentInvoiceLines })
    expect(r.orderItems[0].lastPrice).toBe(7)
  })

  it('wyciąga ostatniego dostawcę', () => {
    const products = [makeProduct(1, 'Towar A', 50)]
    const stockRows = [makeStock(1, 10)]
    const recentInvoices = [makeInvoice(1, '2025-03-01', 'Firma Kowalski')]
    const recentInvoiceLines = [makeLine(1, 1, 10)]
    const r = buildOrderRecommendations({ products, stockRows, recentInvoices, recentInvoiceLines })
    expect(r.orderItems[0].lastSupplier).toBe('Firma Kowalski')
  })

  it('grupuje produkty po dostawcy', () => {
    const products = [makeProduct(1, 'Towar A', 50), makeProduct(2, 'Towar B', 50)]
    const stockRows = [makeStock(1, 10), makeStock(2, 5)]
    const recentInvoices = [makeInvoice(1, '2025-03-01', 'Firma X'), makeInvoice(2, '2025-03-02', 'Firma X')]
    const recentInvoiceLines = [makeLine(1, 1, 10), makeLine(2, 2, 8)]
    const r = buildOrderRecommendations({ products, stockRows, recentInvoices, recentInvoiceLines })
    const group = r.supplierGroups.find(g => g.supplier === 'Firma X')
    expect(group).toBeTruthy()
    expect(group.count).toBe(2)
  })

  it('liczy koszt per dostawca', () => {
    const products = [makeProduct(1, 'A', 50), makeProduct(2, 'B', 40)]
    const stockRows = [makeStock(1, 10), makeStock(2, 0)]  // A brakuje 40, B brakuje 40
    const recentInvoices = [makeInvoice(1, '2025-03-01', 'Firma Y')]
    const recentInvoiceLines = [makeLine(1, 1, 2), makeLine(1, 2, 3)]
    const r = buildOrderRecommendations({ products, stockRows, recentInvoices, recentInvoiceLines })
    const group = r.supplierGroups.find(g => g.supplier === 'Firma Y')
    expect(group.totalCost).toBeCloseTo(40 * 2 + 40 * 3, 0)  // 80 + 120 = 200
  })

  it('liczy KPI orderCount', () => {
    const products = [makeProduct(1, 'A', 50), makeProduct(2, 'B', 30)]
    const stockRows = [makeStock(1, 10), makeStock(2, 10)]
    const r = buildOrderRecommendations({ products, stockRows })
    expect(r.kpis.orderCount).toBe(2)
  })

  it('liczy KPI estimatedOrderCost', () => {
    const products = [makeProduct(1, 'A', 50)]
    const stockRows = [makeStock(1, 10)]  // missing = 40
    const recentInvoices = [makeInvoice(1, '2025-03-01')]
    const recentInvoiceLines = [makeLine(1, 1, 3)]
    const r = buildOrderRecommendations({ products, stockRows, recentInvoices, recentInvoiceLines })
    expect(r.kpis.estimatedOrderCost).toBeCloseTo(120, 0)
  })

  it('obsługuje brak cen — kpis.noPriceCount > 0', () => {
    const products = [makeProduct(1, 'A', 50)]
    const stockRows = [makeStock(1, 10)]
    const r = buildOrderRecommendations({ products, stockRows })
    expect(r.kpis.noPriceCount).toBe(1)
    expect(r.kpis.estimatedOrderCost).toBeNull()
  })

  it('obsługuje brak dostawców — kpis.noSupplierCount > 0', () => {
    const products = [makeProduct(1, 'A', 50)]
    const stockRows = [makeStock(1, 10)]
    const r = buildOrderRecommendations({ products, stockRows })
    expect(r.kpis.noSupplierCount).toBe(1)
  })

  it('obsługuje pusty input', () => {
    const r = buildOrderRecommendations({})
    expect(r.hasEnoughData).toBe(false)
    expect(typeof r.summaryText).toBe('string')
    expect(r.orderItems).toHaveLength(0)
  })

  it('nie zwraca NaN ani Infinity', () => {
    const products = [makeProduct(1, 'A', 100)]
    const stockRows = []
    const recentInvoices = [makeInvoice(1, '2025-03-01')]
    const recentInvoiceLines = [makeLine(1, 1, 0)]  // zero price should be ignored
    const r = buildOrderRecommendations({ products, stockRows, recentInvoices, recentInvoiceLines })
    expect(isFinite(r.kpis.orderCount)).toBe(true)
    expect(isNaN(r.kpis.orderCount)).toBe(false)
    expect(isFinite(r.kpis.estimatedOrderCost ?? 0)).toBe(true)
  })
})
