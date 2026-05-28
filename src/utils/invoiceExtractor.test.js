// Unit tests — run via: npm test
// Also runnable in browser console: import('/src/utils/invoiceExtractor.test.js')

import { describe, it } from 'vitest'
import { normalizePolishNumber, normalizeDate, extractWithPatterns, normalizeVatRate } from './polishInvoicePatterns.js'
import { parseInvoiceItems, parseInvoiceItemsLP } from './invoiceExtractor.js'
import { detectColumnMap } from './invoiceLineParser.js'
import { classifyDocument, classifyItem } from './invoiceDocumentClassifier.js'
import { isForbiddenAsInvoiceItem } from './invoiceLineGuards.js'
import { calculateConfidence } from './invoiceValidation.js'
import { findSupplierTemplate, applyItemRulesFromTemplate } from './invoiceSupplierTemplates.js'
import { advancedSimilarity } from './productNormalizer.js'
import {
  sanitizeAiInvoiceResult, validateAiInvoiceSchema,
  capConfidenceIfNeeded, guardAgainstServiceToInventoryMatch,
  rejectUnsafeAiInventoryEffects, mergeLocalAndAiResult,
} from './invoiceAiResultGuard.js'
import {
  rememberProductAlias, findProductByAlias,
  rememberSupplierItemName, getSupplierItemMapping,
  exportInvoiceLearningData, importInvoiceLearningData, clearInvoiceLearningData,
  hashInvoiceText, buildLayoutFingerprint, buildTrainingExample, saveInvoiceTrainingExample, getInvoiceTrainingExamples,
} from './invoiceLearning.js'

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message)
    throw new Error(`Assertion failed: ${message}`)
  } else {
    console.log('PASS:', message)
  }
}

function approx(a, b, eps = 0.001) {
  return Math.abs(a - b) < eps
}

// ═══════════════════════════════════════════════════════════════
// Vitest test suite — each section is an it() block
// ═══════════════════════════════════════════════════════════════

describe('invoiceExtractor', () => {

  it('normalizePolishNumber', () => {
    assert(approx(normalizePolishNumber('1 234,56'), 1234.56), "normalizePolishNumber('1 234,56') === 1234.56")
    assert(approx(normalizePolishNumber('1234,56'), 1234.56),  "normalizePolishNumber('1234,56') === 1234.56")
    assert(approx(normalizePolishNumber('45.00'), 45.00),       "normalizePolishNumber('45.00') === 45.00")
    assert(approx(normalizePolishNumber('1.234,56'), 1234.56), "normalizePolishNumber('1.234,56') === 1234.56 (dot=thousands)")
    assert(approx(normalizePolishNumber('0,99'), 0.99),         "normalizePolishNumber('0,99') === 0.99")
    assert(approx(normalizePolishNumber('100'), 100),           "normalizePolishNumber('100') === 100")
    assert(isNaN(normalizePolishNumber('')),                    "normalizePolishNumber('') is NaN")
    assert(isNaN(normalizePolishNumber(null)),                  "normalizePolishNumber(null) is NaN")
  })

  it('normalizeDate', () => {
    assert(normalizeDate('15.04.2026') === '2026-04-15', "normalizeDate('15.04.2026')")
    assert(normalizeDate('01/03/2025') === '2025-03-01', "normalizeDate('01/03/2025')")
    assert(normalizeDate('2026-04-15') === '2026-04-15', "normalizeDate already ISO")
    assert(normalizeDate('3.5.2024') === '2024-05-03',   "normalizeDate('3.5.2024') single digits")
    assert(normalizeDate('15-04-2026') === '2026-04-15', "normalizeDate('15-04-2026')")
    assert(normalizeDate(null) === null,                  "normalizeDate(null) === null")
  })

  it('extractWithPatterns', () => {
    const sampleInvoice = `
FAKTURA VAT NR: FV/2026/001
Data wystawienia: 15.04.2026
Sprzedawca:
ACME Sp. z o.o.
NIP: 123-456-78-90

Nabywca:
KUPUJĄCY Sp. z o.o.
NIP: 987-654-32-10
`
    const extracted = extractWithPatterns(sampleInvoice)
    assert(extracted.numer != null,             'extractWithPatterns finds numer')
    assert(extracted.data != null,              'extractWithPatterns finds data')
    assert(extracted.data === '2026-04-15',     'extractWithPatterns normalizes date')
    assert(extracted.nipSprzedawcy === '1234567890', 'extractWithPatterns finds sprzedawca NIP')
    assert(extracted.nipNabywcy === '9876543210',    'extractWithPatterns finds nabywca NIP')
  })

  it('parseInvoiceItems', () => {
    const sampleLines = `
Papier toaletowy Velvet 8 szt 2,99 23,92
Płyn do szyb CLIN 750ml 5 szt 4,50 22,50
Żarówka LED E27 10W 1 szt 12,99
`
    const items = parseInvoiceItems(sampleLines)
    assert(items.length >= 2, `parseInvoiceItems finds items (found ${items.length})`)
    if (items.length > 0) {
      assert(items[0].rawName.length > 0,    'first item has rawName')
      assert(items[0].quantity > 0,          'first item has quantity > 0')
      assert(items[0].unitPriceNet > 0,      'first item has unitPriceNet > 0')
    }
  })

  it('detectColumnMap', () => {
    const headerItems = [
      { x: 20,  text: 'Lp' },
      { x: 60,  text: 'Nazwa' },
      { x: 280, text: 'Ilość' },
      { x: 340, text: 'Jm' },
      { x: 400, text: 'Cena' },
      { x: 460, text: 'Wartość netto' },
      { x: 530, text: 'VAT' },
      { x: 580, text: 'Brutto' },
    ]
    const colMap = detectColumnMap(headerItems)
    assert(colMap.lp != null,            'detectColumnMap finds lp')
    assert(colMap.nazwa != null,         'detectColumnMap finds nazwa')
    assert(colMap.ilosc != null,         'detectColumnMap finds ilosc')
    assert(colMap.cenaNetto != null,     'detectColumnMap finds cenaNetto')
    assert(colMap.wartoscNetto != null,  'detectColumnMap finds wartoscNetto')
  })

  it('classifyDocument regression', () => {
    const playText = `
FAKTURA VAT
P4 Sp. z o.o.
NIP: 7792308495
NAZWA TOWARU LUB USŁUGI NETTO (ZŁ) STAWKA VAT VAT (ZŁ) BRUTTO (ZŁ)
Usługi telekomunikacyjne 52,85 23% 12,15 65,00
Usługi telekomunikacyjne - TV 4,63 8% 0,37 5,00
Razem 57,48 12,52 70,00
Do zapłaty 70,00 zł
Termin płatności: 2026-06-01
Zapłać online: play.pl
Numer konta: 12 3456 7890
`
    const playResult = classifyDocument(playText, [])
    assert(playResult === 'telecom_invoice', `Play powinno być telecom_invoice (got: ${playResult})`)

    const bricoText = `
FAKTURA VAT FV/BRICO/001/2026
BRICO TEST Sp. z o.o.
NIP: 1234567890
Lp Nazwa towaru Ilość Jm Cena netto Wartość netto VAT Brutto
1 SYFON UMYWALKOWY BIAŁY 32MM 2 szt 19,99 39,98 23% 49,18
2 BATERIA AAA 4SZT 3 opak 8,50 25,50 23% 31,37
3 LISTWA PRZYPODŁOGOWA DAB 2.5M 5 szt 12,00 60,00 23% 73,80
Razem netto 125,48
VAT 28,87
Razem brutto 154,35
`
    const bricoResult = classifyDocument(bricoText, [{
      columnMap: { ILOSC: { x: 200 }, JEDNOSTKA: { x: 250 } },
      rowCount: 3,
    }])
    assert(bricoResult === 'inventory_purchase_invoice', `Brico powinno być inventory_purchase_invoice (got: ${bricoResult})`)
  })

  it('isForbiddenAsInvoiceItem regression', () => {
    assert(isForbiddenAsInvoiceItem('Razem netto 125,48'), 'Razem netto nie może być pozycją')
    assert(isForbiddenAsInvoiceItem('Zapłać online: play.pl'), 'Zapłać online nie może być pozycją')
    assert(isForbiddenAsInvoiceItem('Numer konta: 12 3456 7890'), 'Numer konta nie może być pozycją')
    assert(!isForbiddenAsInvoiceItem('SYFON UMYWALKOWY BIAŁY 32MM'), 'Syfon może być pozycją')
    assert(!isForbiddenAsInvoiceItem('BATERIA AAA 4SZT'), 'Bateria może być pozycją')
    assert(isForbiddenAsInvoiceItem('Do zapłaty 70,00'), 'Do zapłaty nie może być pozycją')
  })

  it('confidence max 95', () => {
    const perfectResult = {
      fields: {
        numer: 'FV/2026/001',
        data_zakupu: '2026-04-15',
        kontrahent_nip: '1234567890',
        pozycje: [
          { rawName: 'Syfon', ilosc: 2, cenaNetto: 19.99, wartoscNetto: 39.98, jednostka: 'szt' },
          { rawName: 'Bateria', ilosc: 3, cenaNetto: 8.50, wartoscNetto: 25.50, jednostka: 'opak' },
        ],
      },
      validation: { errors: [], warnings: [] },
    }
    assert(
      calculateConfidence(perfectResult, 'inventory_purchase_invoice') <= 95,
      'Confidence nigdy nie może być 100%'
    )
    assert(
      calculateConfidence(perfectResult, 'inventory_purchase_invoice') > 0,
      'Confidence dla dobrego odczytu > 0'
    )
  })

  it('classifyItem regressions', () => {
    const serviceItem = {
      rawName: 'Usługi telekomunikacyjne',
      itemType: 'service_item',
      ilosc: 1,
      cenaNetto: 52.85,
      shouldAffectInventory: false,
    }
    const { itemType: classifiedType } = classifyItem(serviceItem, 'telecom_invoice')
    assert(classifiedType === 'service_item', 'Usługa telekomunikacyjna musi być service_item')
    assert(serviceItem.shouldAffectInventory === false, 'Usługa nie może wpływać na magazyn')
    assert(serviceItem.matchedProductId === null || serviceItem.matchedProductId === undefined,
      'Usługa nie może być dopasowana do towaru')

    const { itemType: summaryType } = classifyItem({ rawName: 'Razem do zapłaty', cenaNetto: 70, ilosc: 1, jednostka: 'szt' }, 'inventory_purchase_invoice')
    assert(summaryType === 'summary_line', 'Razem do zapłaty powinno być summary_line')
  })

  // ═══════════════════════════════════════════════════════════════
  // A. Play/service invoice regressions
  // ═══════════════════════════════════════════════════════════════

  it('A: Play/service invoice regressions', () => {
    const { itemType: playItemType, shouldAffectInventory: playAffect } = classifyItem(
      { rawName: 'Usługi telekomunikacyjne', ilosc: 1, cenaNetto: 52.85, jednostka: 'usł.' },
      'telecom_invoice'
    )
    assert(playItemType === 'service_item', 'Play: Usługi telekomunikacyjne muszą być service_item')
    assert(playAffect === false, 'Play: Usługi telekomunikacyjne nie wpływają na magazyn')

    const { itemType: playGeneric, shouldAffectInventory: playGenericAffect } = classifyItem(
      { rawName: 'TV 4K - Rodzina M 5G', ilosc: 1, cenaNetto: 5.00, jednostka: 'szt' },
      'telecom_invoice'
    )
    assert(playGeneric === 'service_item', 'Play: dowolna pozycja w telecom_invoice to service_item (bez słów kluczowych)')
    assert(playGenericAffect === false, 'Play: dowolna pozycja w telecom_invoice nie wpływa na magazyn')

    assert(isForbiddenAsInvoiceItem('Zapłać online: play.pl'), 'Play: Zapłać online nie może być pozycją')
    assert(isForbiddenAsInvoiceItem('Numer konta: 12 3456 7890'), 'Play: Numer konta nie może być pozycją')
    assert(isForbiddenAsInvoiceItem('Termin płatności 2026-06-01'), 'Play: Termin płatności nie może być pozycją')
  })

  // ═══════════════════════════════════════════════════════════════
  // B. Brico/inventory invoice regressions
  // ═══════════════════════════════════════════════════════════════

  it('B: Brico/inventory invoice regressions', () => {
    const { itemType: syfonType, shouldAffectInventory: syfonAffect } = classifyItem(
      { rawName: 'SYFON UMYWALKOWY BIAŁY 32MM', ilosc: 2, cenaNetto: 19.99, jednostka: 'szt' },
      'inventory_purchase_invoice'
    )
    assert(syfonType === 'inventory_item', 'Brico: syfon musi być inventory_item')
    assert(syfonAffect === true, 'Brico: syfon wpływa na magazyn')

    const { itemType: bateriaType } = classifyItem(
      { rawName: 'BATERIA AAA 4SZT', ilosc: 3, cenaNetto: 8.50, jednostka: 'opak' },
      'inventory_purchase_invoice'
    )
    assert(bateriaType === 'inventory_item', 'Brico: bateria musi być inventory_item')

    assert(!isForbiddenAsInvoiceItem('SYFON UMYWALKOWY BIAŁY 32MM'), 'Brico: syfon może być pozycją')
    assert(!isForbiddenAsInvoiceItem('BATERIA AAA 4SZT'), 'Brico: bateria może być pozycją')
  })

  // ═══════════════════════════════════════════════════════════════
  // C. Mixed invoice regressions
  // ═══════════════════════════════════════════════════════════════

  it('C: Mixed invoice regressions', () => {
    const { itemType: mixedTowar } = classifyItem(
      { rawName: 'Syfon umywalkowy', ilosc: 2, cenaNetto: 19.99, jednostka: 'szt' },
      'unknown'
    )
    assert(mixedTowar === 'inventory_item', 'Mixed: towar z ceną i ilością to inventory_item')

    const { itemType: mixedUsługa, shouldAffectInventory: mixedUsługaAffect } = classifyItem(
      { rawName: 'Usługa transportowa', ilosc: 1, cenaNetto: 50.00, jednostka: 'usł.' },
      'unknown'
    )
    assert(mixedUsługa === 'service_item', 'Mixed: usługa transportowa to service_item')
    assert(mixedUsługaAffect === false, 'Mixed: usługa transportowa nie wpływa na magazyn')
  })

  // ═══════════════════════════════════════════════════════════════
  // D. AI result guard tests
  // ═══════════════════════════════════════════════════════════════

  it('D: AI result guard', () => {
    // D1: service_item z shouldAffectInventory=true → guard blokuje
    const aiResultServiceInventory = {
      documentType: 'telecom_invoice',
      confidence: 70,
      warnings: [],
      pozycje: [
        { rawName: 'Usługi telekomunikacyjne', itemType: 'service_item', shouldAffectInventory: true, cenaNetto: 52.85, ilosc: 1 },
      ],
    }
    const guarded1 = guardAgainstServiceToInventoryMatch(JSON.parse(JSON.stringify(aiResultServiceInventory)))
    assert(guarded1.pozycje[0].shouldAffectInventory === false, 'Guard: service_item z shouldAffectInventory=true → blokowane')
    assert(guarded1.pozycje[0].warnings?.length > 0, 'Guard: ostrzeżenie dodane dla service_item→inventory')

    // D2: confidence 100 → capped do 95
    const aiHigh = { documentType: 'inventory_purchase_invoice', confidence: 100, warnings: [], pozycje: [] }
    const capped = capConfidenceIfNeeded(JSON.parse(JSON.stringify(aiHigh)))
    assert(capped.confidence <= 95, 'Guard: AI confidence 100 → cappowane do max 95')

    // D3: AI pozycja bez ceny → shouldAffectInventory=false
    const aiNoCena = {
      documentType: 'inventory_purchase_invoice',
      confidence: 80,
      warnings: [],
      pozycje: [
        { rawName: 'Syfon', itemType: 'inventory_item', shouldAffectInventory: true, cenaNetto: 0, ilosc: 2 },
      ],
    }
    const guarded3 = guardAgainstServiceToInventoryMatch(JSON.parse(JSON.stringify(aiNoCena)))
    assert(guarded3.pozycje[0].shouldAffectInventory === false, 'Guard: pozycja bez ceny → shouldAffectInventory=false')
    assert(guarded3.pozycje[0].warnings?.some(w => w.includes('price')), 'Guard: ostrzeżenie o brakującej cenie')

    // D4: telecom_invoice → rejectUnsafeAiInventoryEffects blokuje wszystkie inventory=true
    const aiTelecom = {
      documentType: 'telecom_invoice',
      confidence: 90,
      warnings: [],
      pozycje: [
        { rawName: 'Jakiś towar', itemType: 'inventory_item', shouldAffectInventory: true, matchedProductId: 'abc123', cenaNetto: 10, ilosc: 1 },
      ],
    }
    const rejected = rejectUnsafeAiInventoryEffects(JSON.parse(JSON.stringify(aiTelecom)))
    assert(rejected.pozycje[0].shouldAffectInventory === false, 'Guard: rejectUnsafe blokuje inventory w telecom_invoice')
    assert(rejected.pozycje[0].matchedProductId === null, 'Guard: rejectUnsafe czyści matchedProductId w telecom_invoice')
    assert(rejected.confidence <= 80, 'Guard: rejectUnsafe capuje confidence telecom_invoice do 80')

    // D5: validateAiInvoiceSchema
    const { valid: validSchema } = validateAiInvoiceSchema({
      documentType: 'inventory_purchase_invoice',
      confidence: 85,
      pozycje: [{ rawName: 'Syfon' }],
    })
    assert(validSchema === true, 'Guard: poprawny schema → valid=true')

    const { valid: invalidSchema } = validateAiInvoiceSchema({ confidence: 'blah', pozycje: null })
    assert(invalidSchema === false, 'Guard: niepoprawny schema → valid=false')

    // D6: sanitizeAiInvoiceResult — null guard
    assert(sanitizeAiInvoiceResult(null) === null, 'Guard: sanitize null → null')
    assert(typeof sanitizeAiInvoiceResult({ documentType: 'test', confidence: 50, pozycje: [] }) === 'object', 'Guard: sanitize poprawnego obiektu')

    // D7: mergeLocalAndAiResult — AI uzupełnia brakujące pola
    const localEmpty = { documentType: 'unknown', confidence: 30, rawText: '', warnings: [], fields: { numer: null, data_zakupu: '2026-01-01', pozycje: [] } }
    const aiSuggestion = { documentType: 'inventory_purchase_invoice', confidence: 70, warnings: [], pozycje: [], fields: { numer: 'FV/2026/001' } }
    const merged = mergeLocalAndAiResult(JSON.parse(JSON.stringify(localEmpty)), aiSuggestion)
    assert(merged.documentType === 'inventory_purchase_invoice', 'Merge: AI documentType uzupełnia unknown lokalny')
    assert(merged.fields.numer === 'FV/2026/001', 'Merge: AI uzupełnia brakujące pole numer')
    assert(merged.fields.data_zakupu === '2026-01-01', 'Merge: merge nie nadpisuje istniejących lokalnych danych')
  })

  // ═══════════════════════════════════════════════════════════════
  // E. Learning data tests
  // ═══════════════════════════════════════════════════════════════

  it('E: learning data', () => {
    // Clear before testing to ensure clean state
    clearInvoiceLearningData()

    // E1: alias rawName → productId
    rememberProductAlias('Syfon umywalkowy biały 32mm', 'prod-001')
    const foundAlias = findProductByAlias('syfon umywalkowy biały 32mm')
    assert(foundAlias === 'prod-001', 'Learning: rememberProductAlias + findProductByAlias działa')

    // E2: case insensitive alias lookup
    const foundAliasUpper = findProductByAlias('SYFON UMYWALKOWY BIAŁY 32MM')
    assert(foundAliasUpper === 'prod-001', 'Learning: alias lookup działa case-insensitive')

    // E3: supplier rawName → productId
    rememberSupplierItemName('7792308495', 'Bateria AAA 4szt', 'prod-002')
    const foundSupplier = getSupplierItemMapping('7792308495', 'bateria aaa 4szt')
    assert(foundSupplier === 'prod-002', 'Learning: rememberSupplierItemName + getSupplierItemMapping działa')

    // E4: unknown alias → null
    const notFound = findProductByAlias('produkt który nie istnieje w bazie')
    assert(notFound === null, 'Learning: nieznany alias zwraca null')

    // E5: hashInvoiceText — różne teksty dają różne hashe
    const h1 = hashInvoiceText('Faktura Play')
    const h2 = hashInvoiceText('Faktura Brico')
    assert(h1 !== null && h2 !== null, 'Learning: hashInvoiceText zwraca wartość')
    assert(h1 !== h2, 'Learning: różne teksty → różne hashe')
    assert(hashInvoiceText('') === null, 'Learning: pusty tekst → null')

    // E6: buildLayoutFingerprint
    const mockLayout = { pages: [{ lines: [{ text: 'Faktura VAT' }, { text: 'ACME Sp. z o.o.' }] }] }
    const fp = buildLayoutFingerprint(mockLayout)
    assert(fp !== null, 'Learning: buildLayoutFingerprint zwraca wartość')
    assert(fp.pageCount === 1, 'Learning: fingerprint.pageCount poprawny')

    // E7: buildTrainingExample + saveInvoiceTrainingExample + getInvoiceTrainingExamples
    const mockLocal = {
      documentType: 'unknown', confidence: 40, rawText: 'Faktura Play',
      fields: { numer: null, data_zakupu: '2026-01-01', sprzedawca_nip: '7792308495', sprzedawca_nazwa: 'P4 Sp. z o.o.', pozycje: [
        { rawName: 'Usługi telekomunikacyjne', itemType: 'inventory_item', shouldAffectInventory: true, matchedProductId: 'bad-prod', cenaNetto: 52.85, ilosc: 1 }
      ] },
    }
    const mockCorrected = {
      documentType: 'telecom_invoice', confidence: 70, rawText: 'Faktura Play',
      fields: { numer: null, data_zakupu: '2026-01-01', sprzedawca_nip: '7792308495', sprzedawca_nazwa: 'P4 Sp. z o.o.', pozycje: [
        { rawName: 'Usługi telekomunikacyjne', itemType: 'service_item', shouldAffectInventory: false, matchedProductId: null, cenaNetto: 52.85, ilosc: 1 }
      ] },
    }
    const example = buildTrainingExample(mockLocal, null, mockCorrected)
    assert(example.id != null, 'Learning: training example ma id')
    assert(example.documentTypeBefore === 'unknown', 'Learning: documentTypeBefore poprawny')
    assert(example.documentTypeAfter === 'telecom_invoice', 'Learning: documentTypeAfter poprawny')
    assert(example.corrections.some(c => c.correctionType === 'wrong_document_type'), 'Learning: wykryto korektę documentType')
    assert(example.corrections.some(c => c.correctionType === 'wrong_item_type'), 'Learning: wykryto korektę itemType')
    assert(example.corrections.some(c => c.correctionType === 'wrong_inventory_effect'), 'Learning: wykryto korektę shouldAffectInventory')

    saveInvoiceTrainingExample(example)
    const allExamples = getInvoiceTrainingExamples()
    assert(allExamples.length > 0, 'Learning: saveInvoiceTrainingExample + getInvoiceTrainingExamples działa')
    assert(allExamples[allExamples.length - 1].id === example.id, 'Learning: ostatni example to właśnie dodany')

    // E8: export / import round-trip
    const exported = exportInvoiceLearningData()
    assert(typeof exported === 'string' && exported.includes('"aliases"'), 'Learning: exportInvoiceLearningData zwraca JSON')

    clearInvoiceLearningData()
    assert(getInvoiceTrainingExamples().length === 0, 'Learning: clearInvoiceLearningData czyści examples')
    assert(findProductByAlias('syfon umywalkowy biały 32mm') === null, 'Learning: clearInvoiceLearningData czyści aliasy')

    const importResult = importInvoiceLearningData(exported)
    assert(importResult.success === true, 'Learning: importInvoiceLearningData zwraca success=true')
    assert(findProductByAlias('syfon umywalkowy biały 32mm') === 'prod-001', 'Learning: po imporcie alias jest dostępny')
    assert(getInvoiceTrainingExamples().length > 0, 'Learning: po imporcie training examples są dostępne')

    // E9: import z nieprawidłowym JSON → nie crashuje
    const badImport = importInvoiceLearningData('nie-to-json!!!{')
    assert(badImport.success === false, 'Learning: import złego JSON zwraca success=false')
  })

  // ═══════════════════════════════════════════════════════════════
  // F. Supplier templates + normalizeVatRate + advancedSimilarity
  // ═══════════════════════════════════════════════════════════════

  it('F: supplier templates + normalizeVatRate + advancedSimilarity', () => {
    // F1: findSupplierTemplate — NIP lookups
    const euronetMatch = findSupplierTemplate('5270005984', null, null)
    assert(euronetMatch.template !== null, 'F1a: NIP 5270005984 → EURO-NET znaleziony')
    assert(euronetMatch.template?.name?.includes('EURO-NET'), 'F1b: NIP 5270005984 → name zawiera EURO-NET')
    assert(euronetMatch.matchedBy === 'nip', 'F1c: matchedBy === nip')
    assert(euronetMatch.confidence === 100, 'F1d: confidence NIP = 100')

    const p4Match = findSupplierTemplate('9512074656', null, null)
    assert(p4Match.template?.documentType === 'telecom_invoice', 'F2: NIP 9512074656 → telecom_invoice')

    const castoMatch = findSupplierTemplate('5260208211', null, null)
    assert(castoMatch.template?.documentType === 'inventory_purchase_invoice', 'F3: NIP 5260208211 Castorama → inventory_purchase_invoice')

    const tauronMatch = findSupplierTemplate('6762460451', null, null)
    assert(tauronMatch.template?.documentType === 'utility_invoice', 'F4: NIP 6762460451 Tauron → utility_invoice')

    const unknownMatch = findSupplierTemplate('9999999999', null, null)
    assert(unknownMatch.template === null, 'F5: nieznany NIP → template null')
    assert(unknownMatch.confidence === 0, 'F5b: nieznany NIP → confidence 0')

    // F6: findSupplierTemplate — name alias lookup
    const playByName = findSupplierTemplate(null, 'Play sp. z o.o.', null)
    assert(playByName.template?.documentType === 'telecom_invoice', 'F6: alias "Play" → telecom_invoice')
    assert(playByName.matchedBy === 'name', 'F6b: matchedBy === name')
    assert(playByName.confidence === 85, 'F6c: confidence name = 85')

    // F7: findSupplierTemplate — text pattern lookup
    const euronetByPattern = findSupplierTemplate(null, null, 'FAKTURA VAT\nEURO-NET sp. z o.o.\nul. Szyszkowa 20')
    assert(euronetByPattern.template !== null, 'F7: EURO-NET wykryty po wzorcu w tekście')
    assert(euronetByPattern.matchedBy === 'pattern', 'F7b: matchedBy === pattern')
    assert(euronetByPattern.confidence === 75, 'F7c: confidence pattern = 75')

    // F8: applyItemRulesFromTemplate — EURO-NET service prefix
    const euronetTemplate = findSupplierTemplate('5270005984', null, null).template
    const puspakItem = { rawName: 'Wniesienie i montaż', indeks: 'PUSPAK7', cenaNetto: 49 }
    const puspakResult = applyItemRulesFromTemplate(puspakItem, euronetTemplate)
    assert(puspakResult.itemType === 'service_item', 'F8a: PUSPAK7 prefix → service_item')
    assert(puspakResult.shouldAffectInventory === false, 'F8b: PUSPAK7 → nie wpływa na magazyn')
    assert(puspakResult.classifiedBy === 'template_index_prefix', 'F8c: classifiedBy = template_index_prefix')

    const ptransItem = { rawName: 'Transport', indeks: 'PTRANS01', cenaNetto: 30 }
    const ptransResult = applyItemRulesFromTemplate(ptransItem, euronetTemplate)
    assert(ptransResult.itemType === 'service_item', 'F9: PTRANS01 prefix → service_item')

    // F10: applyItemRulesFromTemplate — regular product stays unchanged
    const pralkaItem = { rawName: 'Pralka Bosch WAN28281', indeks: 'BOS-WAN', cenaNetto: 1299 }
    const pralkaResult = applyItemRulesFromTemplate(pralkaItem, euronetTemplate)
    assert(pralkaResult.itemType === undefined, 'F10a: produkt bez prefiksu serwisowego nie dostaje itemType')
    assert(pralkaResult.templateApplied?.includes('EURO-NET'), 'F10b: templateApplied ustawione')

    // F11: applyItemRulesFromTemplate — keyword match
    const transportItem = { rawName: 'Opłata za transport i wniesienie', indeks: '', cenaNetto: 29 }
    const transportResult = applyItemRulesFromTemplate(transportItem, euronetTemplate)
    assert(transportResult.itemType === 'service_item', 'F11a: słowo kluczowe "transport" → service_item')
    assert(transportResult.classifiedBy === 'template_keyword', 'F11b: classifiedBy = template_keyword')

    // F12: applyItemRulesFromTemplate — null template → passthrough
    const unchanged = applyItemRulesFromTemplate({ rawName: 'Test', cenaNetto: 10 }, null)
    assert(unchanged.rawName === 'Test', 'F12: null template → item nie zmieniony')

    // F13–F22: normalizeVatRate
    assert(normalizeVatRate('23%') === 23,        'F13: normalizeVatRate("23%") === 23')
    assert(normalizeVatRate('23 %') === 23,       'F14: normalizeVatRate("23 %") === 23')
    assert(normalizeVatRate('8') === 8,           'F15: normalizeVatRate("8") === 8')
    assert(normalizeVatRate('5%') === 5,          'F16: normalizeVatRate("5%") === 5')
    assert(normalizeVatRate('0') === 0,           'F17: normalizeVatRate("0") === 0')
    assert(normalizeVatRate('zw') === 0,          'F18: normalizeVatRate("zw") === 0')
    assert(normalizeVatRate('zwolnione') === 0,   'F19: normalizeVatRate("zwolnione") === 0')
    assert(normalizeVatRate('np') === 0,          'F20: normalizeVatRate("np") === 0')
    assert(normalizeVatRate('') === null,         'F21: normalizeVatRate("") === null')
    assert(normalizeVatRate('99') === null,       'F22: normalizeVatRate("99") → null (nieznana stawka)')

    // F23–F27: isForbiddenAsInvoiceItem — nowe przypadki
    assert(isForbiddenAsInvoiceItem('Termin zapłaty: 14 dni'),          'F23: Termin zapłaty → forbidden')
    assert(isForbiddenAsInvoiceItem('IBAN PL 12 3456 7890 1234 5678'),  'F24: IBAN → forbidden')
    assert(isForbiddenAsInvoiceItem('Strona 1 z 3'),                    'F25: Strona 1 z 3 → forbidden')
    assert(isForbiddenAsInvoiceItem('VAT 23%'),                         'F26: VAT 23% → forbidden')
    assert(!isForbiddenAsInvoiceItem('Farba lateksowa biała 10L', { hasPrice: true }), 'F27: farba → allowed')

    // F28–F32: advancedSimilarity
    const exact = advancedSimilarity('Farba lateksowa biała 10L', { nazwa: 'Farba lateksowa biała 10L' })
    assert(exact.score === 1.0, 'F28: identyczne nazwy → score 1.0')

    const similar = advancedSimilarity('Kabel HDMI złocony 2m', { nazwa: 'Kabel HDMI 2.0 złocony 2m' })
    assert(similar.score >= 0.5, `F29: podobne nazwy → score >= 0.5 (got ${similar.score})`)

    const skuExact = advancedSimilarity('BOX-1234', { nazwa: 'Wiertarka udarowa', sku: 'BOX-1234' })
    assert(skuExact.score === 1.0, 'F30: SKU match → score 1.0')
    assert(skuExact.confidenceLabel === 'strong', 'F31: SKU match → confidenceLabel strong')

    const unrelated = advancedSimilarity('Wkręt do drewna 4x40mm', { nazwa: 'Żarówka LED E27 9W' })
    assert(unrelated.score < 0.5, `F32: niezwiązane produkty → score < 0.5 (got ${unrelated.score})`)
  })

  it('G: parseInvoiceItemsLP — IKEA split+concatenated', () => {
    const ikeaText = [
      'FAKTURA VAT',
      'Sprzedawca: IKEA Retail Sp. z o.o.',
      '',
      'Lp. Nazwa Jedn. Ilość Cena netto Wartość netto VAT Kwota VAT Wartość brutto',
      '',
      '1 BILLY regał biały 80x28x202 cm szt.',
      '2 249,00 zł 498,00 zł 23% 114,54 zł 612,54 zł',
      '2 LEDARE żarówka LED E27 806 lm szt. 12 18,99 zł 227,88 zł 23% 52,41 zł 280,29 zł 3 TJENA pudełko z pokrywką 32x35x32 cm szt. 6 24,99 zł 149,94 zł 23% 34,49 zł 184,43 zł 4 VARDAGEN szklanka 31 cl szt. 8 7,59 zł 60,72 zł 23% 13,97 zł 74,69 zł',
      'RAZEM 936,54 zł 215,41 zł 1151,95 zł',
      'DO ZAPŁATY 1151,95 zł',
      'Numer rachunku: 12 3456 7890 1234 5678 9012 3456',
      'Płatność: przelew 7 dni',
    ].join('\n')

    const items = parseInvoiceItemsLP(ikeaText)

    assert(items.length === 4, `G01: IKEA LP parser returns 4 items (got ${items.length})`)

    // G02: BILLY — split continuation "2 249,00 zł..." must NOT become qty=2249
    const billy = items[0]
    assert(billy.ilosc === 2, `G02: BILLY qty=2 not ${billy.ilosc}`)
    assert(Math.abs(billy.cenaNetto - 249) < 0.01, `G03: BILLY unitPriceNet=249 not ${billy.cenaNetto}`)
    assert(Math.abs(billy.wartoscNetto - 498) < 0.01, `G04: BILLY totalNet=498 not ${billy.wartoscNetto}`)

    // G05: LEDARE — from concatenated line
    const ledare = items[1]
    assert(ledare.rawName.startsWith('LEDARE'), `G05: item[1] name starts LEDARE (got ${ledare.rawName})`)
    assert(ledare.ilosc === 12, `G06: LEDARE qty=12 not ${ledare.ilosc}`)
    assert(Math.abs(ledare.cenaNetto - 18.99) < 0.01, `G07: LEDARE price=18.99 not ${ledare.cenaNetto}`)

    // G08: TJENA
    const tjena = items[2]
    assert(tjena.rawName.startsWith('TJENA'), `G08: item[2] name starts TJENA (got ${tjena.rawName})`)
    assert(tjena.ilosc === 6, `G09: TJENA qty=6 not ${tjena.ilosc}`)
    assert(Math.abs(tjena.cenaNetto - 24.99) < 0.01, `G10: TJENA price=24.99 not ${tjena.cenaNetto}`)

    // G11: VARDAGEN — "31 cl" inside name must not create spurious LP 31 split
    const vardagen = items[3]
    assert(vardagen.rawName.startsWith('VARDAGEN'), `G11: item[3] name starts VARDAGEN (got ${vardagen.rawName})`)
    assert(vardagen.ilosc === 8, `G12: VARDAGEN qty=8 not ${vardagen.ilosc}`)
    assert(Math.abs(vardagen.cenaNetto - 7.59) < 0.01, `G13: VARDAGEN price=7.59 not ${vardagen.cenaNetto}`)

    // G14: stop lines must not appear as items
    const names = items.map(i => i.rawName.toLowerCase())
    assert(!names.some(n => n.includes('razem')), 'G14: RAZEM not in items')
    assert(!names.some(n => n.includes('zapłaty') || n.includes('zaplaty')), 'G15: DO ZAPŁATY not in items')
    assert(!names.some(n => n.includes('numer rachunku')), 'G16: Numer rachunku not in items')
  })

})

// ═══════════════════════════════════════════════════════════════
// EXPORT: runInvoiceParserSelfTest — callable from InvoiceLearningDebugPanel
// Returns { passed, failed, total, failures[] }
// ═══════════════════════════════════════════════════════════════

export async function runInvoiceParserSelfTest() {
  const results = { passed: 0, failed: 0, total: 0, failures: [] }

  function assert(condition, message) {
    results.total++
    if (condition) {
      results.passed++
      console.log('✅ PASS:', message)
    } else {
      results.failed++
      results.failures.push(message)
      console.error('❌ FAIL:', message)
    }
  }

  const { classifyDocument, classifyItem, isForbiddenLine } =
    await import('./invoiceDocumentClassifier.js')
  const { calculateConfidence } = await import('./invoiceValidation.js')
  const { normalizePolishNumber } = await import('./polishInvoicePatterns.js')
  const { isForbiddenAsInvoiceItem } = await import('./invoiceLineGuards.js')

  // ── Normalizacja liczb ────────────────────────────────────────
  assert(normalizePolishNumber('1 234,56') === 1234.56, 'normalizePolishNumber 1 234,56')
  assert(normalizePolishNumber('45.00') === 45.00, 'normalizePolishNumber 45.00')
  assert(normalizePolishNumber('1.234,56') === 1234.56, 'normalizePolishNumber 1.234,56 (dot=thousands)')
  assert(normalizePolishNumber('0,99') === 0.99, 'normalizePolishNumber 0,99')
  assert(isNaN(normalizePolishNumber('')), 'normalizePolishNumber pusty string → NaN')

  // ── Forbidden lines ───────────────────────────────────────────
  assert(isForbiddenLine('Razem netto 125,48'), 'isForbiddenLine: Razem netto')
  assert(isForbiddenLine('Zapłać online: play.pl'), 'isForbiddenLine: Zapłać online')
  assert(isForbiddenLine('Numer konta: 12 3456'), 'isForbiddenLine: Numer konta')
  assert(!isForbiddenLine('SYFON UMYWALKOWY BIAŁY'), 'isForbiddenLine: syfon allowed')
  assert(!isForbiddenLine('CLIN PŁYN DO SZYB 750ML'), 'isForbiddenLine: CLIN allowed')

  assert(isForbiddenAsInvoiceItem('Do zapłaty 70,00'), 'isForbiddenAsInvoiceItem: Do zapłaty')
  assert(!isForbiddenAsInvoiceItem('BATERIA AAA 4SZT'), 'isForbiddenAsInvoiceItem: Bateria allowed')

  // ── Klasyfikacja dokumentów ───────────────────────────────────
  const playText = 'usługi telekomunikacyjne abonament p4 sp rozliczenie konta'
  assert(classifyDocument(playText, []) === 'telecom_invoice', 'classifyDocument: Play → telecom_invoice')

  const bricoText = 'cena jednostkowa wartość netto jm syfon żarówka'
  const bricoTable = [{ columnMap: { ILOSC: { x: 200 }, JEDNOSTKA: { x: 250 } }, rowCount: 3 }]
  assert(classifyDocument(bricoText, bricoTable) === 'inventory_purchase_invoice', 'classifyDocument: Brico → inventory_purchase_invoice')

  // ── classifyItem ─────────────────────────────────────────────
  const { itemType: t1, shouldAffectInventory: a1 } = classifyItem(
    { rawName: 'Usługi telekomunikacyjne', ilosc: 1, cenaNetto: 52.85, jednostka: 'usł.' },
    'telecom_invoice'
  )
  assert(t1 === 'service_item', 'classifyItem: Usługi telekomunikacyjne → service_item')
  assert(a1 === false, 'classifyItem: telecom → shouldAffectInventory=false')

  const { itemType: t2, shouldAffectInventory: a2 } = classifyItem(
    { rawName: 'Abonament TV 4G', ilosc: 1, cenaNetto: 5.00, jednostka: 'szt' },
    'telecom_invoice'
  )
  assert(t2 === 'service_item', 'classifyItem: dowolna pozycja w telecom_invoice → service_item')
  assert(a2 === false, 'classifyItem: telecom pozycja bez słów kluczowych → inventory=false')

  const { itemType: t3, shouldAffectInventory: a3 } = classifyItem(
    { rawName: 'SYFON UMYWALKOWY 32MM', ilosc: 2, cenaNetto: 19.99, jednostka: 'szt' },
    'inventory_purchase_invoice'
  )
  assert(t3 === 'inventory_item', 'classifyItem: syfon w inventory_purchase_invoice → inventory_item')
  assert(a3 === true, 'classifyItem: syfon → shouldAffectInventory=true')

  const { itemType: t4 } = classifyItem(
    { rawName: 'Razem do zapłaty', cenaNetto: 70, ilosc: 1, jednostka: 'szt' },
    'inventory_purchase_invoice'
  )
  assert(t4 === 'summary_line', 'classifyItem: Razem do zapłaty → summary_line')

  // ── Confidence max 95 ────────────────────────────────────────
  const perfectResult = {
    fields: {
      numer: 'FV/001', data_zakupu: '2026-05-22',
      kontrahent_nip: '1234567890',
      pozycje: [
        { itemType: 'inventory_item', ilosc: 1, cenaNetto: 10, wartoscNetto: 10, matchScore: 0.9 },
      ],
    },
    validation: { errors: [], warnings: [] },
    documentType: 'inventory_purchase_invoice',
  }
  const conf = calculateConfidence(perfectResult, 'inventory_purchase_invoice')
  assert(conf <= 95, 'calculateConfidence: max 95%')
  assert(conf > 0, 'calculateConfidence: > 0 dla kompletnego wyniku')

  console.log(`\n📊 Self-test: ${results.passed}/${results.total} passed`)
  if (results.failures.length > 0) console.error('Failed:', results.failures)

  return results
}
