// Unit tests — run in browser console: import('/src/utils/invoiceExtractor.test.js')
// or: node --input-type=module < src/utils/invoiceExtractor.test.js (requires Node ESM support)

import { normalizePolishNumber, normalizeDate, extractWithPatterns } from './polishInvoicePatterns.js'
import { parseInvoiceItems } from './invoiceExtractor.js'
import { detectColumnMap } from './invoiceLineParser.js'

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

console.log('Tests complete.')
