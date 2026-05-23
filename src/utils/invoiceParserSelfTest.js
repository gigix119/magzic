// Clean structural self-test — no side effects, no localStorage, no top-level code.
// Returns { passed, failed, total, failures, results } and never mutates any state.

import { normalizePolishNumber, normalizeDate, normalizeVatRate } from './polishInvoicePatterns.js'
import { isForbiddenAsInvoiceItem } from './invoiceLineGuards.js'
import { classifyDocument, classifyItem } from './invoiceDocumentClassifier.js'
import { calculateConfidence } from './invoiceValidation.js'
import { findSupplierTemplate, applyItemRulesFromTemplate } from './invoiceSupplierTemplates.js'
import { advancedSimilarity } from './productNormalizer.js'
import { DEFAULT_INVOICE_MODEL_CONFIG } from './invoiceModelConfig.js'
import { extractItemFeatures, extractProductMatchFeatures } from './invoiceFeatureExtractor.js'
import { scoreItemType, scoreShouldAffectInventory, scoreProductCandidate, rankProductCandidates } from './invoiceScoringEngine.js'
import { buildTrainingDataset, evaluateModelConfig } from './invoiceModelTrainer.js'
import {
  anonymizeInvoiceText,
  buildExpectedProductMatch,
  buildGoldenSampleFromApprovedInvoice,
  buildSyntheticGoldenSample,
  extractEvaluationDatasetFromGoldenSamples,
} from './invoiceDatasetBuilder.js'

function makeRunner() {
  const results = []

  function check(name, condition, message = '') {
    const passed = !!condition
    results.push({ name, passed, message: passed ? '' : (message || `Expected truthy, got: ${condition}`) })
  }

  function approx(a, b, eps = 0.001) {
    return Math.abs(a - b) <= eps
  }

  return { check, approx, results }
}

export async function runInvoiceParserSelfTest() {
  const { check, approx, results } = makeRunner()

  // ── normalizePolishNumber ────────────────────────────────────────
  check('normalizePolishNumber 1 234,56', approx(normalizePolishNumber('1 234,56'), 1234.56))
  check('normalizePolishNumber 1234,56', approx(normalizePolishNumber('1234,56'), 1234.56))
  check('normalizePolishNumber 45.00', approx(normalizePolishNumber('45.00'), 45.00))
  check('normalizePolishNumber 1.234,56 (dot=thousands)', approx(normalizePolishNumber('1.234,56'), 1234.56))
  check('normalizePolishNumber 0,99', approx(normalizePolishNumber('0,99'), 0.99))
  check('normalizePolishNumber empty → NaN', isNaN(normalizePolishNumber('')))
  check('normalizePolishNumber null → NaN', isNaN(normalizePolishNumber(null)))

  // ── normalizeDate ────────────────────────────────────────────────
  check('normalizeDate 15.04.2026', normalizeDate('15.04.2026') === '2026-04-15')
  check('normalizeDate 01/03/2025', normalizeDate('01/03/2025') === '2025-03-01')
  check('normalizeDate already ISO', normalizeDate('2026-04-15') === '2026-04-15')
  check('normalizeDate null → null', normalizeDate(null) === null)

  // ── normalizeVatRate ─────────────────────────────────────────────
  check('normalizeVatRate 23%', normalizeVatRate('23%') === 23)
  check('normalizeVatRate 23 %', normalizeVatRate('23 %') === 23)
  check('normalizeVatRate 8', normalizeVatRate('8') === 8)
  check('normalizeVatRate zw → 0', normalizeVatRate('zw') === 0)
  check('normalizeVatRate np → 0', normalizeVatRate('np') === 0)
  check('normalizeVatRate empty → null', normalizeVatRate('') === null)
  check('normalizeVatRate 99 → null (invalid rate)', normalizeVatRate('99') === null)

  // ── isForbiddenAsInvoiceItem ─────────────────────────────────────
  check('forbidden: Razem netto', isForbiddenAsInvoiceItem('Razem netto'))
  check('forbidden: Do zapłaty', isForbiddenAsInvoiceItem('Do zapłaty 70,00'))
  check('forbidden: Numer konta', isForbiddenAsInvoiceItem('Numer konta: 12 3456'))
  check('forbidden: Termin zapłaty', isForbiddenAsInvoiceItem('Termin zapłaty: 14 dni'))
  check('forbidden: IBAN PL', isForbiddenAsInvoiceItem('IBAN PL 12 3456 7890'))
  check('forbidden: Strona 1 z 3', isForbiddenAsInvoiceItem('Strona 1 z 3'))
  check('forbidden: VAT 23%', isForbiddenAsInvoiceItem('VAT 23%'))
  check('allowed: SYFON UMYWALKOWY', !isForbiddenAsInvoiceItem('SYFON UMYWALKOWY BIAŁY 32MM'))
  check('allowed: Farba lateksowa', !isForbiddenAsInvoiceItem('Farba lateksowa biała 10L', { hasPrice: true }))
  check('allowed: BATERIA AAA', !isForbiddenAsInvoiceItem('BATERIA AAA 4SZT'))

  // ── classifyDocument ─────────────────────────────────────────────
  const telecomText = 'usługi telekomunikacyjne abonament p4 sp rozliczenie konta'
  check('classifyDocument: telecom → telecom_invoice', classifyDocument(telecomText, []) === 'telecom_invoice')

  const inventoryText = 'cena jednostkowa wartość netto jm syfon żarówka'
  const inventoryTable = [{ columnMap: { ILOSC: { x: 200 }, JEDNOSTKA: { x: 250 } }, rowCount: 3 }]
  check('classifyDocument: inventory → inventory_purchase_invoice', classifyDocument(inventoryText, inventoryTable) === 'inventory_purchase_invoice')

  // ── classifyItem ─────────────────────────────────────────────────
  const { itemType: t1, shouldAffectInventory: a1 } = classifyItem(
    { rawName: 'Usługi telekomunikacyjne', ilosc: 1, cenaNetto: 52.85, jednostka: 'usł.' }, 'telecom_invoice'
  )
  check('classifyItem: telecom usługa → service_item', t1 === 'service_item')
  check('classifyItem: telecom usługa → inventory=false', a1 === false)

  const { itemType: t2, shouldAffectInventory: a2 } = classifyItem(
    { rawName: 'SYFON UMYWALKOWY 32MM', ilosc: 2, cenaNetto: 19.99, jednostka: 'szt' }, 'inventory_purchase_invoice'
  )
  check('classifyItem: syfon inventory_purchase_invoice → inventory_item', t2 === 'inventory_item')
  check('classifyItem: syfon → inventory=true', a2 === true)

  const { itemType: t3 } = classifyItem(
    { rawName: 'Razem do zapłaty', cenaNetto: 70, ilosc: 1, jednostka: 'szt' }, 'inventory_purchase_invoice'
  )
  check('classifyItem: Razem do zapłaty → summary_line', t3 === 'summary_line')

  // ── calculateConfidence (max 95) ─────────────────────────────────
  const perfectResult = {
    fields: {
      numer: 'FV/001', data_zakupu: '2026-05-22',
      kontrahent_nip: '1234567890',
      pozycje: [{ rawName: 'Syfon', ilosc: 1, cenaNetto: 10, wartoscNetto: 10, jednostka: 'szt' }],
    },
    validation: { errors: [], warnings: [] },
  }
  const conf = calculateConfidence(perfectResult, 'inventory_purchase_invoice')
  check('calculateConfidence ≤ 95', conf <= 95)
  check('calculateConfidence > 0 for complete result', conf > 0)

  // ── findSupplierTemplate ─────────────────────────────────────────
  const euronet = findSupplierTemplate('5270005984', null, null)
  check('findSupplierTemplate: EURO-NET by NIP', euronet.template !== null && euronet.template.name.includes('EURO-NET'))
  check('findSupplierTemplate: EURO-NET confidence=100', euronet.confidence === 100)

  const p4 = findSupplierTemplate('9512074656', null, null)
  check('findSupplierTemplate: P4 → telecom_invoice', p4.template?.documentType === 'telecom_invoice')

  const unknownSupplier = findSupplierTemplate('9999999999', null, null)
  check('findSupplierTemplate: unknown → null template', unknownSupplier.template === null)

  const byName = findSupplierTemplate(null, 'Play sp. z o.o.', null)
  check('findSupplierTemplate: Play by name → telecom_invoice', byName.template?.documentType === 'telecom_invoice')

  const byPattern = findSupplierTemplate(null, null, 'FAKTURA VAT EURO-NET sp. z o.o.')
  check('findSupplierTemplate: EURO-NET by pattern', byPattern.template !== null && byPattern.matchedBy === 'pattern')

  // ── applyItemRulesFromTemplate ───────────────────────────────────
  const euronetTemplate = euronet.template
  const puspak = applyItemRulesFromTemplate({ rawName: 'Wniesienie', indeks: 'PUSPAK7', cenaNetto: 49 }, euronetTemplate)
  check('applyItemRulesFromTemplate: PUSPAK prefix → service_item', puspak.itemType === 'service_item')
  check('applyItemRulesFromTemplate: PUSPAK → inventory=false', puspak.shouldAffectInventory === false)

  const pralka = applyItemRulesFromTemplate({ rawName: 'Pralka Bosch', indeks: 'BOX-001', cenaNetto: 1299 }, euronetTemplate)
  check('applyItemRulesFromTemplate: regular product stays unchanged', pralka.itemType === undefined)

  const nullTemplate = applyItemRulesFromTemplate({ rawName: 'test' }, null)
  check('applyItemRulesFromTemplate: null template → passthrough', nullTemplate.rawName === 'test')

  // ── advancedSimilarity ───────────────────────────────────────────
  const exact = advancedSimilarity('Farba lateksowa biała 10L', { nazwa: 'Farba lateksowa biała 10L' })
  check('advancedSimilarity: exact → 1.0', exact.score === 1.0)

  const skuMatch = advancedSimilarity('BOX-1234', { nazwa: 'Wiertarka udarowa', sku: 'BOX-1234' })
  check('advancedSimilarity: SKU match → 1.0', skuMatch.score === 1.0)

  const unrelated = advancedSimilarity('Wkręt do drewna 4x40mm', { nazwa: 'Żarówka LED E27 9W' })
  check('advancedSimilarity: unrelated → < 0.5', unrelated.score < 0.5)

  // ── Model self-tests (12 checks) ─────────────────────────────────

  // Test 1: trainInvoiceModel warning przy <5 samples
  const emptyDataset = buildTrainingDataset([], [], [])
  const metricsEmpty = evaluateModelConfig(DEFAULT_INVOICE_MODEL_CONFIG, emptyDataset)
  check('model: empty dataset → totalSamples=0', metricsEmpty.totalSamples === 0)

  // Test 2: evaluateModelConfig liczy metryki
  const sampleDataset = buildTrainingDataset([
    {
      id: 'gs1', name: 'Test sample',
      documentType: 'inventory_purchase_invoice',
      expectedOutput: {
        documentType: 'inventory_purchase_invoice',
        pozycje: [{ itemType: 'inventory_item', shouldAffectInventory: true }],
      },
    },
  ], [], [])
  const metrics1 = evaluateModelConfig(DEFAULT_INVOICE_MODEL_CONFIG, sampleDataset)
  check('model: evaluateModelConfig liczy totalSamples', metrics1.totalSamples === sampleDataset.length)

  // Test 3: service invoice nie może dostać shouldAffectInventory=true
  const serviceItemFeatures = extractItemFeatures(
    { rawName: 'Usługi telekomunikacyjne', ilosc: 1, cenaNetto: 52.85, jednostka: 'usł.' }
  )
  const invResult = scoreShouldAffectInventory(serviceItemFeatures, 'telecom_invoice', DEFAULT_INVOICE_MODEL_CONFIG)
  check('model: telecom invoice → shouldAffectInventory=false', invResult.shouldAffectInventory === false)

  // Test 4: Play/telecom nie może matchować do towaru
  const playRanking = rankProductCandidates(
    'Usługi telekomunikacyjne abonament',
    [{ id: 'p1', nazwa: 'Syfon umywalkowy' }],
    { itemType: 'service_item' },
    DEFAULT_INVOICE_MODEL_CONFIG
  )
  check('model: service_item → brak rankingu produktów', playRanking.candidates.length === 0)

  // Test 5: Brico-style inventory pasuje do syfon/bateria/listwa
  const bricoFeatures = extractItemFeatures(
    { rawName: 'SYFON UMYWALKOWY 32MM', ilosc: 2, cenaNetto: 19.99, jednostka: 'szt' }
  )
  check('model: brico-style item → isInventoryKeyword=true', bricoFeatures.isInventoryKeyword === true)
  const bricoScoring = scoreItemType(bricoFeatures, DEFAULT_INVOICE_MODEL_CONFIG)
  check('model: brico-style → itemType inventory_item lub cost_item', ['inventory_item', 'cost_item'].includes(bricoScoring.itemType))

  // Test 6: G9 nie może być strong match do E27
  const g9Features = extractProductMatchFeatures('Żarówka G9 3W', { nazwa: 'Żarówka E27 9W' })
  check('model: G9 vs E27 → techParamConflict=true', g9Features.techParamConflict === true)
  const g9Score = scoreProductCandidate(g9Features, DEFAULT_INVOICE_MODEL_CONFIG)
  check('model: G9 vs E27 → score < strong threshold', g9Score.score < DEFAULT_INVOICE_MODEL_CONFIG.thresholds.productStrongMatch)

  // Test 7: 750ml i 0.75L — oba mają tech param ml/l (similar domain)
  const f750 = extractProductMatchFeatures('Płyn 750ml', { nazwa: 'Płyn do naczyń 750ml' })
  check('model: 750ml vs 750ml → techParamMatch=true', f750.techParamMatch === true)

  // Test 8: serviceToInventoryErrorRate wykrywa błędy
  const badDataset = buildTrainingDataset([
    {
      id: 'bad1', name: 'Bad telecom',
      documentType: 'telecom_invoice',
      expectedOutput: {
        documentType: 'inventory_purchase_invoice',
        pozycje: [{ itemType: 'inventory_item', shouldAffectInventory: true }],
      },
    },
  ], [], [])
  const badMetrics = evaluateModelConfig(DEFAULT_INVOICE_MODEL_CONFIG, badDataset)
  check('model: serviceToInventoryErrorRate > 0 dla błędnego sampla', badMetrics.serviceToInventoryErrorRate > 0)

  // Test 9: shadow mode — scoreItemType NIE zmienia itemType w oryginalnym obiekcie
  const originalItem = { rawName: 'Syfon', ilosc: 2, cenaNetto: 19.99, jednostka: 'szt' }
  const origItemType = originalItem.itemType
  const featsCopy = extractItemFeatures(originalItem)
  scoreItemType(featsCopy, DEFAULT_INVOICE_MODEL_CONFIG)
  check('model: shadow mode nie mutuje oryginalnego itemu', originalItem.itemType === origItemType)

  // Test 10: active mode nadal przechodzi przez scoreShouldAffectInventory guard
  const activeConfig = { ...DEFAULT_INVOICE_MODEL_CONFIG, mode: 'active' }
  const serviceGuardResult = scoreShouldAffectInventory(
    extractItemFeatures({ rawName: 'Abonament internetowy', ilosc: 1, cenaNetto: 100, jednostka: 'usł.' }),
    'utility_invoice',
    activeConfig
  )
  check('model: active mode — utility_invoice nadal blokuje inventory', serviceGuardResult.shouldAffectInventory === false)

  // Test 11: import/export model config działa (roundtrip)
  const { exportInvoiceModelConfig, importInvoiceModelConfig, getInvoiceModelConfig } = await import('./invoiceModelConfig.js')
  const exported = exportInvoiceModelConfig()
  check('model: export config → valid JSON string', typeof exported === 'string' && exported.includes('"version"'))
  const badImport = importInvoiceModelConfig('{ INVALID JSON !!!')
  check('model: import nieprawidłowego JSON → success=false bez wyjątku', badImport.success === false)

  // Test 12: uszkodzony config → fallback do DEFAULT
  const cfg = getInvoiceModelConfig()
  check('model: getInvoiceModelConfig zwraca obiekt z mode', typeof cfg.mode === 'string')
  check('model: getInvoiceModelConfig zwraca valid mode', ['off', 'shadow', 'active'].includes(cfg.mode))

  // ── Dataset builder self-tests (10 checks) ──────────────────────

  // Test 13: anonymizeInvoiceText maskuje NIP
  const textWithNip = 'Sprzedawca: Firma ABC NIP: 123-456-78-90 ul. Testowa 1'
  const anonymized = anonymizeInvoiceText(textWithNip)
  check('dataset: anonymizeInvoiceText maskuje NIP', !anonymized.includes('123-456-78-90') && anonymized.includes('XXX'))

  // Test 14: anonymizeInvoiceText maskuje IBAN
  const textWithIban = 'Przelew na konto: PL61109010140000071219812874'
  const anonymizedIban = anonymizeInvoiceText(textWithIban)
  check('dataset: anonymizeInvoiceText maskuje IBAN', !anonymizedIban.includes('PL61109010140000071219812874'))

  // Test 15: buildSyntheticGoldenSample — Brico ma inventory items
  const bricoSample = buildSyntheticGoldenSample('brico')
  check('dataset: brico sample ma documentType inventory', bricoSample?.documentType === 'inventory_purchase_invoice')
  check('dataset: brico sample ma pozycje inventory_item', (bricoSample?.expectedOutput?.pozycje || []).every(p => p.expectedItemType === 'inventory_item'))
  check('dataset: brico sample rawName present', (bricoSample?.expectedOutput?.pozycje || []).every(p => !!p.rawName))

  // Test 16: buildSyntheticGoldenSample — Play ma service items i shouldAffectInventory=false
  const playSample = buildSyntheticGoldenSample('play')
  check('dataset: play sample ma documentType telecom', playSample?.documentType === 'telecom_invoice')
  check('dataset: play sample — wszystkie pozycje shouldAffectInventory=false',
    (playSample?.expectedOutput?.pozycje || []).every(p => p.expectedShouldAffectInventory === false))

  // Test 17: buildGoldenSampleFromApprovedInvoice — basic roundtrip
  const fakeExtractionResult = {
    documentType: 'inventory_purchase_invoice',
    confidence: 80,
    source: 'pdf_text',
    rawText: 'Numer: FV/2026/001 NIP: 987-654-32-10',
    fields: {
      numer: 'FV/2026/001',
      kontrahent_nip: '9876543210',
      kontrahent_nazwa: 'Firma Testowa',
      suma_netto: 150,
    },
  }
  const fakeItems = [
    { rawName: 'SYFON UMYWALKOWY', ilosc: 2, jednostka: 'szt', cenaNetto: 19.99, itemType: 'inventory_item', shouldAffectInventory: true, matchedProductId: null },
  ]
  const builtSample = buildGoldenSampleFromApprovedInvoice(fakeExtractionResult, fakeItems, { name: 'Test roundtrip' })
  check('dataset: buildGoldenSampleFromApprovedInvoice — ma name', builtSample?.name === 'Test roundtrip')
  check('dataset: buildGoldenSampleFromApprovedInvoice — ma supplierNip', builtSample?.supplierNip === '9876543210')
  check('dataset: buildGoldenSampleFromApprovedInvoice — pozycja ma rawName', builtSample?.expectedOutput?.pozycje?.[0]?.rawName === 'SYFON UMYWALKOWY')
  check('dataset: buildGoldenSampleFromApprovedInvoice — pozycja ma expectedItemType', builtSample?.expectedOutput?.pozycje?.[0]?.expectedItemType === 'inventory_item')

  // Test 18: buildGoldenSampleFromApprovedInvoice — anonymize maskuje NIP
  const builtAnon = buildGoldenSampleFromApprovedInvoice(fakeExtractionResult, fakeItems, { anonymize: true })
  check('dataset: anonymize=true — rawText bez NIP', !builtAnon?.inputSample?.rawText?.includes('987-654-32-10'))

  // Test 19: extractEvaluationDatasetFromGoldenSamples — tworzy typed items
  const miniSamples = [
    {
      id: 'mini1',
      name: 'Mini sample',
      documentType: 'inventory_purchase_invoice',
      supplierNip: null,
      expectedOutput: {
        documentType: 'inventory_purchase_invoice',
        pozycje: [
          { rawName: 'Syfon', expectedItemType: 'inventory_item', expectedShouldAffectInventory: true, expectedProductId: null },
        ],
      },
    },
  ]
  const typedDataset = extractEvaluationDatasetFromGoldenSamples(miniSamples, [])
  check('dataset: extractEvaluationDataset — zawiera document_type item', typedDataset.some(i => i.task === 'document_type'))
  check('dataset: extractEvaluationDataset — zawiera item_type item', typedDataset.some(i => i.task === 'item_type'))
  check('dataset: extractEvaluationDataset — brak product_match (no products)', !typedDataset.some(i => i.task === 'product_match'))

  // Test 20: buildExpectedProductMatch — brak produktów → productId=null
  const matchResult = buildExpectedProductMatch('Syfon umywalkowy', [], {})
  check('dataset: buildExpectedProductMatch brak produktów → productId=null', matchResult.productId === null)

  // Test 21: evaluateModelConfig handles typed product_match items without products (no crash)
  const typedWithProduct = [
    {
      id: 'pm1', task: 'product_match',
      input: { rawName: 'Syfon', jednostka: 'szt', supplierNip: null, cenaNetto: 20, itemType: 'inventory_item' },
      expected: { productId: 'fake-uuid' },
      source: 'golden',
    },
  ]
  const metricsTyped = evaluateModelConfig(DEFAULT_INVOICE_MODEL_CONFIG, typedWithProduct, [])
  check('dataset: evaluateModelConfig — typed product_match bez produktów → Top1=0, nie crashuje', metricsTyped.productMatchTop1Accuracy === 0)

  // Test 22: evaluateModelConfig z produktem — Top1 poprawny gdy exact match
  const fakeProductList = [{ id: 'prod-syfon', nazwa: 'Syfon umywalkowy 32mm', jednostka: 'szt' }]
  const typedExact = [
    {
      id: 'pm2', task: 'product_match',
      input: { rawName: 'Syfon umywalkowy 32mm', jednostka: 'szt', supplierNip: null, cenaNetto: 20, itemType: 'inventory_item' },
      expected: { productId: 'prod-syfon' },
      source: 'golden',
    },
  ]
  const metricsExact = evaluateModelConfig(DEFAULT_INVOICE_MODEL_CONFIG, typedExact, fakeProductList)
  check('dataset: evaluateModelConfig — exact match → Top1Accuracy = 1.0', metricsExact.productMatchTop1Accuracy === 1.0)
  check('dataset: evaluateModelConfig — exact match → Top3Accuracy = 1.0', metricsExact.productMatchTop3Accuracy === 1.0)

  // ── Build summary ────────────────────────────────────────────────
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length
  const failures = results.filter(r => !r.passed).map(r => ({ name: r.name, message: r.message }))

  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    console.group('[invoiceParserSelfTest]')
    results.forEach(r => r.passed ? console.log('✅', r.name) : console.error('❌', r.name, r.message))
    console.log(`\n📊 ${passed}/${total} passed`)
    console.groupEnd()
  }

  return { passed, failed, total, failures, results }
}

// Expose in DEV mode for browser console access
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  window.runInvoiceParserSelfTest = runInvoiceParserSelfTest
}
