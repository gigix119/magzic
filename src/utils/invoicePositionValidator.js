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
