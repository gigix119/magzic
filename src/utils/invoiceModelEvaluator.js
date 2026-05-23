import { getGoldenSamples } from './invoiceGoldenSamples.js'
import { getCorrectionEvents } from './invoiceCorrectionTracker.js'
import { getInvoiceModelConfig } from './invoiceModelConfig.js'
import { buildTrainingDataset, evaluateModelConfig } from './invoiceModelTrainer.js'

const SERVICE_DOC_TYPES = new Set(['telecom_invoice', 'utility_invoice', 'service_cost_invoice'])

// ── Per-source evaluation ─────────────────────────────────────────────────────

export function evaluateGoldenSamples(config) {
  const cfg = config || getInvoiceModelConfig()
  const samples = getGoldenSamples()
  if (!samples.length) {
    return { totalSamples: 0, note: 'Brak golden samples' }
  }
  const dataset = buildTrainingDataset(samples, [], [])
  return evaluateModelConfig(cfg, dataset)
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

export function runInvoiceModelEvaluation() {
  const config = getInvoiceModelConfig()
  const goldenSamples = getGoldenSamples()
  const correctionEvents = getCorrectionEvents()

  const dataset = buildTrainingDataset(goldenSamples, correctionEvents, [])
  const metrics = evaluateModelConfig(config, dataset)

  const failures = []

  // Check golden samples for specific failure patterns
  for (const sample of goldenSamples) {
    const expectedDocType = sample.expectedOutput?.documentType
    if (!expectedDocType) continue

    // Detect wrong document type
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
      if (!poz.itemType) continue

      const isServiceDoc = SERVICE_DOC_TYPES.has(expectedDocType)

      // Service doc item must not affect inventory
      if (isServiceDoc && poz.shouldAffectInventory === true) {
        failures.push({
          sampleId: sample.id,
          name: sample.name || sample.id,
          expected: { shouldAffectInventory: false, documentType: expectedDocType },
          actual: { shouldAffectInventory: true },
          errorType: 'wrong_inventory_effect',
          message: `Item ${i} in ${expectedDocType} has shouldAffectInventory=true (service doc)`,
        })
      }

      // Inventory item in service doc is a false positive
      if (isServiceDoc && poz.itemType === 'inventory_item') {
        failures.push({
          sampleId: sample.id,
          name: sample.name || sample.id,
          expected: { itemType: 'service_item' },
          actual: { itemType: 'inventory_item' },
          errorType: 'false_positive_item',
          message: `Item "${poz.nazwa || '?'}" classified as inventory_item in service document`,
        })
      }
    }
  }

  // Check correction events for service→inventory errors
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
    metrics,
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
    `Top-1 dopasowanie produktu:  ${pct(m.productMatchTop1Accuracy)}`,
    `Top-3 dopasowanie produktu:  ${pct(m.productMatchTop3Accuracy)}`,
    `Wskaźnik false positive:     ${pct(m.falsePositiveRate)}`,
    `Błędy usługa→magazyn:        ${pct(m.serviceToInventoryErrorRate)}`,
  ]

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
