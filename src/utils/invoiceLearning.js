// PRIVACY NOTE: All data stored here stays in localStorage only.
// We store: product aliases (rawName→productId), supplier mappings, typical prices,
// and training examples (structural summaries only, never full PDF content or PII).
// Training examples contain text hashes and field summaries — NOT raw invoice text.

const KEYS = {
  aliases: 'magzic_product_aliases',
  supplierMappings: 'magzic_supplier_item_mappings',
  typicalPrices: 'magzic_typical_prices',
  trainingExamples: 'magzic_invoice_training_examples',
}

const MAX_TRAINING_EXAMPLES = 500

function getStore(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}

function getStoreArray(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}

function saveStore(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* quota */ }
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
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  }
}
