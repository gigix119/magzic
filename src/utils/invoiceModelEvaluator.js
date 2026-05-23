import { getGoldenSamples } from './invoiceGoldenSamples.js'
import { getCorrectionEvents } from './invoiceCorrectionTracker.js'
import { getInvoiceModelConfig } from './invoiceModelConfig.js'
import { buildTrainingDataset, evaluateModelConfig } from './invoiceModelTrainer.js'
import { rankProductCandidates } from './invoiceScoringEngine.js'

const SERVICE_DOC_TYPES = new Set(['telecom_invoice', 'utility_invoice', 'service_cost_invoice'])

// ── Per-source evaluation ─────────────────────────────────────────────────────

export function evaluateGoldenSamples(config, products = []) {
  const cfg = config || getInvoiceModelConfig()
  const samples = getGoldenSamples()
  if (!samples.length) {
    return { totalSamples: 0, note: 'Brak golden samples' }
  }
  const dataset = buildTrainingDataset(samples, [], [])
  return evaluateModelConfig(cfg, dataset, Array.isArray(products) ? products : [])
}

export function evaluateCorrectionEvents(config) {
  const cfg = config || getInvoiceModelConfig()
  const events = getCorrectionEvents()
  if (!events.length) {
    return { totalSamples: 0, note: 'Brak correction events' }
  }
  const dataset = buildTrainingDataset([], events, [])
  return evaluateModelConfig(cfg, dataset)
}

// ── Full evaluation run ───────────────────────────────────────────────────────

export function runInvoiceModelEvaluation({ products } = {}) {
  const config = getInvoiceModelConfig()
  const goldenSamples = getGoldenSamples()
  const correctionEvents = getCorrectionEvents()

  const productsList = Array.isArray(products) ? products : []
  const dataset = buildTrainingDataset(goldenSamples, correctionEvents, [])
  const metrics = evaluateModelConfig(config, dataset, productsList)

  // Product match evaluation — only when products list is available
  let top1Correct = 0
  let top3Correct = 0
  let productMatchTotal = 0
  const productMatchEvaluationAvailable = productsList.length > 0

  if (productMatchEvaluationAvailable) {
    for (const sample of goldenSamples) {
      const pozycje = sample.expectedOutput?.pozycje || []
      for (const poz of pozycje) {
        if (!poz.rawName || !poz.expectedProductId) continue
        try {
          const ranking = rankProductCandidates(
            poz.rawName,
            productsList,
            {
              itemType: poz.expectedItemType || poz.itemType || 'inventory_item',
              unit: poz.jednostka,
              supplierNip: sample.supplierNip,
              cenaNetto: poz.cenaNetto,
            },
            config
          )
          productMatchTotal++
          const topIds = ranking.candidates.map(c => c.product?.id)
          if (topIds[0] === poz.expectedProductId) top1Correct++
          if (topIds.slice(0, 3).includes(poz.expectedProductId)) top3Correct++
        } catch { /* ignore */ }
      }
    }
  }

  const productMatchMetrics = productMatchTotal > 0
    ? {
        productMatchTop1Accuracy: top1Correct / productMatchTotal,
        productMatchTop3Accuracy: top3Correct / productMatchTotal,
      }
    : { productMatchTop1Accuracy: 0, productMatchTop3Accuracy: 0 }

  const failures = []

  for (const sample of goldenSamples) {
    const expectedDocType = sample.expectedOutput?.documentType
    if (!expectedDocType) continue

    const inputDocType = sample.documentType || expectedDocType
    if (inputDocType !== expectedDocType && inputDocType !== 'unknown') {
      failures.push({
        sampleId: sample.id,
        name: sample.name || sample.id,
        expected: { documentType: expectedDocType },
        actual: { documentType: inputDocType },
        errorType: 'wrong_document_type',
        message: `Expected ${expectedDocType}, got ${inputDocType}`,
      })
    }

    const pozycje = sample.expectedOutput?.pozycje || []
    for (let i = 0; i < pozycje.length; i++) {
      const poz = pozycje[i]
      const itemType = poz.expectedItemType || poz.itemType
      if (!itemType) continue

      const isServiceDoc = SERVICE_DOC_TYPES.has(expectedDocType)
      const expectedShouldAffect = poz.expectedShouldAffectInventory ?? poz.shouldAffectInventory

      if (isServiceDoc && expectedShouldAffect === true) {
        failures.push({
          sampleId: sample.id,
          name: sample.name || sample.id,
          expected: { shouldAffectInventory: false, documentType: expectedDocType },
          actual: { shouldAffectInventory: true },
          errorType: 'wrong_inventory_effect',
          message: `Item ${i} in ${expectedDocType} has shouldAffectInventory=true (service doc)`,
        })
      }

      if (isServiceDoc && itemType === 'inventory_item') {
        failures.push({
          sampleId: sample.id,
          name: sample.name || sample.id,
          expected: { itemType: 'service_item' },
          actual: { itemType: 'inventory_item' },
          errorType: 'false_positive_item',
          message: `Item "${poz.nazwa || poz.rawName || '?'}" classified as inventory_item in service document`,
        })
      }
    }
  }

  for (const event of correctionEvents) {
    if (!event.documentTypeAfter) continue
    const isServiceDocAfter = SERVICE_DOC_TYPES.has(event.documentTypeAfter)

    for (const correction of (event.corrections || [])) {
      if (
        correction.correctionType === 'wrong_inventory_effect' &&
        correction.newValue === false &&
        correction.oldValue === true &&
        isServiceDocAfter
      ) {
        failures.push({
          sampleId: event.id,
          name: `correction_event_${(event.createdAt || '').slice(0, 10)}`,
          expected: { shouldAffectInventory: false },
          actual: { shouldAffectInventory: true },
          errorType: 'wrong_inventory_effect',
          message: `Correction: service doc item had shouldAffectInventory=true for ${event.documentTypeAfter}`,
        })
      }

      if (correction.correctionType === 'wrong_item_type' && correction.newValue) {
        if (
          correction.oldValue === 'inventory_item' &&
          ['service_item', 'cost_item', 'fee_item'].includes(correction.newValue)
        ) {
          failures.push({
            sampleId: event.id,
            name: `correction_event_${(event.createdAt || '').slice(0, 10)}`,
            expected: { itemType: correction.newValue },
            actual: { itemType: correction.oldValue },
            errorType: 'wrong_item_type',
            message: `Item was inventory_item, corrected to ${correction.newValue}`,
          })
        }
      }
    }
  }

  return {
    totalSamples: dataset.length,
    passed: Math.max(0, dataset.length - failures.length),
    failed: failures.length,
    metrics: { ...metrics, ...productMatchMetrics },
    productMatchEvaluationAvailable,
    productMatchTotal,
    failures,
    config: { mode: config.mode, version: config.version },
    evaluatedAt: new Date().toISOString(),
  }
}

// ── Report formatter ──────────────────────────────────────────────────────────

export function formatEvaluationReport(evaluation) {
  if (!evaluation) return 'Brak wyników ewaluacji.'

  const m = evaluation.metrics || {}
  const pct = (v) => `${((v || 0) * 100).toFixed(1)}%`

  const lines = [
    `Ewaluacja modelu — ${(evaluation.evaluatedAt || '').slice(0, 19) || '—'}`,
    `Próbki: ${evaluation.totalSamples}  OK: ${evaluation.passed}  Błędy: ${evaluation.failed}`,
    '',
    `Klasyfikacja dokumentu:      ${pct(m.documentTypeAccuracy)}`,
    `Klasyfikacja pozycji:        ${pct(m.itemTypeAccuracy)}`,
    `Efekt magazynowy:            ${pct(m.inventoryEffectAccuracy)}`,
  ]

  if (evaluation.productMatchEvaluationAvailable && (evaluation.productMatchTotal || 0) > 0) {
    lines.push(`Top-1 dopasowanie produktu:  ${pct(m.productMatchTop1Accuracy)} (n=${evaluation.productMatchTotal})`)
    lines.push(`Top-3 dopasowanie produktu:  ${pct(m.productMatchTop3Accuracy)}`)
  } else {
    lines.push('Top-1 dopasowanie produktu:  n/a (brak expectedProductId lub listy produktów)')
  }

  lines.push(
    `Wskaźnik false positive:     ${pct(m.falsePositiveRate)}`,
    `Błędy usługa→magazyn:        ${pct(m.serviceToInventoryErrorRate)}`,
  )

  if (evaluation.failures?.length > 0) {
    lines.push('', `Błędy (${evaluation.failures.length}):`)
    for (const f of evaluation.failures.slice(0, 10)) {
      lines.push(`  ❌ [${f.errorType}] ${f.name}: ${f.message}`)
    }
    if (evaluation.failures.length > 10) {
      lines.push(`  … i ${evaluation.failures.length - 10} więcej`)
    }
  } else if (evaluation.totalSamples > 0) {
    lines.push('', '✅ Brak wykrytych błędów.')
  }

  return lines.join('\n')
}
