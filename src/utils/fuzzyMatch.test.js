import { describe, it, expect } from 'vitest'
import { normalizeName, matchLokal, fuzzyTopMatches } from './fuzzyMatch'

const LOKALE = [
  { id: '1', nazwa: 'Jas Las A19' },
  { id: '2', nazwa: 'Jas Las A13' },
  { id: '3', nazwa: 'Jas Las B16' },
  { id: '4', nazwa: 'Hel CasaBaia 04' },
]

describe('normalizeName', () => {
  it('trimuje, lowercase i kolapsuje spacje', () => {
    expect(normalizeName('  Jas   Las A19 ')).toBe('jas las a19')
  })
})

describe('matchLokal', () => {
  it('zwraca dopasowanie dokładne (case/whitespace insensitive)', () => {
    expect(matchLokal('jas las a19', LOKALE).id).toBe('1')
  })

  it('zwraca null gdy brak dopasowania (nawet fuzzy include)', () => {
    expect(matchLokal('Mech Anch X99', LOKALE)).toBeNull()
  })
})

describe('fuzzyTopMatches', () => {
  it('zwraca najbliższe dopasowania, najbliższe jako pierwsze', () => {
    const top = fuzzyTopMatches('Jas Las A19', LOKALE, 3)
    expect(top[0].id).toBe('1')
    expect(top.map(l => l.id)).toEqual(expect.arrayContaining(['1', '2', '3']))
  })

  it('respektuje limit topN', () => {
    expect(fuzzyTopMatches('Jas Las A19', LOKALE, 2)).toHaveLength(2)
  })
})
