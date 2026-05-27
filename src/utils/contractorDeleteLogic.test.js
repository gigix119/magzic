import { describe, it, expect } from 'vitest'
import { isFkViolation, getContractorDeleteAction, buildFakturyCount } from './contractorDeleteLogic'

describe('isFkViolation', () => {
  it('detects PostgreSQL 23503 error code', () => {
    expect(isFkViolation({ code: '23503', message: 'some db error' })).toBe(true)
  })

  it('detects error by message keyword', () => {
    expect(isFkViolation({ code: 'XX000', message: 'update or delete on table "kontrahenci" violates foreign key constraint "faktury_kontrahent_id_fkey"' })).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isFkViolation({ code: '42703', message: 'column does not exist' })).toBe(false)
  })

  it('returns false for null', () => {
    expect(isFkViolation(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isFkViolation(undefined)).toBe(false)
  })
})

describe('getContractorDeleteAction', () => {
  it('allows delete when invoice count is 0', () => {
    expect(getContractorDeleteAction(0)).toBe('delete')
  })

  it('blocks delete when invoice count is 1', () => {
    expect(getContractorDeleteAction(1)).toBe('deactivate_only')
  })

  it('blocks delete when invoice count is greater than 1', () => {
    expect(getContractorDeleteAction(5)).toBe('deactivate_only')
  })

  it('allows delete when count is undefined / NaN', () => {
    expect(getContractorDeleteAction(undefined)).toBe('delete')
    expect(getContractorDeleteAction(NaN)).toBe('delete')
  })
})

describe('buildFakturyCount', () => {
  it('counts invoices per contractor id', () => {
    const faktury = [
      { kontrahent_id: 'a' },
      { kontrahent_id: 'a' },
      { kontrahent_id: 'b' },
    ]
    const cnt = buildFakturyCount(faktury)
    expect(cnt['a']).toBe(2)
    expect(cnt['b']).toBe(1)
  })

  it('ignores records with null kontrahent_id', () => {
    const faktury = [
      { kontrahent_id: null },
      { kontrahent_id: 'a' },
    ]
    const cnt = buildFakturyCount(faktury)
    expect(cnt[null]).toBeUndefined()
    expect(cnt['a']).toBe(1)
  })

  it('returns empty object for empty input', () => {
    expect(buildFakturyCount([])).toEqual({})
  })

  it('returns empty object for null input', () => {
    expect(buildFakturyCount(null)).toEqual({})
  })

  it('contractor with no invoices has no entry (returns 0 via fallback)', () => {
    const cnt = buildFakturyCount([{ kontrahent_id: 'a' }])
    expect(cnt['z'] || 0).toBe(0)
  })

  it('correctly counts when a contractor has many invoices', () => {
    const faktury = Array.from({ length: 10 }, () => ({ kontrahent_id: 'ikea' }))
    expect(buildFakturyCount(faktury)['ikea']).toBe(10)
  })
})
