// PRIVACY NOTE: All data stored here stays in localStorage only.
// We store: product aliases (rawName→productId), supplier mappings, typical prices,
// and training examples (structural summaries only, never full PDF content or PII).
// Training examples contain text hashes and field summaries — NOT raw invoice text.

const KEYS = {
  aliases: 'magzic_product_aliases',
  supplierMappings: 'magzic_supplier_item_mappings',
  typicalPrices: 'magzic_typical_prices',
  trainingExamples: 'magzic_invoice_training_examples',
  supplierContractorMappings: 'magzic_supplier_contractor_mappings',
}

const MAX_TRAINING_EXAMPLES = 500

// In-memory fallback used when localStorage is unavailable (e.g. Node/test environment)
const _mem = Object.create(null)

function _getLS() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}

function getStore(key) {
  try {
    const ls = _getLS()
    const raw = ls ? ls.getItem(key) : (_mem[key] ?? null)
    return JSON.parse(raw || '{}')
  } catch { return {} }
}

function getStoreArray(key) {
  try {
    const ls = _getLS()
    const raw = ls ? ls.getItem(key) : (_mem[key] ?? null)
    return JSON.parse(raw || '[]')
  } catch { return [] }
}

function saveStore(key, data) {
  try {
    const ls = _getLS()
    const val = JSON.stringify(data)
    if (ls) ls.setItem(key, val)
    else _mem[key] = val
  } catch { /* quota */ }
}

// ── Product aliases ───────────────────────────────────────────────────

export function rememberProductAlias(rawName, productId) {
  if (!rawName || !productId) return
  const aliases = getStore(KEYS.aliases)
  aliases[rawName.toLowerCase().trim()] = { productId, addedAt: new Date().toISOString() }
  saveStore(KEYS.aliases, aliases)
}

export function findProductByAlias(rawName) {
  if (!rawName) return null
  try {
    const aliases = getStore(KEYS.aliases)
    return aliases[rawName.toLowerCase().trim()]?.productId || null
  } catch { return null }
}

// ── Supplier item mappings ────────────────────────────────────────────

export function rememberSupplierItemName(supplierNip, rawName, productId) {
  if (!supplierNip || !rawName || !productId) return
  const mappings = getStore(KEYS.supplierMappings)
  if (!mappings[supplierNip]) mappings[supplierNip] = {}
  mappings[supplierNip][rawName.toLowerCase().trim()] = productId
  saveStore(KEYS.supplierMappings, mappings)
}

export function getSupplierItemMapping(supplierNip, rawName) {
  if (!supplierNip || !rawName) return null
  try {
    const mappings = getStore(KEYS.supplierMappings)
    return mappings[supplierNip]?.[rawName.toLowerCase().trim()] || null
  } catch { return null }
}

// ── Supplier → Contractor mappings ───────────────────────────────────
// Remembers which contractor was manually chosen for a given detected supplier name/NIP.
// This allows future invoices from the same supplier to be matched automatically.

export function rememberSupplierContractorMapping(detectedName, nip, contractorId, canonicalName) {
  if (!contractorId) return
  const mappings = getStore(KEYS.supplierContractorMappings)
  if (nip) {
    const n = String(nip).replace(/\D/g, '')
    if (n.length >= 8) {
      mappings[`nip:${n}`] = { contractorId, canonicalName: canonicalName || null, addedAt: new Date().toISOString() }
    }
  }
  if (detectedName && detectedName.trim().length >= 3) {
    mappings[`name:${detectedName.toLowerCase().trim()}`] = { contractorId, canonicalName: canonicalName || null, addedAt: new Date().toISOString() }
  }
  saveStore(KEYS.supplierContractorMappings, mappings)
}

export function findSupplierContractorMapping(detectedName, nip) {
  const mappings = getStore(KEYS.supplierContractorMappings)
  if (nip) {
    const n = String(nip).replace(/\D/g, '')
    if (n.length >= 8) {
      const byNip = mappings[`nip:${n}`]
      if (byNip?.contractorId) return { ...byNip, source: 'learned_supplier_mapping', matchedBy: 'nip' }
    }
  }
  if (detectedName && detectedName.trim().length >= 3) {
    const byName = mappings[`name:${detectedName.toLowerCase().trim()}`]
    if (byName?.contractorId) return { ...byName, source: 'learned_supplier_mapping', matchedBy: 'name' }
  }
  return null
}

// ── Typical prices ────────────────────────────────────────────────────

export function rememberTypicalPrice(productId, supplierId, price) {
  if (!productId || !supplierId || !price) return
  const prices = getStore(KEYS.typicalPrices)
  const key = `${productId}_${supplierId}`
  if (!prices[key]) prices[key] = []
  prices[key].push({ price: Number(price), date: new Date().toISOString() })
  if (prices[key].length > 10) prices[key] = prices[key].slice(-10)
  saveStore(KEYS.typicalPrices, prices)
}

export function getTypicalPrice(productId, supplierId) {
  if (!productId || !supplierId) return null
  try {
    const prices = getStore(KEYS.typicalPrices)
    const history = prices[`${productId}_${supplierId}`] || []
    if (!history.length) return null
    const avg = history.reduce((s, h) => s + h.price, 0) / history.length
    return { avg, last: history[history.length - 1].price, count: history.length }
  } catch { return null }
}

// ── Training examples ─────────────────────────────────────────────────
// Stores structural summaries of corrections, not full PDF data.

export function hashInvoiceText(rawText) {
  if (!rawText) return null
  // Simple 32-bit hash (djb2) — not cryptographic, just for deduplication
  let hash = 5381
  for (let i = 0; i < Math.min(rawText.length, 2000); i++) {
    hash = ((hash << 5) + hash) ^ rawText.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function buildLayoutFingerprint(layout) {
  if (!layout) return null
  try {
    const pages = Array.isArray(layout.pages) ? layout.pages : []
    return {
      pageCount: pages.length,
      lineCountP1: pages[0]?.lines?.length ?? 0,
      avgLineLength: pages.length
        ? Math.round(pages.flatMap(p => p.lines || []).map(l => l.text?.length || 0).reduce((s, n) => s + n, 0) / Math.max(1, pages.flatMap(p => p.lines || []).length))
        : 0,
    }
  } catch { return null }
}

// InvoiceCorrection shape:
// { fieldPath, oldValue, newValue, correctionType }
// correctionType: 'wrong_value' | 'missing_value' | 'false_positive' | 'false_negative' |
//                 'wrong_product_match' | 'wrong_item_type' | 'wrong_inventory_effect' | 'wrong_document_type'

export function buildTrainingExample(localResult, aiResult, correctedResult) {
  const now = new Date().toISOString()
  const rawText = correctedResult?.rawText || localResult?.rawText || ''
  const corrections = []

  // Detect documentType correction
  if (localResult?.documentType !== correctedResult?.documentType) {
    corrections.push({
      fieldPath: 'documentType',
      oldValue: localResult?.documentType,
      newValue: correctedResult?.documentType,
      correctionType: 'wrong_document_type',
    })
  }

  // Detect per-pozycja corrections
  const corrPoz = correctedResult?.fields?.pozycje || []
  const localPoz = localResult?.fields?.pozycje || []
  for (let i = 0; i < corrPoz.length; i++) {
    const cp = corrPoz[i]
    const lp = localPoz[i]
    if (!lp) {
      corrections.push({ fieldPath: `pozycje[${i}]`, oldValue: null, newValue: cp.rawName, correctionType: 'missing_value' })
      continue
    }
    if (cp.itemType !== lp.itemType) {
      corrections.push({ fieldPath: `pozycje[${i}].itemType`, oldValue: lp.itemType, newValue: cp.itemType, correctionType: 'wrong_item_type' })
    }
    if (cp.shouldAffectInventory !== lp.shouldAffectInventory) {
      corrections.push({ fieldPath: `pozycje[${i}].shouldAffectInventory`, oldValue: lp.shouldAffectInventory, newValue: cp.shouldAffectInventory, correctionType: 'wrong_inventory_effect' })
    }
    if (cp.matchedProductId !== lp.matchedProductId) {
      corrections.push({ fieldPath: `pozycje[${i}].matchedProductId`, oldValue: lp.matchedProductId, newValue: cp.matchedProductId, correctionType: 'wrong_product_match' })
    }
  }

  // Summarize local extraction (no PII — just counts/types)
  const localSummary = {
    documentType: localResult?.documentType,
    confidence: localResult?.confidence,
    pozycjeCount: localPoz.length,
    itemTypes: localPoz.map(p => p.itemType),
    hasNumer: !!localResult?.fields?.numer,
    hasData: !!localResult?.fields?.data_zakupu,
    hasNip: !!(localResult?.fields?.kontrahent_nip || localResult?.fields?.sprzedawca_nip),
  }

  const aiSummary = aiResult ? {
    documentType: aiResult.documentType,
    confidence: aiResult.confidence,
    pozycjeCount: (aiResult.pozycje || []).length,
    itemTypes: (aiResult.pozycje || []).map(p => p.itemType),
  } : null

  return {
    id: crypto.randomUUID(),
    parserVersion: '2.0',
    supplierNip: correctedResult?.fields?.sprzedawca_nip || correctedResult?.fields?.kontrahent_nip || null,
    supplierName: correctedResult?.fields?.sprzedawca_nazwa || correctedResult?.fields?.kontrahent_nazwa || null,
    documentTypeBefore: localResult?.documentType || 'unknown',
    documentTypeAfter: correctedResult?.documentType || 'unknown',
    rawTextHash: hashInvoiceText(rawText),
    localExtractionSummary: localSummary,
    aiExtractionSummary: aiSummary,
    correctedResultSummary: {
      documentType: correctedResult?.documentType,
      pozycjeCount: corrPoz.length,
      itemTypes: corrPoz.map(p => p.itemType),
    },
    corrections,
    acceptedAt: now,
    createdAt: now,
  }
}

export function saveInvoiceTrainingExample(example) {
  if (!example) return
  const examples = getStoreArray(KEYS.trainingExamples)
  examples.push(example)
  // Keep last N examples to avoid localStorage overflow
  const trimmed = examples.slice(-MAX_TRAINING_EXAMPLES)
  saveStore(KEYS.trainingExamples, trimmed)
}

export function getInvoiceTrainingExamples() {
  return getStoreArray(KEYS.trainingExamples)
}

export function exportInvoiceLearningData() {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    version: '2.0',
    aliases: getStore(KEYS.aliases),
    supplierMappings: getStore(KEYS.supplierMappings),
    typicalPrices: getStore(KEYS.typicalPrices),
    trainingExamples: getStoreArray(KEYS.trainingExamples),
  }, null, 2)
}

export function importInvoiceLearningData(jsonString) {
  try {
    const data = JSON.parse(jsonString)
    if (!data || typeof data !== 'object') throw new Error('Invalid format')

    if (data.aliases) saveStore(KEYS.aliases, data.aliases)
    if (data.supplierMappings) saveStore(KEYS.supplierMappings, data.supplierMappings)
    if (data.typicalPrices) saveStore(KEYS.typicalPrices, data.typicalPrices)
    if (Array.isArray(data.trainingExamples)) {
      const trimmed = data.trainingExamples.slice(-MAX_TRAINING_EXAMPLES)
      saveStore(KEYS.trainingExamples, trimmed)
    }

    return { success: true, imported: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

export function clearInvoiceLearningData() {
  for (const key of Object.values(KEYS)) {
    try {
      const ls = _getLS()
      if (ls) ls.removeItem(key)
      else delete _mem[key]
    } catch { /* ignore */ }
  }
}

// ── All-in-one export/import/clear (includes corrections + golden samples) ───

export function exportAllInvoiceLearningData() {
  try {
    const correctionEvents = JSON.parse(localStorage.getItem('magzic_invoice_correction_events') || '[]')
    const goldenSamples = JSON.parse(localStorage.getItem('magzic_invoice_golden_samples') || '[]')
    return JSON.stringify({
      version: '2.0',
      exportedAt: new Date().toISOString(),
      aliases: getStore(KEYS.aliases),
      supplierMappings: getStore(KEYS.supplierMappings),
      typicalPrices: getStore(KEYS.typicalPrices),
      trainingExamples: getStoreArray(KEYS.trainingExamples),
      correctionEvents,
      goldenSamples,
    }, null, 2)
  } catch (err) {
    return JSON.stringify({ error: err.message })
  }
}

export function importAllInvoiceLearningData(jsonString) {
  try {
    const data = JSON.parse(jsonString)
    if (!data || typeof data !== 'object') throw new Error('Invalid format')

    const counts = {}

    if (data.aliases) {
      const existing = getStore(KEYS.aliases)
      const merged = { ...existing, ...data.aliases }
      saveStore(KEYS.aliases, merged)
      counts.aliases = Object.keys(data.aliases).length
    }
    if (data.supplierMappings) {
      const existing = getStore(KEYS.supplierMappings)
      const merged = { ...existing, ...data.supplierMappings }
      saveStore(KEYS.supplierMappings, merged)
      counts.supplierMappings = Object.keys(data.supplierMappings).length
    }
    if (data.typicalPrices) {
      saveStore(KEYS.typicalPrices, data.typicalPrices)
      counts.typicalPrices = Object.keys(data.typicalPrices).length
    }
    if (Array.isArray(data.trainingExamples)) {
      const existing = getStoreArray(KEYS.trainingExamples)
      const combined = [...existing, ...data.trainingExamples].slice(-MAX_TRAINING_EXAMPLES)
      saveStore(KEYS.trainingExamples, combined)
      counts.trainingExamples = data.trainingExamples.length
    }
    if (Array.isArray(data.correctionEvents)) {
      try {
        const existing = JSON.parse(localStorage.getItem('magzic_invoice_correction_events') || '[]')
        const combined = [...existing, ...data.correctionEvents].slice(-500)
        localStorage.setItem('magzic_invoice_correction_events', JSON.stringify(combined))
        counts.correctionEvents = data.correctionEvents.length
      } catch { /* quota */ }
    }
    if (Array.isArray(data.goldenSamples)) {
      try {
        const existing = JSON.parse(localStorage.getItem('magzic_invoice_golden_samples') || '[]')
        const existingIds = new Set(existing.map(s => s.id))
        const newSamples = data.goldenSamples.filter(s => !existingIds.has(s.id))
        localStorage.setItem('magzic_invoice_golden_samples', JSON.stringify([...existing, ...newSamples]))
        counts.goldenSamples = newSamples.length
      } catch { /* quota */ }
    }

    return { success: true, importedCounts: counts }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

export function clearAllInvoiceLearningData() {
  clearInvoiceLearningData()
  try { localStorage.removeItem('magzic_invoice_correction_events') } catch { /* ignore */ }
  try { localStorage.removeItem('magzic_invoice_golden_samples') } catch { /* ignore */ }
}
