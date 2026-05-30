import { describe, it, expect } from 'vitest'
import { normalizeProductName, advancedSimilarity, findBestMatch } from './productNormalizer'

// ── normalizeProductName ──────────────────────────────────────────────────────

describe('normalizeProductName', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeProductName('Farba Biała')).toBe('farba biala')
  })

  it('removes stopwords shorter than 2 chars', () => {
    expect(normalizeProductName('klej do ściany')).toBe('klej sciany')
  })

  it('returns empty string for single-char product name', () => {
    expect(normalizeProductName('B')).toBe('')
    expect(normalizeProductName('A')).toBe('')
  })

  it('returns empty string for null/empty input', () => {
    expect(normalizeProductName('')).toBe('')
    expect(normalizeProductName(null)).toBe('')
  })
})

// ── advancedSimilarity — guard against single-char product names ──────────────

describe('advancedSimilarity — short product name guard', () => {
  const shortNameProduct = { id: 'p-b', nazwa: 'B', typ: '' }

  it('returns score 0 for product with single-char name (prevents "B" false match)', () => {
    const { score } = advancedSimilarity('Farba biała matowa 10 l', shortNameProduct)
    expect(score).toBe(0)
  })

  it('returns score 0 for product with empty name', () => {
    const { score } = advancedSimilarity('Klej montażowy 300 ml', { id: 'p-empty', nazwa: '', typ: '' })
    expect(score).toBe(0)
  })

  it('returns score 0 for product with null name', () => {
    const { score } = advancedSimilarity('Wkręt 4x40 200 szt.', { id: 'p-null', nazwa: null, typ: null })
    expect(score).toBe(0)
  })

  it('does not assign short-name product via findBestMatch at any threshold', () => {
    const products = [
      { id: 'p-b', nazwa: 'B', typ: '' },
      { id: 'p-a', nazwa: 'A', typ: '' },
    ]
    const match = findBestMatch('Farba biała matowa 10 l', products, 0.1)
    expect(match).toBeNull()
  })

  it('still matches a real product even when garbage products are present', () => {
    const products = [
      { id: 'p-b', nazwa: 'B', typ: '' },
      { id: 'p-farba', nazwa: 'Farba biała matowa', typ: 'farba' },
    ]
    const match = findBestMatch('Farba biała matowa 10 l', products, 0.5)
    expect(match).not.toBeNull()
    expect(match.product.id).toBe('p-farba')
  })

  it('returns score 0 for product whose normalized name is empty even if typ is also short', () => {
    const product = { id: 'p-x', nazwa: 'X', typ: 'Y' }
    const { score } = advancedSimilarity('Farba biała matowa', product)
    expect(score).toBe(0)
  })
})

// ── advancedSimilarity — normal matching still works ─────────────────────────

describe('advancedSimilarity — normal matching', () => {
  it('returns score 1.0 for exact match', () => {
    const { score } = advancedSimilarity('Klej montażowy', { nazwa: 'Klej montażowy', typ: '' })
    expect(score).toBe(1.0)
  })

  it('returns score >= 0.85 for contains match', () => {
    const { score } = advancedSimilarity('Klej montażowy 300 ml', { nazwa: 'Klej montażowy', typ: '' })
    expect(score).toBeGreaterThanOrEqual(0.85)
  })

  it('returns score < 0.85 for unrelated products', () => {
    const { score } = advancedSimilarity('Śruba M6x30', { nazwa: 'Farba biała', typ: '' })
    expect(score).toBeLessThan(0.85)
  })
})

// ── regression: 26 items should NOT match product "B" at score >= 0.85 ───────

describe('regression: fake B product match', () => {
  const productB = { id: 'b-uuid', nazwa: 'B', typ: '' }
  const invoiceItems = [
    'Farba biała matowa 10 l',
    'Klej montażowy 300 ml',
    'Wkręt 4x40 200 szt.',
    'Taśma malarska 48 mm',
    'Pędzel płaski 50 mm',
    'Grunt podkładowy 5 l',
    'Silikon sanitarny biały',
    'Pianka montażowa 750 ml',
    'Kołek rozporowy 8x40',
    'Śruba ocynkowana M5x30',
  ]

  it.each(invoiceItems)('invoice item "%s" does NOT auto-match product B (score < 0.85)', (itemName) => {
    const { score } = advancedSimilarity(itemName, productB)
    expect(score).toBeLessThan(0.85)
  })
})
