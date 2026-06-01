const MODEL_CONFIG_KEY = 'magzic_invoice_model_config'

export const DEFAULT_INVOICE_MODEL_CONFIG = {
  version: '0.1.0',
  mode: 'shadow',
  thresholds: {
    productStrongMatch: 0.85,
    productReviewMatch: 0.65,
    documentTypeConfidence: 0.75,
    itemTypeConfidence: 0.75,
    falsePositiveRisk: 0.65,
    inventoryEffectConfidence: 0.8,
  },
  weights: {
    productNameTokenOverlap: 0.30,
    productTechParams: 0.25,
    productBrandMatch: 0.15,
    productUnitMatch: 0.10,
    productSupplierAlias: 0.25,
    productHistoricalAlias: 0.30,
    productCategoryMatch: 0.10,
    productConflictPenalty: -0.35,
    productTfIdfScore: 0.15,
    productAliasScore: 1.0,

    documentInventorySignals: 0.30,
    documentServiceSignals: 0.30,
    documentTableKind: 0.25,
    documentSupplierTemplate: 0.15,

    itemHasQuantity: 0.15,
    itemHasUnit: 0.15,
    itemHasPrice: 0.20,
    itemHasVat: 0.10,
    itemInTableRegion: 0.20,
    itemForbiddenPenalty: -0.60,
    itemPaymentPenalty: -0.70,
    itemSummaryPenalty: -0.80,

    mathConsistency: 0.25,
    totalsConsistency: 0.25,
    validationWarningPenalty: -0.15,
    validationErrorPenalty: -0.35,
  },
  confidenceThresholds: {
    high: 0.9,
    medium: 0.6,
    autoApprove: 0.9,
    aliasAutoApproveUsageCount: 3,
  },
  trainedAt: null,
  trainedOn: {
    goldenSamples: 0,
    correctionEvents: 0,
  },
  metrics: null,
}

function isValidConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return false
  if (!cfg.version || !cfg.mode) return false
  if (!['off', 'shadow', 'active'].includes(cfg.mode)) return false
  if (!cfg.thresholds || typeof cfg.thresholds !== 'object') return false
  if (!cfg.weights || typeof cfg.weights !== 'object') return false
  return true
}

export function getInvoiceModelConfig() {
  try {
    const raw = localStorage.getItem(MODEL_CONFIG_KEY)
    if (!raw) return { ...DEFAULT_INVOICE_MODEL_CONFIG }
    const parsed = JSON.parse(raw)
    if (!isValidConfig(parsed)) return { ...DEFAULT_INVOICE_MODEL_CONFIG }
    return {
      ...DEFAULT_INVOICE_MODEL_CONFIG,
      ...parsed,
      thresholds: { ...DEFAULT_INVOICE_MODEL_CONFIG.thresholds, ...parsed.thresholds },
      weights: { ...DEFAULT_INVOICE_MODEL_CONFIG.weights, ...parsed.weights },
      confidenceThresholds: { ...DEFAULT_INVOICE_MODEL_CONFIG.confidenceThresholds, ...(parsed.confidenceThresholds || {}) },
    }
  } catch {
    return { ...DEFAULT_INVOICE_MODEL_CONFIG }
  }
}

export function saveInvoiceModelConfig(config) {
  try {
    if (!isValidConfig(config)) return { success: false, error: 'Nieprawidłowy config' }
    localStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(config))
    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export function resetInvoiceModelConfig() {
  try { localStorage.removeItem(MODEL_CONFIG_KEY) } catch { /* ignore */ }
}

export function activateInvoiceModelConfig(config) {
  const current = getInvoiceModelConfig()
  const updated = { ...current, ...config, mode: 'active' }
  return saveInvoiceModelConfig(updated)
}

export function setInvoiceModelMode(mode) {
  if (!['off', 'shadow', 'active'].includes(mode)) {
    return { success: false, error: 'Nieprawidłowy tryb. Dozwolone: off, shadow, active' }
  }
  const config = getInvoiceModelConfig()
  config.mode = mode
  return saveInvoiceModelConfig(config)
}

export function exportInvoiceModelConfig() {
  return JSON.stringify(getInvoiceModelConfig(), null, 2)
}

export function importInvoiceModelConfig(json) {
  try {
    const parsed = JSON.parse(json)
    if (!isValidConfig(parsed)) return { success: false, error: 'Nieprawidłowa struktura configu modelu' }
    const merged = {
      ...DEFAULT_INVOICE_MODEL_CONFIG,
      ...parsed,
      thresholds: { ...DEFAULT_INVOICE_MODEL_CONFIG.thresholds, ...parsed.thresholds },
      weights: { ...DEFAULT_INVOICE_MODEL_CONFIG.weights, ...parsed.weights },
    }
    return saveInvoiceModelConfig(merged)
  } catch (e) {
    return { success: false, error: String(e) }
  }
}
