import { describe, it, expect } from 'vitest'
import { normalizeText, tokenize, buildTfIdfIndex, queryTfIdf, generateTrigrams, trigramSimilarity, substringMatch, subsequenceMatch, combinedProductScore } from './invoiceTfIdf.js'

// ── normalizeText ─────────────────────────────────────────────────────────────

describe('normalizeText', () => {
  it('handles null and undefined safely', () => {
    expect(normalizeText(null)).toBe('')
    expect(normalizeText(undefined)).toBe('')
    expect(normalizeText('')).toBe('')
  })

  it('replaces all Polish diacritics', () => {
    const result = normalizeText('Łódź, śruba, wkręt, żarówka, przewód')
    expect(result).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/)
    expect(result).toContain('lodz')
    expect(result).toContain('sruba')
    expect(result).toContain('wkret')
    expect(result).toContain('zarowka')
    expect(result).toContain('przewod')
  })

  it('normalises cat.6 and cat 6 variants to cat6', () => {
    expect(normalizeText('CAT.6')).toContain('cat6')
    expect(normalizeText('cat 6')).toContain('cat6')
    expect(normalizeText('cat. 6')).toContain('cat6')
  })

  it('normalises kat.6 and kat 6 variants to kat6', () => {
    expect(normalizeText('kat.6')).toContain('kat6')
    expect(normalizeText('kat 6')).toContain('kat6')
    expect(normalizeText('Kabel UTP kat. 6')).toContain('kat6')
  })

  it('removes trailing quote from size fractions', () => {
    expect(normalizeText('1/2"')).toContain('1/2')
    expect(normalizeText('3/4"')).toContain('3/4')
    expect(normalizeText('1/2"')).not.toContain('"')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeText('kabel   utp')).toBe('kabel utp')
  })
})

// ── tokenize ──────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('handles null, undefined and empty input safely', () => {
    expect(tokenize(null)).toEqual([])
    expect(tokenize(undefined)).toEqual([])
    expect(tokenize('')).toEqual([])
  })

  it('removes Polish stopwords', () => {
    const tokens = tokenize('kabel do internetu na ścianę')
    expect(tokens).not.toContain('do')
    expect(tokens).not.toContain('na')
    expect(tokens).toContain('kabel')
    expect(tokens).toContain('internetu')
  })

  it('preserves technical tokens including cat6, ip44, dn50, fractions', () => {
    const tokens = tokenize('Kabel UTP CAT.6 IP44 DN50 3/4')
    expect(tokens).toContain('kabel')
    expect(tokens).toContain('utp')
    expect(tokens).toContain('cat6')
    expect(tokens).toContain('ip44')
    expect(tokens).toContain('dn50')
    expect(tokens).toContain('3/4')
  })

  it('aliases kat6 to cat6', () => {
    const tokens = tokenize('kabel kat6 skretka')
    expect(tokens).toContain('cat6')
    expect(tokens).not.toContain('kat6')
  })

  it('aliases przewód (via przewod) to kabel', () => {
    const tokens = tokenize('Przewód sieciowy UTP')
    expect(tokens).toContain('kabel')
    expect(tokens).not.toContain('przewod')
  })

  it('drops short non-digit tokens but keeps tokens with digits', () => {
    // "m" alone is 1 char, no digit → dropped; "m2" has digit → kept
    const tokens = tokenize('rura m m2 pvc')
    expect(tokens).not.toContain('m')
    expect(tokens).toContain('m2')
    expect(tokens).toContain('rura')
    expect(tokens).toContain('pvc')
  })
})

// ── buildTfIdfIndex ───────────────────────────────────────────────────────────

describe('buildTfIdfIndex', () => {
  it('handles empty array safely', () => {
    const idx = buildTfIdfIndex([])
    expect(idx.vectors).toEqual([])
    expect(idx.norms).toEqual([])
    expect(idx.idf).toEqual({})
  })

  it('handles null and missing-field products without throwing', () => {
    expect(() => buildTfIdfIndex([null, {}, { id: 1 }])).not.toThrow()
  })

  it('builds vectors and norms with the correct length', () => {
    const products = [
      { id: 1, nazwa: 'Kabel UTP cat6' },
      { id: 2, nazwa: 'Syfon chrom' },
    ]
    const idx = buildTfIdfIndex(products)
    expect(idx.vectors).toHaveLength(2)
    expect(idx.norms).toHaveLength(2)
    expect(Object.keys(idx.idf).length).toBeGreaterThan(0)
  })

  it('IDF values are finite and positive', () => {
    const products = [
      { id: 1, nazwa: 'zawor kulowy dn50' },
      { id: 2, nazwa: 'uszczelka gumowa' },
    ]
    const idx = buildTfIdfIndex(products)
    for (const val of Object.values(idx.idf)) {
      expect(isFinite(val)).toBe(true)
      expect(val).toBeGreaterThan(0)
    }
  })

  it('uses sku/code/symbol fields when present', () => {
    const products = [{ id: 1, nazwa: 'Kabel', sku: 'UTP-CAT6-10M' }]
    const idx = buildTfIdfIndex(products)
    // "cat6" should appear from the sku after normalization
    expect(Object.keys(idx.idf)).toContain('cat6')
  })
})

// ── queryTfIdf ────────────────────────────────────────────────────────────────

describe('queryTfIdf', () => {
  const products = [
    { id: 1, nazwa: 'Przewód sieciowy UTP kat. 6' },
    { id: 2, nazwa: 'Syfon umywalkowy chrom' },
    { id: 3, nazwa: 'Żarówka LED E27' },
  ]
  const index = buildTfIdfIndex(products)

  it('ranks the most relevant product first for KABEL UTP CAT6', () => {
    const results = queryTfIdf('KABEL UTP CAT6', index)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].productId).toBe(1)
    expect(results[0].score).toBeGreaterThan(0)
  })

  it('returns [] for null, undefined or empty query', () => {
    expect(queryTfIdf(null, index)).toEqual([])
    expect(queryTfIdf(undefined, index)).toEqual([])
    expect(queryTfIdf('', index)).toEqual([])
  })

  it('returns [] for null or invalid index', () => {
    expect(queryTfIdf('KABEL', null)).toEqual([])
    expect(queryTfIdf('KABEL', {})).toEqual([])
    expect(queryTfIdf('KABEL', buildTfIdfIndex([]))).toEqual([])
  })

  it('returns [] when no query terms exist in the vocabulary', () => {
    const results = queryTfIdf('xyzqqqnotaword', index)
    expect(results).toEqual([])
  })

  it('is deterministic — same query yields identical results each call', () => {
    const r1 = queryTfIdf('KABEL UTP CAT6', index)
    const r2 = queryTfIdf('KABEL UTP CAT6', index)
    expect(r1).toHaveLength(r2.length)
    expect(r1[0].productId).toBe(r2[0].productId)
    expect(r1[0].score).toBeCloseTo(r2[0].score, 10)
  })

  it('respects the topK limit', () => {
    const results = queryTfIdf('kabel utp syfon zarowka', index, 2)
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('scores are between 0 and 1', () => {
    const results = queryTfIdf('KABEL UTP CAT6', index)
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(1)
    }
  })

  it('product 1 scores higher than syfon and zarowka for cable query', () => {
    const results = queryTfIdf('KABEL UTP CAT6', index)
    const byId = Object.fromEntries(results.map(r => [r.productId, r.score]))
    expect(byId[1] ?? 0).toBeGreaterThan(byId[2] ?? 0)
    expect(byId[1] ?? 0).toBeGreaterThan(byId[3] ?? 0)
  })
})

// ── New: trigram / substring / subsequence / combinedProductScore ───────────

describe('generateTrigrams', () => {
  it('generates correct trigrams for "domestos"', () => {
    const tg = generateTrigrams('domestos')
    expect(tg.has('dom')).toBe(true)
    expect(tg.has('tos')).toBe(true)
  })

  it('short string returns itself as a Set entry', () => {
    const tg = generateTrigrams('ab')
    expect(tg.has('ab')).toBe(true)
  })
})

describe('trigramSimilarity', () => {
  it('"domestos" vs "domestos" → 1.0', () => {
    expect(trigramSimilarity('domestos', 'domestos')).toBeCloseTo(1.0, 5)
  })

  it('"domest" vs "domestos" → > 0.5', () => {
    expect(trigramSimilarity('domest', 'domestos')).toBeGreaterThan(0.5)
  })

  it('completely different strings → 0', () => {
    expect(trigramSimilarity('abc', 'xyz')).toBe(0)
  })
})

describe('substringMatch', () => {
  it('"led" in "żarówka LED 5W" → 1.0 (diacritics stripped)', () => {
    expect(substringMatch('led', 'żarówka LED 5W')).toBe(1.0)
  })

  it('"papier toalet" in "papier toaletowy" → 1.0', () => {
    expect(substringMatch('papier toalet', 'papier toaletowy')).toBe(1.0)
  })

  it('"zarowka" in "żarówka LED" → 1.0 (diacritics stripped)', () => {
    expect(substringMatch('zarowka', 'żarówka LED')).toBe(1.0)
  })

  it('"xyz" in "domestos" → 0', () => {
    expect(substringMatch('xyz', 'domestos')).toBe(0)
  })
})

describe('subsequenceMatch', () => {
  it('"dmst" in "domestos" → > 0.4', () => {
    expect(subsequenceMatch('dmst', 'domestos')).toBeGreaterThan(0.4)
  })

  it('"ptl" in "papier toaletowy" → > 0', () => {
    expect(subsequenceMatch('ptl', 'papier toaletowy')).toBeGreaterThan(0)
  })

  it('"xyz" in "domestos" → 0 (not a subsequence)', () => {
    expect(subsequenceMatch('xyz', 'domestos')).toBe(0)
  })

  it('"zl" in "zarowka led" → > 0', () => {
    expect(subsequenceMatch('zl', 'zarowka led')).toBeGreaterThan(0)
  })
})

describe('combinedProductScore', () => {
  it('"dmst" vs "Domestos" → > 0.09 (subsequence signal)', () => {
    expect(combinedProductScore('dmst', 'Domestos')).toBeGreaterThan(0.09)
  })

  it('"żarówka" vs "zarowka led" → > 0.4 (diacritics)', () => {
    expect(combinedProductScore('żarówka', 'zarowka led')).toBeGreaterThan(0.4)
  })

  it('"zar led" vs "Żarówka LED 5W" → > 0.5', () => {
    expect(combinedProductScore('zar led', 'Żarówka LED 5W')).toBeGreaterThan(0.5)
  })

  it('"papier" vs "Papier toaletowy 8 rolek" → > 0.3', () => {
    expect(combinedProductScore('papier', 'Papier toaletowy 8 rolek')).toBeGreaterThan(0.3)
  })

  it('"rekaw" vs "Rękawice nitrylowe M" → > 0.3', () => {
    expect(combinedProductScore('rekaw', 'Rękawice nitrylowe M')).toBeGreaterThan(0.3)
  })

  it('"DOMESTOS" vs "domestos" → > 0.9 (case insensitive)', () => {
    expect(combinedProductScore('DOMESTOS', 'domestos')).toBeGreaterThan(0.9)
  })

  it('"ręcznik" vs "recznik papierowy" → > 0.3 (diacritics)', () => {
    expect(combinedProductScore('ręcznik', 'recznik papierowy')).toBeGreaterThan(0.3)
  })

  it('empty query → 0', () => {
    expect(combinedProductScore('', 'domestos')).toBe(0)
  })
})
