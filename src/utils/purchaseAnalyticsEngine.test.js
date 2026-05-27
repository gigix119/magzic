import { describe, it, expect } from 'vitest'
import { buildPurchaseDashboard } from './purchaseAnalyticsEngine.js'

const invoices = [
  { id: 'f1', numer: 'FAK/001', data_zakupu: '2026-05-01', kontrahent_id: 'k1', kontrahenci: { id: 'k1', nazwa: 'ABC Sp. z o.o.' } },
  { id: 'f2', numer: 'FAK/002', data_zakupu: '2026-05-10', kontrahent_id: 'k1', kontrahenci: { id: 'k1', nazwa: 'ABC Sp. z o.o.' } },
  { id: 'f3', numer: 'FAK/003', data_zakupu: '2026-05-15', kontrahent_id: 'k2', kontrahenci: { id: 'k2', nazwa: 'XYZ Dostawy' } },
]

const invoiceLines = [
  { id: 'p1', faktura_id: 'f1', towar_id: 't1', ilosc: 10, cena_netto: 50,  vat_procent: 23, towary: { id: 't1', nazwa: 'Rękawice' } },
  { id: 'p2', faktura_id: 'f1', towar_id: 't2', ilosc: 5,  cena_netto: 100, vat_procent: 23, towary: { id: 't2', nazwa: 'Maseczki' } },
  { id: 'p3', faktura_id: 'f2', towar_id: 't1', ilosc: 20, cena_netto: 48,  vat_procent: 23, towary: { id: 't1', nazwa: 'Rękawice' } },
  { id: 'p4', faktura_id: 'f3', towar_id: 't3', ilosc: 2,  cena_netto: 300, vat_procent: 8,  towary: { id: 't3', nazwa: 'Sprzęt' } },
]

describe('buildPurchaseDashboard', () => {
  it('oblicza łączną wartość zakupów netto', () => {
    const r = buildPurchaseDashboard({ invoices, invoiceLines })
    // 10*50=500, 5*100=500, 20*48=960, 2*300=600 → 2560
    expect(r.kpis.totalNetto).toBeCloseTo(2560, 1)
  })

  it('oblicza łączną wartość brutto', () => {
    const r = buildPurchaseDashboard({ invoices, invoiceLines })
    // 500*1.23=615, 500*1.23=615, 960*1.23=1180.8, 600*1.08=648 → 3058.8
    expect(r.kpis.totalBrutto).toBeCloseTo(3058.8, 0)
  })

  it('liczy liczbę faktur', () => {
    const r = buildPurchaseDashboard({ invoices, invoiceLines })
    expect(r.kpis.invoiceCount).toBe(3)
  })

  it('liczy liczbę pozycji', () => {
    const r = buildPurchaseDashboard({ invoices, invoiceLines })
    expect(r.kpis.lineCount).toBe(4)
  })

  it('liczy liczbę dostawców', () => {
    const r = buildPurchaseDashboard({ invoices, invoiceLines })
    expect(r.kpis.supplierCount).toBe(2)
  })

  it('grupuje po dostawcach i sortuje malejąco po wartości', () => {
    const r = buildPurchaseDashboard({ invoices, invoiceLines })
    expect(r.supplierBreakdown.length).toBe(2)
    expect(r.supplierBreakdown[0].name).toBe('ABC Sp. z o.o.')
  })

  it('wylicza udział procentowy dostawcy', () => {
    const r = buildPurchaseDashboard({ invoices, invoiceLines })
    const abc = r.supplierBreakdown.find(s => s.name === 'ABC Sp. z o.o.')
    // ABC: 500+500+960=1960 / 2560 ≈ 76.56%
    expect(abc.share).toBeCloseTo(76.56, 0)
    expect(abc.share).toBeLessThanOrEqual(100)
  })

  it('znajdzie top produkt kosztowo', () => {
    const r = buildPurchaseDashboard({ invoices, invoiceLines })
    // Rękawice: 500+960=1460 > Sprzęt: 600 > Maseczki: 500
    expect(r.topProductsBySpend[0].name).toBe('Rękawice')
    expect(r.topProductsBySpend[0].totalNetto).toBeCloseTo(1460, 1)
  })

  it('oblicza średnią wartość faktury', () => {
    const r = buildPurchaseDashboard({ invoices, invoiceLines })
    expect(r.kpis.avgInvoice).toBeCloseTo(2560 / 3, 0)
  })

  it('ustawia hasEnoughData=true gdy są faktury', () => {
    const r = buildPurchaseDashboard({ invoices, invoiceLines })
    expect(r.hasEnoughData).toBe(true)
  })

  it('obsługuje brak faktur', () => {
    const r = buildPurchaseDashboard({ invoices: [], invoiceLines: [] })
    expect(r.hasEnoughData).toBe(false)
    expect(r.kpis.invoiceCount).toBe(0)
    expect(r.supplierBreakdown).toHaveLength(0)
    expect(r.topProductsBySpend).toHaveLength(0)
  })

  it('obsługuje brak pozycji faktur', () => {
    const r = buildPurchaseDashboard({ invoices, invoiceLines: [] })
    expect(r.hasEnoughData).toBe(true)
    expect(r.warnings.length).toBeGreaterThan(0)
    expect(r.kpis.totalNetto).toBe(0)
    expect(r.kpis.invoiceCount).toBe(3)
  })

  it('nie zwraca NaN przy null/undefined wartościach', () => {
    const badInvoices = [{ id: 'f1', data_zakupu: null, kontrahent_id: null, kontrahenci: null }]
    const badLines = [{ id: 'p1', faktura_id: 'f1', ilosc: null, cena_netto: null, vat_procent: null, towary: null, raw_name: null }]
    const r = buildPurchaseDashboard({ invoices: badInvoices, invoiceLines: badLines })
    expect(isNaN(r.kpis.totalNetto)).toBe(false)
    expect(isNaN(r.kpis.totalBrutto)).toBe(false)
    expect(isNaN(r.kpis.avgInvoice)).toBe(false)
  })

  it('purchasesOverTime zawiera posortowane dni', () => {
    const r = buildPurchaseDashboard({ invoices, invoiceLines })
    expect(r.purchasesOverTime.length).toBe(3)
    expect(r.purchasesOverTime[0].isoDate).toBe('2026-05-01')
    expect(r.purchasesOverTime[2].isoDate).toBe('2026-05-15')
  })

  it('formatuje datę jako DD.MM', () => {
    const r = buildPurchaseDashboard({ invoices, invoiceLines })
    expect(r.purchasesOverTime[0].date).toBe('01.05')
  })
})
