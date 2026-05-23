// Clean structural self-test — no side effects, no localStorage, no top-level code.
// Returns { passed, failed, total, failures, results } and never mutates any state.

import { normalizePolishNumber, normalizeDate, normalizeVatRate } from './polishInvoicePatterns.js'
import { isForbiddenAsInvoiceItem } from './invoiceLineGuards.js'
import { classifyDocument, classifyItem } from './invoiceDocumentClassifier.js'
import { calculateConfidence } from './invoiceValidation.js'
import { findSupplierTemplate, applyItemRulesFromTemplate } from './invoiceSupplierTemplates.js'
import { advancedSimilarity } from './productNormalizer.js'

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
