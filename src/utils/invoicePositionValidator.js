import { isForbiddenAsInvoiceItem } from './invoiceLineGuards.js'

const METADATA_LINE_TYPES = new Set(['summary_line', 'payment_info'])

const TRASH_KEYWORDS = [
  'razem', 'suma', 'do zapłaty', 'łącznie', 'remarks', 'ksef',
  'powered by comarch', 'nr wiersza', 'line number', 'faktura ustrukturyzowana',
]

function _isTrashContent(rawName) {
  if (!rawName) return true
  if (rawName.length > 160) return true
  const lower = rawName.toLowerCase()
  return TRASH_KEYWORDS.some(k => lower.includes(k))
}

/**
 * Returns the assignment status of an extracted item.
 * @returns {'ready'|'needs_product'|'needs_price'|'needs_review'|'service_cost'|'ignored'}
 */
export function getAssignmentStatus(item, towary = []) {
  if (!item) return 'ignored'
  if (item.skipped) return 'ignored'
  if (METADATA_LINE_TYPES.has(item.lineType)) return 'ignored'

  const price = item.unitPriceNet ?? item.cenaNetto ?? 0
  if (price <= 0) return 'needs_price'

  const isService = item.itemType === 'service_item' || item.shouldAffectInventory === false
  if (isService) return 'service_cost'

  // inventory / unknown — needs a matched product
  const matchedId = item.matchedProductId || null
  if (!matchedId) return 'needs_product'

  const product = towary.find(t => t.id === matchedId)
  if (!product) return 'needs_product'

  if (!product.nazwa || product.nazwa.length < 2) return 'needs_review'

  const matchScore = item.matchScore ?? 0
  if (matchScore > 0 && matchScore < 0.85) return 'needs_review'

  return 'ready'
}

/**
 * @param {'ready'|'needs_product'|'needs_price'|'needs_review'|'service_cost'|'ignored'} status
 */
export function isReadyToSave(status) {
  return status === 'ready' || status === 'service_cost'
}

/**
 * Validates a single position (already a form position object) before saving to DB.
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validatePositionBeforeInvoiceSave(position, towary = []) {
  const errors = []
  const warnings = []

  const rawName = position.nazwa || position.rawName || ''
  if (_isTrashContent(rawName)) {
    errors.push(`Nieprawidłowa nazwa pozycji: "${rawName.slice(0, 60)}"`)
  }

  if (METADATA_LINE_TYPES.has(position.lineType)) {
    errors.push('Linia to metadane faktury (podsumowanie/płatność), nie pozycja towaru')
  }

  const price = Number(position.cena_netto ?? position.cenaNetto ?? position.unitPriceNet ?? 0)
  if (price <= 0) {
    errors.push('Cena netto wynosi 0 — uzupełnij cenę przed zapisem')
  }

  const qty = Number(position.ilosc ?? position.quantity ?? 0)
  if (qty <= 0) {
    errors.push('Ilość musi być większa niż 0')
  }

  const isService = position.itemType === 'service_item' || position.shouldAffectInventory === false
  if (!isService) {
    const towarId = position._towarId || position.towar_id || position.matchedProductId || null
    if (!towarId) {
      errors.push('Brak dopasowania do towaru — przypisz towar przed zapisem')
    } else {
      const product = towary.find(t => t.id === towarId)
      if (!product) {
        errors.push(`Towar ID "${towarId}" nie istnieje w bazie`)
      } else if (!product.nazwa || product.nazwa.length < 2) {
        errors.push(`Towar "${product.nazwa}" ma zbyt krótką nazwę — sprawdź dane`)
      }
    }

    const matchScore = Number(position.matchScore ?? 0)
    if (matchScore > 0 && matchScore < 0.85) {
      warnings.push(`Niskie dopasowanie towaru (${Math.round(matchScore * 100)}%) — zweryfikuj ręcznie`)
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

/**
 * Splits positions into readyToSave and blocked lists.
 * @returns {{ readyToSave: object[], blocked: Array<{position: object, errors: string[]}>, warnings: string[] }}
 */
export function preparePositionsForInvoiceSave(positions, towary = []) {
  const readyToSave = []
  const blocked = []
  const warnings = []

  for (const pos of (positions || [])) {
    if (pos.skipped) continue
    if (METADATA_LINE_TYPES.has(pos.lineType)) continue

    const { ok, errors, warnings: posWarnings } = validatePositionBeforeInvoiceSave(pos, towary)
    warnings.push(...posWarnings)

    if (ok) {
      readyToSave.push(pos)
    } else {
      blocked.push({ position: pos, errors })
    }
  }

  return { readyToSave, blocked, warnings }
}

// ── Draft / review line validation (invoice line ≠ stock movement) ────────────

/**
 * Minimal validation for adding a position as a draft invoice line.
 * Does NOT require productId, warehouseId, or matchScore.
 * Only requires a non-empty, non-metadata name.
 */
export function validatePositionForInvoiceDraft(position) {
  const errors = []
  const warnings = []

  if (!position) return { ok: false, errors: ['Brak pozycji'], warnings }
  if (position.skipped) return { ok: false, errors: ['Pozycja pominięta'], warnings }
  if (METADATA_LINE_TYPES.has(position.lineType)) {
    return { ok: false, errors: ['Linia to metadane faktury, nie pozycja'], warnings }
  }

  const rawName = (position.nazwa || position.rawName || '').trim()
  if (!rawName || rawName.length < 2) {
    errors.push('Brak nazwy pozycji (minimum 2 znaki)')
    return { ok: false, errors, warnings }
  }

  if (isForbiddenAsInvoiceItem(rawName, {})) {
    errors.push(`Nazwa jest metadaną lub śmieciem: "${rawName.slice(0, 60)}"`)
    return { ok: false, errors, warnings }
  }

  const price = Number(position.cena_netto ?? position.cenaNetto ?? position.unitPriceNet ?? 0)
  if (price <= 0) {
    warnings.push('Cena = 0 — pozycja robocza bez wartości, nie wpłynie na magazyn')
  }

  const qty = Number(position.ilosc ?? position.quantity ?? 0)
  if (qty <= 0) {
    warnings.push('Ilość = 0 — uzupełnij przed zatwierdzeniem')
  }

  return { ok: errors.length === 0, errors, warnings }
}

/**
 * Hard validation for inventory impact (stock movement).
 * Requires productId, warehouseId, price > 0, qty > 0.
 */
export function validatePositionForInventoryImpact(position, towary = []) {
  const errors = []
  const warnings = []

  const price = Number(position.cena_netto ?? position.cenaNetto ?? position.unitPriceNet ?? 0)
  if (price <= 0) errors.push('Cena netto musi być > 0 aby wpłynąć na magazyn')

  const qty = Number(position.ilosc ?? position.quantity ?? 0)
  if (qty <= 0) errors.push('Ilość musi być > 0')

  const towarId = position._towarId || position.towar_id || position.matchedProductId || null
  if (!towarId) {
    errors.push('Brak powiązania z towarem — nie można zaktualizować magazynu')
  } else {
    const product = towary.find(t => t.id === towarId)
    if (!product) {
      errors.push(`Towar ID "${towarId}" nie istnieje w bazie`)
    } else if (!product.nazwa || product.nazwa.length < 2) {
      errors.push(`Towar "${product.nazwa}" ma zbyt krótką nazwę`)
    }
  }

  const warehouseId = position.magazyn_id || null
  if (!warehouseId) errors.push('Brak magazynu — wymagany do aktualizacji stanów')

  const matchScore = Number(position.matchScore ?? 0)
  if (matchScore > 0 && matchScore < 0.85) {
    warnings.push(`Niskie dopasowanie towaru (${Math.round(matchScore * 100)}%) — zweryfikuj ręcznie`)
  }

  return { ok: errors.length === 0, errors, warnings }
}

/**
 * Splits positions into draftLines (can be added to invoice) and blocked (garbage/metadata).
 * Draft positions have shouldAffectInventory=false and invoiceLineStatus='review_required'.
 * @returns {{ draftLines: object[], blocked: Array<{position: object, errors: string[]}>, warnings: string[] }}
 */
export function preparePositionsForInvoiceDraft(positions) {
  const draftLines = []
  const blocked = []
  const warnings = []

  for (const pos of (positions || [])) {
    if (pos.skipped) continue
    if (METADATA_LINE_TYPES.has(pos.lineType)) continue

    const { ok, errors, warnings: posWarnings } = validatePositionForInvoiceDraft(pos)
    if (posWarnings.length > 0) {
      warnings.push(...posWarnings.map(w => `${(pos.nazwa || pos.rawName || '').slice(0, 30)}: ${w}`))
    }

    if (ok) {
      draftLines.push({
        ...pos,
        _isDraft: true,
        shouldAffectInventory: false,
        invoiceLineStatus: 'review_required',
      })
    } else {
      blocked.push({ position: pos, errors })
    }
  }

  return { draftLines, blocked, warnings }
}

/**
 * Recalculates the display/inventory status of a single saved invoice line (DB row).
 * Derives status from existing DB fields — no front-end-only flags needed.
 *
 * @param {object} line - pozycje_faktury row (may include joined towary/magazyny)
 * @param {object} [context]
 * @param {object[]} [context.towary] - full towary list for validation
 * @param {string|null} [context.fakturaDefaultMagazynId] - faktura.magazyn_id fallback
 * @returns {{ invoiceLineStatus: string, inventoryImpactStatus: string, shouldAffectInventory: boolean, errors: string[], warnings: string[] }}
 */
export function recalculateInvoiceLineStatus(line, context = {}) {
  const { towary = [], fakturaDefaultMagazynId = null } = context
  const price = Number(line.cena_netto ?? line.unitPriceNet ?? 0)
  const qty = Number(line.ilosc ?? line.quantity ?? 0)
  const towarId = line.towar_id || line._towarId || line.matchedProductId || null
  const magazynId = line.magazyn_id || fakturaDefaultMagazynId || null
  const isService = line.itemType === 'service_item' || line.itemType === 'cost_item' || line.shouldAffectInventory === false

  if (isService) {
    return { invoiceLineStatus: 'accepted', inventoryImpactStatus: 'none', shouldAffectInventory: false, errors: [], warnings: [] }
  }

  if (!towarId) {
    return {
      invoiceLineStatus: 'review_required',
      inventoryImpactStatus: 'none',
      shouldAffectInventory: false,
      errors: [],
      warnings: ['Brak przypisanego towaru — pozycja robocza, nie wpłynie na magazyn'],
    }
  }

  const errors = []
  if (price <= 0) errors.push('Cena netto = 0')
  if (qty <= 0) errors.push('Ilość = 0')
  if (!magazynId) errors.push('Brak magazynu docelowego')
  const product = towary.find(t => t.id === towarId)
  if (!product) errors.push('Towar nie istnieje w bazie')
  else if (!product.nazwa || product.nazwa.length < 2) errors.push('Towar ma zbyt krótką nazwę')

  if (errors.length > 0) {
    return { invoiceLineStatus: 'review_required', inventoryImpactStatus: 'blocked', shouldAffectInventory: true, errors, warnings: [] }
  }

  return { invoiceLineStatus: 'accepted', inventoryImpactStatus: 'ready', shouldAffectInventory: true, errors: [], warnings: [] }
}

/**
 * Filters positions that are ready for inventory impact (stock movement).
 * @returns {{ readyForStock: object[], blocked: Array<{position: object, errors: string[]}>, warnings: string[] }}
 */
export function preparePositionsForInventoryImpact(positions, towary = []) {
  const readyForStock = []
  const blocked = []
  const warnings = []

  for (const pos of (positions || [])) {
    if (pos.skipped) continue
    if (pos.shouldAffectInventory === false) continue
    if (pos._isDraft) continue

    const { ok, errors, warnings: posWarnings } = validatePositionForInventoryImpact(pos, towary)
    warnings.push(...posWarnings)

    if (ok) {
      readyForStock.push(pos)
    } else {
      blocked.push({ position: pos, errors })
    }
  }

  return { readyForStock, blocked, warnings }
}
