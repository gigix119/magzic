// Unit tests — run in browser console: import('/src/utils/invoiceExtractor.test.js')
// or: node --input-type=module < src/utils/invoiceExtractor.test.js (requires Node ESM support)

import { normalizePolishNumber, normalizeDate, extractWithPatterns } from './polishInvoicePatterns.js'
import { parseInvoiceItems } from './invoiceExtractor.js'
import { detectColumnMap } from './invoiceLineParser.js'
import { classifyDocument, classifyItem } from './invoiceDocumentClassifier.js'
import { isForbiddenAsInvoiceItem } from './invoiceLineGuards.js'
import { calculateConfidence } from './invoiceValidation.js'

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

console.log('Tests complete.')
