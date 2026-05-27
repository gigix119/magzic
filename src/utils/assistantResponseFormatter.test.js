import { describe, it, expect } from 'vitest'
import { formatPurchaseDashboardResponse, formatLatestPriceChangesResponse, formatInvoiceComparisonResponse, formatLowStockResponse, formatPLN } from './assistantResponseFormatter.js'

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

describe('formatLatestPriceChangesResponse', () => {
  const samplePriceChanges = {
    hasEnoughData: true,
    kpis: {
      totalTracked: 8,
      increaseCount: 5,
      decreaseCount: 2,
      anomalyCount: 3,
      avgChangePct: 11.4,
      maxIncreasePct: 27.5,
    },
  }

  it('zwraca string z liczbą śledzonych produktów', () => {
    const text = formatLatestPriceChangesResponse(samplePriceChanges)
    expect(typeof text).toBe('string')
    expect(text).toContain('8')
  })

  it('zawiera liczbę wzrostów i spadków', () => {
    const text = formatLatestPriceChangesResponse(samplePriceChanges)
    expect(text).toContain('5')
    expect(text).toContain('2')
  })

  it('zawiera anomalie', () => {
    const text = formatLatestPriceChangesResponse(samplePriceChanges)
    expect(text).toContain('3')
  })

  it('zawiera maxIncreasePct', () => {
    const text = formatLatestPriceChangesResponse(samplePriceChanges)
    expect(text).toContain('27,5')
  })

  it('obsługuje brak danych — zwraca komunikat', () => {
    const text = formatLatestPriceChangesResponse({ hasEnoughData: false, kpis: {} })
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(10)
  })
})

describe('formatInvoiceComparisonResponse', () => {
  const sampleComparison = {
    hasEnoughData: true,
    kpis: {
      bruttoA: 1000,
      bruttoB: 1200,
      diffBrutto: 200,
      diffBruttoPct: 20,
      matchedCount: 5,
      onlyBCount: 2,
      onlyACount: 1,
      topPriceChangeName: 'Rękawice nitrylowe',
      topPriceChangePct: 35.5,
    },
    invoiceAInfo: { numer: 'F/001/2025' },
    invoiceBInfo: { numer: 'F/002/2025' },
    priceChanges: [
      { name: 'Rękawice nitrylowe', priceDiff: 14, priceDiffPct: 35.5 },
    ],
  }

  it('zawiera PLN (zł)', () => {
    const text = formatInvoiceComparisonResponse(sampleComparison)
    expect(text).toContain('zł')
  })

  it('zawiera procent (%)', () => {
    const text = formatInvoiceComparisonResponse(sampleComparison)
    expect(text).toContain('%')
  })

  it('zawiera informację o droższej/tańszej fakturze', () => {
    const text = formatInvoiceComparisonResponse(sampleComparison)
    expect(text.includes('droższa') || text.includes('tańsza')).toBe(true)
  })

  it('zawiera nazwę największej zmiany ceny', () => {
    const text = formatInvoiceComparisonResponse(sampleComparison)
    expect(text).toContain('Rękawice nitrylowe')
  })

  it('obsługuje brak danych', () => {
    const text = formatInvoiceComparisonResponse({ hasEnoughData: false, kpis: {} })
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(5)
  })
})

describe('formatLowStockResponse', () => {
  const sampleAnalysis = {
    hasEnoughData: true,
    kpis: {
      belowCount: 7,
      criticalCount: 2,
      nearCount: 3,
      totalMissing: 250,
      estimatedRestockCost: 1450.50,
      topMissingName: 'Kret 1L',
      topMissingQty: 48,
      topCostName: 'Kret 1L',
      topCostValue: 1440,
    },
  }

  it('zawiera liczbę produktów poniżej minimum', () => {
    const text = formatLowStockResponse(sampleAnalysis)
    expect(text).toContain('7')
  })

  it('zawiera informację o krytycznych produktach', () => {
    const text = formatLowStockResponse(sampleAnalysis)
    expect(text.toLowerCase()).toContain('krytyczne')
  })

  it('zawiera największy brak (nazwę produktu)', () => {
    const text = formatLowStockResponse(sampleAnalysis)
    expect(text).toContain('Kret 1L')
  })

  it('zawiera PLN jeśli jest szacowany koszt', () => {
    const text = formatLowStockResponse(sampleAnalysis)
    expect(text).toContain('zł')
  })

  it('obsługuje brak danych', () => {
    const text = formatLowStockResponse({ hasEnoughData: false, kpis: {} })
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(5)
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
