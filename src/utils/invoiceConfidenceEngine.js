/**
 * Deterministic Confidence Score + Auto-Approval Engine for invoice product matching.
 *
 * Combines alias learning signals, TF-IDF/shadow-model scores, exact-name checks,
 * and ambiguity detection to produce a single confidence assessment per matched item.
 *
 * Zero external AI — fully in-process, no network calls.
 */

import { getInvoiceModelConfig } from './invoiceModelConfig.js'
import { normalizeText } from './invoiceTfIdf.js'

// ── Shared helpers ────────────────────────────────────────────────────────────

const _empty = (blockers = []) => ({
  confidence: 0, level: 'none', reasons: [], blockers, autoApproved: false,
})

function _thresholds(cfg) {
  const t = (cfg && cfg.confidenceThresholds) || {}
  return {
    high:                       t.high                       ?? 0.90,
    medium:                     t.medium                     ?? 0.60,
    autoApprove:                t.autoApprove                ?? 0.90,
    aliasAutoApproveUsageCount: t.aliasAutoApproveUsageCount ?? 3,
  }
}

function _finalize(rawConf, reasons, blockers, productExists, thr) {
  const confidence = Math.round(Math.max(0, Math.min(1, rawConf)) * 1000) / 1000

  let level
  if      (confidence >= thr.high)   level = 'high'
  else if (confidence >= thr.medium) level = 'medium'
  else if (confidence > 0.01)        level = 'low'
  else                               level = 'none'

  const autoApproved = (
    level === 'high' &&
    confidence >= thr.autoApprove &&
    blockers.length === 0 &&
    !!productExists
  )

  return {
    confidence,
    level,
    reasons:  [...new Set(reasons)],
    blockers: [...new Set(blockers)],
    autoApproved,
  }
}

// ── Lower-level: raw matchFeatures input ──────────────────────────────────────

/**
 * Compute confidence from raw match-feature vector (invoiceFeatureExtractor output,
 * augmented with aliasScore + tfIdfScore from the scoring engine).
 *
 * @param {object} matchFeatures
 * @param {object} context
 * @param {string} context.invoiceName
 * @param {object|null} context.product
 * @param {object[]} [context.allCandidates]
 * @param {number}   [context.aliasUsageCount]
 * @param {object}   [context.config]
 * @returns {{ confidence, level, reasons, blockers, autoApproved }}
 */
export function calculateMatchConfidence(matchFeatures, context = {}) {
  try {
    return _fromMatchFeatures(matchFeatures, context)
  } catch {
    return _empty(['confidence_engine_error'])
  }
}

function _fromMatchFeatures(matchFeatures, context) {
  if (!matchFeatures || typeof matchFeatures !== 'object') {
    return _empty(['missing_product'])
  }

  const cfg = context.config || getInvoiceModelConfig()
  const thr = _thresholds(cfg)

  const invoiceName = String(context.invoiceName || '').trim()
  if (!invoiceName) return _empty(['empty_invoice_name'])
  if (!context.product) return _empty(['missing_product'])

  const reasons  = []
  const blockers = []
  let   conf     = 0

  const aliasUsageCount = context.aliasUsageCount ?? 0
  const aliasScore      = matchFeatures.aliasScore ?? 0
  const tfIdfScore      = matchFeatures.tfIdfScore ?? 0
  const overallScore    = matchFeatures.score ?? 0
  const tokenOverlap    = matchFeatures.tokenOverlap ?? 0

  // Alias signals
  if (aliasScore >= 1.0) {
    conf += 0.80
    reasons.push('alias_match')
    if (aliasUsageCount >= thr.aliasAutoApproveUsageCount) {
      conf += 0.15
      reasons.push('alias_used_multiple_times')
    } else if (aliasUsageCount >= 1) {
      conf += 0.05 * Math.min(aliasUsageCount, 2)
      reasons.push('alias_used_once')
    }
  } else if (matchFeatures.globalAliasMatch || matchFeatures.supplierAliasMatch) {
    conf += 0.70
    reasons.push('alias_match')
  }

  // Exact name match
  if (matchFeatures.exactMatch) {
    conf = Math.max(conf, 0.95)
    reasons.push('exact_name_match')
  }

  // TF-IDF score (max-based so strong signals dominate without over-stacking)
  if (tfIdfScore >= 0.85) {
    conf = Math.max(conf, 0.70)
    reasons.push('strong_tfidf_match')
  } else if (tfIdfScore >= 0.60) {
    conf = Math.max(conf, 0.45)
    reasons.push('moderate_tfidf_match')
  }

  // Overall scoring signal
  if (overallScore >= 0.85) {
    conf = Math.max(conf, 0.80)
    reasons.push('strong_existing_score')
  } else if (overallScore >= 0.65) {
    conf = Math.max(conf, 0.55)
    reasons.push('moderate_existing_score')
  } else if (overallScore > 0.01) {
    conf = Math.max(conf, overallScore * 0.3)
  }

  // Technical parameters
  if (matchFeatures.techParamMatch && !matchFeatures.techParamConflict) {
    conf += 0.10
    reasons.push('technical_tokens_match')
  }
  if (matchFeatures.techParamConflict) {
    conf -= 0.20
    blockers.push('tech_param_conflict')
  }

  // Token overlap boost
  if (tokenOverlap >= 0.70) {
    conf += 0.10
    reasons.push('high_token_overlap')
  }

  // Ambiguity check
  const candidates = Array.isArray(context.allCandidates) ? context.allCandidates : []
  if (candidates.length >= 2) {
    const [top, second] = candidates
    if (top && second && (top.score || 0) > 0 &&
        Math.abs((top.score || 0) - (second.score || 0)) < 0.10) {
      blockers.push('ambiguous_candidates')
      conf -= 0.10
    }
  }

  // Low-score blocker
  if (aliasScore < 1 && !matchFeatures.exactMatch && overallScore < 0.30) {
    blockers.push('low_score')
  }

  return _finalize(conf, reasons, blockers, context.product, thr)
}

// ── Higher-level: enriched item input ────────────────────────────────────────

/**
 * Compute confidence from a fully-enriched extracted invoice item
 * (after alias lookup, shadow-model merge, etc.).
 *
 * This is the primary entry point called from Faktury.jsx.
 *
 * @param {object}   item            - enriched invoice position
 * @param {object[]} [allCandidates] - top candidate list for ambiguity detection
 * @param {object}   [configOverride]- optional config override (for tests)
 * @returns {{ confidence, level, reasons, blockers, autoApproved }}
 */
export function calculateItemConfidence(item, allCandidates = [], configOverride = null) {
  try {
    return _fromItem(item, allCandidates, configOverride)
  } catch {
    return _empty(['confidence_engine_error'])
  }
}

function _fromItem(item, allCandidates, configOverride) {
  if (!item || typeof item !== 'object') return _empty()

  const cfg = configOverride || getInvoiceModelConfig()
  const thr = _thresholds(cfg)

  const invoiceName = String(item.rawName || item.nazwa || '').trim()
  if (!invoiceName) return _empty(['empty_invoice_name'])

  // Service / cost items: confidence is not applicable for inventory matching
  if (item.itemType === 'service_item' || item.shouldAffectInventory === false) {
    return {
      confidence: 0.50, level: 'medium',
      reasons: ['service_item'], blockers: [], autoApproved: false,
    }
  }

  if (!item.matchedProductId) return _empty(['missing_product'])

  const reasons  = []
  const blockers = []
  let   conf     = 0

  const isAliasMatch    = item.matchingSource === 'alias_learned'
  const aliasUsageCount = item.aliasUsageCount ?? 0
  const matchScore      = item.matchScore   ?? 0
  const modelScore      = item._modelScore  ?? 0
  const modelLabel      = item._modelLabel  || null
  const hasDisagreement = item._matchDisagreement === true

  // ── Alias signals ──────────────────────────────────────────────────────────

  if (isAliasMatch) {
    conf += 0.80
    reasons.push('alias_match')
    if (aliasUsageCount >= thr.aliasAutoApproveUsageCount) {
      conf += 0.15
      reasons.push('alias_used_multiple_times')
    } else if (aliasUsageCount >= 1) {
      conf += 0.05
      reasons.push('alias_used_once')
    }
  }

  // ── Exact normalized name match ────────────────────────────────────────────

  const normInvoice = normalizeText(invoiceName)
  const normProduct = normalizeText(item.matchedProductNazwa || '')
  if (normInvoice && normProduct && normInvoice === normProduct) {
    conf = Math.max(conf, 0.95)
    if (!reasons.includes('exact_name_match')) reasons.push('exact_name_match')
  }

  // ── Similarity score (non-alias matches) ───────────────────────────────────

  if (!isAliasMatch) {
    if (matchScore >= 0.95) {
      conf = Math.max(conf, 0.92)
      reasons.push('strong_existing_score')
    } else if (matchScore >= 0.85) {
      conf = Math.max(conf, 0.80)
      reasons.push('strong_existing_score')
    } else if (matchScore >= 0.65) {
      conf = Math.max(conf, 0.60)
      reasons.push('moderate_existing_score')
    } else if (matchScore >= 0.40) {
      conf = Math.max(conf, 0.35)
    } else if (matchScore > 0.01) {
      conf = Math.max(conf, 0.05)
    }
  }

  // ── Shadow model corroboration ─────────────────────────────────────────────

  if (modelLabel === 'strong' && modelScore >= 0.85 && !hasDisagreement) {
    conf = Math.max(conf, conf + 0.10)
    if (!reasons.includes('strong_tfidf_match')) reasons.push('strong_tfidf_match')
  } else if (modelScore >= 0.60 && !hasDisagreement) {
    conf = Math.max(conf, conf + 0.05)
  }

  // ── Negative signals ───────────────────────────────────────────────────────

  if (hasDisagreement) {
    blockers.push('conflicting_top_candidates')
    conf = Math.max(0, conf - 0.15)
  }

  if (!isAliasMatch && matchScore < 0.30 && modelScore < 0.30) {
    blockers.push('low_score')
  }

  // Ambiguity: top-2 candidates too close (only for non-alias matches)
  const candidates = allCandidates.length > 0 ? allCandidates : (item._topCandidates || [])
  if (!isAliasMatch && candidates.length >= 2) {
    const [top, second] = candidates
    if (top && second && (top.score || 0) > 0 &&
        Math.abs((top.score || 0) - (second.score || 0)) < 0.10) {
      blockers.push('ambiguous_candidates')
      conf = Math.max(0, conf - 0.10)
    }
  }

  return _finalize(conf, reasons, blockers, { id: item.matchedProductId }, thr)
}
