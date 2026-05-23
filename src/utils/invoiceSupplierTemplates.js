// ── Built-in supplier templates ───────────────────────────────────────
// Hardcoded catalog of known Polish suppliers with their document rules.
// localStorage-based learning templates are separate (getTemplateForSupplier/saveTemplateFromExtraction).

export const SUPPLIER_TEMPLATES = [
  // ── EURO-NET ──────────────────────────────────────────────────────────
  {
    nip: '5270005984',
    name: 'EURO-NET sp. z o.o.',
    aliases: ['EURO-NET', 'EuroNet', 'EURONET', 'euro-net'],
    documentType: 'inventory_purchase_invoice',
    detectionPatterns: [
      /EURO[-\s]?NET/i,
      /NIP[:\s]*527[\s-]?000[\s-]?59[\s-]?84/,
    ],
    tableColumns: {
      indeks: { keywords: ['indeks', 'kod', 'sku', 'index'] },
      nazwa: { keywords: ['nazwa', 'opis', 'towar'] },
      ilosc: { keywords: ['ilość', 'ilosc', 'szt', 'qty'] },
      jednostka: { keywords: ['jm', 'j.m.', 'jedn', 'unit'] },
      cenaNetto: { keywords: ['cena netto', 'cena j.n.', 'cena jedn'] },
      vat: { keywords: ['vat', 'stawka'] },
      wartoscNetto: { keywords: ['wartość netto', 'wartosc netto', 'wart. netto'] },
    },
    itemRules: {
      serviceIndexPrefixes: ['PUSPAK', 'PTRANS', 'PMONT', 'PSERW', 'PGOTP', 'PUBEZ'],
      serviceKeywords: [
        'wniesienie', 'rozpakowanie', 'instalacja', 'demontaż', 'demontaz',
        'transport', 'pobranie przy odbiorze', 'opłata', 'oplata',
        'gwarancja', 'ubezpieczenie', 'rata', 'dostarczenie',
      ],
    },
    validation: {
      minPozycji: 1,
      maxPozycji: 100,
      requiredFields: ['nazwa', 'ilosc', 'cenaNetto'],
      expectedVatRates: [0, 8, 23],
    },
  },

  // ── Brico Marche ──────────────────────────────────────────────────────
  {
    nip: null,
    name: 'Brico Marche',
    aliases: ['BRICO', 'Brico Marche', 'BRICO MARCHE', 'Brico Depot'],
    documentType: 'inventory_purchase_invoice',
    detectionPatterns: [
      /BRICO\s*(MARCHE|DEPOT)?/i,
    ],
    tableColumns: {
      indeks: { keywords: ['kod', 'ref', 'ean', 'indeks'] },
      nazwa: { keywords: ['nazwa', 'opis', 'produkt', 'towar'] },
      ilosc: { keywords: ['ilość', 'ilosc', 'qty', 'szt'] },
      jednostka: { keywords: ['jm', 'j.m.', 'jedn'] },
      cenaNetto: { keywords: ['cena netto', 'cena j.'] },
      vat: { keywords: ['vat', 'stawka'] },
      wartoscNetto: { keywords: ['wartość netto', 'wartosc netto'] },
    },
    itemRules: {
      serviceIndexPrefixes: [],
      serviceKeywords: ['dostawa', 'transport', 'opłata serwisowa'],
    },
    validation: {
      minPozycji: 1,
      maxPozycji: 200,
      requiredFields: ['nazwa', 'ilosc', 'cenaNetto'],
      expectedVatRates: [0, 8, 23],
    },
  },

  // ── Castorama Polska ──────────────────────────────────────────────────
  {
    nip: '5260208211',
    name: 'Castorama Polska sp. z o.o.',
    aliases: ['CASTORAMA', 'Castorama', 'castorama'],
    documentType: 'inventory_purchase_invoice',
    detectionPatterns: [
      /CASTORAMA/i,
      /NIP[:\s]*526[\s-]?020[\s-]?82[\s-]?11/,
    ],
    tableColumns: {
      indeks: { keywords: ['kod', 'ref', 'ean', 'symbol'] },
      nazwa: { keywords: ['nazwa', 'opis', 'artykuł', 'artykul'] },
      ilosc: { keywords: ['ilość', 'ilosc', 'qty'] },
      jednostka: { keywords: ['jm', 'j.m.', 'jedn'] },
      cenaNetto: { keywords: ['cena netto', 'cena jedn'] },
      vat: { keywords: ['vat', 'stawka'] },
      wartoscNetto: { keywords: ['wartość netto', 'wartosc netto'] },
    },
    itemRules: {
      serviceIndexPrefixes: [],
      serviceKeywords: ['dostawa', 'transport', 'montaż', 'montaz', 'usługa', 'usluga'],
    },
    validation: {
      minPozycji: 1, maxPozycji: 200,
      requiredFields: ['nazwa', 'ilosc', 'cenaNetto'],
      expectedVatRates: [0, 8, 23],
    },
  },

  // ── Leroy Merlin ─────────────────────────────────────────────────────
  {
    nip: '1130089950',
    name: 'Leroy Merlin Polska sp. z o.o.',
    aliases: ['LEROY MERLIN', 'Leroy Merlin', 'leroy merlin', 'LM'],
    documentType: 'inventory_purchase_invoice',
    detectionPatterns: [
      /LEROY\s*MERLIN/i,
      /NIP[:\s]*113[\s-]?008[\s-]?99[\s-]?50/,
    ],
    tableColumns: {
      indeks: { keywords: ['kod', 'ref', 'ean', 'symbol', 'nr art'] },
      nazwa: { keywords: ['nazwa', 'opis', 'artykuł'] },
      ilosc: { keywords: ['ilość', 'ilosc', 'qty'] },
      jednostka: { keywords: ['jm', 'j.m.', 'jedn', 'um'] },
      cenaNetto: { keywords: ['cena netto', 'cena j.n.'] },
      vat: { keywords: ['vat', 'stawka'] },
      wartoscNetto: { keywords: ['wartość netto', 'wartosc netto'] },
    },
    itemRules: {
      serviceIndexPrefixes: [],
      serviceKeywords: ['dostawa', 'transport', 'montaż', 'montaz', 'cięcie', 'ciecie'],
    },
    validation: {
      minPozycji: 1, maxPozycji: 200,
      requiredFields: ['nazwa', 'ilosc', 'cenaNetto'],
      expectedVatRates: [0, 8, 23],
    },
  },

  // ── PSB Mrówka ────────────────────────────────────────────────────────
  {
    nip: null,
    name: 'PSB Mrówka',
    aliases: ['PSB', 'Mrówka', 'MROWKA', 'PSB MROWKA', 'PSB Mrówka'],
    documentType: 'inventory_purchase_invoice',
    detectionPatterns: [/PSB|MROWKA|Mrówka/i],
    tableColumns: {
      indeks: { keywords: ['kod', 'symbol', 'indeks'] },
      nazwa: { keywords: ['nazwa', 'opis', 'towar'] },
      ilosc: { keywords: ['ilość', 'ilosc'] },
      jednostka: { keywords: ['jm', 'jedn'] },
      cenaNetto: { keywords: ['cena netto', 'cena j.'] },
      vat: { keywords: ['vat'] },
      wartoscNetto: { keywords: ['wartość netto', 'wartosc netto'] },
    },
    itemRules: {
      serviceIndexPrefixes: [],
      serviceKeywords: ['dostawa', 'transport', 'usługa'],
    },
    validation: {
      minPozycji: 1, maxPozycji: 200,
      requiredFields: ['nazwa', 'ilosc', 'cenaNetto'],
      expectedVatRates: [0, 8, 23],
    },
  },

  // ── Selgros ──────────────────────────────────────────────────────────
  {
    nip: '5270101764',
    name: 'Selgros Sp. z o.o.',
    aliases: ['SELGROS', 'Selgros'],
    documentType: 'inventory_purchase_invoice',
    detectionPatterns: [
      /SELGROS/i,
      /NIP[:\s]*527[\s-]?010[\s-]?17[\s-]?64/,
    ],
    tableColumns: {
      indeks: { keywords: ['kod', 'ean', 'artykuł', 'nr art'] },
      nazwa: { keywords: ['nazwa', 'opis', 'towar'] },
      ilosc: { keywords: ['ilość', 'ilosc', 'szt'] },
      jednostka: { keywords: ['jm', 'j.m.', 'jedn'] },
      cenaNetto: { keywords: ['cena netto', 'cena'] },
      vat: { keywords: ['vat', 'stawka'] },
      wartoscNetto: { keywords: ['wartość netto', 'wartosc netto'] },
    },
    itemRules: {
      serviceIndexPrefixes: [],
      serviceKeywords: ['opakowanie zwrotne', 'kaucja', 'dostawa', 'transport'],
    },
    validation: {
      minPozycji: 1, maxPozycji: 500,
      requiredFields: ['nazwa', 'ilosc', 'cenaNetto'],
      expectedVatRates: [0, 5, 8, 23],
    },
  },

  // ── Makro Cash and Carry ──────────────────────────────────────────────
  {
    nip: '1130014086',
    name: 'Makro Cash and Carry Polska S.A.',
    aliases: ['MAKRO', 'Makro', 'MAKRO C&C', 'Metro', 'METRO'],
    documentType: 'inventory_purchase_invoice',
    detectionPatterns: [
      /MAKRO|METRO/i,
      /NIP[:\s]*113[\s-]?001[\s-]?40[\s-]?86/,
    ],
    tableColumns: {
      indeks: { keywords: ['art. nr', 'artnr', 'kod', 'ean'] },
      nazwa: { keywords: ['nazwa', 'opis', 'artykuł', 'produkt'] },
      ilosc: { keywords: ['ilość', 'ilosc', 'qty'] },
      jednostka: { keywords: ['jm', 'j.m.', 'jedn'] },
      cenaNetto: { keywords: ['cena netto', 'cena j.n.'] },
      vat: { keywords: ['vat', 'stawka'] },
      wartoscNetto: { keywords: ['wartość netto'] },
    },
    itemRules: {
      serviceIndexPrefixes: [],
      serviceKeywords: ['dostawa', 'transport', 'opłata', 'oplata', 'karta makro'],
    },
    validation: {
      minPozycji: 1, maxPozycji: 500,
      requiredFields: ['nazwa', 'ilosc', 'cenaNetto'],
      expectedVatRates: [0, 5, 8, 23],
    },
  },

  // ── P4 / Play ─────────────────────────────────────────────────────────
  {
    nip: '9512074656',
    name: 'P4 sp. z o.o.',
    aliases: ['P4', 'Play', 'PLAY', 'P4 sp. z o.o.'],
    documentType: 'telecom_invoice',
    detectionPatterns: [
      /\bP4\s+sp\b/i,
      /\bPLAY\b/i,
      /NIP[:\s]*951[\s-]?207[\s-]?46[\s-]?56/,
    ],
    itemRules: {
      serviceIndexPrefixes: [],
      serviceKeywords: [
        'usługi telekomunikacyjne', 'abonament', 'połączenia', 'sms',
        'internet mobilny', 'roaming', 'opłata aktywacyjna',
      ],
    },
    validation: {
      minPozycji: 0, maxPozycji: 50,
      requiredFields: [],
      expectedVatRates: [0, 8, 23],
    },
  },

  // ── Orange Polska ─────────────────────────────────────────────────────
  {
    nip: '5260250995',
    name: 'Orange Polska S.A.',
    aliases: ['ORANGE', 'Orange', 'Orange Polska', 'ORANGE POLSKA', 'TP S.A.'],
    documentType: 'telecom_invoice',
    detectionPatterns: [
      /ORANGE\s+POLSKA/i,
      /NIP[:\s]*526[\s-]?025[\s-]?09[\s-]?95/,
    ],
    itemRules: {
      serviceIndexPrefixes: [],
      serviceKeywords: [
        'usługi telekomunikacyjne', 'abonament', 'telefonia', 'internet',
        'telewizja', 'roaming', 'połączenia', 'sms', 'opłata',
      ],
    },
    validation: {
      minPozycji: 0, maxPozycji: 50,
      requiredFields: [],
      expectedVatRates: [0, 8, 23],
    },
  },

  // ── T-Mobile Polska ───────────────────────────────────────────────────
  {
    nip: '5261040567',
    name: 'T-Mobile Polska S.A.',
    aliases: ['T-MOBILE', 'T-Mobile', 'TMOBILE', 'Era', 'Polkomtel'],
    documentType: 'telecom_invoice',
    detectionPatterns: [
      /T[\s-]?MOBILE/i,
      /NIP[:\s]*526[\s-]?104[\s-]?05[\s-]?67/,
    ],
    itemRules: {
      serviceIndexPrefixes: [],
      serviceKeywords: [
        'abonament', 'usługi telekomunikacyjne', 'internet', 'roaming',
        'połączenia', 'sms', 'mms', 'opłata',
      ],
    },
    validation: {
      minPozycji: 0, maxPozycji: 50,
      requiredFields: [],
      expectedVatRates: [0, 8, 23],
    },
  },

  // ── Tauron Sprzedaż ───────────────────────────────────────────────────
  {
    nip: '6762460451',
    name: 'Tauron Sprzedaż sp. z o.o.',
    aliases: ['TAURON', 'Tauron', 'Tauron Sprzedaż', 'TAURON SPRZEDAZ'],
    documentType: 'utility_invoice',
    detectionPatterns: [
      /TAURON/i,
      /NIP[:\s]*676[\s-]?246[\s-]?04[\s-]?51/,
    ],
    itemRules: {
      serviceIndexPrefixes: [],
      serviceKeywords: ['energia elektryczna', 'dystrybucja', 'opłata', 'rozliczenie'],
    },
    validation: {
      minPozycji: 0, maxPozycji: 20,
      requiredFields: [],
      expectedVatRates: [0, 5, 23],
    },
  },

  // ── PGE Obrót ─────────────────────────────────────────────────────────
  {
    nip: '7891022026',
    name: 'PGE Obrót S.A.',
    aliases: ['PGE', 'PGE OBROT', 'PGE Obrót', 'PGE Polska Grupa Energetyczna'],
    documentType: 'utility_invoice',
    detectionPatterns: [
      /PGE\s*(Obrót|Obrot|Energia|S\.A\.)?/i,
      /NIP[:\s]*789[\s-]?102[\s-]?20[\s-]?26/,
    ],
    itemRules: {
      serviceIndexPrefixes: [],
      serviceKeywords: ['energia elektryczna', 'dystrybucja', 'opłata', 'paliwo gazowe'],
    },
    validation: {
      minPozycji: 0, maxPozycji: 20,
      requiredFields: [],
      expectedVatRates: [0, 5, 23],
    },
  },

  // ── Allegro ───────────────────────────────────────────────────────────
  {
    nip: '5252674798',
    name: 'Allegro sp. z o.o.',
    aliases: ['ALLEGRO', 'Allegro', 'allegro.pl'],
    documentType: 'inventory_purchase_invoice',
    detectionPatterns: [
      /ALLEGRO/i,
      /NIP[:\s]*525[\s-]?267[\s-]?47[\s-]?98/,
    ],
    tableColumns: {
      indeks: { keywords: ['kod', 'ean', 'oferta'] },
      nazwa: { keywords: ['nazwa', 'opis', 'towar', 'produkt'] },
      ilosc: { keywords: ['ilość', 'ilosc', 'qty'] },
      jednostka: { keywords: ['jm', 'j.m.', 'jedn'] },
      cenaNetto: { keywords: ['cena netto', 'cena'] },
      vat: { keywords: ['vat', 'stawka'] },
      wartoscNetto: { keywords: ['wartość netto', 'wartosc netto'] },
    },
    itemRules: {
      serviceIndexPrefixes: [],
      serviceKeywords: [
        'prowizja', 'opłata za wystawienie', 'smart!', 'allegro smart',
        'dostawa', 'przesyłka', 'opłata serwisowa',
      ],
    },
    validation: {
      minPozycji: 1, maxPozycji: 100,
      requiredFields: ['nazwa', 'cenaNetto'],
      expectedVatRates: [0, 5, 8, 23],
    },
  },
]

// ── Lookup functions ──────────────────────────────────────────────────────

export function findSupplierTemplate(nip, name, rawText) {
  // 1. Match po NIP (najsilniejszy — 100% pewność)
  if (nip) {
    const cleanNip = String(nip).replace(/[-\s]/g, '')
    const byNip = SUPPLIER_TEMPLATES.find(t => t.nip && t.nip === cleanNip)
    if (byNip) return { template: byNip, matchedBy: 'nip', confidence: 100 }
  }

  // 2. Match po nazwie (85%)
  if (name) {
    const nameUpper = name.toUpperCase()
    const byName = SUPPLIER_TEMPLATES.find(t =>
      t.aliases.some(a => nameUpper.includes(a.toUpperCase()))
    )
    if (byName) return { template: byName, matchedBy: 'name', confidence: 85 }
  }

  // 3. Match po wzorcach w tekście (75%)
  if (rawText) {
    const byPattern = SUPPLIER_TEMPLATES.find(t =>
      t.detectionPatterns?.some(p => p.test(rawText))
    )
    if (byPattern) return { template: byPattern, matchedBy: 'pattern', confidence: 75 }
  }

  return { template: null, matchedBy: null, confidence: 0 }
}

export function applyItemRulesFromTemplate(item, template) {
  if (!template?.itemRules) return item

  const rules = template.itemRules
  const indexUpper = (item.indeks || item.sku || '').toUpperCase()
  const nameUpper = (item.rawName || item.nazwa || '').toUpperCase()

  const isServiceByIndex = (rules.serviceIndexPrefixes || []).some(prefix =>
    indexUpper.startsWith(prefix.toUpperCase())
  )
  const isServiceByKeyword = (rules.serviceKeywords || []).some(kw =>
    nameUpper.includes(kw.toUpperCase())
  )

  if (isServiceByIndex || isServiceByKeyword) {
    return {
      ...item,
      itemType: 'service_item',
      shouldAffectInventory: false,
      classifiedBy: isServiceByIndex ? 'template_index_prefix' : 'template_keyword',
      templateApplied: template.name,
    }
  }

  return { ...item, templateApplied: template.name }
}

// ── Legacy localStorage-based learning templates ──────────────────────────
// (unchanged — used for learning from past extractions)

const STORAGE_KEY = 'magzic_invoice_supplier_templates'

export function getTemplates() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function saveTemplates(templates) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(templates)) } catch { /* quota */ }
}

export function getTemplateForSupplier(nip, name) {
  const templates = getTemplates()
  if (nip) {
    const byNip = templates.find(t => t.supplierNip === nip)
    if (byNip) return byNip
  }
  if (name) {
    const byName = templates.find(t =>
      t.supplierName?.toLowerCase() === name?.toLowerCase()
    )
    if (byName) return byName
  }
  return null
}

export function saveTemplateFromExtraction(result) {
  try {
    if (result.confidence < 70) return null
    if (!result.fields.pozycje.length) return null

    const nip = result.fields.sprzedawca_nip || result.fields.kontrahent_nip
    const name = result.fields.sprzedawca_nazwa || result.fields.kontrahent_nazwa
    if (!nip && !name) return null

    const templates = getTemplates()
    const existing = templates.findIndex(t => t.supplierNip === nip)

    const template = {
      id: existing >= 0 ? templates[existing].id : crypto.randomUUID(),
      supplierNip: nip,
      supplierName: name,
      columnMap: result.debug?.columnMap || {},
      successCount: (templates[existing]?.successCount || 0) + 1,
      lastUsedAt: new Date().toISOString(),
      createdAt: templates[existing]?.createdAt || new Date().toISOString(),
    }

    if (existing >= 0) templates[existing] = template
    else templates.push(template)

    saveTemplates(templates)
    return template
  } catch { return null }
}

export function updateTemplateStats(supplierNip, success) {
  try {
    const templates = getTemplates()
    const idx = templates.findIndex(t => t.supplierNip === supplierNip)
    if (idx < 0) return
    if (success) templates[idx].successCount = (templates[idx].successCount || 0) + 1
    else templates[idx].failureCount = (templates[idx].failureCount || 0) + 1
    saveTemplates(templates)
  } catch { /* ignore */ }
}
