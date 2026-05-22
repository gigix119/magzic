const CORRECTIONS_KEY = 'magzic_invoice_corrections'

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
        correctionType: !oldVal ? 'missing_value' : 'wrong_value',
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

export function saveCorrectionEvent(extracted, approved) {
  if (!extracted || !approved) return
  const corrections = diffInvoiceExtraction(extracted, approved)
  if (!corrections.length) return

  const event = {
    id: crypto.randomUUID(),
    parserVersion: '1.0',
    supplierNip: extracted.fields?.kontrahent_nip,
    supplierName: extracted.fields?.kontrahent_nazwa,
    documentTypeBefore: extracted.documentType,
    documentTypeAfter: approved.documentType || extracted.documentType,
    source: extracted.source,
    confidenceBefore: extracted.confidence,
    corrections,
    createdAt: new Date().toISOString(),
  }

  try {
    const events = JSON.parse(localStorage.getItem(CORRECTIONS_KEY) || '[]')
    events.push(event)
    if (events.length > 200) events.splice(0, events.length - 200)
    localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(events))
  } catch (e) {
    console.error('Błąd zapisu correctionEvent:', e)
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
  localStorage.removeItem(CORRECTIONS_KEY)
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
