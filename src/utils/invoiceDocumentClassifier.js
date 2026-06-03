import {
  TELECOM_SIGNALS, UTILITY_SIGNALS, INVENTORY_SIGNALS,
  SERVICE_ITEM_KEYWORDS, FORBIDDEN_AS_ITEM,
} from './invoiceConstants.js'

export function classifyDocument(text, tableCandidates) {
  const lower = text.toLowerCase()

  const telecomScore = TELECOM_SIGNALS.filter(s => lower.includes(s)).length
  if (telecomScore >= 2) return 'telecom_invoice'

  const utilityScore = UTILITY_SIGNALS.filter(s => lower.includes(s)).length
  if (utilityScore >= 2) return 'utility_invoice'

  const inventoryScore = INVENTORY_SIGNALS.filter(s => lower.includes(s)).length

  // JEDNOSTKA is optional — invoices without a unit column still qualify
  const hasInventoryTable = (tableCandidates || []).some(c =>
    c.columnMap?.ILOSC &&
    (c.columnMap?.JEDNOSTKA || c.columnMap?.CENA_NETTO || c.columnMap?.WARTOSC_NETTO ||
     c.columnMap?.CENA_BRUTTO || c.columnMap?.WARTOSC_BRUTTO) &&
    c.rowCount >= 1
  )

  if (inventoryScore >= 2 || hasInventoryTable) return 'inventory_purchase_invoice'
  if (telecomScore >= 1 || utilityScore >= 1) return 'service_cost_invoice'

  return 'unknown'
}

const SERVICE_DOC_TYPES = new Set(['telecom_invoice', 'utility_invoice', 'service_cost_invoice'])

export function classifyItem(item, documentType) {
  const text = (item.rawName || item.nazwa || '').toLowerCase()

  // Step 1: hard block — summary/payment lines are never invoice positions
  for (const forbidden of FORBIDDEN_AS_ITEM) {
    if (text.includes(forbidden)) {
      return { itemType: 'summary_line', shouldAffectInventory: false }
    }
  }

  // Step 2: service keywords → service_item (in any doc type)
  const hasServiceKeyword = SERVICE_ITEM_KEYWORDS.some(k => text.includes(k))
  if (hasServiceKeyword) {
    return { itemType: 'service_item', shouldAffectInventory: false }
  }

  // Step 3: service document type → ALL items are service/cost by default
  // (unless they're explicitly inventory-like with physical units AND not a service doc)
  if (SERVICE_DOC_TYPES.has(documentType)) {
    return { itemType: 'service_item', shouldAffectInventory: false }
  }

  // Step 4: item with qty + any price (net or gross) + unit → inventory_item
  const hasAnyPrice = (item.cenaNetto > 0) || (item.cenaBrutto > 0) ||
    (item.wartoscNetto > 0) || (item.wartoscBrutto > 0)
  if (item.ilosc > 0 && hasAnyPrice && item.jednostka) {
    return { itemType: 'inventory_item', shouldAffectInventory: true }
  }
  // Also classify if price exists but unit is missing (gross invoice without unit column)
  if (item.ilosc > 0 && hasAnyPrice) {
    return { itemType: 'inventory_item', shouldAffectInventory: true }
  }

  // Step 5: inventory document fallback
  if (documentType === 'inventory_purchase_invoice') {
    return { itemType: 'inventory_item', shouldAffectInventory: true }
  }

  return { itemType: 'unknown', shouldAffectInventory: false }
}

export function isForbiddenLine(lineText) {
  const lower = lineText.toLowerCase().trim()
  return FORBIDDEN_AS_ITEM.some(f => lower.startsWith(f) || lower === f)
}
