const TELECOM_SIGNALS = [
  'usługi telekomunikacyjne', 'abonament', 'p4 sp', 'play', 'orange',
  'numer konta klienta', 'twoje abonamenty', 'rozliczenie konta',
  'opłaty naliczone', 'rodzina m 5g', 'zapłać online', 'obsługa klienta',
]

const UTILITY_SIGNALS = [
  'energia elektryczna', 'gaz', 'woda i ścieki', 'tauron',
  'pge', 'enea', 'energa', 'pgnig',
]

const INVENTORY_SIGNALS = [
  'cena jednostkowa', 'cena netto j', 'cena jedn',
  'wartość netto', 'jm', 'j.m.', 'ilość szt',
  'syfon', 'bateria', 'listwa', 'żarówka', 'worki', 'papier toaletowy',
  'clin', 'płyn do', 'silikon', 'kołki', 'śruby', 'wąż prysznicowy',
]

const FORBIDDEN_AS_ITEM = [
  'razem', 'suma', 'do zapłaty', 'wartość faktury',
  'prosimy o wpłatę', 'zapłać online', 'termin płatności',
  'forma płatności', 'przelew', 'numer konta', 'numer rachunku',
  'obsługa klienta', 'zarządzaj kontem', 'twoje abonamenty',
  'rozliczenie konta', 'saldo końcowe', 'wpłata',
  'odcinek dla wpłacającego', 'opłać fakturę', 'zeskanuj kod',
  'tytułem', 'nazwa odbiorcy', 'abonament za okres',
  'opłaty naliczone w okresie', 'blankiet',
]

export function classifyDocument(text, tableCandidates) {
  const lower = text.toLowerCase()

  const telecomScore = TELECOM_SIGNALS.filter(s => lower.includes(s)).length
  if (telecomScore >= 2) return 'telecom_invoice'

  const utilityScore = UTILITY_SIGNALS.filter(s => lower.includes(s)).length
  if (utilityScore >= 2) return 'utility_invoice'

  const inventoryScore = INVENTORY_SIGNALS.filter(s => lower.includes(s)).length

  const hasInventoryTable = (tableCandidates || []).some(c =>
    c.columnMap?.ILOSC && c.columnMap?.JEDNOSTKA && c.rowCount >= 1
  )

  if (inventoryScore >= 2 || hasInventoryTable) return 'inventory_purchase_invoice'
  if (telecomScore >= 1 || utilityScore >= 1) return 'service_cost_invoice'

  return 'unknown'
}

export function classifyItem(item, documentType) {
  const text = (item.rawName || item.nazwa || '').toLowerCase()

  for (const forbidden of FORBIDDEN_AS_ITEM) {
    if (text.includes(forbidden)) {
      return { itemType: 'summary_line', shouldAffectInventory: false }
    }
  }

  if (
    text.includes('usług') || text.includes('abonament') ||
    text.includes('opłat') || text.includes('serwis')
  ) {
    if (documentType === 'telecom_invoice' || documentType === 'service_cost_invoice' || documentType === 'utility_invoice') {
      return { itemType: 'service_item', shouldAffectInventory: false }
    }
  }

  if (item.ilosc > 0 && item.cenaNetto > 0 && item.jednostka) {
    return { itemType: 'inventory_item', shouldAffectInventory: true }
  }

  if (documentType === 'inventory_purchase_invoice') {
    return { itemType: 'inventory_item', shouldAffectInventory: true }
  }

  return { itemType: 'unknown', shouldAffectInventory: false }
}

export function isForbiddenLine(lineText) {
  const lower = lineText.toLowerCase().trim()
  return FORBIDDEN_AS_ITEM.some(f => lower.startsWith(f) || lower === f)
}
