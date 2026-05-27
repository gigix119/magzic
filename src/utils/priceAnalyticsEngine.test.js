import { describe, it, expect } from 'vitest'
import { buildLatestPriceChanges } from './priceAnalyticsEngine'

function makeInv(id, date) {
  return { id, data_zakupu: date, numer: `F/${id}`, typ: 'zakup', status: 'zatwierdzona', kontrahent_id: 1 }
}

function makeLine(id, faktura_id, towar_id, cena_netto, raw_name = null, nazwa = null) {
  return {
    id,
    faktura_id,
    towar_id,
    cena_netto,
    ilosc: 1,
    vat_procent: 23,
    raw_name,
    towary: towar_id ? { id: towar_id, nazwa: nazwa ?? `Towar ${towar_id}`, jednostka: 'szt' } : null,
  }
}

const invoices = [
  makeInv(1, '2025-01-10'),
  makeInv(2, '2025-02-10'),
  makeInv(3, '2025-03-10'),
]

describe('buildLatestPriceChanges', () => {
  it('returns empty result for no data', () => {
    const result = buildLatestPriceChanges({})
    expect(result.hasEnoughData).toBe(false)
    expect(result.increases).toHaveLength(0)
    expect(result.decreases).toHaveLength(0)
    expect(result.kpis.totalTracked).toBe(0)
  })

  it('detects price increase by towar_id', () => {
    const lines = [
      makeLine(1, 1, 10, 100),
      makeLine(2, 2, 10, 120),
    ]
    const result = buildLatestPriceChanges({ invoices, invoiceLines: lines })
    expect(result.increases).toHaveLength(1)
    expect(result.increases[0].diffPct).toBeCloseTo(20, 0)
    expect(result.increases[0].lastPrice).toBe(120)
    expect(result.increases[0].prevPrice).toBe(100)
  })

  it('detects price decrease by towar_id', () => {
    const lines = [
      makeLine(1, 1, 10, 200),
      makeLine(2, 2, 10, 150),
    ]
    const result = buildLatestPriceChanges({ invoices, invoiceLines: lines })
    expect(result.decreases).toHaveLength(1)
    expect(result.decreases[0].diff).toBeCloseTo(-50, 0)
    expect(result.decreases[0].diffPct).toBeCloseTo(-25, 0)
  })

  it('skips products with only one purchase', () => {
    const lines = [makeLine(1, 1, 10, 100)]
    const result = buildLatestPriceChanges({ invoices, invoiceLines: lines })
    expect(result.kpis.totalTracked).toBe(0)
  })

  it('skips zero or negative prices', () => {
    const lines = [
      makeLine(1, 1, 10, 0),
      makeLine(2, 2, 10, 100),
    ]
    const result = buildLatestPriceChanges({ invoices, invoiceLines: lines })
    expect(result.kpis.totalTracked).toBe(0)
  })

  it('groups by raw_name fallback when no towar_id', () => {
    const lines = [
      { id: 1, faktura_id: 1, towar_id: null, cena_netto: 50, ilosc: 1, vat_procent: 23, raw_name: 'Jabłka świeże', towary: null },
      { id: 2, faktura_id: 2, towar_id: null, cena_netto: 65, ilosc: 1, vat_procent: 23, raw_name: 'Jabłka świeże', towary: null },
    ]
    const result = buildLatestPriceChanges({ invoices, invoiceLines: lines })
    expect(result.increases).toHaveLength(1)
    expect(result.increases[0].diffPct).toBeCloseTo(30, 0)
  })

  it('detects anomaly above 15% threshold', () => {
    const lines = [
      makeLine(1, 1, 10, 100),
      makeLine(2, 2, 10, 120),
    ]
    const result = buildLatestPriceChanges({ invoices, invoiceLines: lines })
    expect(result.anomalies).toHaveLength(1)
  })

  it('no anomaly when change is below threshold', () => {
    const lines = [
      makeLine(1, 1, 10, 100),
      makeLine(2, 2, 10, 110),
    ]
    const result = buildLatestPriceChanges({ invoices, invoiceLines: lines })
    expect(result.anomalies).toHaveLength(0)
  })

  it('sorts increases descending by diffPct', () => {
    const lines = [
      makeLine(1, 1, 10, 100),
      makeLine(2, 2, 10, 130),
      makeLine(3, 1, 20, 200),
      makeLine(4, 2, 20, 250),
      makeLine(5, 1, 30, 50),
      makeLine(6, 3, 30, 80),
    ]
    const result = buildLatestPriceChanges({ invoices, invoiceLines: lines })
    for (let i = 1; i < result.increases.length; i++) {
      expect(result.increases[i - 1].diffPct).toBeGreaterThanOrEqual(result.increases[i].diffPct)
    }
  })

  it('computes kpis.increaseCount and decreaseCount', () => {
    const lines = [
      makeLine(1, 1, 10, 100),
      makeLine(2, 2, 10, 130),
      makeLine(3, 1, 20, 200),
      makeLine(4, 2, 20, 180),
    ]
    const result = buildLatestPriceChanges({ invoices, invoiceLines: lines })
    expect(result.kpis.increaseCount).toBe(1)
    expect(result.kpis.decreaseCount).toBe(1)
    expect(result.kpis.totalTracked).toBe(2)
  })

  it('computes avgChangePct correctly', () => {
    const lines = [
      makeLine(1, 1, 10, 100),
      makeLine(2, 2, 10, 110),
      makeLine(3, 1, 20, 100),
      makeLine(4, 2, 20, 120),
    ]
    const result = buildLatestPriceChanges({ invoices, invoiceLines: lines })
    // towar 10: +10%, towar 20: +20% → avg = 15%
    expect(result.kpis.avgChangePct).toBeCloseTo(15, 0)
  })

  it('chartData limited to top 10 by abs(diffPct)', () => {
    const invs = Array.from({ length: 15 }, (_, i) => makeInv(i + 1, `2025-0${Math.floor(i / 5) + 1}-${(i % 5 + 1) * 5}`))
    const lines = []
    for (let t = 1; t <= 15; t++) {
      lines.push(makeLine(t * 2 - 1, 1, t, 100))
      lines.push(makeLine(t * 2, 2, t, 100 + t * 5))
    }
    const result = buildLatestPriceChanges({ invoices: invs, invoiceLines: lines })
    expect(result.chartData.length).toBeLessThanOrEqual(10)
  })

  it('product key uses towar_id over raw_name', () => {
    const lines = [
      { id: 1, faktura_id: 1, towar_id: 5, cena_netto: 100, ilosc: 1, vat_procent: 23, raw_name: 'Inny opis', towary: { id: 5, nazwa: 'Towar 5', jednostka: 'kg' } },
      { id: 2, faktura_id: 2, towar_id: 5, cena_netto: 115, ilosc: 1, vat_procent: 23, raw_name: 'Zupełnie inny opis', towary: { id: 5, nazwa: 'Towar 5', jednostka: 'kg' } },
    ]
    const result = buildLatestPriceChanges({ invoices, invoiceLines: lines })
    expect(result.increases).toHaveLength(1)
    expect(result.increases[0].name).toBe('Towar 5')
  })

  it('hasEnoughData is false when no products have 2+ purchases', () => {
    const lines = [makeLine(1, 1, 10, 50), makeLine(2, 1, 20, 80)]
    const result = buildLatestPriceChanges({ invoices, invoiceLines: lines })
    expect(result.hasEnoughData).toBe(false)
  })
})
