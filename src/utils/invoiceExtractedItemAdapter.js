/**
 * Canonical helpers for resolving product identity from extracted invoice items.
 *
 * These helpers ensure the UI counter, save validation, and alias learning all
 * use the same field resolution logic regardless of which path set the product.
 */

const EXPLICIT_MATCH_SOURCES = new Set([
  'manual_selected',
  'alias_learned',
  'manual_created_from_invoice',
])

/**
 * Resolves the product UUID from an extracted item, checking all known field names.
 * Returns null when no product is attached.
 *
 * @param {object} item
 * @returns {string|null}
 */
export function getExtractedItemProductId(item) {
  if (!item) return null
  return (
    item.matchedProductId ||
    item.towarId ||
    item.towar_id ||
    item.productId ||
    item.product_id ||
    item.selectedProductId ||
    null
  )
}

/**
 * Returns true when the item has a resolved product ID.
 *
 * @param {object} item
 * @returns {boolean}
 */
export function hasExtractedItemProduct(item) {
  return !!getExtractedItemProductId(item)
}

/**
 * Returns true when the product was set by an explicit user action
 * (manual dropdown selection, alias lookup, or new-product creation).
 *
 * @param {object} item
 * @returns {boolean}
 */
export function isExplicitProductMatch(item) {
  if (!item) return false
  return EXPLICIT_MATCH_SOURCES.has(item.matchingSource)
}

/**
 * Returns the effective match score for threshold checks.
 * Explicit user selections always score 1.0.
 *
 * @param {object} item
 * @returns {number}
 */
export function getEffectiveMatchScore(item) {
  if (!item) return 0
  if (isExplicitProductMatch(item)) return 1.0
  return item.matchScore ?? 0
}

/**
 * Merges a selected product into an extracted item, setting all canonical fields
 * so both the UI counter and the save workflow agree on the product.
 *
 * @param {object} item - original extracted item
 * @param {{ id: string, nazwa: string }|null} product - selected product, or null to clear
 * @param {string} [matchingSource]
 * @returns {object} updated item
 */
export function normalizeExtractedItemProductFields(item, product, matchingSource = 'manual_selected') {
  if (!product) {
    return {
      ...item,
      matchedProductId: null,
      matchedProductNazwa: null,
      matchScore: 0,
      matchingSource: null,
    }
  }
  return {
    ...item,
    matchedProductId: product.id,
    matchedProductNazwa: product.nazwa,
    matchScore: 1.0,
    matchingSource,
  }
}

/**
 * Returns true when the item is ready to be saved as an inventory position.
 *
 * Rules:
 * - must not be skipped
 * - service items are always ready (no product required)
 * - inventory items need a resolved product ID and a positive price
 * - explicit user selections are trusted regardless of original match score
 *
 * @param {object} item
 * @param {object[]} [towary] - full product list for existence check
 * @returns {boolean}
 */
export function isExtractedItemReadyForInventorySave(item, towary = []) {
  if (!item || item.skipped) return false

  const price = item.unitPriceNet ?? item.cenaNetto ?? item.cena_netto ?? 0
  if (!(price > 0)) return false

  const isService = item.itemType === 'service_item' || item.shouldAffectInventory === false
  if (isService) return true

  const productId = getExtractedItemProductId(item)
  if (!productId) return false

  if (towary.length > 0) {
    const product = towary.find(t => t.id === productId)
    if (!product || !product.nazwa || product.nazwa.length < 2) return false
  }

  const score = getEffectiveMatchScore(item)
  return score >= 0.85
}
