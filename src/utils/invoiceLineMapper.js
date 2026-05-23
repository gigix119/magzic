let _lineId = 0

/**
 * Maps an extracted/actionable position to a normalized invoice line object.
 * Positions without productId become draft lines (shouldAffectInventory=false).
 *
 * @param {object} position - extracted item or form position
 * @param {object} [options]
 * @param {boolean} [options.forceDraft=false] - force draft status regardless of product match
 * @param {string} [options.invoiceLineStatus] - override status ('draft'|'review_required'|'accepted')
 * @returns {object} invoice line
 */
export function mapActionablePositionToInvoiceLine(position, options = {}) {
  const { forceDraft = false, invoiceLineStatus } = options

  const productId = position._towarId || position.matchedProductId || position.towar_id || null
  const hasProduct = !!productId
  const isService = position.itemType === 'service_item' || position.shouldAffectInventory === false
  const isDraft = forceDraft || !hasProduct || isService || position._isDraft === true

  const unitPriceNet = Number(
    position.cena_netto ?? position.cenaNetto ?? position.unitPriceNet ?? 0
  )
  const qty = Number(position.ilosc ?? position.quantity ?? 1)
  const vatRate = Number(position.vat_procent ?? position.vat ?? 23)
  const totalNet = unitPriceNet * qty
  const totalGross = totalNet * (1 + vatRate / 100)

  const resolvedStatus = invoiceLineStatus ?? (isDraft ? 'review_required' : 'accepted')

  return {
    id: `line_${++_lineId}`,
    name: position.nazwa || position.rawName || '',
    rawName: position.rawName || position.nazwa || '',
    productId: hasProduct ? productId : null,
    productName: position.matchedProductNazwa || position.towar_nazwa || null,
    itemType: position.itemType || 'unknown',
    invoiceLineStatus: resolvedStatus,
    shouldAffectInventory: isDraft ? false : (position.shouldAffectInventory ?? false),
    inventoryImpactStatus: isDraft ? 'blocked' : (hasProduct ? 'ready' : 'blocked'),
    quantity: qty,
    unit: position.jednostka || position.unit || 'szt',
    unitPriceNet,
    vatRate,
    totalNet,
    totalGross,
    warehouseId: position.magazyn_id || null,
    source: 'pdf_extraction',
    confidence: position.confidence ?? 0,
    warnings: position.warnings || [],
    matchScore: position.matchScore ?? 0,
  }
}
