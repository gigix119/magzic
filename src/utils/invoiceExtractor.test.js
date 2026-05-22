// Unit tests — run in browser console: import('/src/utils/invoiceExtractor.test.js')
// or: node --input-type=module < src/utils/invoiceExtractor.test.js (requires Node ESM support)

import { normalizePolishNumber, normalizeDate, extractWithPatterns } from './polishInvoicePatterns.js'
import { parseInvoiceItems } from './invoiceExtractor.js'
import { detectColumnMap } from './invoiceLineParser.js'
import { classifyDocument, classifyItem } from './invoiceDocumentClassifier.js'
import { isForbiddenAsInvoiceItem } from './invoiceLineGuards.js'
import { calculateConfidence } from './invoiceValidation.js'
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
  if (!condition) console.error('FAIL:', message)
  else console.log('PASS:', message)
}

function approx(a, b, eps = 0.001) {
  return Math.abs(a - b) < eps
}

// ── normalizePolishNumber ────────────────────────────────────────────
assert(approx(normalizePolishNumber('1 234,56'), 1234.56), "normalizePolishNumber('1 234,56') === 1234.56")
assert(approx(normalizePolishNumber('1234,56'), 1234.56),  "normalizePolishNumber('1234,56') === 1234.56")
assert(approx(normalizePolishNumber('45.00'), 45.00),       "normalizePolishNumber('45.00') === 45.00")
assert(approx(normalizePolishNumber('1.234,56'), 1234.56), "normalizePolishNumber('1.234,56') === 1234.56 (dot=thousands)")
assert(approx(normalizePolishNumber('0,99'), 0.99),         "normalizePolishNumber('0,99') === 0.99")
assert(approx(normalizePolishNumber('100'), 100),           "normalizePolishNumber('100') === 100")
assert(isNaN(normalizePolishNumber('')),                    "normalizePolishNumber('') is NaN")
assert(isNaN(normalizePolishNumber(null)),                  "normalizePolishNumber(null) is NaN")

// ── normalizeDate ────────────────────────────────────────────────────
assert(normalizeDate('15.04.2026') === '2026-04-15', "normalizeDate('15.04.2026')")
assert(normalizeDate('01/03/2025') === '2025-03-01', "normalizeDate('01/03/2025')")
assert(normalizeDate('2026-04-15') === '2026-04-15', "normalizeDate already ISO")
assert(normalizeDate('3.5.2024') === '2024-05-03',   "normalizeDate('3.5.2024') single digits")
assert(normalizeDate('15-04-2026') === '2026-04-15', "normalizeDate('15-04-2026')")
assert(normalizeDate(null) === null,                  "normalizeDate(null) === null")

// ── extractWithPatterns ──────────────────────────────────────────────
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

// ── parseInvoiceItems (regex fallback) ───────────────────────────────
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

// ── detectColumnMap ──────────────────────────────────────────────────
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

// ── Regression: classifyDocument ────────────────────────────────────
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

// ── Regression: isForbiddenAsInvoiceItem ────────────────────────────
assert(isForbiddenAsInvoiceItem('Razem netto 125,48'), 'Razem netto nie może być pozycją')
assert(isForbiddenAsInvoiceItem('Zapłać online: play.pl'), 'Zapłać online nie może być pozycją')
assert(isForbiddenAsInvoiceItem('Numer konta: 12 3456 7890'), 'Numer konta nie może być pozycją')
assert(!isForbiddenAsInvoiceItem('SYFON UMYWALKOWY BIAŁY 32MM'), 'Syfon może być pozycją')
assert(!isForbiddenAsInvoiceItem('BATERIA AAA 4SZT'), 'Bateria może być pozycją')
assert(isForbiddenAsInvoiceItem('Do zapłaty 70,00'), 'Do zapłaty nie może być pozycją')

// ── Regression: confidence max 95 ───────────────────────────────────
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

// ── Regression: service item nie matchuje do towaru ──────────────────
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

// ── Regression: classifyItem returns summary_line for forbidden ──────
const { itemType: summaryType } = classifyItem({ rawName: 'Razem do zapłaty', cenaNetto: 70, ilosc: 1, jednostka: 'szt' }, 'inventory_purchase_invoice')
assert(summaryType === 'summary_line', 'Razem do zapłaty powinno być summary_line')

// ═══════════════════════════════════════════════════════════════
// A. Play/service invoice regressions
// ═══════════════════════════════════════════════════════════════

const { itemType: playItemType, shouldAffectInventory: playAffect } = classifyItem(
  { rawName: 'Usługi telekomunikacyjne', ilosc: 1, cenaNetto: 52.85, jednostka: 'usł.' },
  'telecom_invoice'
)
assert(playItemType === 'service_item', 'Play: Usługi telekomunikacyjne muszą być service_item')
assert(playAffect === false, 'Play: Usługi telekomunikacyjne nie wpływają na magazyn')

// Line without service keyword but inside telecom_invoice — must still be service_item
const { itemType: playGeneric, shouldAffectInventory: playGenericAffect } = classifyItem(
  { rawName: 'TV 4K - Rodzina M 5G', ilosc: 1, cenaNetto: 5.00, jednostka: 'szt' },
  'telecom_invoice'
)
assert(playGeneric === 'service_item', 'Play: dowolna pozycja w telecom_invoice to service_item (bez słów kluczowych)')
assert(playGenericAffect === false, 'Play: dowolna pozycja w telecom_invoice nie wpływa na magazyn')

assert(isForbiddenAsInvoiceItem('Zapłać online: play.pl'), 'Play: Zapłać online nie może być pozycją')
assert(isForbiddenAsInvoiceItem('Numer konta: 12 3456 7890'), 'Play: Numer konta nie może być pozycją')
assert(isForbiddenAsInvoiceItem('Termin płatności 2026-06-01'), 'Play: Termin płatności nie może być pozycją')

// ═══════════════════════════════════════════════════════════════
// B. Brico/inventory invoice regressions
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// C. Mixed invoice regressions
// ═══════════════════════════════════════════════════════════════

const mixedDoc = 'unknown'
const { itemType: mixedTowar } = classifyItem(
  { rawName: 'Syfon umywalkowy', ilosc: 2, cenaNetto: 19.99, jednostka: 'szt' },
  mixedDoc
)
assert(mixedTowar === 'inventory_item', 'Mixed: towar z ceną i ilością to inventory_item')

const { itemType: mixedUsługa, shouldAffectInventory: mixedUsługaAffect } = classifyItem(
  { rawName: 'Usługa transportowa', ilosc: 1, cenaNetto: 50.00, jednostka: 'usł.' },
  mixedDoc
)
assert(mixedUsługa === 'service_item', 'Mixed: usługa transportowa to service_item')
assert(mixedUsługaAffect === false, 'Mixed: usługa transportowa nie wpływa na magazyn')

// ═══════════════════════════════════════════════════════════════
// D. AI result guard tests
// ═══════════════════════════════════════════════════════════════

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
const { valid: validSchema, errors: schemaErrors } = validateAiInvoiceSchema({
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

// ═══════════════════════════════════════════════════════════════
// E. Learning data tests
// ═══════════════════════════════════════════════════════════════

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

console.log('All tests complete.')
