// Guard layer for AI invoice results.
// All AI output passes through this module before being shown to the user.
// AI is a suggestion — never a source of truth.

const SERVICE_DOC_TYPES = new Set(['telecom_invoice', 'utility_invoice', 'service_cost_invoice'])

const SERVICE_KEYWORDS = [
  'usług', 'abonament', 'opłat', 'serwis', 'telekomunik', 'internet',
  'energia elektryczna', 'gaz ziemny', 'woda i ścieki', 'tauron', 'pge',
]

const REQUIRED_POZYCJA_FIELDS = ['rawName']

export function sanitizeAiInvoiceResult(aiResult) {
  if (!aiResult || typeof aiResult !== 'object') return null
  try {
    return JSON.parse(JSON.stringify(aiResult))
  } catch {
    return null
  }
}

export function validateAiInvoiceSchema(aiResult) {
  const errors = []
  if (!aiResult) { errors.push('AI result is null'); return { valid: false, errors } }
  if (typeof aiResult !== 'object') { errors.push('AI result is not an object'); return { valid: false, errors } }
  if (!aiResult.documentType) errors.push('Missing documentType')
  if (typeof aiResult.confidence !== 'number' || aiResult.confidence < 0 || aiResult.confidence > 100) {
    errors.push('confidence must be a number between 0 and 100')
  }
  if (!Array.isArray(aiResult.pozycje)) errors.push('pozycje must be an array')
  else {
    for (const [i, poz] of aiResult.pozycje.entries()) {
      for (const field of REQUIRED_POZYCJA_FIELDS) {
        if (!poz[field]) errors.push(`pozycje[${i}] missing ${field}`)
      }
    }
  }
  return { valid: errors.length === 0, errors }
}

export function capConfidenceIfNeeded(result) {
  if (!result) return result
  // AI confidence hard cap at 95
  if (result.confidence > 95) result.confidence = 95
  // Degrade confidence based on warnings
  const warnCount = (result.warnings || []).length + (result.aiWarnings || []).length
  if (warnCount > 5) result.confidence = Math.min(result.confidence, 60)
  else if (warnCount > 3) result.confidence = Math.min(result.confidence, 75)
  else if (warnCount > 1) result.confidence = Math.min(result.confidence, 85)
  return result
}

export function guardAgainstServiceToInventoryMatch(result) {
  if (!result) return result
  const isServiceDoc = SERVICE_DOC_TYPES.has(result.documentType)

  for (const item of (result.pozycje || [])) {
    const nameL = (item.rawName || item.nazwa || '').toLowerCase()
    const hasServiceKeyword = SERVICE_KEYWORDS.some(k => nameL.includes(k))

    // Guard 1: service_item must never affect inventory
    if (item.itemType === 'service_item' && item.shouldAffectInventory === true) {
      item.shouldAffectInventory = false
      _addWarning(item, 'Guard: service_item cannot affect inventory')
    }

    // Guard 2: service document → all non-inventory items get shouldAffectInventory=false
    if (isServiceDoc && item.itemType !== 'inventory_item') {
      item.shouldAffectInventory = false
    }

    // Guard 3: service keyword in name → remove product match + block inventory
    if (hasServiceKeyword && item.matchedProductId) {
      _addWarning(item, `Guard: service item "${item.rawName}" cleared from inventory match`)
      item.matchedProductId = null
      item.matchedProductSuggestion = null
      item.matchScore = 0
      item.shouldAffectInventory = false
    }

    // Guard 4: missing price/quantity → review, no inventory
    const hasCena = (item.cenaNetto != null && item.cenaNetto > 0) || (item.wartoscNetto != null && item.wartoscNetto > 0)
    const hasIlosc = item.ilosc != null && Number(item.ilosc) > 0
    if (!hasCena || !hasIlosc) {
      _addWarning(item, 'Guard: missing price or quantity — review required')
      if (!hasCena) item.shouldAffectInventory = false
    }

    // Guard 5: non-inventory itemType with matchedProductId → clear unless it's an explicit inventory type
    if (item.itemType && item.itemType !== 'inventory_item' && item.matchedProductId) {
      _addWarning(item, `Guard: non-inventory item "${item.rawName}" cleared from product match (itemType=${item.itemType})`)
      item.matchedProductId = null
      item.matchScore = 0
    }

    // Guard 6: AI confidence 100 → cap to 95 at item level (if present)
    if (item.confidence > 0.95) item.confidence = 0.95
  }

  return result
}

export function rejectUnsafeAiInventoryEffects(result) {
  if (!result) return result
  // Hard rule: service document types → ALL items get shouldAffectInventory=false, no exceptions
  if (SERVICE_DOC_TYPES.has(result.documentType)) {
    for (const item of (result.pozycje || [])) {
      item.shouldAffectInventory = false
      if (item.matchedProductId) {
        _addWarning(item, `Guard: telecom/utility invoice — inventory match blocked for "${item.rawName}"`)
        item.matchedProductId = null
        item.matchScore = 0
      }
    }
    // Also cap document-level confidence
    if (result.confidence > 80) result.confidence = 80
  }
  return result
}

export function mergeLocalAndAiResult(localResult, aiResult) {
  if (!aiResult) return localResult
  // Deep clone local as base (AI is suggestion only)
  const merged = JSON.parse(JSON.stringify(localResult))

  // Prefer AI documentType if local is 'unknown' and AI has a specific one
  if ((merged.documentType === 'unknown' || !merged.documentType) && aiResult.documentType && aiResult.documentType !== 'unknown') {
    merged.documentType = aiResult.documentType
  }

  // AI fills missing header fields
  const aiFields = aiResult.fields || {}
  const localFields = merged.fields || {}
  for (const key of [
    'numer', 'data_wystawienia', 'data_zakupu',
    'sprzedawca_nip', 'sprzedawca_nazwa',
    'kontrahent_nip', 'kontrahent_nazwa',
    'suma_netto', 'suma_brutto', 'do_zaplaty', 'waluta',
  ]) {
    if ((localFields[key] == null || localFields[key] === '') && aiFields[key] != null && aiFields[key] !== '') {
      localFields[key] = aiFields[key]
    }
  }
  merged.fields = localFields

  // If local has no positions but AI does — use AI positions (they still go through guard)
  if (!merged.fields.pozycje?.length && Array.isArray(aiResult.pozycje) && aiResult.pozycje.length) {
    merged.fields.pozycje = aiResult.pozycje
  }

  merged.source = 'pdf_text_ai'
  merged.aiConfidence = aiResult.confidence
  merged.aiWarnings = aiResult.warnings || []

  // Merge top-level warnings
  for (const w of (aiResult.warnings || [])) {
    if (!merged.warnings.includes(w)) merged.warnings.push(w)
  }
  if (aiResult.priceAlerts?.length) {
    merged.priceAlerts = aiResult.priceAlerts
  }

  return merged
}

function _addWarning(item, msg) {
  if (!item.warnings) item.warnings = []
  if (!item.warnings.includes(msg)) item.warnings.push(msg)
}
