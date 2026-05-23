import { rankProductCandidates } from './invoiceScoringEngine.js'
import { getInvoiceModelConfig } from './invoiceModelConfig.js'

const SERVICE_DOC_TYPES = new Set(['telecom_invoice', 'utility_invoice', 'service_cost_invoice'])

// ── Text anonymization ────────────────────────────────────────────────────────

export function anonymizeInvoiceText(text) {
  if (!text) return ''
  let t = String(text)
  // IBAN (PL + 26 digits, possibly with spaces)
  t = t.replace(/\bPL\s?\d{2}[\s\d]{26,32}/gi, 'PL XX XXXX XXXX XXXX XXXX XXXX XXXX')
  // NIP: 10 digits with optional separators
  t = t.replace(/\b\d{3}[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2}\b/g, 'XXX-XXX-XX-XX')
  // PESEL: 11 digits
  t = t.replace(/\b\d{11}\b/g, 'XXXXXXXXXXX')
  // Phone
  t = t.replace(/\b(\+48[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/g, 'XXX-XXX-XXX')
  // Email
  t = t.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'xxx@xxx.xxx')
  return t
}

// ── Product match helper ──────────────────────────────────────────────────────

export function buildExpectedProductMatch(rawName, products, context = {}) {
  if (!rawName || !Array.isArray(products) || products.length === 0) {
    return { productId: null, score: 0, confidenceLabel: 'weak' }
  }
  const cfg = getInvoiceModelConfig()
  const result = rankProductCandidates(rawName, products, context, cfg)
  const best = result.best
  if (!best) return { productId: null, score: 0, confidenceLabel: 'weak' }
  return {
    productId: best.product?.id ?? null,
    score: best.score,
    confidenceLabel: best.confidenceLabel,
    reasons: best.reasons || [],
  }
}

// ── Golden sample builder from approved invoice ───────────────────────────────

export function buildGoldenSampleFromApprovedInvoice(extractionResult, approvedItems, options = {}) {
  const { name, anonymize = false } = options
  const docType = extractionResult?.documentType || 'unknown'
  const fields = extractionResult?.fields || {}

  const rawText = anonymize
    ? anonymizeInvoiceText(extractionResult?.rawText || '')
    : null

  const pozycje = (approvedItems || []).map(item => ({
    nazwa: item.nazwa || item.name || item.rawName || '',
    rawName: item.rawName || '',
    ilosc: item.ilosc ?? item.quantity ?? null,
    jednostka: item.jednostka || item.unit || null,
    cenaNetto: item.cenaNetto ?? item.unitPriceNet ?? null,
    expectedItemType: item.itemType || null,
    expectedShouldAffectInventory: item.shouldAffectInventory ?? null,
    expectedProductId: item.matchedProductId || null,
    itemType: item.itemType || null,
    shouldAffectInventory: item.shouldAffectInventory ?? null,
  }))

  const isServiceDoc = SERVICE_DOC_TYPES.has(docType)
  const hasInventory = !isServiceDoc && pozycje.some(p => p.expectedItemType === 'inventory_item')
  const hasService = isServiceDoc || pozycje.some(p => p.expectedItemType === 'service_item')
  const supplierType = hasInventory && hasService ? 'mixed'
    : hasInventory ? 'inventory' : 'service'

  const hasProductMatches = pozycje.some(p => !!p.expectedProductId)

  return {
    name: (name || `Faktura ${fields.numer || ''} ${new Date().toLocaleDateString('pl-PL')}`).trim(),
    supplierName: fields.kontrahent_nazwa || null,
    supplierNip: fields.kontrahent_nip || null,
    documentType: docType,
    category: supplierType,
    inputSample: rawText ? {
      rawText,
      fields: {
        numer: fields.numer || null,
        data_zakupu: fields.data_zakupu || null,
        kontrahent_nip: fields.kontrahent_nip || null,
        kontrahent_nazwa: fields.kontrahent_nazwa || null,
        suma_netto: fields.suma_netto || null,
      },
    } : null,
    evaluationHints: {
      supplierType,
      expectedProductMatchAvailable: hasProductMatches,
    },
    expectedOutput: {
      documentType: docType,
      pozycje,
    },
    tags: [
      extractionResult?.source,
      `conf:${extractionResult?.confidence}`,
      supplierType,
    ].filter(Boolean),
  }
}

// ── Synthetic golden samples ──────────────────────────────────────────────────

export function buildSyntheticGoldenSample(type) {
  if (type === 'brico') {
    return {
      name: 'Synthetic — Brico Marche (inwentarz)',
      supplierName: 'Brico Marche',
      supplierNip: '7272608066',
      documentType: 'inventory_purchase_invoice',
      category: 'inventory',
      inputSample: null,
      evaluationHints: { supplierType: 'inventory', expectedProductMatchAvailable: false },
      expectedOutput: {
        documentType: 'inventory_purchase_invoice',
        pozycje: [
          { nazwa: 'Syfon umywalkowy 32mm', rawName: 'SYFON UMYWALKOWY 32MM', ilosc: 2, jednostka: 'szt', cenaNetto: 19.99, expectedItemType: 'inventory_item', expectedShouldAffectInventory: true, expectedProductId: null, itemType: 'inventory_item', shouldAffectInventory: true },
          { nazwa: 'Bateria wannowa chrom', rawName: 'BATERIA WANNOWA CHROM EVO', ilosc: 1, jednostka: 'szt', cenaNetto: 89.99, expectedItemType: 'inventory_item', expectedShouldAffectInventory: true, expectedProductId: null, itemType: 'inventory_item', shouldAffectInventory: true },
          { nazwa: 'Silikon sanitarny biały 280ml', rawName: 'SILIKON SANITARNY BIALY 280ML', ilosc: 3, jednostka: 'szt', cenaNetto: 12.50, expectedItemType: 'inventory_item', expectedShouldAffectInventory: true, expectedProductId: null, itemType: 'inventory_item', shouldAffectInventory: true },
        ],
      },
      tags: ['synthetic', 'inventory'],
    }
  }

  if (type === 'play') {
    return {
      name: 'Synthetic — Play (faktura usługowa)',
      supplierName: 'P4 Sp. z o.o.',
      supplierNip: '9512074656',
      documentType: 'telecom_invoice',
      category: 'service',
      inputSample: null,
      evaluationHints: { supplierType: 'service', expectedProductMatchAvailable: false },
      expectedOutput: {
        documentType: 'telecom_invoice',
        pozycje: [
          { nazwa: 'Usługi telekomunikacyjne — abonament', rawName: 'Usługi telekomunikacyjne abonament', ilosc: 1, jednostka: 'usł.', cenaNetto: 52.85, expectedItemType: 'service_item', expectedShouldAffectInventory: false, expectedProductId: null, itemType: 'service_item', shouldAffectInventory: false },
          { nazwa: 'Opłata serwisowa internetowa', rawName: 'Opłata serwisowa internetowa', ilosc: 1, jednostka: 'usł.', cenaNetto: 10.00, expectedItemType: 'service_item', expectedShouldAffectInventory: false, expectedProductId: null, itemType: 'service_item', shouldAffectInventory: false },
        ],
      },
      tags: ['synthetic', 'service', 'telecom'],
    }
  }

  if (type === 'mixed') {
    return {
      name: 'Synthetic — Faktura mieszana',
      supplierName: 'Firma Mixed Sp. z o.o.',
      supplierNip: null,
      documentType: 'mixed_invoice',
      category: 'mixed',
      inputSample: null,
      evaluationHints: { supplierType: 'mixed', expectedProductMatchAvailable: false },
      expectedOutput: {
        documentType: 'mixed_invoice',
        pozycje: [
          { nazwa: 'Pralka Bosch WAT28400PL', rawName: 'Pralka Bosch WAT28400PL', ilosc: 1, jednostka: 'szt', cenaNetto: 1299.00, expectedItemType: 'inventory_item', expectedShouldAffectInventory: true, expectedProductId: null, itemType: 'inventory_item', shouldAffectInventory: true },
          { nazwa: 'Wniesienie i podłączenie sprzętu', rawName: 'Wniesienie i podłączenie sprzętu', ilosc: 1, jednostka: 'usł.', cenaNetto: 150.00, expectedItemType: 'service_item', expectedShouldAffectInventory: false, expectedProductId: null, itemType: 'service_item', shouldAffectInventory: false },
        ],
      },
      tags: ['synthetic', 'mixed'],
    }
  }

  return null
}

// ── Typed evaluation dataset ──────────────────────────────────────────────────

export function extractEvaluationDatasetFromGoldenSamples(goldenSamples, products = []) {
  const items = []
  const productsList = Array.isArray(products) ? products : []

  for (const sample of (goldenSamples || [])) {
    const docType = sample.expectedOutput?.documentType
    if (!docType) continue

    items.push({
      id: `${sample.id}_doctype`,
      task: 'document_type',
      sampleId: sample.id,
      sampleName: sample.name || sample.id,
      input: {
        documentType: sample.documentType || docType,
        supplierNip: sample.supplierNip || null,
        supplierName: sample.supplierName || null,
      },
      expected: { documentType: docType },
      source: 'golden',
    })

    const pozycje = sample.expectedOutput?.pozycje || []
    for (let i = 0; i < pozycje.length; i++) {
      const poz = pozycje[i]
      const expectedItemType = poz.expectedItemType || poz.itemType
      const expectedShouldAffect = poz.expectedShouldAffectInventory ?? poz.shouldAffectInventory

      if (expectedItemType) {
        items.push({
          id: `${sample.id}_item_${i}`,
          task: 'item_type',
          sampleId: sample.id,
          sampleName: sample.name || sample.id,
          input: {
            rawName: poz.rawName || poz.nazwa || '',
            ilosc: poz.ilosc,
            jednostka: poz.jednostka,
            cenaNetto: poz.cenaNetto,
            documentType: docType,
          },
          expected: {
            itemType: expectedItemType,
            shouldAffectInventory: typeof expectedShouldAffect === 'boolean' ? expectedShouldAffect : null,
          },
          source: 'golden',
        })
      }

      if (poz.rawName && poz.expectedProductId && productsList.length > 0) {
        items.push({
          id: `${sample.id}_product_${i}`,
          task: 'product_match',
          sampleId: sample.id,
          sampleName: sample.name || sample.id,
          input: {
            rawName: poz.rawName,
            jednostka: poz.jednostka,
            supplierNip: sample.supplierNip || null,
            cenaNetto: poz.cenaNetto,
            itemType: expectedItemType || 'inventory_item',
          },
          expected: { productId: poz.expectedProductId },
          source: 'golden',
        })
      }
    }
  }

  return items
}
