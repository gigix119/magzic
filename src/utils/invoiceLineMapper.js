let _lineId = 0

/**
 * Maps a raw parsed position (from PDF extractor or manual form) to a normalized
 * form-position object ready for display and DB insertion.
 *
 * Key rules:
 * - Only carries matchedProductId when matchScore >= 0.85 (prevents product "a" assignments)
 * - Falls back to 'szt' unit, never 'litr' unless explicitly set in source data
 * - vat_procent comes from source, defaults to 23
 *
 * @param {object} poz - raw parsed position
 * @param {string|null} defaultMagazynId - warehouse to fall back to when not a service
 * @returns {object} normalized form position
 */
export function mapParsedPozycjaToFormPozycja(poz, defaultMagazynId = null) {
  const nazwa = poz.rawName || poz.nazwa || poz.name || poz.description || ''
  const jednostka = poz.jednostka || poz.unit || poz.jm || 'szt'
  const ilosc = Number(poz.ilosc ?? poz.quantity ?? poz.qty ?? 1)
  const cenaNetto = Number(
    poz.cenaNetto ?? poz.cena_netto ?? poz.unitPriceNet ?? poz.unitPrice ?? poz.netPrice ?? poz.price ?? 0
  )
  const vatProcent = Number(poz.vat ?? poz.vatRate ?? poz.vatProcent ?? poz.vat_procent ?? 23)
  const itemType = poz.itemType || poz.item_type || 'inventory_item'
  const isService = itemType === 'service_item' || itemType === 'cost_item' || poz.shouldAffectInventory === false
  const matchScore = poz.matchScore ?? poz.confidence ?? 0
  // Only trust the match if it meets the auto-assign threshold
  const towarId = (poz.matchedProductId && matchScore >= 0.85) ? poz.matchedProductId : null

  return {
    nazwa,
    rawName: nazwa,
    towar_id: towarId,
    _towarId: towarId,
    ilosc,
    jednostka,
    cena_netto: cenaNetto,
    vat_procent: vatProcent,
    magazyn_id: isService ? null : (poz.magazynId || poz.magazyn_id || defaultMagazynId || null),
    itemType: isService ? 'service_item' : 'inventory_item',
    shouldAffectInventory: !isService,
    indeks: poz.indeks || poz.sku || poz.index || poz.kod || '',
    source: 'pdf_extraction',
    matchScore,
  }
}

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
