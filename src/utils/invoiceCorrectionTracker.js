import { logCorrection } from './modelLogger.js'

const CORRECTIONS_KEY = 'magzic_invoice_correction_events'
const MAX_EVENTS = 500

// ── Core diff ────────────────────────────────────────────────────────────────

export function classifyCorrection(fieldPath, oldValue, newValue) {
  if (oldValue == null && newValue != null) return 'missing_value'
  if (oldValue != null && newValue == null) return 'false_positive'
  if (fieldPath.endsWith('.documentType') || fieldPath === 'documentType') return 'wrong_document_type'
  if (fieldPath.endsWith('.itemType')) return 'wrong_item_type'
  if (fieldPath.endsWith('.shouldAffectInventory')) return 'wrong_inventory_effect'
  if (fieldPath.endsWith('.matchedProductId')) return 'wrong_product_match'
  if (fieldPath.endsWith('.cenaNetto') || fieldPath.endsWith('.cena_netto')) return 'wrong_price'
  if (fieldPath.endsWith('.ilosc')) return 'wrong_quantity'
  if (fieldPath.endsWith('.jednostka')) return 'wrong_unit'
  if (fieldPath.endsWith('.vat') || fieldPath.endsWith('.vat_procent')) return 'wrong_vat'
  if (fieldPath.includes('pozycje') && oldValue == null) return 'false_negative'
  if (fieldPath.includes('pozycje') && newValue == null) return 'false_positive'
  return 'wrong_value'
}

export function diffInvoiceExtraction(extracted, approved) {
  const corrections = []

  const headerFields = ['numer', 'data_zakupu', 'kontrahent_nip', 'kontrahent_nazwa', 'suma_netto', 'suma_brutto']
  for (const field of headerFields) {
    const oldVal = extracted.fields?.[field]
    const newVal = approved.fields?.[field]
    if (oldVal !== newVal) {
      corrections.push({
        fieldPath: `fields.${field}`,
        oldValue: oldVal,
        newValue: newVal,
        correctionType: classifyCorrection(`fields.${field}`, oldVal, newVal),
      })
    }
  }

  const extPozycje = extracted.fields?.pozycje || []
  const appPozycje = approved.fields?.pozycje || []

  if (appPozycje.length > extPozycje.length) {
    corrections.push({
      fieldPath: 'fields.pozycje',
      oldValue: extPozycje.length,
      newValue: appPozycje.length,
      correctionType: 'false_negative',
    })
  }
  if (appPozycje.length < extPozycje.length) {
    corrections.push({
      fieldPath: 'fields.pozycje',
      oldValue: extPozycje.length,
      newValue: appPozycje.length,
      correctionType: 'false_positive',
    })
  }

  const minLen = Math.min(extPozycje.length, appPozycje.length)
  for (let i = 0; i < minLen; i++) {
    const ep = extPozycje[i]
    const ap = appPozycje[i]

    if (ep.matchedProductId !== ap.matchedProductId) {
      corrections.push({ fieldPath: `pozycje[${i}].matchedProductId`, oldValue: ep.matchedProductId, newValue: ap.matchedProductId, correctionType: 'wrong_product_match' })
    }
    if (ep.itemType !== ap.itemType) {
      corrections.push({ fieldPath: `pozycje[${i}].itemType`, oldValue: ep.itemType, newValue: ap.itemType, correctionType: 'wrong_item_type' })
    }
    if (ep.shouldAffectInventory !== ap.shouldAffectInventory) {
      corrections.push({ fieldPath: `pozycje[${i}].shouldAffectInventory`, oldValue: ep.shouldAffectInventory, newValue: ap.shouldAffectInventory, correctionType: 'wrong_inventory_effect' })
    }
    if (Math.abs((ep.cenaNetto || 0) - (ap.cenaNetto || 0)) > 0.01) {
      corrections.push({ fieldPath: `pozycje[${i}].cenaNetto`, oldValue: ep.cenaNetto, newValue: ap.cenaNetto, correctionType: 'wrong_price' })
    }
    if (ep.ilosc !== ap.ilosc) {
      corrections.push({ fieldPath: `pozycje[${i}].ilosc`, oldValue: ep.ilosc, newValue: ap.ilosc, correctionType: 'wrong_quantity' })
    }
    if (ep.jednostka !== ap.jednostka) {
      corrections.push({ fieldPath: `pozycje[${i}].jednostka`, oldValue: ep.jednostka, newValue: ap.jednostka, correctionType: 'wrong_unit' })
    }
  }

  return corrections
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function buildCorrectionSummary(corrections) {
  const byType = {}
  let total = 0
  for (const c of corrections) {
    byType[c.correctionType] = (byType[c.correctionType] || 0) + 1
    total++
  }
  const mostCommon = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([type, count]) => ({ type, count }))
  return { total, byType, mostCommon }
}

// ── Persistence ───────────────────────────────────────────────────────────────

export function saveCorrectionEvent(extracted, approved, extractionLogId = null) {
  if (!extracted || !approved) return
  const corrections = diffInvoiceExtraction(extracted, approved)
  if (!corrections.length) return

  const event = {
    id: crypto.randomUUID(),
    parserVersion: '2.0',
    supplierNip: extracted.fields?.kontrahent_nip,
    supplierName: extracted.fields?.kontrahent_nazwa,
    documentTypeBefore: extracted.documentType,
    documentTypeAfter: approved.documentType || extracted.documentType,
    source: extracted.source,
    confidenceBefore: extracted.confidence,
    confidenceAfter: approved.confidence,
    corrections,
    summary: buildCorrectionSummary(corrections),
    createdAt: new Date().toISOString(),
  }

  try {
    const events = JSON.parse(localStorage.getItem(CORRECTIONS_KEY) || '[]')
    events.push(event)
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
    localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(events))
  } catch { /* non-critical */ }

  // Dual-write to Supabase — fire-and-forget, never throws
  const originalCtx = {
    documentType: extracted.documentType,
    confidence: extracted.confidence,
    source: extracted.source,
  }
  const correctedCtx = {
    documentType: approved.documentType || extracted.documentType,
  }
  for (const correction of corrections.slice(0, 20)) {
    logCorrection({
      extractionLogId,
      fieldKey: correction.fieldPath,
      originalValue: correction.oldValue != null ? String(correction.oldValue) : null,
      correctedValue: correction.newValue != null ? String(correction.newValue) : null,
      originalData: originalCtx,
      correctedData: correctedCtx,
    }).catch(() => {})
  }

  return event
}

export function getCorrectionEvents() {
  try { return JSON.parse(localStorage.getItem(CORRECTIONS_KEY) || '[]') } catch { return [] }
}

export function exportCorrectionEvents() {
  return JSON.stringify(getCorrectionEvents(), null, 2)
}

export function clearCorrectionEvents() {
  try { localStorage.removeItem(CORRECTIONS_KEY) } catch { /* ignore */ }
}

export function getCorrectionStats() {
  const events = getCorrectionEvents()
  const typeCount = {}
  let totalCorrections = 0

  for (const event of events) {
    for (const c of event.corrections || []) {
      typeCount[c.correctionType] = (typeCount[c.correctionType] || 0) + 1
      totalCorrections++
    }
  }

  return {
    totalEvents: events.length,
    totalCorrections,
    byType: typeCount,
    mostCommon: Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => ({ type, count })),
  }
}
