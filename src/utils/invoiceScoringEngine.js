import {
  extractDocumentFeatures,
  extractItemFeatures,
  extractProductMatchFeatures,
} from './invoiceFeatureExtractor.js'
import { getInvoiceModelConfig } from './invoiceModelConfig.js'
import { buildTfIdfIndex, queryTfIdf } from './invoiceTfIdf.js'

// Module-level TF-IDF index cache — rebuilt only when the products array reference changes
let _tfIdfProducts = null
let _tfIdfIndex = null

function getOrBuildTfIdfIndex(products) {
  if (products === _tfIdfProducts && _tfIdfIndex !== null) return _tfIdfIndex
  _tfIdfProducts = products
  try {
    _tfIdfIndex = buildTfIdfIndex(products)
  } catch {
    _tfIdfIndex = null
    _tfIdfProducts = null
  }
  return _tfIdfIndex
}

const SERVICE_DOC_TYPES = new Set(['telecom_invoice', 'utility_invoice', 'service_cost_invoice'])

// ── Document type scoring ─────────────────────────────────────────────────────

export function scoreDocumentType(features, config) {
  const cfg = config || getInvoiceModelConfig()
  const w = cfg.weights

  let inventoryScore = 0
  let serviceScore = 0
  let telecomScore = 0
  let utilityScore = 0

  // Inventory scoring
  const invSigNorm = Math.min(features.inventorySignalsCount / 3, 1)
  inventoryScore += invSigNorm * w.documentInventorySignals
  if (features.hasInventoryTable) inventoryScore += w.documentTableKind
  if (features.hasSupplierTemplate) inventoryScore += w.documentSupplierTemplate * 0.5
  if (features.hasInvoiceNumber) inventoryScore += 0.1
  if (features.hasTotals) inventoryScore += 0.1
  if (!features.mathValid) inventoryScore = Math.max(0, inventoryScore - 0.2)
  if (features.errorsCount > 0) inventoryScore = Math.max(0, inventoryScore + w.validationErrorPenalty * 0.5)

  // Telecom scoring
  const teleSigNorm = Math.min(features.telecomSignalsCount / 2, 1)
  telecomScore += teleSigNorm * w.documentServiceSignals

  // Utility scoring
  const utilSigNorm = Math.min(features.utilitySignalsCount / 2, 1)
  utilityScore += utilSigNorm * w.documentServiceSignals

  // Service scoring
  const servSigNorm = Math.min(features.serviceSignalsCount / 2, 1)
  serviceScore += servSigNorm * w.documentServiceSignals

  let documentType = 'unknown'
  let confidence = 0

  if (telecomScore >= w.documentServiceSignals * 0.9 && telecomScore > inventoryScore) {
    documentType = 'telecom_invoice'
    confidence = Math.min(0.95, telecomScore)
  } else if (utilityScore >= w.documentServiceSignals * 0.9 && utilityScore > inventoryScore) {
    documentType = 'utility_invoice'
    confidence = Math.min(0.95, utilityScore)
  } else if (
    inventoryScore > serviceScore &&
    (features.inventorySignalsCount >= 2 || features.hasInventoryTable)
  ) {
    documentType = 'inventory_purchase_invoice'
    confidence = Math.min(0.95, inventoryScore)
  } else if (serviceScore > inventoryScore && serviceScore >= w.documentServiceSignals * 0.5) {
    documentType = 'service_cost_invoice'
    confidence = Math.min(0.95, serviceScore)
  } else if (inventoryScore > 0 && serviceScore > 0 && Math.abs(inventoryScore - serviceScore) < 0.15) {
    documentType = 'mixed_invoice'
    confidence = Math.min(0.7, (inventoryScore + serviceScore) / 2)
  }

  return {
    documentType,
    confidence: Math.max(0, Math.min(1, confidence)),
    scores: { inventoryScore, serviceScore, telecomScore, utilityScore },
  }
}

// ── Item type scoring ─────────────────────────────────────────────────────────

export function scoreItemType(features, config) {
  const cfg = config || getInvoiceModelConfig()
  const w = cfg.weights

  // Hard blocks — never override
  if (features.isForbiddenLine) {
    return { itemType: 'summary_line', shouldAffectInventory: false, confidence: 0.99, reason: 'forbidden_line' }
  }
  if (features.isPaymentLine) {
    return { itemType: 'payment_info', shouldAffectInventory: false, confidence: 0.95, reason: 'payment_line' }
  }
  if (features.isSummaryLine) {
    return { itemType: 'summary_line', shouldAffectInventory: false, confidence: 0.90, reason: 'summary_line' }
  }

  let inventoryScore = 0
  let serviceScore = 0

  // Inventory signals
  if (features.hasQuantity) inventoryScore += w.itemHasQuantity
  if (features.hasUnit) inventoryScore += w.itemHasUnit
  if (features.hasPrice) inventoryScore += w.itemHasPrice
  if (features.hasVat) inventoryScore += w.itemHasVat
  if (features.isInTableRegion) inventoryScore += w.itemInTableRegion
  if (features.isInventoryKeyword) inventoryScore += 0.20
  if (features.hasTechParams) inventoryScore += 0.10
  if (features.unitKnown && !features.isServiceKeyword) inventoryScore += 0.08
  if (features.mathValid) inventoryScore += 0.08
  if (features.pricePositive) inventoryScore += 0.05
  if (features.hasName && features.nameLength > 3) inventoryScore += 0.05

  // Service signals
  if (features.isServiceKeyword) {
    serviceScore += 0.55
    inventoryScore = Math.max(0, inventoryScore - 0.30)
  }

  // False positive penalty
  if (features.falsePositiveRisk > 0.5) {
    inventoryScore = Math.max(0, inventoryScore * (1 - features.falsePositiveRisk))
  }

  let itemType = 'unknown'
  let confidence = 0.3
  let reason = 'score_based'

  if (serviceScore > inventoryScore && serviceScore > 0.3) {
    itemType = 'service_item'
    confidence = Math.min(0.95, serviceScore)
    reason = 'service_keyword_dominant'
  } else if (inventoryScore > 0.35 && features.hasQuantity && features.hasPrice) {
    itemType = 'inventory_item'
    confidence = Math.min(0.95, inventoryScore)
    reason = 'inventory_signals'
  } else if (inventoryScore > 0.20) {
    itemType = 'cost_item'
    confidence = Math.min(0.80, inventoryScore)
    reason = 'weak_inventory_signals'
  } else if (features.hasPrice && !features.hasQuantity) {
    itemType = 'fee_item'
    confidence = 0.50
    reason = 'price_no_quantity'
  }

  return {
    itemType,
    confidence: Math.max(0, Math.min(1, confidence)),
    reason,
  }
}

// ── shouldAffectInventory scoring ─────────────────────────────────────────────

export function scoreShouldAffectInventory(itemFeatures, documentType, config) {
  const cfg = config || getInvoiceModelConfig()
  const thr = cfg.thresholds

  // Hard rules — guardy mają pierwszeństwo
  if (SERVICE_DOC_TYPES.has(documentType)) {
    return { shouldAffectInventory: false, confidence: 0.99, reason: 'service_document_type' }
  }
  if (itemFeatures.isForbiddenLine || itemFeatures.isPaymentLine || itemFeatures.isSummaryLine) {
    return { shouldAffectInventory: false, confidence: 0.99, reason: 'forbidden_or_summary' }
  }
  if (itemFeatures.isServiceKeyword) {
    return { shouldAffectInventory: false, confidence: 0.90, reason: 'service_keyword' }
  }

  const itemScoring = scoreItemType(itemFeatures, cfg)

  if (itemScoring.itemType !== 'inventory_item') {
    return {
      shouldAffectInventory: false,
      confidence: itemScoring.confidence,
      reason: `non_inventory_type_${itemScoring.itemType}`,
    }
  }

  if (itemScoring.confidence >= thr.inventoryEffectConfidence) {
    return {
      shouldAffectInventory: true,
      confidence: itemScoring.confidence,
      reason: 'inventory_item_high_confidence',
    }
  }

  return {
    shouldAffectInventory: false,
    confidence: itemScoring.confidence,
    reason: 'inventory_item_low_confidence',
  }
}

// ── Product candidate scoring ─────────────────────────────────────────────────

export function scoreProductCandidate(matchFeatures, config) {
  const cfg = config || getInvoiceModelConfig()
  const w = cfg.weights
  const thr = cfg.thresholds

  // Hard short-circuits
  if (matchFeatures.exactMatch) {
    return { score: 1.0, confidenceLabel: 'strong', reasons: ['exact_match'], warnings: [] }
  }
  if (matchFeatures.globalAliasMatch) {
    return { score: 0.98, confidenceLabel: 'strong', reasons: ['global_alias'], warnings: [] }
  }
  if (matchFeatures.supplierAliasMatch) {
    return { score: 0.95, confidenceLabel: 'strong', reasons: ['supplier_alias'], warnings: [] }
  }

  let score = 0
  const reasons = []
  const warnings = []

  if (matchFeatures.tokenOverlap > 0) {
    score += matchFeatures.tokenOverlap * w.productNameTokenOverlap
    reasons.push(`token_overlap:${Math.round(matchFeatures.tokenOverlap * 100)}%`)
  }
  if (matchFeatures.normalizedContains && !matchFeatures.exactMatch) {
    score += 0.20
    reasons.push('contains_match')
  }
  if (matchFeatures.techParamMatch) {
    score += w.productTechParams * 0.6
    reasons.push('tech_param_match')
  }
  if (matchFeatures.techParamConflict) {
    score += w.productConflictPenalty
    warnings.push('tech_param_conflict')
  }
  if (matchFeatures.brandMatch) {
    score += w.productBrandMatch * 0.5
    reasons.push('brand_match')
  }
  if (matchFeatures.unitMatch) {
    score += w.productUnitMatch
    reasons.push('unit_match')
  }
  if (matchFeatures.categoryMatch) {
    score += w.productCategoryMatch
    reasons.push('category_match')
  }
  if (matchFeatures.nameLengthPenalty > 0) {
    score -= matchFeatures.nameLengthPenalty
    warnings.push('name_too_long')
  }
  if (matchFeatures.genericTokenPenalty > 0) {
    score -= matchFeatures.genericTokenPenalty
    warnings.push('generic_name')
  }

  // TF-IDF signal — additive boost when there is real token overlap in the index
  if (matchFeatures.tfIdfScore > 0) {
    score += matchFeatures.tfIdfScore * (w.productTfIdfScore ?? 0.15)
    reasons.push(`tfidf:${Math.round(matchFeatures.tfIdfScore * 100)}%`)
  }

  const finalScore = Math.max(0, Math.min(1, score))
  let confidenceLabel = 'weak'
  if (finalScore >= thr.productStrongMatch) confidenceLabel = 'strong'
  else if (finalScore >= thr.productReviewMatch) confidenceLabel = 'review'

  return { score: finalScore, confidenceLabel, reasons, warnings }
}

// ── Rank product candidates ───────────────────────────────────────────────────

export function rankProductCandidates(rawName, products, context, config) {
  const cfg = config || getInvoiceModelConfig()

  if (!rawName || !Array.isArray(products) || products.length === 0) {
    return { best: null, candidates: [] }
  }

  // Service/cost/fee items never get product matches
  if (context?.itemType && ['service_item', 'cost_item', 'fee_item', 'summary_line', 'payment_info'].includes(context.itemType)) {
    return { best: null, candidates: [] }
  }

  // Compute TF-IDF scores once for the whole candidate set (cached per products reference)
  let tfIdfScoreMap = null
  try {
    const idx = getOrBuildTfIdfIndex(products)
    if (idx) {
      const tfResults = queryTfIdf(rawName, idx, products.length)
      tfIdfScoreMap = new Map(tfResults.map(r => [r.productId, r.score]))
    }
  } catch { /* non-critical: TF-IDF failure must not break existing matching */ }

  const scored = products.map(product => {
    const matchFeatures = extractProductMatchFeatures(rawName, product, {
      unit: context?.unit,
      supplierNip: context?.supplierNip,
      currentPrice: context?.cenaNetto,
      typicalPrice: context?.typicalPrice,
    })
    // Attach TF-IDF score as an additional signal (0 when unavailable → no effect)
    matchFeatures.tfIdfScore = tfIdfScoreMap?.get(product.id) ?? 0
    const { score, confidenceLabel, reasons, warnings } = scoreProductCandidate(matchFeatures, cfg)
    return { product, score, confidenceLabel, reasons, warnings, features: matchFeatures }
  })

  scored.sort((a, b) => b.score - a.score)
  const top5 = scored.slice(0, 5)
  const best = top5[0]?.score >= cfg.thresholds.productReviewMatch ? top5[0] : null

  return { best, candidates: top5 }
}

// ── Extraction risk scoring ───────────────────────────────────────────────────

export function scoreExtractionRisk(metrics) {
  if (!metrics) return { riskScore: 1.0, riskLevel: 'high', reasons: [] }

  let riskScore = 0
  const reasons = []

  if (!metrics.mathValid) { riskScore += 0.30; reasons.push('math_invalid') }
  if (metrics.errorsCount > 0) {
    riskScore += Math.min(metrics.errorsCount * 0.15, 0.45)
    reasons.push(`${metrics.errorsCount}_errors`)
  }
  if (metrics.confidence < 60) { riskScore += 0.30; reasons.push('low_confidence') }
  else if (metrics.confidence < 85) { riskScore += 0.10; reasons.push('medium_confidence') }
  if (metrics.unknownItemCount > 0) {
    riskScore += Math.min(metrics.unknownItemCount * 0.10, 0.30)
    reasons.push(`${metrics.unknownItemCount}_unknown_items`)
  }
  if (metrics.documentType === 'unknown') { riskScore += 0.20; reasons.push('unknown_doc_type') }
  if (metrics.warningsCount > 3) { riskScore += 0.10; reasons.push('many_warnings') }

  const finalRisk = Math.min(1, riskScore)
  let riskLevel = 'low'
  if (finalRisk > 0.5) riskLevel = 'high'
  else if (finalRisk > 0.25) riskLevel = 'medium'

  return { riskScore: finalRisk, riskLevel, reasons }
}

// ── Shadow mode: run model on full extraction result ──────────────────────────
// Returns modelSuggestions object — does NOT modify the extraction result.

export function runShadowModelOnResult(extractionResult, products, config) {
  const cfg = config || getInvoiceModelConfig()

  if (!extractionResult) return null
  if (cfg.mode === 'off') return null

  try {
    const docFeatures = extractDocumentFeatures(extractionResult)
    const docScoring = scoreDocumentType(docFeatures, cfg)

    const pozycje = extractionResult.fields?.pozycje || []
    const itemSuggestions = pozycje.map(item => {
      const itemFeatures = extractItemFeatures(item)
      const itemScoring = scoreItemType(itemFeatures, cfg)
      const invScoring = scoreShouldAffectInventory(itemFeatures, extractionResult.documentType, cfg)

      let productRanking = { best: null, candidates: [] }
      if (
        cfg.mode !== 'off' &&
        itemScoring.itemType === 'inventory_item' &&
        Array.isArray(products) && products.length > 0
      ) {
        productRanking = rankProductCandidates(
          item.rawName || '',
          products,
          {
            itemType: itemScoring.itemType,
            unit: item.jednostka || item.unit,
            supplierNip: extractionResult.fields?.kontrahent_nip,
            cenaNetto: item.cenaNetto ?? item.unitPriceNet,
          },
          cfg
        )
      }

      // Disagreement detection (shadow mode)
      const legacyItemType = item.itemType
      const modelItemType = itemScoring.itemType
      const matchDisagreement =
        legacyItemType && modelItemType &&
        legacyItemType !== 'unknown' && modelItemType !== 'unknown' &&
        legacyItemType !== modelItemType

      return {
        rawName: item.rawName,
        modelItemType: itemScoring.itemType,
        modelItemTypeConfidence: itemScoring.confidence,
        modelShouldAffectInventory: invScoring.shouldAffectInventory,
        modelInventoryConfidence: invScoring.confidence,
        topCandidates: productRanking.candidates,
        bestCandidate: productRanking.best,
        modelScore: productRanking.best?.score ?? 0,
        matchDisagreement,
        features: itemFeatures,
      }
    })

    return {
      modelVersion: cfg.version,
      modelMode: cfg.mode,
      documentType: docScoring.documentType,
      documentTypeConfidence: docScoring.confidence,
      documentScores: docScoring.scores,
      itemSuggestions,
      computedAt: Date.now(),
    }
  } catch (e) {
    if (import.meta.env?.DEV) console.error('[invoiceScoringEngine] Shadow model error:', e)
    return null
  }
}
