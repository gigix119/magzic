import { describe, it, expect } from 'vitest'
import {
  parseMoney, parseQuantity, normalizeVatRate, roundMoney,
  calculateFromNet, calculateFromGross, inferPriceModeFromHeaders,
  validateLineMath, validateInvoiceTotals,
} from './invoiceMath.js'

const eps = 0.01

describe('parseMoney', () => {
  it('"1 923,00" → 1923.00', () => expect(parseMoney('1 923,00')).toBeCloseTo(1923, 2))
  it('"1,24" → 1.24',        () => expect(parseMoney('1,24')).toBeCloseTo(1.24, 2))
  it('"698,92" → 698.92',    () => expect(parseMoney('698,92')).toBeCloseTo(698.92, 2))
  it('"0,00" → 0',           () => expect(parseMoney('0,00')).toBeCloseTo(0, 2))
  it('"14,99" → 14.99',      () => expect(parseMoney('14,99')).toBeCloseTo(14.99, 2))
  it('"309,00" → 309',       () => expect(parseMoney('309,00')).toBeCloseTo(309, 2))
  it('"58,00" → 58',         () => expect(parseMoney('58,00')).toBeCloseTo(58, 2))
  it('"62,00" → 62',         () => expect(parseMoney('62,00')).toBeCloseTo(62, 2))
})

describe('parseQuantity', () => {
  it('"50.000" → 50',  () => expect(parseQuantity('50.000')).toBe(50))
  it('"1.0000" → 1',   () => expect(parseQuantity('1.0000')).toBe(1))
  it('"10.000" → 10',  () => expect(parseQuantity('10.000')).toBe(10))
  it('"12.000" → 12',  () => expect(parseQuantity('12.000')).toBe(12))
  it('"1.000" → 1',    () => expect(parseQuantity('1.000')).toBe(1))
  it('"1" → 1',        () => expect(parseQuantity('1')).toBe(1))
  it('"10" → 10',      () => expect(parseQuantity('10')).toBe(10))
  it('"2" → 2',        () => expect(parseQuantity('2')).toBe(2))
  it('"4" → 4',        () => expect(parseQuantity('4')).toBe(4))
  it('"2.5" → 2.5 (non-zero decimal is float)', () => expect(parseQuantity('2.5')).toBeCloseTo(2.5, 2))
})

describe('normalizeVatRate', () => {
  it('"23" → 23',  () => expect(normalizeVatRate('23')).toBe(23))
  it('"23%" → 23', () => expect(normalizeVatRate('23%')).toBe(23))
  it('"8%" → 8',   () => expect(normalizeVatRate('8%')).toBe(8))
  it('"zw" → 0',   () => expect(normalizeVatRate('zw')).toBe(0))
  it('"np" → 0',   () => expect(normalizeVatRate('np')).toBe(0))
})

describe('calculateFromNet', () => {
  it('1.16 × 50 @ 23% → net 58.00, gross 71.34', () => {
    const r = calculateFromNet(1.16, 50, 23)
    expect(r.lineTotalNet).toBeCloseTo(58.00, 2)
    expect(r.lineTotalGross).toBeCloseTo(71.34, 2)
  })
  it('1.24 × 50 @ 23% → net 62.00', () => {
    const r = calculateFromNet(1.24, 50, 23)
    expect(r.lineTotalNet).toBeCloseTo(62.00, 2)
  })
  it('2.39 × 10 @ 23% → net 23.90', () => {
    const r = calculateFromNet(2.39, 10, 23)
    expect(r.lineTotalNet).toBeCloseTo(23.90, 2)
  })
  it('2.94 × 12 @ 23% → net 35.28, gross 43.39', () => {
    const r = calculateFromNet(2.94, 12, 23)
    expect(r.lineTotalNet).toBeCloseTo(35.28, 2)
    expect(r.lineTotalGross).toBeCloseTo(43.39, 2)
  })
  it('19.31 × 1 @ 23% → net 19.31, gross 23.75', () => {
    const r = calculateFromNet(19.31, 1, 23)
    expect(r.lineTotalNet).toBeCloseTo(19.31, 2)
    expect(r.lineTotalGross).toBeCloseTo(23.75, 2)
  })
})

describe('calculateFromGross', () => {
  it('76.00 × 10 @ 23% → gross 760.00, net 617.89', () => {
    const r = calculateFromGross(76.00, 10, 23)
    expect(r.lineTotalGross).toBeCloseTo(760.00, 2)
    expect(r.lineTotalNet).toBeCloseTo(617.89, 2)
  })
  it('525.00 × 1 @ 23% → gross 525.00, net 426.83', () => {
    const r = calculateFromGross(525.00, 1, 23)
    expect(r.lineTotalGross).toBeCloseTo(525.00, 2)
    expect(r.lineTotalNet).toBeCloseTo(426.83, 2)
  })
  it('14.99 × 1 @ 23% → gross 14.99, net 12.19', () => {
    const r = calculateFromGross(14.99, 1, 23)
    expect(r.lineTotalGross).toBeCloseTo(14.99, 2)
    expect(r.lineTotalNet).toBeCloseTo(12.19, 2)
  })
  it('149.99 × 1 @ 23%', () => {
    const r = calculateFromGross(149.99, 1, 23)
    expect(r.lineTotalGross).toBeCloseTo(149.99, 2)
    expect(r.unitPriceNet).toBeCloseTo(149.99 / 1.23, 2)
  })
  it('309.00 × 1 @ 23%', () => {
    const r = calculateFromGross(309.00, 1, 23)
    expect(r.lineTotalGross).toBeCloseTo(309.00, 2)
    expect(r.lineTotalNet).toBeCloseTo(309.00 / 1.23, 2)
  })
  it('83.98 × 1 @ 23% → net 68.28', () => {
    const r = calculateFromGross(83.98, 1, 23)
    expect(r.lineTotalNet).toBeCloseTo(68.28, 2)
  })
  it('345.00 × 1 @ 23%', () => {
    const r = calculateFromGross(345.00, 1, 23)
    expect(r.lineTotalGross).toBeCloseTo(345.00, 2)
  })
  it('199.00 × 2 @ 23% → gross 398.00', () => {
    const r = calculateFromGross(199.00, 2, 23)
    expect(r.lineTotalGross).toBeCloseTo(398.00, 2)
  })
  it('295.00 × 4 @ 23% → gross 1180.00', () => {
    const r = calculateFromGross(295.00, 4, 23)
    expect(r.lineTotalGross).toBeCloseTo(1180.00, 2)
  })
})

describe('inferPriceModeFromHeaders', () => {
  it('net headers → "net"', () => {
    const headers = ['Lp.', 'Nazwa towaru/usługi', 'Jdn.', 'Ilość', 'Cena jdn. netto', 'Rabat [PLN]', 'VAT', 'Wartość netto']
    expect(inferPriceModeFromHeaders(headers)).toBe('net')
  })
  it('gross headers → "gross"', () => {
    const headers = ['Lp.', 'Nazwa towaru/usługi', 'Ilość', 'Cena jdn. brutto', 'Rabat [PLN]', 'VAT', 'Wartość brutto']
    expect(inferPriceModeFromHeaders(headers)).toBe('gross')
  })
  it('mixed headers → "mixed"', () => {
    const headers = ['Cena netto', 'Wartość brutto']
    expect(inferPriceModeFromHeaders(headers)).toBe('mixed')
  })
  it('empty → "unknown"', () => {
    expect(inferPriceModeFromHeaders([])).toBe('unknown')
  })
})

describe('validateLineMath', () => {
  it('50 × 1.16 = 58.00 → valid', () => {
    const r = validateLineMath({ quantity: 50, unitPriceNet: 1.16, lineTotalNet: 58.00 })
    expect(r.valid).toBe(true)
  })
  it('mismatch → invalid', () => {
    const r = validateLineMath({ quantity: 50, unitPriceNet: 1.16, lineTotalNet: 1.00 })
    expect(r.valid).toBe(false)
  })
})

describe('validateInvoiceTotals', () => {
  it('FV 00867/2026 net totals match', () => {
    const lines = [
      { lineTotalNet: 58.00 },
      { lineTotalNet: 62.00 },
      { lineTotalNet: 23.90 },
      { lineTotalNet: 35.28 },
      { lineTotalNet: 19.31 },
    ]
    const summary = { totalNet: 198.49, totalVat: 45.65, totalGross: 244.14 }
    const r = validateInvoiceTotals(lines, summary)
    expect(r.sumNet).toBeCloseTo(198.49, 2)
    expect(r.valid).toBe(true)
  })
})
