import { describe, it, expect } from 'vitest'
import {
  normalizeNip,
  normalizeContractorName,
  isSameNip,
  findMatchingContractor,
  findContractorDuplicates,
  prepareContractorFromInvoice,
} from './contractorMatcher'

describe('normalizeNip', () => {
  it('removes dashes', () => {
    expect(normalizeNip('123-456-78-90')).toBe('1234567890')
  })
  it('removes PL prefix (uppercase)', () => {
    expect(normalizeNip('PL1234567890')).toBe('1234567890')
  })
  it('removes pl prefix (lowercase)', () => {
    expect(normalizeNip('pl1234567890')).toBe('1234567890')
  })
  it('removes spaces', () => {
    expect(normalizeNip('123 456 78 90')).toBe('1234567890')
  })
  it('handles plain digits', () => {
    expect(normalizeNip('1234567890')).toBe('1234567890')
  })
  it('handles mixed dashes and spaces', () => {
    expect(normalizeNip('123-45-67-890')).toBe('1234567890')
  })
  it('returns null for empty string', () => {
    expect(normalizeNip('')).toBe(null)
  })
  it('returns null for null', () => {
    expect(normalizeNip(null)).toBe(null)
  })
  it('returns null for undefined', () => {
    expect(normalizeNip(undefined)).toBe(null)
  })
  it('returns null for too short result', () => {
    expect(normalizeNip('12345')).toBe(null)
  })
})

describe('isSameNip', () => {
  it('matches same NIP in different formats', () => {
    expect(isSameNip('123-456-78-90', 'PL1234567890')).toBe(true)
  })
  it('matches when both plain', () => {
    expect(isSameNip('1234567890', '1234567890')).toBe(true)
  })
  it('returns false for different NIPs', () => {
    expect(isSameNip('1234567890', '9876543210')).toBe(false)
  })
  it('returns false if first is null', () => {
    expect(isSameNip(null, '1234567890')).toBe(false)
  })
  it('returns false if second is null', () => {
    expect(isSameNip('1234567890', null)).toBe(false)
  })
  it('returns false if both null', () => {
    expect(isSameNip(null, null)).toBe(false)
  })
})

describe('findMatchingContractor', () => {
  const contractors = [
    { id: '1', nazwa: 'ABC Sp. z o.o.', nip: '1234567890' },
    { id: '2', nazwa: 'XYZ S.A.', nip: '9876543210' },
    { id: '3', nazwa: 'Firma Testowa', nip: null },
  ]

  it('finds by NIP — exact', () => {
    const result = findMatchingContractor({ nip: '123-456-78-90', nazwa: '' }, contractors)
    expect(result.match?.id).toBe('1')
    expect(result.matchedBy).toBe('nip')
    expect(result.confidence).toBe('exact')
  })

  it('finds by NIP with PL prefix', () => {
    const result = findMatchingContractor({ nip: 'PL1234567890', nazwa: '' }, contractors)
    expect(result.match?.id).toBe('1')
  })

  it('finds by name — exact normalized', () => {
    const result = findMatchingContractor({ nip: null, nazwa: 'ABC Sp. z o.o.' }, contractors)
    expect(result.match?.id).toBe('1')
    expect(result.matchedBy).toBe('name')
  })

  it('finds by name — normalized without suffix', () => {
    const result = findMatchingContractor({ nip: null, nazwa: 'abc' }, contractors)
    // 'abc' normalized = 'abc', 'ABC Sp. z o.o.' normalized = 'abc'
    expect(result.match?.id).toBe('1')
  })

  it('NIP match wins over name fallback', () => {
    const result = findMatchingContractor({ nip: '1234567890', nazwa: 'XYZ S.A.' }, contractors)
    expect(result.match?.id).toBe('1') // matched by NIP, not name
  })

  it('returns no match for unknown NIP and name', () => {
    const result = findMatchingContractor({ nip: '0000000000', nazwa: 'Nieznana Firma Zupełnie Inna' }, contractors)
    expect(result.match).toBe(null)
    expect(result.confidence).toBe('none')
  })

  it('returns null for null input', () => {
    const result = findMatchingContractor(null, contractors)
    expect(result.match).toBe(null)
    expect(result.confidence).toBe('none')
  })

  it('returns null for empty contractors', () => {
    const result = findMatchingContractor({ nip: '1234567890', nazwa: 'ABC' }, [])
    expect(result.match).toBe(null)
  })
})

describe('findContractorDuplicates', () => {
  const contractors = [
    { id: '1', nazwa: 'ABC Sp. z o.o.', nip: '1234567890' },
    { id: '2', nazwa: 'XYZ S.A.', nip: '9876543210' },
  ]

  it('finds duplicate by NIP', () => {
    const dupes = findContractorDuplicates({ nazwa: 'Something Else', nip: '1234567890' }, contractors)
    expect(dupes.length).toBe(1)
    expect(dupes[0].id).toBe('1')
  })

  it('finds duplicate by NIP in different format', () => {
    const dupes = findContractorDuplicates({ nazwa: 'ABC', nip: '123-456-78-90' }, contractors)
    expect(dupes.length).toBe(1)
    expect(dupes[0].id).toBe('1')
  })

  it('finds duplicate by normalized name when no NIP', () => {
    const dupes = findContractorDuplicates({ nazwa: 'abc', nip: null }, contractors)
    expect(dupes.length).toBe(1)
    expect(dupes[0].id).toBe('1')
  })

  it('returns empty for no match', () => {
    const dupes = findContractorDuplicates({ nazwa: 'Completely New Company', nip: '5555555555' }, contractors)
    expect(dupes.length).toBe(0)
  })

  it('returns empty for null candidate', () => {
    const dupes = findContractorDuplicates(null, contractors)
    expect(dupes.length).toBe(0)
  })
})

describe('findMatchingContractor — token fuzzy matching', () => {
  const contractors = [
    { id: '10', nazwa: 'Centrum Sprzętu Budowlanego Sp. z o.o.', nip: '1111111111' },
    { id: '11', nazwa: 'Hurtownia Materiałów Budowlanych', nip: '2222222222' },
    { id: '12', nazwa: 'Sklep ABC', nip: '3333333333' },
  ]

  it('matches by token overlap (word order variant)', () => {
    const result = findMatchingContractor({ nip: null, nazwa: 'Sprzętu Budowlanego Centrum' }, contractors)
    expect(result.match?.id).toBe('10')
    expect(result.matchedBy).toBe('name_tokens')
    expect(result.confidence).toBe('fuzzy')
  })

  it('matches by token overlap (abbreviated name)', () => {
    const result = findMatchingContractor({ nip: null, nazwa: 'Hurtownia Materiałów Budowlanych' }, contractors)
    // Exact normalized match wins before tokens even needed
    expect(result.match?.id).toBe('11')
  })

  it('does not match unrelated name', () => {
    const result = findMatchingContractor({ nip: null, nazwa: 'Całkowicie Inna Firma' }, contractors)
    expect(result.match).toBe(null)
  })

  it('token match does not trigger for very short names', () => {
    const result = findMatchingContractor({ nip: null, nazwa: 'AB' }, contractors)
    expect(result.match).toBe(null)
  })
})

describe('prepareContractorFromInvoice', () => {
  it('extracts from kontrahent fields', () => {
    const extracted = {
      fields: { kontrahent_nip: '123-456-78-90', kontrahent_nazwa: 'Test Firma Sp. z o.o.' },
    }
    const result = prepareContractorFromInvoice(extracted)
    expect(result.nip).toBe('1234567890')
    expect(result.nazwa).toBe('Test Firma Sp. z o.o.')
  })

  it('falls back to sprzedawca fields', () => {
    const extracted = {
      fields: { sprzedawca_nip: '1234567890', sprzedawca_nazwa: 'Sprzedawca Firma' },
    }
    const result = prepareContractorFromInvoice(extracted)
    expect(result.nip).toBe('1234567890')
    expect(result.nazwa).toBe('Sprzedawca Firma')
  })

  it('kontrahent fields take priority over sprzedawca', () => {
    const extracted = {
      fields: {
        kontrahent_nip: '1111111111',
        kontrahent_nazwa: 'Kontrahent',
        sprzedawca_nip: '2222222222',
        sprzedawca_nazwa: 'Sprzedawca',
      },
    }
    const result = prepareContractorFromInvoice(extracted)
    expect(result.nip).toBe('1111111111')
    expect(result.nazwa).toBe('Kontrahent')
  })

  it('returns null if no data in fields', () => {
    const result = prepareContractorFromInvoice({ fields: {} })
    expect(result).toBe(null)
  })

  it('returns null for null input', () => {
    const result = prepareContractorFromInvoice(null)
    expect(result).toBe(null)
  })

  it('normalizes NIP in extracted data', () => {
    const extracted = { fields: { kontrahent_nip: 'PL 123-456-78-90', kontrahent_nazwa: 'Firma' } }
    const result = prepareContractorFromInvoice(extracted)
    expect(result.nip).toBe('1234567890')
  })
})
