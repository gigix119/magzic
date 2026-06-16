import { describe, it, expect, vi } from 'vitest'
import DateFilter, { resolveFilterDate, isoToday } from './DateFilter.jsx'

// Smoke renders — call as plain function since it's hook-free
describe('DateFilter — render', () => {
  it('returns a React element', () => {
    const result = DateFilter({ value: 'today', onChange: vi.fn() })
    expect(result).toBeTruthy()
    expect(typeof result).toBe('object')
  })

  it('renders with showAll=false', () => {
    const result = DateFilter({ value: 'tomorrow', onChange: vi.fn(), showAll: false })
    expect(result).toBeTruthy()
  })

  it('renders with custom ISO date value', () => {
    const result = DateFilter({ value: '2026-06-20', onChange: vi.fn() })
    expect(result).toBeTruthy()
  })
})

describe('resolveFilterDate', () => {
  it("returns today's ISO date for 'today'", () => {
    const result = resolveFilterDate('today')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).toBe(isoToday())
  })

  it("returns tomorrow's ISO date for 'tomorrow'", () => {
    const result = resolveFilterDate('tomorrow')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).not.toBe(isoToday())
    // tomorrow must be after today
    expect(result > isoToday()).toBe(true)
  })

  it("returns null for 'all'", () => {
    expect(resolveFilterDate('all')).toBeNull()
  })

  it('returns the ISO date string as-is for custom dates', () => {
    expect(resolveFilterDate('2026-07-15')).toBe('2026-07-15')
  })

  it('returns null for empty/undefined', () => {
    expect(resolveFilterDate('')).toBeNull()
    expect(resolveFilterDate(undefined)).toBeNull()
  })
})
