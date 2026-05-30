import { describe, it, expect } from 'vitest'
import {
  getAssignmentStatus,
  isReadyToSave,
  preparePositionsForInvoiceSave,
  preparePositionsForInvoiceDraft,
  preparePositionsForInventoryImpact,
  validatePositionForInventoryImpact,
  validatePositionForInvoiceDraft,
  validatePositionBeforeInvoiceSave,
  recalculateInvoiceLineStatus,
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

// ── Empty / garbage position filtering ───────────────────────────────────────

describe('validatePositionForInvoiceDraft — empty position rejection', () => {
  it('rejects position with empty name', () => {
    const { ok, errors } = validatePositionForInvoiceDraft({ nazwa: '', rawName: '' })
    expect(ok).toBe(false)
    expect(errors[0]).toMatch(/brak nazwy/i)
  })

  it('rejects position with null name', () => {
    const { ok } = validatePositionForInvoiceDraft({ nazwa: null, rawName: null })
    expect(ok).toBe(false)
  })

  it('rejects position with single-char name', () => {
    const { ok } = validatePositionForInvoiceDraft({ nazwa: 'B', rawName: 'B' })
    expect(ok).toBe(false)
  })

  it('rejects undefined/null position', () => {
    const { ok } = validatePositionForInvoiceDraft(null)
    expect(ok).toBe(false)
  })

  it('accepts position with valid name even without productId or price', () => {
    const { ok } = validatePositionForInvoiceDraft({ nazwa: 'Farba biała matowa 10 l', rawName: 'Farba biała matowa 10 l' })
    expect(ok).toBe(true)
  })
})

describe('preparePositionsForInvoiceDraft — filters empty positions', () => {
  it('skips empty-name positions and does not add them to draftLines', () => {
    const positions = [
      { nazwa: '', rawName: '', itemType: 'inventory_item', unitPriceNet: 10, ilosc: 1 },
      { nazwa: 'Farba biała', rawName: 'Farba biała', itemType: 'inventory_item', unitPriceNet: 10, ilosc: 1 },
    ]
    const { draftLines, blocked } = preparePositionsForInvoiceDraft(positions)
    expect(draftLines).toHaveLength(1)
    expect(draftLines[0].nazwa).toBe('Farba biała')
    expect(blocked).toHaveLength(1)
  })
})

// ── Validator: position with invoice name but no productId ───────────────────

describe('validatePositionBeforeInvoiceSave — position without productId', () => {
  it('reports missing product, NOT "Towar ma zbyt krótką nazwę"', () => {
    const pos = {
      nazwa: 'Farba biała matowa 10 l',
      rawName: 'Farba biała matowa 10 l',
      ilosc: 2,
      cena_netto: 45.0,
      vat_procent: 23,
      magazyn_id: 'mag-1',
      itemType: 'inventory_item',
      shouldAffectInventory: true,
      _towarId: null,
      towar_id: null,
      matchedProductId: null,
    }
    const { ok, errors } = validatePositionBeforeInvoiceSave(pos, TOWARY)
    expect(ok).toBe(false)
    expect(errors.some(e => e.toLowerCase().includes('dopasowania') || e.toLowerCase().includes('towaru'))).toBe(true)
    expect(errors.some(e => e.toLowerCase().includes('zbyt krótk'))).toBe(false)
  })
})

// ── recalculateInvoiceLineStatus — position without towar_id ─────────────────

describe('recalculateInvoiceLineStatus — no towar_id', () => {
  it('returns review_required with no errors when towar_id is null', () => {
    const line = { towar_id: null, ilosc: 2, cena_netto: 45.0, magazyn_id: 'mag-1' }
    const { invoiceLineStatus, inventoryImpactStatus, errors } = recalculateInvoiceLineStatus(line, { towary: TOWARY })
    expect(invoiceLineStatus).toBe('review_required')
    expect(inventoryImpactStatus).toBe('none')
    expect(errors).toHaveLength(0)
  })

  it('does NOT report "Towar ma zbyt krótką nazwę" for a position without towar_id', () => {
    const line = { towar_id: null, ilosc: 1, cena_netto: 10 }
    const { errors } = recalculateInvoiceLineStatus(line, { towary: TOWARY })
    expect(errors.some(e => e.includes('zbyt krótk'))).toBe(false)
  })
})

// ── Full regression: 30-line ragged invoice ───────────────────────────────────

describe('regression: ragged invoice 30 lines', () => {
  const TOWARY_EXTENDED = [
    ...TOWARY,
    { id: 'prod-3', nazwa: 'Farba biała matowa 10 l', typ: 'farba', jednostka: 'szt' },
    { id: 'prod-4', nazwa: 'Klej montażowy 300 ml', typ: 'klej', jednostka: 'szt' },
  ]

  function makeRaggedInvoiceItems() {
    const items = []
    for (let i = 0; i < 26; i++) {
      items.push({
        nazwa: `Farba biała matowa 10 l ${i}`,
        rawName: `Farba biała matowa 10 l ${i}`,
        itemType: 'inventory_item',
        unitPriceNet: 45.0,
        ilosc: 1,
        jednostka: 'szt',
        matchedProductId: null,
        matchScore: 0,
      })
    }
    // 1 empty line (should be filtered)
    items.push({ nazwa: '', rawName: '', itemType: 'inventory_item', unitPriceNet: 0, ilosc: 0 })
    // 1 service
    items.push({ nazwa: 'Transport', rawName: 'Transport', itemType: 'service_item', shouldAffectInventory: false, unitPriceNet: 200, ilosc: 1 })
    // 1 ready with product
    items.push({ nazwa: 'Tabletki do zmywarki', rawName: 'Tabletki do zmywarki', itemType: 'inventory_item', unitPriceNet: 12.5, ilosc: 5, matchedProductId: 'prod-1', matchScore: 1.0 })
    // 1 skipped
    items.push({ nazwa: 'Suma końcowa', rawName: 'Suma końcowa', itemType: 'inventory_item', unitPriceNet: 0, ilosc: 0, lineType: 'summary_line' })
    return items
  }

  it('draft: empty line is blocked, not added to draftLines', () => {
    const items = makeRaggedInvoiceItems()
    const { draftLines } = preparePositionsForInvoiceDraft(items)
    const emptyInDraft = draftLines.filter(p => !(p.nazwa || p.rawName || '').trim())
    expect(emptyInDraft).toHaveLength(0)
  })

  it('draft: items without productId get invoiceLineStatus review_required', () => {
    const items = makeRaggedInvoiceItems().filter(i => i.itemType !== 'service_item' && (i.nazwa || '').trim().length >= 2 && !i.lineType)
    const { draftLines } = preparePositionsForInvoiceDraft(items)
    const needsReview = draftLines.filter(p => p.invoiceLineStatus === 'review_required')
    expect(needsReview.length).toBeGreaterThan(0)
  })

  it('save: item without productId is blocked (no false product assigned)', () => {
    const raggedItem = {
      nazwa: 'Farba biała matowa 10 l 0',
      rawName: 'Farba biała matowa 10 l 0',
      itemType: 'inventory_item',
      shouldAffectInventory: true,
      unitPriceNet: 45.0,
      ilosc: 1,
      cena_netto: 45.0,
      matchedProductId: null,
      _towarId: null,
      towar_id: null,
      matchScore: 0,
      magazyn_id: 'mag-1',
    }
    const { readyToSave, blocked } = preparePositionsForInvoiceSave([raggedItem], TOWARY_EXTENDED)
    expect(readyToSave).toHaveLength(0)
    expect(blocked).toHaveLength(1)
  })
})
