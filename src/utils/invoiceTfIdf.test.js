import { describe, it, expect } from 'vitest'
import { normalizeText, tokenize, buildTfIdfIndex, queryTfIdf } from './invoiceTfIdf.js'

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
