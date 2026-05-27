import { describe, it, expect } from 'vitest'
import {
  isGenericContractorName,
  validateContractorFromPdf,
  getVerificationStatusConfig,
  getItemTypeLabel,
  looksLikeServiceItem,
  canLineAffectInventory,
  canLineBeSavedAsDraft,
  getLineBlockingReasons,
} from './invoiceVerificationStatus'

// ── isGenericContractorName ───────────────────────────────────────────────────

describe('isGenericContractorName', () => {
  it('blocks exact generic Polish names', () => {
    expect(isGenericContractorName('sprzedawca')).toBe(true)
    expect(isGenericContractorName('nabywca')).toBe(true)
    expect(isGenericContractorName('dostawca')).toBe(true)
    expect(isGenericContractorName('kontrahent')).toBe(true)
    expect(isGenericContractorName('platnik')).toBe(true)
    expect(isGenericContractorName('płatnik')).toBe(true)
  })

  it('blocks generic English names', () => {
    expect(isGenericContractorName('vendor')).toBe(true)
    expect(isGenericContractorName('buyer')).toBe(true)
    expect(isGenericContractorName('supplier')).toBe(true)
    expect(isGenericContractorName('customer')).toBe(true)
    expect(isGenericContractorName('seller')).toBe(true)
  })

  it('blocks null and empty', () => {
    expect(isGenericContractorName(null)).toBe(true)
    expect(isGenericContractorName('')).toBe(true)
    expect(isGenericContractorName(undefined)).toBe(true)
  })

  it('blocks names shorter than 3 characters', () => {
    expect(isGenericContractorName('AB')).toBe(true)
    expect(isGenericContractorName('X')).toBe(true)
  })

  it('blocks case-insensitively', () => {
    expect(isGenericContractorName('SPRZEDAWCA')).toBe(true)
    expect(isGenericContractorName('Nabywca')).toBe(true)
    expect(isGenericContractorName('VENDOR')).toBe(true)
  })

  it('allows real company names', () => {
    expect(isGenericContractorName('ACME Sp. z o.o.')).toBe(false)
    expect(isGenericContractorName('Kowalski i Wspólnicy')).toBe(false)
    expect(isGenericContractorName('FHU Nowak')).toBe(false)
    expect(isGenericContractorName('ABC123')).toBe(false)
  })
})

// ── validateContractorFromPdf ─────────────────────────────────────────────────

describe('validateContractorFromPdf', () => {
  it('returns invalid for null', () => {
    const r = validateContractorFromPdf(null)
    expect(r.valid).toBe(false)
    expect(r.warnings.length).toBeGreaterThan(0)
  })

  it('returns invalid for generic name', () => {
    const r = validateContractorFromPdf({ nazwa: 'Sprzedawca', nip: '1234567890' })
    expect(r.valid).toBe(false)
    expect(r.nipOk).toBe(null)
  })

  it('returns valid for real name without NIP', () => {
    const r = validateContractorFromPdf({ nazwa: 'ACME Sp. z o.o.' })
    expect(r.valid).toBe(true)
    expect(r.nipOk).toBe(null)
    expect(r.warnings).toHaveLength(0)
  })

  it('returns valid with correct NIP', () => {
    // 1234563224 — valid NIP checksum
    const r = validateContractorFromPdf({ nazwa: 'ACME Sp. z o.o.', nip: '1234563224' })
    expect(r.valid).toBe(true)
    expect(r.nipOk).toBe(true)
    expect(r.warnings).toHaveLength(0)
  })

  it('returns warning for invalid NIP checksum', () => {
    const r = validateContractorFromPdf({ nazwa: 'ACME Sp. z o.o.', nip: '1234567890' })
    expect(r.valid).toBe(true)
    expect(r.nipOk).toBe(false)
    expect(r.warnings.length).toBeGreaterThan(0)
    expect(r.warnings[0]).toContain('1234567890')
  })
})

// ── getVerificationStatusConfig ───────────────────────────────────────────────

describe('getVerificationStatusConfig', () => {
  it('returns config for all known statuses', () => {
    for (const status of ['ready', 'service_cost', 'needs_review', 'needs_price', 'needs_product', 'ignored']) {
      const cfg = getVerificationStatusConfig(status)
      expect(cfg).toHaveProperty('label')
      expect(cfg).toHaveProperty('short')
      expect(cfg).toHaveProperty('bg')
      expect(cfg).toHaveProperty('color')
      expect(cfg).toHaveProperty('border')
    }
  })

  it('falls back to ignored config for unknown status', () => {
    const cfg = getVerificationStatusConfig('unknown_status_xyz')
    expect(cfg).toHaveProperty('label')
    expect(cfg.short).toBe('– pominięta')
  })

  it('ready status has green color', () => {
    const cfg = getVerificationStatusConfig('ready')
    expect(cfg.color).toContain('#166534')
  })

  it('needs_product has red color', () => {
    const cfg = getVerificationStatusConfig('needs_product')
    expect(cfg.color).toContain('#991b1b')
  })
})

// ── getItemTypeLabel ──────────────────────────────────────────────────────────

describe('getItemTypeLabel', () => {
  it('returns label for inventory_item', () => {
    const r = getItemTypeLabel('inventory_item')
    expect(r.text).toBe('Towar')
    expect(r.bg).toBeTruthy()
    expect(r.color).toBeTruthy()
  })

  it('returns label for service_item', () => {
    const r = getItemTypeLabel('service_item')
    expect(r.text).toBe('Usługa')
  })

  it('returns fallback for unknown type', () => {
    const r = getItemTypeLabel('unknown_xyz')
    expect(r.text).toBe('Sprawdź')
  })
})

// ── looksLikeServiceItem ──────────────────────────────────────────────────────

describe('looksLikeServiceItem', () => {
  it('detects service keywords', () => {
    expect(looksLikeServiceItem('transport materiałów')).toBe(true)
    expect(looksLikeServiceItem('usługa serwisowa')).toBe(true)
    expect(looksLikeServiceItem('abonament telefon')).toBe(true)
    expect(looksLikeServiceItem('licencja programu')).toBe(true)
    expect(looksLikeServiceItem('szkolenie pracowników')).toBe(true)
    expect(looksLikeServiceItem('energia elektryczna')).toBe(true)
  })

  it('rejects non-service items', () => {
    expect(looksLikeServiceItem('Śruba M6x20')).toBe(false)
    expect(looksLikeServiceItem('Farba lateksowa 10L')).toBe(false)
    expect(looksLikeServiceItem('Cement 25kg')).toBe(false)
  })

  it('returns false for null/empty', () => {
    expect(looksLikeServiceItem(null)).toBe(false)
    expect(looksLikeServiceItem('')).toBe(false)
  })
})

// ── canLineAffectInventory ────────────────────────────────────────────────────

describe('canLineAffectInventory', () => {
  it('returns true for inventory_item with default shouldAffect', () => {
    expect(canLineAffectInventory({ itemType: 'inventory_item' })).toBe(true)
  })

  it('returns false when shouldAffectInventory is false', () => {
    expect(canLineAffectInventory({ itemType: 'inventory_item', shouldAffectInventory: false })).toBe(false)
  })

  it('returns false for service_item', () => {
    expect(canLineAffectInventory({ itemType: 'service_item' })).toBe(false)
  })

  it('returns false for null', () => {
    expect(canLineAffectInventory(null)).toBe(false)
  })
})

// ── canLineBeSavedAsDraft ─────────────────────────────────────────────────────

describe('canLineBeSavedAsDraft', () => {
  it('returns true for item with valid name', () => {
    expect(canLineBeSavedAsDraft({ rawName: 'Śruba M6' })).toBe(true)
  })

  it('returns true when nazwa is present instead of rawName', () => {
    expect(canLineBeSavedAsDraft({ nazwa: 'Cement 25kg' })).toBe(true)
  })

  it('returns false for null', () => {
    expect(canLineBeSavedAsDraft(null)).toBe(false)
  })

  it('returns false for item with empty name', () => {
    expect(canLineBeSavedAsDraft({ rawName: '' })).toBe(false)
    expect(canLineBeSavedAsDraft({ rawName: 'A' })).toBe(false)
  })

  it('returns false for summary_line type', () => {
    expect(canLineBeSavedAsDraft({ rawName: 'Razem netto', lineType: 'summary_line' })).toBe(false)
  })

  it('returns false for payment_info type', () => {
    expect(canLineBeSavedAsDraft({ rawName: 'Numer konta', lineType: 'payment_info' })).toBe(false)
  })
})

// ── getLineBlockingReasons ────────────────────────────────────────────────────

describe('getLineBlockingReasons', () => {
  it('returns reason for missing price', () => {
    const item = { itemType: 'inventory_item', shouldAffectInventory: true, unitPriceNet: 0, matchedProductId: 'abc' }
    const reasons = getLineBlockingReasons(item, [{ id: 'abc', nazwa: 'Test', typ: 'test', jednostka: 'szt' }])
    expect(reasons.some(r => r.includes('ceny'))).toBe(true)
  })

  it('returns reason for missing product', () => {
    const item = { itemType: 'inventory_item', shouldAffectInventory: true, unitPriceNet: 100, matchedProductId: null }
    const reasons = getLineBlockingReasons(item, [])
    expect(reasons.some(r => r.toLowerCase().includes('towar') || r.toLowerCase().includes('dopasowania'))).toBe(true)
  })

  it('returns empty for ready item', () => {
    const towary = [{ id: 'abc', nazwa: 'Test produkt', typ: 'test', jednostka: 'szt' }]
    const item = {
      itemType: 'inventory_item', shouldAffectInventory: true,
      unitPriceNet: 10, matchedProductId: 'abc', matchScore: 1.0,
    }
    const reasons = getLineBlockingReasons(item, towary)
    expect(reasons).toHaveLength(0)
  })
})
