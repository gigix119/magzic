import { describe, it, expect } from 'vitest'
import { formatPurchaseDashboardResponse, formatPLN } from './assistantResponseFormatter.js'

const sampleDashboard = {
  hasEnoughData: true,
  kpis: {
    totalNetto: 2560.00,
    totalBrutto: 3058.80,
    invoiceCount: 3,
    lineCount: 4,
    supplierCount: 2,
    avgInvoice: 853.33,
    topSupplierName: 'ABC Sp. z o.o.',
    topSupplierShare: 76.56,
    topProductName: 'Rękawice',
    topProductSpend: 1460.00,
  },
  warnings: [],
}

describe('formatPurchaseDashboardResponse', () => {
  it('zwraca string', () => {
    const text = formatPurchaseDashboardResponse(sampleDashboard)
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(10)
  })

  it('zawiera kwotę PLN (brutto)', () => {
    const text = formatPurchaseDashboardResponse(sampleDashboard)
    expect(text).toContain('zł')
    expect(text).toContain('3')
  })

  it('zawiera liczbę faktur', () => {
    const text = formatPurchaseDashboardResponse(sampleDashboard)
    expect(text).toContain('3')
  })

  it('zawiera największego dostawcę', () => {
    const text = formatPurchaseDashboardResponse(sampleDashboard)
    expect(text).toContain('ABC Sp. z o.o.')
  })

  it('zawiera największy produkt', () => {
    const text = formatPurchaseDashboardResponse(sampleDashboard)
    expect(text).toContain('Rękawice')
  })

  it('zawiera udział procentowy dostawcy', () => {
    const text = formatPurchaseDashboardResponse(sampleDashboard)
    expect(text).toContain('%')
  })

  it('obsługuje brak danych — zwraca czytelny komunikat', () => {
    const text = formatPurchaseDashboardResponse({ hasEnoughData: false, kpis: {} })
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(5)
  })

  it('obsługuje null dashboard — nie crashuje', () => {
    const text = formatPurchaseDashboardResponse(null)
    expect(typeof text).toBe('string')
  })

  it('zawiera ostrzeżenie gdy warnings nie jest puste', () => {
    const dash = { ...sampleDashboard, warnings: ['Brak pozycji'] }
    const text = formatPurchaseDashboardResponse(dash)
    expect(text).toContain('Brak pozycji')
  })
})

describe('formatPLN', () => {
  it('formatuje liczbę jako PLN', () => {
    expect(formatPLN(1234.56)).toContain('zł')
    expect(formatPLN(0)).toBe('0,00 zł')
  })

  it('nie zwraca NaN dla złych danych', () => {
    expect(formatPLN(NaN)).toBe('0,00 zł')
    expect(formatPLN(undefined)).toBe('0,00 zł')
    expect(formatPLN(null)).toBe('0,00 zł')
  })
})
