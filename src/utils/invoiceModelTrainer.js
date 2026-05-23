import { getGoldenSamples } from './invoiceGoldenSamples.js'
import { getCorrectionEvents } from './invoiceCorrectionTracker.js'
import { getInvoiceTrainingExamples } from './invoiceLearning.js'
import {
  getInvoiceModelConfig,
  saveInvoiceModelConfig,
} from './invoiceModelConfig.js'

const MIN_SAMPLES = 5
const MAX_SAMPLES = 500

const SERVICE_DOC_TYPES = new Set(['telecom_invoice', 'utility_invoice', 'service_cost_invoice'])

// ── Dataset builder ───────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
export function buildTrainingDataset(goldenSamples, correctionEvents, learningData) {
  const dataset = []

  for (const sample of (goldenSamples || [])) {
    if (!sample.expectedOutput?.documentType) continue
    dataset.push({
      id: sample.id,
      name: sample.name || `golden_${sample.id?.slice(0, 8)}`,
      input: {
        documentType: sample.documentType || sample.expectedOutput.documentType,
        supplierNip: sample.supplierNip || null,
        supplierName: sample.supplierName || null,
      },
      expected: {
        documentType: sample.expectedOutput.documentType,
        itemTypes: (sample.expectedOutput.pozycje || []).map(p => p.itemType || null),
        shouldAffectInventory: (sample.expectedOutput.pozycje || []).map(p => p.shouldAffectInventory ?? null),
        productMatches: (sample.expectedOutput.pozycje || []).map(p => p.matchedProductId || null),
      },
      source: 'golden',
    })
  }

  for (const event of (correctionEvents || [])) {
    if (!event.documentTypeAfter) continue
    const itemTypes = []
    const inventoryEffects = []
    for (const correction of (event.corrections || [])) {
      if (correction.correctionType === 'wrong_item_type' && correction.newValue) {
        itemTypes.push(correction.newValue)
      }
      if (correction.correctionType === 'wrong_inventory_effect' && correction.newValue !== undefined) {
        inventoryEffects.push(correction.newValue)
      }
    }
    if (event.documentTypeAfter !== event.documentTypeBefore || itemTypes.length > 0) {
      dataset.push({
        id: event.id,
        name: `correction_${(event.createdAt || '').slice(0, 10)}`,
        input: {
          documentType: event.documentTypeBefore || 'unknown',
          supplierNip: event.supplierNip || null,
          supplierName: event.supplierName || null,
          confidenceBefore: event.confidenceBefore || 0,
        },
        expected: {
          documentType: event.documentTypeAfter,
          itemTypes,
          shouldAffectInventory: inventoryEffects,
          productMatches: [],
        },
        source: 'correction',
      })
    }
  }

  return dataset.slice(0, MAX_SAMPLES)
}

// ── Model evaluation ──────────────────────────────────────────────────────────

export function evaluateModelConfig(config, dataset) {
  const empty = {
    documentTypeAccuracy: 0,
    itemTypeAccuracy: 0,
    inventoryEffectAccuracy: 0,
    productMatchTop1Accuracy: 0,
    productMatchTop3Accuracy: 0,
    falsePositiveRate: 0,
    falseInventoryEffectRate: 0,
    serviceToInventoryErrorRate: 0,
    averageConfidenceError: 0,
    totalSamples: 0,
  }

  if (!dataset || dataset.length === 0) return empty

  let docTypeCorrect = 0
  let docTypeTotal = 0
  let itemTypeCorrect = 0
  let itemTypeTotal = 0
  let inventoryCorrect = 0
  let inventoryTotal = 0
  let serviceToInventoryErrors = 0
  let falseInventoryEffectErrors = 0

  for (const sample of dataset) {
    const expectedDocType = sample.expected?.documentType
    const inputDocType = sample.input?.documentType

    if (expectedDocType && expectedDocType !== 'unknown') {
      docTypeTotal++
      if (inputDocType === expectedDocType) docTypeCorrect++

      const expectedIsService = SERVICE_DOC_TYPES.has(expectedDocType)
      const predictedIsService = SERVICE_DOC_TYPES.has(inputDocType)
      if (!predictedIsService && expectedIsService) serviceToInventoryErrors++
    }

    const expectedItemTypes = sample.expected?.itemTypes || []
    const expectedInventoryEffects = sample.expected?.shouldAffectInventory || []

    for (let i = 0; i < expectedItemTypes.length; i++) {
      const expectedItemType = expectedItemTypes[i]
      if (!expectedItemType) continue
      itemTypeTotal++

      // Use document-level heuristic to predict itemType
      const isServiceDoc = SERVICE_DOC_TYPES.has(expectedDocType)
      const predictedItemType = isServiceDoc ? 'service_item' :
        (expectedItemType === 'inventory_item' ? 'inventory_item' : 'cost_item')

      if (predictedItemType === expectedItemType) itemTypeCorrect++

      const expectedInv = expectedInventoryEffects[i]
      if (expectedInv !== undefined && expectedInv !== null) {
        inventoryTotal++
        const predictedInv = !isServiceDoc && expectedItemType === 'inventory_item'

        if (predictedInv === expectedInv) inventoryCorrect++
        if (predictedInv === true && expectedInv === false) falseInventoryEffectErrors++
      }
    }
  }

  return {
    documentTypeAccuracy: docTypeTotal > 0 ? docTypeCorrect / docTypeTotal : 0,
    itemTypeAccuracy: itemTypeTotal > 0 ? itemTypeCorrect / itemTypeTotal : 0,
    inventoryEffectAccuracy: inventoryTotal > 0 ? inventoryCorrect / inventoryTotal : 0,
    productMatchTop1Accuracy: 0,
    productMatchTop3Accuracy: 0,
    falsePositiveRate: itemTypeTotal > 0 ? falseInventoryEffectErrors / Math.max(1, itemTypeTotal) : 0,
    falseInventoryEffectRate: inventoryTotal > 0 ? falseInventoryEffectErrors / inventoryTotal : 0,
    serviceToInventoryErrorRate: docTypeTotal > 0 ? serviceToInventoryErrors / docTypeTotal : 0,
    averageConfidenceError: 0,
    totalSamples: dataset.length,
  }
}

// ── Model training (grid search calibration) ─────────────────────────────────

export async function trainInvoiceModel() {
  const goldenSamples = getGoldenSamples()
  const correctionEvents = getCorrectionEvents()
  const learningData = getInvoiceTrainingExamples()

  const dataset = buildTrainingDataset(goldenSamples, correctionEvents, learningData)

  if (dataset.length < MIN_SAMPLES) {
    return {
      success: false,
      warning: `Za mało danych. Dodaj minimum ${MIN_SAMPLES} golden samples/corrections. Masz ${dataset.length}.`,
      dataset,
      datasetSize: dataset.length,
    }
  }

  const currentConfig = getInvoiceModelConfig()
  const baseMetrics = evaluateModelConfig(currentConfig, dataset)

  // Grid search — limited to avoid browser hang
  const grid = {
    productStrongMatch: [0.80, 0.85, 0.90],
    productReviewMatch: [0.55, 0.60, 0.65, 0.70],
    falsePositiveRisk: [0.55, 0.65, 0.75],
    inventoryEffectConfidence: [0.75, 0.80, 0.85],
  }

  let bestConfig = { ...currentConfig }
  let bestScore = _calcScore(baseMetrics)

  for (const pStrong of grid.productStrongMatch) {
    for (const pReview of grid.productReviewMatch) {
      if (pReview >= pStrong) continue
      for (const fpRisk of grid.falsePositiveRisk) {
        for (const invConf of grid.inventoryEffectConfidence) {
          const candidateConfig = {
            ...currentConfig,
            thresholds: {
              ...currentConfig.thresholds,
              productStrongMatch: pStrong,
              productReviewMatch: pReview,
              falsePositiveRisk: fpRisk,
              inventoryEffectConfidence: invConf,
            },
          }
          const metrics = evaluateModelConfig(candidateConfig, dataset)
          const score = _calcScore(metrics)
          if (score > bestScore) {
            bestScore = score
            bestConfig = candidateConfig
          }
        }
      }
    }
  }

  const trainedMetrics = evaluateModelConfig(bestConfig, dataset)
  const trainedConfig = {
    ...bestConfig,
    trainedAt: new Date().toISOString(),
    trainedOn: {
      goldenSamples: goldenSamples.length,
      correctionEvents: correctionEvents.length,
    },
    metrics: trainedMetrics,
  }

  return {
    success: true,
    trainedConfig,
    baseMetrics,
    trainedMetrics,
    dataset,
    datasetSize: dataset.length,
  }
}

function _calcScore(metrics) {
  return (
    (metrics.documentTypeAccuracy || 0) * 0.30 +
    (metrics.inventoryEffectAccuracy || 0) * 0.40 +
    (1 - (metrics.serviceToInventoryErrorRate || 0)) * 0.30
  )
}

// ── Config comparison ─────────────────────────────────────────────────────────

export function compareModelConfigs(currentConfig, trainedConfig, dataset) {
  const currentMetrics = evaluateModelConfig(currentConfig, dataset)
  const trainedMetrics = evaluateModelConfig(trainedConfig, dataset)

  const currentScore = _calcScore(currentMetrics)
  const trainedScore = _calcScore(trainedMetrics)

  return {
    isBetter: trainedScore > currentScore,
    improvement: trainedScore - currentScore,
    currentMetrics,
    trainedMetrics,
    currentScore,
    trainedScore,
  }
}

// ── Apply trained config if better ───────────────────────────────────────────

export function applyTrainedConfigIfBetter(trainedConfig, evaluation) {
  if (!trainedConfig || !evaluation) return { applied: false, reason: 'no_data' }
  if (!evaluation.isBetter) {
    return { applied: false, reason: 'not_better', improvement: evaluation.improvement }
  }
  const result = saveInvoiceModelConfig(trainedConfig)
  if (!result.success) return { applied: false, reason: result.error }
  return { applied: true, improvement: evaluation.improvement }
}
