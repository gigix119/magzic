import { describe, it, expect } from 'vitest'
import {
  getExtractedItemProductId,
  hasExtractedItemProduct,
  isExplicitProductMatch,
  getEffectiveMatchScore,
  normalizeExtractedItemProductFields,
  isExtractedItemReadyForInventorySave,
} from './invoiceExtractedItemAdapter'

const TOWARY = [
  { id: 'prod-1', nazwa: 'Tabletki do zmywarki', typ: 'towar', jednostka: 'szt' },
  { id: 'prod-2', nazwa: 'Domestos 5L', typ: 'towar', jednostka: 'l' },
]

// ── getExtractedItemProductId ─────────────────────────────────────────────────

describe('getExtractedItemProductId', () => {
  it('reads matchedProductId', () => {
    expect(getExtractedItemProductId({ matchedProductId: 'prod-1' })).toBe('prod-1')
  })

  it('reads towarId as fallback', () => {
    expect(getExtractedItemProductId({ towarId: 'prod-2' })).toBe('prod-2')
  })

  it('reads towar_id as fallback', () => {
    expect(getExtractedItemProductId({ towar_id: 'prod-2' })).toBe('prod-2')
  })

  it('reads productId as fallback', () => {
    expect(getExtractedItemProductId({ productId: 'prod-3' })).toBe('prod-3')
  })

  it('reads selectedProductId as final fallback', () => {
    expect(getExtractedItemProductId({ selectedProductId: 'prod-4' })).toBe('prod-4')
  })

  it('returns null when no product field is set', () => {
    expect(getExtractedItemProductId({})).toBeNull()
  })

  it('returns null for null input', () => {
    expect(getExtractedItemProductId(null)).toBeNull()
  })

  it('matchedProductId takes precedence over towar_id', () => {
    expect(getExtractedItemProductId({ matchedProductId: 'first', towar_id: 'second' })).toBe('first')
  })
})

// ── hasExtractedItemProduct ───────────────────────────────────────────────────

describe('hasExtractedItemProduct', () => {
  it('returns true when matchedProductId is set', () => {
    expect(hasExtractedItemProduct({ matchedProductId: 'prod-1' })).toBe(true)
  })

  it('returns false when no product fields', () => {
    expect(hasExtractedItemProduct({})).toBe(false)
  })
})

// ── isExplicitProductMatch ────────────────────────────────────────────────────

describe('isExplicitProductMatch', () => {
  it('returns true for manual_selected', () => {
    expect(isExplicitProductMatch({ matchingSource: 'manual_selected' })).toBe(true)
  })

  it('returns true for alias_learned', () => {
    expect(isExplicitProductMatch({ matchingSource: 'alias_learned' })).toBe(true)
  })

  it('returns true for manual_created_from_invoice', () => {
    expect(isExplicitProductMatch({ matchingSource: 'manual_created_from_invoice' })).toBe(true)
  })

  it('returns false for auto-matched item (no matchingSource)', () => {
    expect(isExplicitProductMatch({ matchingSource: undefined })).toBe(false)
  })

  it('returns false for null item', () => {
    expect(isExplicitProductMatch(null)).toBe(false)
  })
})

// ── getEffectiveMatchScore ────────────────────────────────────────────────────

describe('getEffectiveMatchScore', () => {
  it('returns 1.0 for explicit selections regardless of stored matchScore', () => {
    expect(getEffectiveMatchScore({ matchingSource: 'manual_selected', matchScore: 0.2 })).toBe(1.0)
    expect(getEffectiveMatchScore({ matchingSource: 'alias_learned', matchScore: null })).toBe(1.0)
    expect(getEffectiveMatchScore({ matchingSource: 'manual_created_from_invoice', matchScore: 0 })).toBe(1.0)
  })

  it('returns stored matchScore for auto-matched items', () => {
    expect(getEffectiveMatchScore({ matchScore: 0.92 })).toBe(0.92)
  })

  it('returns 0 when matchScore not set', () => {
    expect(getEffectiveMatchScore({})).toBe(0)
  })
})

// ── normalizeExtractedItemProductFields ───────────────────────────────────────

describe('normalizeExtractedItemProductFields', () => {
  it('sets all canonical fields when product is provided', () => {
    const item = { rawName: 'Syfon 32mm', matchScore: 0.5 }
    const result = normalizeExtractedItemProductFields(item, { id: 'prod-1', nazwa: 'Syfon' })
    expect(result.matchedProductId).toBe('prod-1')
    expect(result.matchedProductNazwa).toBe('Syfon')
    expect(result.matchScore).toBe(1.0)
    expect(result.matchingSource).toBe('manual_selected')
  })

  it('accepts custom matchingSource', () => {
    const item = { rawName: 'Test' }
    const result = normalizeExtractedItemProductFields(item, { id: 'p', nazwa: 'P' }, 'alias_learned')
    expect(result.matchingSource).toBe('alias_learned')
  })

  it('clears product fields when product is null', () => {
    const item = { rawName: 'X', matchedProductId: 'old-id', matchScore: 1.0 }
    const result = normalizeExtractedItemProductFields(item, null)
    expect(result.matchedProductId).toBeNull()
    expect(result.matchScore).toBe(0)
    expect(result.matchingSource).toBeNull()
  })
})

// ── isExtractedItemReadyForInventorySave ──────────────────────────────────────

describe('isExtractedItemReadyForInventorySave', () => {
  // Case 1: matchedProductId present → ready
  it('returns true for item with matchedProductId and high score', () => {
    const item = { matchedProductId: 'prod-1', matchScore: 1.0, unitPriceNet: 10, itemType: 'inventory_item', shouldAffectInventory: true }
    expect(isExtractedItemReadyForInventorySave(item, TOWARY)).toBe(true)
  })

  // Case 2: towarId or towar_id → ready
  it('returns true for item with towarId field', () => {
    const item = { towarId: 'prod-1', matchScore: 1.0, unitPriceNet: 10, itemType: 'inventory_item', shouldAffectInventory: true }
    expect(isExtractedItemReadyForInventorySave(item, TOWARY)).toBe(true)
  })

  it('returns true for item with towar_id field', () => {
    const item = { towar_id: 'prod-1', matchScore: 1.0, unitPriceNet: 10, itemType: 'inventory_item', shouldAffectInventory: true }
    expect(isExtractedItemReadyForInventorySave(item, TOWARY)).toBe(true)
  })

  // Case 3: UI-ready counter and save-ready validation agree for explicit selections
  it('returns true for manual_selected item even when stored matchScore was low', () => {
    const item = {
      matchedProductId: 'prod-1',
      matchScore: 0.3,
      matchingSource: 'manual_selected',
      unitPriceNet: 15,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    expect(isExtractedItemReadyForInventorySave(item, TOWARY)).toBe(true)
  })

  // Case 4: manual_created_from_invoice with matchScore null saves correctly
  it('returns true for manual_created_from_invoice item (matchScore null)', () => {
    const item = {
      matchedProductId: 'prod-1',
      matchScore: null,
      matchingSource: 'manual_created_from_invoice',
      unitPriceNet: 20,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    expect(isExtractedItemReadyForInventorySave(item, TOWARY)).toBe(true)
  })

  // Case 5: alias_learned item saves correctly
  it('returns true for alias_learned item', () => {
    const item = {
      matchedProductId: 'prod-2',
      matchScore: 1.0,
      matchingSource: 'alias_learned',
      unitPriceNet: 5,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    expect(isExtractedItemReadyForInventorySave(item, TOWARY)).toBe(true)
  })

  // Case 6: confidence fields do not remove product id
  it('returns true even when item has low confidence level (but product is set)', () => {
    const item = {
      matchedProductId: 'prod-1',
      matchScore: 1.0,
      matchingSource: 'manual_selected',
      confidence: 0.4,
      confidenceLevel: 'low',
      autoApproved: false,
      unitPriceNet: 10,
      itemType: 'inventory_item',
      shouldAffectInventory: true,
    }
    expect(isExtractedItemReadyForInventorySave(item, TOWARY)).toBe(true)
  })

  // Case 7: service item saves without product
  it('returns true for service item without product', () => {
    const item = { itemType: 'service_item', shouldAffectInventory: false, unitPriceNet: 100 }
    expect(isExtractedItemReadyForInventorySave(item, TOWARY)).toBe(true)
  })

  // Case 8: item without product and not service → blocked
  it('returns false for inventory item without product', () => {
    const item = { matchedProductId: null, matchScore: 0, unitPriceNet: 10, itemType: 'inventory_item', shouldAffectInventory: true }
    expect(isExtractedItemReadyForInventorySave(item, TOWARY)).toBe(false)
  })

  // Case 9: skipped item → blocked
  it('returns false for skipped item', () => {
    const item = { matchedProductId: 'prod-1', matchScore: 1.0, unitPriceNet: 10, skipped: true }
    expect(isExtractedItemReadyForInventorySave(item, TOWARY)).toBe(false)
  })

  // Case 10: item with price 0 → blocked
  it('returns false when price is 0', () => {
    const item = { matchedProductId: 'prod-1', matchScore: 1.0, unitPriceNet: 0, itemType: 'inventory_item' }
    expect(isExtractedItemReadyForInventorySave(item, TOWARY)).toBe(false)
  })
})
