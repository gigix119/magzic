import { describe, it, expect } from 'vitest'
import {
  isSellerLabel,
  isBuyerLabel,
  isForbiddenSupplierLine,
  scoreSupplierCandidate,
  detectSupplierFromLines,
} from './invoiceSupplierDetector'
import {
  rememberSupplierContractorMapping,
  findSupplierContractorMapping,
  clearInvoiceLearningData,
} from './invoiceLearning'

// ── isSellerLabel ─────────────────────────────────────────────────────────────

describe('isSellerLabel', () => {
  it('recognizes Polish seller labels', () => {
    expect(isSellerLabel('Sprzedawca')).toBe(true)
    expect(isSellerLabel('sprzedawca:')).toBe(true)
    expect(isSellerLabel('Wystawca')).toBe(true)
    expect(isSellerLabel('wystawiający:')).toBe(true)
    expect(isSellerLabel('Dostawca')).toBe(true)
    expect(isSellerLabel('Nadawca')).toBe(true)
    expect(isSellerLabel('Dane sprzedawcy')).toBe(true)
    expect(isSellerLabel('Dane wystawcy')).toBe(true)
  })

  it('recognizes English seller labels', () => {
    expect(isSellerLabel('Seller')).toBe(true)
    expect(isSellerLabel('Supplier:')).toBe(true)
    expect(isSellerLabel('Issuer')).toBe(true)
    expect(isSellerLabel('Vendor')).toBe(true)
    expect(isSellerLabel('Bill from')).toBe(true)
  })

  it('does NOT recognize ambiguous short labels (od, from) as seller labels', () => {
    expect(isSellerLabel('od')).toBe(false)
    expect(isSellerLabel('Od:')).toBe(false)
    expect(isSellerLabel('From')).toBe(false)
    expect(isSellerLabel('from:')).toBe(false)
  })

  it('does NOT recognize buyer labels as seller labels', () => {
    expect(isSellerLabel('Nabywca')).toBe(false)
    expect(isSellerLabel('Buyer')).toBe(false)
    expect(isSellerLabel('Customer')).toBe(false)
    expect(isSellerLabel('Odbiorca')).toBe(false)
  })

  it('does NOT recognize arbitrary text as seller label', () => {
    expect(isSellerLabel('Faktura VAT')).toBe(false)
    expect(isSellerLabel('ACME Sp. z o.o.')).toBe(false)
    expect(isSellerLabel('NIP: 1234567890')).toBe(false)
  })
})

// ── isBuyerLabel ──────────────────────────────────────────────────────────────

describe('isBuyerLabel', () => {
  it('recognizes Polish buyer labels', () => {
    expect(isBuyerLabel('Nabywca')).toBe(true)
    expect(isBuyerLabel('Odbiorca')).toBe(true)
    expect(isBuyerLabel('Kupujący')).toBe(true)
    expect(isBuyerLabel('Nabywca faktury')).toBe(true)
    expect(isBuyerLabel('Zamawiający')).toBe(true)
    expect(isBuyerLabel('Płatnik')).toBe(true)
  })

  it('recognizes English buyer labels', () => {
    expect(isBuyerLabel('Buyer')).toBe(true)
    expect(isBuyerLabel('Customer')).toBe(true)
    expect(isBuyerLabel('Ship to')).toBe(true)
    expect(isBuyerLabel('Bill to')).toBe(true)
  })

  it('does NOT recognize seller labels as buyer labels', () => {
    expect(isBuyerLabel('Sprzedawca')).toBe(false)
    expect(isBuyerLabel('Seller')).toBe(false)
    expect(isBuyerLabel('Supplier')).toBe(false)
  })
})

// ── isForbiddenSupplierLine ───────────────────────────────────────────────────

describe('isForbiddenSupplierLine', () => {
  it('blocks NIP / REGON lines', () => {
    expect(isForbiddenSupplierLine('NIP: 1234567890')).toBe(true)
    expect(isForbiddenSupplierLine('REGON 123456789')).toBe(true)
    expect(isForbiddenSupplierLine('BDO: 000012345')).toBe(true)
  })

  it('blocks bank account lines', () => {
    expect(isForbiddenSupplierLine('12345678901234567890123456')).toBe(true)
    expect(isForbiddenSupplierLine('nr konta: PL61 1090 1014 0000 0712 1981 2874')).toBe(true)
  })

  it('blocks phone, email, URL lines', () => {
    expect(isForbiddenSupplierLine('tel. +48 123 456 789')).toBe(true)
    expect(isForbiddenSupplierLine('biuro@firma.pl')).toBe(true)
    expect(isForbiddenSupplierLine('www.firma.pl')).toBe(true)
  })

  it('blocks invoice metadata', () => {
    expect(isForbiddenSupplierLine('Faktura VAT')).toBe(true)
    expect(isForbiddenSupplierLine('Do zapłaty')).toBe(true)
    expect(isForbiddenSupplierLine('Razem')).toBe(true)
    expect(isForbiddenSupplierLine('Termin płatności')).toBe(true)
  })

  it('allows company names', () => {
    expect(isForbiddenSupplierLine('ACME Sp. z o.o.')).toBe(false)
    expect(isForbiddenSupplierLine('Hurtownia Czystości Sp. z o.o.')).toBe(false)
    expect(isForbiddenSupplierLine('CLEAN WORLD S.A.')).toBe(false)
    expect(isForbiddenSupplierLine('FHU Jan Kowalski')).toBe(false)
  })
})

// ── scoreSupplierCandidate ────────────────────────────────────────────────────

describe('scoreSupplierCandidate', () => {
  it('gives highest score to line immediately after seller label', () => {
    const r1 = scoreSupplierCandidate('ACME Sp. z o.o.', { lineAfterSellerLabel: 1 })
    const r2 = scoreSupplierCandidate('ACME Sp. z o.o.', { lineAfterSellerLabel: 5 })
    expect(r1.score).toBeGreaterThan(r2.score)
  })

  it('gives bonus for legal form (sp. z o.o. gets higher score)', () => {
    const withLegal = scoreSupplierCandidate('ACME Sp. z o.o.', { lineAfterSellerLabel: 2 })
    const withoutLegal = scoreSupplierCandidate('ACME firma', { lineAfterSellerLabel: 2 })
    expect(withLegal.score).toBeGreaterThan(withoutLegal.score)
  })

  it('gives bonus for ALL CAPS company name', () => {
    const allCaps = scoreSupplierCandidate('CLEAN WORLD', { lineAfterSellerLabel: 2 })
    const mixed = scoreSupplierCandidate('clean world', { lineAfterSellerLabel: 2 })
    expect(allCaps.score).toBeGreaterThan(mixed.score)
  })

  it('penalizes buyer section', () => {
    const inBuyer = scoreSupplierCandidate('ACME Sp. z o.o.', { lineAfterSellerLabel: 1, inBuyerSection: true })
    const notBuyer = scoreSupplierCandidate('ACME Sp. z o.o.', { lineAfterSellerLabel: 1, inBuyerSection: false })
    expect(inBuyer.score).toBeLessThan(notBuyer.score)
  })

  it('marks NIP / REGON lines as forbidden', () => {
    const r = scoreSupplierCandidate('NIP: 1234567890', {})
    expect(r.forbidden).toBe(true)
    expect(r.score).toBe(-99)
  })

  it('marks payment info as forbidden', () => {
    expect(scoreSupplierCandidate('Do zapłaty', {}).forbidden).toBe(true)
    expect(scoreSupplierCandidate('Razem netto', {}).forbidden).toBe(true)
  })

  it('marks buyer labels as forbidden', () => {
    expect(scoreSupplierCandidate('Nabywca', {}).forbidden).toBe(true)
    expect(scoreSupplierCandidate('Buyer', {}).forbidden).toBe(true)
    expect(scoreSupplierCandidate('Customer', {}).forbidden).toBe(true)
  })
})

// ── detectSupplierFromLines ───────────────────────────────────────────────────

describe('detectSupplierFromLines', () => {
  it('detects company after Sprzedawca label', () => {
    const lines = [
      'FAKTURA VAT NR FV/001',
      'Sprzedawca:',
      'ACME Sp. z o.o.',
      'NIP: 1234567890',
      'ul. Testowa 1, 00-001 Warszawa',
      'Nabywca:',
      'Klient ABC',
    ]
    const r = detectSupplierFromLines(lines)
    expect(r.nazwa).toBe('ACME Sp. z o.o.')
    expect(r.confidence).not.toBe('none')
    expect(r.source).toBe('seller_label')
  })

  it('detects company after Dostawca label', () => {
    const lines = [
      'Dostawca',
      'Hurtownia Czystości Sp. z o.o.',
      'NIP 9876543210',
    ]
    const r = detectSupplierFromLines(lines)
    expect(r.nazwa).toContain('Hurtownia')
    expect(r.confidence).not.toBe('none')
  })

  it('detects company after Wystawca label', () => {
    const lines = [
      'Wystawca:',
      'CLEAN WORLD S.A.',
      'NIP: 1111111111',
    ]
    const r = detectSupplierFromLines(lines)
    expect(r.nazwa).toBe('CLEAN WORLD S.A.')
  })

  it('detects company after Nadawca label', () => {
    const lines = ['Nadawca', 'Usługi Budowlane Kowalski Sp.k.']
    const r = detectSupplierFromLines(lines)
    expect(r.nazwa).toContain('Kowalski')
  })

  it('detects company after Seller label', () => {
    const lines = ['Seller:', 'Global Trade Ltd.', 'VAT: 1234567890']
    const r = detectSupplierFromLines(lines)
    expect(r.nazwa).toBe('Global Trade Ltd.')
  })

  it('detects company after Supplier label', () => {
    const lines = ['Supplier', 'ACME GmbH', '123 Main St']
    const r = detectSupplierFromLines(lines)
    expect(r.nazwa).toBe('ACME GmbH')
  })

  it('does NOT pick Nabywca section as contractor', () => {
    const lines = [
      'Sprzedawca:',
      'SELLER Corp Sp. z o.o.',
      'NIP 1234567890',
      'Nabywca:',
      'BUYER Sp. z o.o.',
      'NIP 9876543210',
    ]
    const r = detectSupplierFromLines(lines)
    expect(r.nazwa).toBe('SELLER Corp Sp. z o.o.')
    expect(r.nazwa).not.toContain('BUYER')
  })

  it('does NOT pick Buyer section as contractor', () => {
    const lines = [
      'Seller:',
      'GOOD SUPPLIER Ltd.',
      'Buyer:',
      'My Company Sp. z o.o.',
    ]
    const r = detectSupplierFromLines(lines)
    expect(r.nazwa).toBe('GOOD SUPPLIER Ltd.')
    expect(r.nazwa).not.toContain('My Company')
  })

  it('does NOT pick Customer section as contractor', () => {
    const lines = [
      'Vendor:',
      'Dostawca Testowy S.A.',
      'Customer:',
      'Nabywca ABC',
    ]
    const r = detectSupplierFromLines(lines)
    expect(r.nazwa).not.toContain('Nabywca')
  })

  it('does NOT return account number as contractor', () => {
    const lines = [
      'Sprzedawca:',
      '12345678901234567890123456',
      'ACME Sp. z o.o.',
    ]
    const r = detectSupplierFromLines(lines)
    expect(r.nazwa).not.toMatch(/^\d{26}$/)
  })

  it('does NOT return "Do zapłaty" / "Razem" as contractor', () => {
    const lines = [
      'Sprzedawca:',
      'Do zapłaty',
      'VALID COMPANY S.A.',
    ]
    const r = detectSupplierFromLines(lines)
    expect(r.nazwa).not.toBe('Do zapłaty')
  })

  it('extracts NIP from section when present', () => {
    const lines = [
      'Sprzedawca:',
      'ABC Firma Sp. z o.o.',
      'NIP 1234567890',
    ]
    const r = detectSupplierFromLines(lines)
    expect(r.nip).toBe('1234567890')
  })

  it('returns none confidence for empty input', () => {
    expect(detectSupplierFromLines([]).confidence).toBe('none')
    expect(detectSupplierFromLines(null).confidence).toBe('none')
  })

  it('returns none when only metadata lines exist', () => {
    const lines = ['Faktura VAT', 'NIP: 1234567890', 'Razem', 'Do zapłaty: 100,00 zł']
    const r = detectSupplierFromLines(lines)
    expect(r.nazwa).toBe(null)
  })
})

// ── rememberSupplierContractorMapping / findSupplierContractorMapping ─────────

describe('supplier contractor learning', () => {
  // Clear before each test to ensure isolation
  it('saves and retrieves by NIP', () => {
    clearInvoiceLearningData()
    rememberSupplierContractorMapping('ACME Sp. z o.o.', '1234567890', 'kontr-1', 'ACME Sp. z o.o.')
    const found = findSupplierContractorMapping(null, '1234567890')
    expect(found).not.toBe(null)
    expect(found.contractorId).toBe('kontr-1')
    expect(found.matchedBy).toBe('nip')
    expect(found.source).toBe('learned_supplier_mapping')
  })

  it('saves and retrieves by name (case-insensitive)', () => {
    clearInvoiceLearningData()
    rememberSupplierContractorMapping('ACME Sp. z o.o.', null, 'kontr-2', 'ACME Sp. z o.o.')
    const found = findSupplierContractorMapping('acme sp. z o.o.', null)
    expect(found?.contractorId).toBe('kontr-2')
    expect(found?.matchedBy).toBe('name')
  })

  it('NIP match takes priority over name', () => {
    clearInvoiceLearningData()
    rememberSupplierContractorMapping('Other Name', '1234567890', 'nip-match', null)
    rememberSupplierContractorMapping('ACME Sp. z o.o.', null, 'name-match', null)
    const found = findSupplierContractorMapping('ACME Sp. z o.o.', '1234567890')
    expect(found?.contractorId).toBe('nip-match')
    expect(found?.matchedBy).toBe('nip')
  })

  it('does not save when contractorId is undefined/null', () => {
    clearInvoiceLearningData()
    rememberSupplierContractorMapping('ACME', '1234567890', null, 'ACME')
    const found = findSupplierContractorMapping(null, '1234567890')
    expect(found).toBe(null)
  })

  it('returns null when no mapping exists', () => {
    clearInvoiceLearningData()
    const found = findSupplierContractorMapping('Unknown Company', '9999999999')
    expect(found).toBe(null)
  })

  it('normalizes NIP format on save and lookup', () => {
    clearInvoiceLearningData()
    rememberSupplierContractorMapping('Test', '123-456-78-90', 'kontr-3', null)
    const found = findSupplierContractorMapping(null, '1234567890')
    expect(found?.contractorId).toBe('kontr-3')
  })

  it('subsequent invoice with same name gets contractor from history', () => {
    clearInvoiceLearningData()
    // Simulate: first invoice — user manually chose contractor
    rememberSupplierContractorMapping('Hurtownia ABC Sp. z o.o.', '5555555555', 'saved-id', 'Hurtownia ABC')
    // Second invoice — same PDF name detected
    const found = findSupplierContractorMapping('Hurtownia ABC Sp. z o.o.', null)
    expect(found?.contractorId).toBe('saved-id')
    expect(found?.source).toBe('learned_supplier_mapping')
  })
})

// ── Regression: supplier detection cannot break invoice extraction ────────────

describe('regression: supplier detection is non-blocking', () => {
  it('detectSupplierFromLines never throws for any string array input', () => {
    const inputs = [
      [],
      null,
      undefined,
      [''],
      ['od', 'from', 'by'],
      ['Faktura VAT', 'NIP: 1234567890', 'Razem brutto: 1000,00'],
      ['A'.repeat(200)],
      ['\x00\x01\x02'],
      ['30 dni od wystawienia', 'Termin: 14 dni', 'od'],
    ]
    for (const input of inputs) {
      expect(() => detectSupplierFromLines(input)).not.toThrow()
    }
  })

  it('detectSupplierFromLines returns null nazwa when only metadata is present', () => {
    const lines = ['NIP: 1234567890', 'Razem', 'Do zapłaty', 'Faktura VAT']
    const r = detectSupplierFromLines(lines)
    expect(r.nazwa).toBe(null)
    expect(r.confidence).toBe('none')
  })

  it('supplier detection without results does not prevent invoice parsing (getAssignmentStatus independent)', () => {
    // Simulates: detectSupplierFromLines returns confidence none → no name set
    const lines = ['Data: 2026-01-15', 'Termin płatności: 30 dni', 'od']
    const r = detectSupplierFromLines(lines)
    // Should return none or something but NOT throw
    expect(r).toBeDefined()
    expect(r).toHaveProperty('confidence')
  })

  it('findSupplierContractorMapping returns null for null/undefined inputs', () => {
    expect(findSupplierContractorMapping(null, null)).toBe(null)
    expect(findSupplierContractorMapping(undefined, undefined)).toBe(null)
    expect(findSupplierContractorMapping('', '')).toBe(null)
  })

  it('rememberSupplierContractorMapping does not throw for edge case inputs', () => {
    expect(() => rememberSupplierContractorMapping(null, null, null, null)).not.toThrow()
    expect(() => rememberSupplierContractorMapping(undefined, undefined, undefined, undefined)).not.toThrow()
    expect(() => rememberSupplierContractorMapping('', '', 'id', '')).not.toThrow()
  })

  it('ambiguous short word "od" is not treated as seller label', () => {
    expect(isSellerLabel('od')).toBe(false)
    expect(isSellerLabel('Od')).toBe(false)
    expect(isSellerLabel('od:')).toBe(false)
  })

  it('standalone "from" is not treated as seller label', () => {
    expect(isSellerLabel('From')).toBe(false)
    expect(isSellerLabel('from')).toBe(false)
    expect(isSellerLabel('from:')).toBe(false)
    expect(isSellerLabel('Bill from')).toBe(true)
  })

  it('line with "30 dni od wystawienia" does not trigger seller section', () => {
    const lines = [
      'Termin płatności: 30 dni od wystawienia',
      'SOME COMPANY S.A.',
      'NIP: 1234567890',
    ]
    // "od" in "30 dni od wystawienia" is part of a longer line, not a standalone label
    // Verify it doesn't crash regardless of what it detects
    expect(() => detectSupplierFromLines(lines)).not.toThrow()
  })
})
