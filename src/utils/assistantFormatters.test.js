import { describe, it, expect } from 'vitest'
import { fmtNum, fmtPct, formatDatePL } from './assistantFormatters'

describe('fmtNum', () => {
  it('formats decimal number', () => {
    expect(fmtNum(10.5)).toBe('10,50')
  })

  it('formats zero', () => {
    expect(fmtNum(0)).toBe('0,00')
  })

  it('returns — for NaN', () => {
    expect(fmtNum(NaN)).toBe('—')
  })

  it('returns — for null', () => {
    expect(fmtNum(null)).toBe('—')
  })

  it('returns — for undefined', () => {
    expect(fmtNum(undefined)).toBe('—')
  })

  it('returns — for Infinity', () => {
    expect(fmtNum(Infinity)).toBe('—')
  })

  it('returns — for -Infinity', () => {
    expect(fmtNum(-Infinity)).toBe('—')
  })
})

describe('fmtPct', () => {
  it('adds + sign for positive', () => {
    expect(fmtPct(10.5)).toBe('+10.5%')
  })

  it('no + sign for negative', () => {
    expect(fmtPct(-5.0)).toBe('-5.0%')
  })

  it('no + sign for zero', () => {
    expect(fmtPct(0)).toBe('0.0%')
  })

  it('returns 0% for NaN', () => {
    expect(fmtPct(NaN)).toBe('0%')
  })

  it('returns 0% for Infinity', () => {
    expect(fmtPct(Infinity)).toBe('0%')
  })
})

describe('formatDatePL', () => {
  it('formats YYYY-MM-DD to DD.MM.YYYY', () => {
    expect(formatDatePL('2025-03-15')).toBe('15.03.2025')
  })

  it('formats another date correctly', () => {
    expect(formatDatePL('2024-12-01')).toBe('01.12.2024')
  })

  it('returns — for null', () => {
    expect(formatDatePL(null)).toBe('—')
  })

  it('returns — for empty string', () => {
    expect(formatDatePL('')).toBe('—')
  })

  it('returns short string as-is', () => {
    expect(formatDatePL('abc')).toBe('abc')
  })
})
