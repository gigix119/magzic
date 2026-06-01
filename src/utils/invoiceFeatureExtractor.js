import { normalizeProductName } from './productNormalizer.js'
import { findProductByAlias, getSupplierItemMapping } from './invoiceLearning.js'
import {
  TELECOM_SIGNALS, UTILITY_SIGNALS, INVENTORY_SIGNALS, SERVICE_ITEM_KEYWORDS,
  FORBIDDEN_AS_ITEM_KEYWORDS, PAYMENT_KEYWORDS, SUMMARY_KEYWORDS,
  INVENTORY_ITEM_KEYWORDS, KNOWN_UNITS,
} from './invoiceConstants.js'

const TECH_PARAM_PATTERNS = [
  /\b(\d+(?:[.,]\d+)?)\s*w\b/i,
  /\b(\d+(?:[.,]\d+)?)\s*ml\b/i,
  /\b(\d+(?:[.,]\d+)?)\s*l\b/i,
  /\b(\d+(?:[.,]\d+)?)\s*kg\b/i,
  /\b(\d+(?:[.,]\d+)?)\s*g\b(?!u)/i,
  /\b(\d+(?:[.,]\d+)?)\s*m2\b/i,
  /\b(\d+(?:[.,]\d+)?)\s*mb\b/i,
  /\b(g9|e27|e14|e40|b22|gu10|gu5\.?3)\b/i,
  /\b(\d{3,4})\s*x\s*(\d{3,4})\b/i,
  /\b(\d+(?:[.,]\d+)?)\s*%/,
  /\b(\d+(?:[.,]\d+)?)\s*m\b(?!2)/i,
]

export function extractTechParams(name) {
  const n = String(name || '').toLowerCase()
    .replace(/[ąćęłńóśźż]/g, c => ({ ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z' })[c] || c)
  const params = []
  for (const pat of TECH_PARAM_PATTERNS) {
    const m = n.match(pat)
    if (m) params.push(m[0].toLowerCase().replace(/\s+/g, '').replace(',', '.'))
  }
  return params
}

// ── Document features ─────────────────────────────────────────────────────────

export function extractDocumentFeatures(extractionResult) {
  if (!extractionResult) return {}

  const text = (extractionResult.rawText || '').toLowerCase()
  const validation = extractionResult.validation || {}
  const dbg = extractionResult.debug || {}

  return {
    inventorySignalsCount: INVENTORY_SIGNALS.filter(s => text.includes(s)).length,
    serviceSignalsCount: SERVICE_ITEM_KEYWORDS.filter(s => text.includes(s)).length,
    telecomSignalsCount: TELECOM_SIGNALS.filter(s => text.includes(s)).length,
    utilitySignalsCount: UTILITY_SIGNALS.filter(s => text.includes(s)).length,
    hasInventoryTable: (dbg.tableSelected?.rows ?? 0) > 0 ||
      typeof dbg.tableCandidates === 'number' && dbg.tableCandidates > 0 &&
      (dbg.tableSelected?.score ?? 0) > 0,
    hasServiceAmountTable: text.includes('kwota') && SERVICE_ITEM_KEYWORDS.some(k => text.includes(k)),
    hasPaymentTable: PAYMENT_KEYWORDS.some(k => text.includes(k)),
    hasTaxSummaryTable: text.includes('podatek vat') || text.includes('stawka vat') || text.includes('razem vat'),
    tableCandidatesCount: typeof dbg.tableCandidates === 'number' ? dbg.tableCandidates : 0,
    selectedTableConfidence: dbg.tableSelected?.score ?? 0,
    hasSupplierTemplate: !!extractionResult.supplierTemplate,
    usedSupplierTemplate: extractionResult.supplierTemplate?.name ?? null,
    hasValidNip: !!(extractionResult.fields?.kontrahent_nip || extractionResult.fields?.sprzedawca_nip),
    hasInvoiceNumber: !!extractionResult.fields?.numer,
    hasInvoiceDate: !!(extractionResult.fields?.data_zakupu || extractionResult.fields?.data_wystawienia),
    hasTotals: !!(extractionResult.fields?.suma_netto || extractionResult.fields?.suma_brutto),
    mathValid: (validation.errors?.length ?? 0) === 0,
    totalsValid: !(validation.warnings || []).some(w => w.includes('Suma')),
    warningsCount: validation.warnings?.length ?? 0,
    errorsCount: validation.errors?.length ?? 0,
  }
}

// ── Item features ─────────────────────────────────────────────────────────────

export function extractItemFeatures(item, context = {}) {
  if (!item) return {}

  const name = (item.rawName || item.nazwa || '').toLowerCase()
  const ilosc = Number(item.ilosc ?? item.quantity ?? 0)
  const cenaNetto = Number(item.cenaNetto ?? item.unitPriceNet ?? 0)
  const wartoscNetto = Number(item.wartoscNetto ?? item.totalNet ?? 0)
  const jednostka = (item.jednostka || item.unit || '').toLowerCase().replace(/\.$/, '')
  const vatVal = item.vat ?? item.vat_procent ?? null

  const isForbidden = FORBIDDEN_AS_ITEM_KEYWORDS.some(f => name.includes(f))
  const isPayment = PAYMENT_KEYWORDS.some(k => name.includes(k))
  const isSummary = SUMMARY_KEYWORDS.some(k => name.startsWith(k) || name === k)
  const isService = SERVICE_ITEM_KEYWORDS.some(k => name.includes(k))
  const isInventory = INVENTORY_ITEM_KEYWORDS.some(k => name.includes(k))
  const techParams = extractTechParams(name)

  let mathValid = true
  if (ilosc > 0 && cenaNetto > 0 && wartoscNetto > 0) {
    const expected = ilosc * cenaNetto
    mathValid = Math.abs(expected - wartoscNetto) / Math.max(wartoscNetto, 0.01) <= 0.05
  }

  // False positive risk
  let falsePositiveRisk = 0
  if (isForbidden) falsePositiveRisk = 1.0
  else if (isPayment || isSummary) falsePositiveRisk = 0.9
  else if (cenaNetto === 0 && wartoscNetto === 0) falsePositiveRisk = 0.7
  else if (!ilosc || ilosc <= 0) falsePositiveRisk = 0.5
  else if (name.length > 100) falsePositiveRisk = 0.3

  return {
    hasName: name.length > 0,
    nameLength: name.length,
    hasQuantity: ilosc > 0,
    hasUnit: !!jednostka,
    hasPrice: cenaNetto > 0,
    hasVat: vatVal !== null,
    hasGross: !!(item.wartoscBrutto || item.grossValue),
    hasNet: wartoscNetto > 0,
    isInTableRegion: context.isInTableRegion ?? ((item.confidence ?? 0) >= 0.7),
    isForbiddenLine: isForbidden,
    isPaymentLine: isPayment,
    isSummaryLine: isSummary,
    isServiceKeyword: isService,
    isInventoryKeyword: isInventory,
    hasTechParams: techParams.length > 0,
    mathValid,
    unitKnown: KNOWN_UNITS.has(jednostka),
    pricePositive: cenaNetto > 0,
    falsePositiveRisk,
  }
}

// ── Product match features ────────────────────────────────────────────────────

export function extractProductMatchFeatures(rawName, product, context = {}) {
  if (!rawName || !product) return {}

  const normRaw = normalizeProductName(rawName)
  const normProduct = normalizeProductName(product.nazwa || '')

  // Token overlap (Jaccard)
  const tokensA = new Set(normRaw.split(' ').filter(t => t.length > 2))
  const tokensB = new Set(normProduct.split(' ').filter(t => t.length > 2))
  const intersection = [...tokensA].filter(t => tokensB.has(t))
  const union = new Set([...tokensA, ...tokensB])
  const tokenOverlap = union.size > 0 ? intersection.length / union.size : 0

  const normalizedContains = !!(normRaw && normProduct && (normRaw.includes(normProduct) || normProduct.includes(normRaw)))
  const exactMatch = !!(normRaw && normProduct && normRaw === normProduct)

  // Brand match — first long word
  const wordsA = normRaw.split(' ').filter(w => w.length > 3)
  const wordsB = normProduct.split(' ').filter(w => w.length > 3)
  const brandMatch = wordsA.length > 0 && wordsB.length > 0 && wordsA[0] === wordsB[0]

  // Tech params
  const paramsRaw = extractTechParams(rawName)
  const paramsProduct = extractTechParams(product.nazwa || '')
  let techParamMatch = false
  let techParamConflict = false

  if (paramsRaw.length > 0 && paramsProduct.length > 0) {
    const matching = paramsRaw.filter(p => paramsProduct.includes(p))
    const conflicting = paramsRaw.filter(p => {
      const unit = p.replace(/[\d.]+/, '').trim()
      return unit && paramsProduct.some(pp => pp.replace(/[\d.]+/, '').trim() === unit && pp !== p)
    })
    techParamMatch = matching.length > 0
    techParamConflict = conflicting.length > 0
  }

  // Unit match
  const itemUnit = (context.unit || '').toLowerCase().replace(/\.$/, '')
  const productUnit = (product.jednostka || '').toLowerCase().replace(/\.$/, '')
  const unitMatch = !!(
    itemUnit && productUnit && (
      itemUnit === productUnit ||
      (itemUnit === 'l' && productUnit === 'litr') ||
      (itemUnit === 'szt' && productUnit === 'sztuka') ||
      (itemUnit === '0.75l' && productUnit === 'l') ||
      (itemUnit === 'litr' && productUnit === 'l')
    )
  )

  // Supplier alias match
  let supplierAliasMatch = false
  if (context.supplierNip) {
    try {
      const mappedId = getSupplierItemMapping(context.supplierNip, rawName)
      supplierAliasMatch = mappedId === product.id
    } catch { /* ignore */ }
  }

  // Global alias match
  let globalAliasMatch = false
  try {
    const aliasId = findProductByAlias(rawName)
    globalAliasMatch = aliasId === product.id
  } catch { /* ignore */ }

  // Category heuristic
  const productCategory = (product.kategoria || product.category || '').toLowerCase()
  const categoryMatch = !!(productCategory && productCategory.length > 2 && normRaw.includes(productCategory))

  // Price typicality
  let priceTypicality = 0.5
  if (context.typicalPrice && context.currentPrice) {
    const ratio = context.currentPrice / context.typicalPrice
    if (ratio > 0.5 && ratio < 2.0) {
      priceTypicality = 1.0 - Math.abs(1.0 - ratio) * 0.5
    } else {
      priceTypicality = 0.2
    }
  }

  const nameLengthPenalty = rawName.length > 80 ? 0.3 : 0
  const genericWords = ['produkt', 'towar', 'artykul', 'item', 'pozycja']
  const genericTokenPenalty = genericWords.some(w => normRaw.includes(w)) ? 0.2 : 0

  return {
    tokenOverlap,
    normalizedContains,
    exactMatch,
    brandMatch,
    techParamMatch,
    techParamConflict,
    unitMatch,
    supplierAliasMatch,
    globalAliasMatch,
    categoryMatch,
    priceTypicality,
    nameLengthPenalty,
    genericTokenPenalty,
  }
}

// ── Price alert features ──────────────────────────────────────────────────────

export function extractPriceAlertFeatures(item, priceHistory) {
  const cenaNetto = Number(item?.cenaNetto ?? item?.unitPriceNet ?? item?.cena_netto ?? 0)
  if (!cenaNetto || !priceHistory) {
    return { hasHistory: false, deviation: 0, isAnomaly: false, isHigher: false, isLower: false }
  }

  const avg = priceHistory.avg ?? priceHistory.sredniaCena ?? 0
  const last = priceHistory.last ?? priceHistory.ostatniaCena ?? 0

  const deviationFromAvg = avg > 0 ? Math.abs(cenaNetto - avg) / avg : 0
  const deviationFromLast = last > 0 ? (cenaNetto - last) / last : 0

  return {
    hasHistory: true,
    deviation: deviationFromAvg,
    isAnomaly: deviationFromAvg > 0.5,
    isHigher: deviationFromLast > 0.1,
    isLower: deviationFromLast < -0.1,
    avgPrice: avg,
    lastPrice: last,
  }
}
