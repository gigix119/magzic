import { describe, it, expect } from 'vitest'
import {
  getAssignmentStatus,
  isReadyToSave,
  preparePositionsForInvoiceSave,
  preparePositionsForInvoiceDraft,
  preparePositionsForInventoryImpact,
  validatePositionForInventoryImpact,
} from './invoicePositionValidator'

const TOWARY = [
  { id: 'prod-1', nazwa: 'Tabletki do zmywarki', typ: 'towar', jednostka: 'szt' },
  { id: 'prod-2', nazwa: 'Domestos 5L', typ: 'towar', jednostka: 'l' },
]

function makeInventoryItem(overrides = {}) {
  return {
    itemType: 'inventory_item',
    shouldAffectInventory: true,
    rawName: 'Tabletki do zmywarki',
    quantity: 5,
    unitPriceNet: 12.5,
    matchedProductId: 'prod-1',
    matchScore: 1.0,
    skipped: false,
    ...overrides,
  }
}

// ── getAssignmentStatus ───────────────────────────────────────────────────────

describe('getAssignmentStatus', () => {
  it('returns ready for a fully matched inventory item', () => {
    expect(getAssignmentStatus(makeInventoryItem(), TOWARY)).toBe('ready')
  })

  it('returns ready for manual_created_from_invoice (matchScore null)', () => {
    const item = makeInventoryItem({ matchScore: null, matchingSource: 'manual_created_from_invoice' })
    expect(getAssignmentStatus(item, TOWARY)).toBe('ready')
  })

  it('returns ready for manual_selected (matchScore 1.0)', () => {
    const item = makeInventoryItem({ matchScore: 1.0, matchingSource: 'manual_selected' })
    expect(getAssignmentStatus(item, TOWARY)).toBe('ready')
  })

  it('returns needs_review for weak match (matchScore 0.15)', () => {
    const item = makeInventoryItem({ matchScore: 0.15 })
    expect(getAssignmentStatus(item, TOWARY)).toBe('needs_review')
  })

  it('returns needs_review for match below 0.85 threshold', () => {
    const item = makeInventoryItem({ matchScore: 0.84 })
    expect(getAssignmentStatus(item, TOWARY)).toBe('needs_review')
  })

  it('returns ready for matchScore exactly 0.85', () => {
    const item = makeInventoryItem({ matchScore: 0.85 })
    expect(getAssignmentStatus(item, TOWARY)).toBe('ready')
  })

  it('returns needs_product when no matchedProductId', () => {
    const item = makeInventoryItem({ matchedProductId: null })
    expect(getAssignmentStatus(item, TOWARY)).toBe('needs_product')
  })

  it('returns needs_product when product not in towary list', () => {
    const item = makeInventoryItem({ matchedProductId: 'unknown-id' })
    expect(getAssignmentStatus(item, TOWARY)).toBe('needs_product')
  })

  it('returns needs_price when unitPriceNet is 0', () => {
    const item = makeInventoryItem({ unitPriceNet: 0 })
    expect(getAssignmentStatus(item, TOWARY)).toBe('needs_price')
  })

  it('returns needs_price when unitPriceNet is negative', () => {
    const item = makeInventoryItem({ unitPriceNet: -1 })
    expect(getAssignmentStatus(item, TOWARY)).toBe('needs_price')
  })

  it('returns service_cost for service_item', () => {
    const item = makeInventoryItem({ itemType: 'service_item', shouldAffectInventory: false, matchedProductId: null })
    expect(getAssignmentStatus(item, TOWARY)).toBe('service_cost')
  })

  it('returns service_cost when shouldAffectInventory is false', () => {
    const item = makeInventoryItem({ shouldAffectInventory: false, matchedProductId: null })
    expect(getAssignmentStatus(item, TOWARY)).toBe('service_cost')
  })

  it('returns ignored for skipped item', () => {
    const item = makeInventoryItem({ skipped: true })
    expect(getAssignmentStatus(item, TOWARY)).toBe('ignored')
  })

  it('returns ignored for null item', () => {
    expect(getAssignmentStatus(null, TOWARY)).toBe('ignored')
  })
})

// ── isReadyToSave ─────────────────────────────────────────────────────────────

describe('isReadyToSave', () => {
  it('returns true for ready', () => {
    expect(isReadyToSave('ready')).toBe(true)
  })

  it('returns true for service_cost (service items can be added to invoice)', () => {
    expect(isReadyToSave('service_cost')).toBe(true)
  })

  it('returns false for needs_product', () => {
    expect(isReadyToSave('needs_product')).toBe(false)
  })

  it('returns false for needs_price', () => {
    expect(isReadyToSave('needs_price')).toBe(false)
  })

  it('returns false for needs_review', () => {
    expect(isReadyToSave('needs_review')).toBe(false)
  })

  it('returns false for ignored', () => {
    expect(isReadyToSave('ignored')).toBe(false)
  })
})

// ── preparePositionsForInventoryImpact ────────────────────────────────────────

describe('preparePositionsForInventoryImpact', () => {
  it('excludes service items (shouldAffectInventory=false)', () => {
    const positions = [
      makeInventoryItem({ towar_id: 'prod-1', magazyn_id: 'mag-1' }),
      makeInventoryItem({ shouldAffectInventory: false, itemType: 'service_item', towar_id: null, magazyn_id: null }),
    ]
    const { readyForStock } = preparePositionsForInventoryImpact(positions, TOWARY)
    expect(readyForStock).toHaveLength(1)
  })

  it('excludes draft positions (_isDraft=true)', () => {
    const positions = [
      makeInventoryItem({ towar_id: 'prod-1', magazyn_id: 'mag-1' }),
      makeInventoryItem({ _isDraft: true, towar_id: 'prod-1', magazyn_id: 'mag-1' }),
    ]
    const { readyForStock } = preparePositionsForInventoryImpact(positions, TOWARY)
    expect(readyForStock).toHaveLength(1)
  })

  it('blocks position missing warehouseId', () => {
    const pos = makeInventoryItem({ towar_id: 'prod-1', magazyn_id: null })
    const { readyForStock, blocked } = preparePositionsForInventoryImpact([pos], TOWARY)
    expect(readyForStock).toHaveLength(0)
    expect(blocked).toHaveLength(1)
    expect(blocked[0].errors.some(e => e.toLowerCase().includes('magazyn'))).toBe(true)
  })

  it('blocks position missing productId', () => {
    const pos = makeInventoryItem({ towar_id: null, matchedProductId: null, magazyn_id: 'mag-1' })
    const { readyForStock, blocked } = preparePositionsForInventoryImpact([pos], TOWARY)
    expect(readyForStock).toHaveLength(0)
    expect(blocked).toHaveLength(1)
  })

  it('blocks skipped positions', () => {
    const pos = makeInventoryItem({ skipped: true, towar_id: 'prod-1', magazyn_id: 'mag-1' })
    const { readyForStock } = preparePositionsForInventoryImpact([pos], TOWARY)
    expect(readyForStock).toHaveLength(0)
  })
})

// ── validatePositionForInventoryImpact ────────────────────────────────────────

describe('validatePositionForInventoryImpact', () => {
  it('passes for a valid inventory position', () => {
    const pos = makeInventoryItem({ towar_id: 'prod-1', matchedProductId: 'prod-1', magazyn_id: 'mag-1', ilosc: 3, cena_netto: 10 })
    const { ok } = validatePositionForInventoryImpact(pos, TOWARY)
    expect(ok).toBe(true)
  })

  it('fails when price is 0', () => {
    const pos = makeInventoryItem({ towar_id: 'prod-1', magazyn_id: 'mag-1', cena_netto: 0, unitPriceNet: 0 })
    const { ok, errors } = validatePositionForInventoryImpact(pos, TOWARY)
    expect(ok).toBe(false)
    expect(errors.some(e => e.toLowerCase().includes('cena'))).toBe(true)
  })

  it('fails when quantity is 0', () => {
    const pos = makeInventoryItem({ towar_id: 'prod-1', magazyn_id: 'mag-1', ilosc: 0, quantity: 0 })
    const { ok, errors } = validatePositionForInventoryImpact(pos, TOWARY)
    expect(ok).toBe(false)
    expect(errors.some(e => e.toLowerCase().includes('iloś') || e.toLowerCase().includes('ilość'))).toBe(true)
  })

  it('warns for weak match below 0.85', () => {
    const pos = makeInventoryItem({ towar_id: 'prod-1', matchedProductId: 'prod-1', magazyn_id: 'mag-1', matchScore: 0.5, ilosc: 1, cena_netto: 10 })
    const { ok, warnings } = validatePositionForInventoryImpact(pos, TOWARY)
    expect(ok).toBe(true)
    expect(warnings.some(w => w.includes('50%'))).toBe(true)
  })
})

// ── preparePositionsForInvoiceSave ────────────────────────────────────────────

describe('preparePositionsForInvoiceSave', () => {
  it('skips skipped positions', () => {
    const pos = makeInventoryItem({ skipped: true, towar_id: 'prod-1', cena_netto: 10, ilosc: 1 })
    const { readyToSave } = preparePositionsForInvoiceSave([pos], TOWARY)
    expect(readyToSave).toHaveLength(0)
  })

  it('includes manual_created_from_invoice items with valid product', () => {
    const pos = {
      ...makeInventoryItem({ matchScore: null, matchingSource: 'manual_created_from_invoice' }),
      towar_id: 'prod-1',
      cena_netto: 15,
      ilosc: 2,
    }
    const { readyToSave } = preparePositionsForInvoiceSave([pos], TOWARY)
    expect(readyToSave).toHaveLength(1)
  })

  it('blocks position with zero price', () => {
    const pos = makeInventoryItem({ towar_id: 'prod-1', cena_netto: 0, unitPriceNet: 0 })
    const { readyToSave, blocked } = preparePositionsForInvoiceSave([pos], TOWARY)
    expect(readyToSave).toHaveLength(0)
    expect(blocked).toHaveLength(1)
  })
})

// ── preparePositionsForInvoiceDraft ───────────────────────────────────────────

describe('preparePositionsForInvoiceDraft', () => {
  it('marks draft lines with shouldAffectInventory=false', () => {
    const pos = { rawName: 'Usługa sprzątania', itemType: 'service_item', shouldAffectInventory: false, unitPriceNet: 100, quantity: 1 }
    const { draftLines } = preparePositionsForInvoiceDraft([pos])
    expect(draftLines).toHaveLength(1)
    expect(draftLines[0].shouldAffectInventory).toBe(false)
    expect(draftLines[0].invoiceLineStatus).toBe('review_required')
  })

  it('blocks positions with empty name', () => {
    const pos = { rawName: '', itemType: 'inventory_item', unitPriceNet: 50, quantity: 1 }
    const { draftLines, blocked } = preparePositionsForInvoiceDraft([pos])
    expect(draftLines).toHaveLength(0)
    expect(blocked).toHaveLength(1)
  })

  it('excludes skipped positions', () => {
    const pos = { rawName: 'Coś', skipped: true, itemType: 'inventory_item', unitPriceNet: 50, quantity: 1 }
    const { draftLines } = preparePositionsForInvoiceDraft([pos])
    expect(draftLines).toHaveLength(0)
  })
})

// ── Counter logic ─────────────────────────────────────────────────────────────

describe('counter logic (getAssignmentStatus + isReadyToSave)', () => {
  it('service_cost does not count as inventory-ready', () => {
    const items = [
      makeInventoryItem({ itemType: 'service_item', shouldAffectInventory: false, matchedProductId: null }),
    ]
    const statuses = items.map(i => getAssignmentStatus(i, TOWARY))
    const inventoryReadyCount = statuses.filter(s => s === 'ready').length
    const serviceCostCount = statuses.filter(s => s === 'service_cost').length
    expect(inventoryReadyCount).toBe(0)
    expect(serviceCostCount).toBe(1)
  })

  it('only ready items count as inventory-ready', () => {
    const items = [
      makeInventoryItem(),
      makeInventoryItem({ itemType: 'service_item', shouldAffectInventory: false, matchedProductId: null }),
      makeInventoryItem({ matchedProductId: null }),
      makeInventoryItem({ skipped: true }),
    ]
    const statuses = items.map(i => getAssignmentStatus(i, TOWARY))
    const inventoryReadyCount = statuses.filter(s => s === 'ready').length
    expect(inventoryReadyCount).toBe(1)
  })

  it('button-addable count includes both ready and service_cost', () => {
    const items = [
      makeInventoryItem(),
      makeInventoryItem({ itemType: 'service_item', shouldAffectInventory: false, matchedProductId: null }),
    ]
    const statuses = items.map(i => getAssignmentStatus(i, TOWARY))
    const addableCount = statuses.filter(s => isReadyToSave(s)).length
    expect(addableCount).toBe(2)
  })

  it('needs_review items do not count as ready', () => {
    const items = [makeInventoryItem({ matchScore: 0.5 })]
    const statuses = items.map(i => getAssignmentStatus(i, TOWARY))
    const inventoryReadyCount = statuses.filter(s => s === 'ready').length
    expect(inventoryReadyCount).toBe(0)
  })

  it('newly created product item (matchScore null) counts as inventory-ready', () => {
    const items = [makeInventoryItem({ matchScore: null, matchingSource: 'manual_created_from_invoice' })]
    const statuses = items.map(i => getAssignmentStatus(i, TOWARY))
    const inventoryReadyCount = statuses.filter(s => s === 'ready').length
    expect(inventoryReadyCount).toBe(1)
  })
})
