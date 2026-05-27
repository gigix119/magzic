const INTENT_DEFS = {
  purchase_dashboard: {
    patterns: [
      /dashboard\s+(zakup|miesięczn|tygodniow)/i,
      /podsumowanie\s+zakup/i,
      /raport\s+zakup/i,
      /przegląd\s+zakup/i,
    ],
    keywords: ['dashboard zakupów', 'raport zakupów', 'statystyki zakupów', 'podsumowanie zakupów'],
  },
  compare_invoices: {
    patterns: [
      /porównaj\s+.{0,20}(faktur|zakup)/i,
      /zestawienie\s+faktur/i,
      /dwie\s+(ostatni\w*\s+)?faktur/i,
      /porównanie\s+faktur/i,
    ],
    keywords: ['porównaj faktury', 'porównanie faktur', 'zestawienie faktur', 'dwie faktury', 'ostatnie faktury'],
  },
  latest_price_changes: {
    patterns: [
      /co\s+(najbardziej\s+)?(podrożał|zdrożał|wzrosł)/i,
      /czym?\s+podrożał/i,
      /wzrost\s+(cen|ceny)/i,
      /zmian\w*\s+cen/i,
      /ceny\s+wzrosł/i,
    ],
    keywords: ['podrożało', 'zdrożało', 'podrożał', 'zdrożał', 'wzrost cen', 'drożej', 'co podrożało', 'zmiany cen'],
  },
  product_price_history: {
    patterns: [
      /historia\s+cen/i,
      /cena\s+(produktu|towaru|artykułu)/i,
      /jak\s+(zmieniał|zmieniała)\s+się\s+(cen|cena)/i,
      /historię\s+ceny/i,
      /wykres\s+ceny/i,
      /ile\s+kosztował/i,
    ],
    keywords: ['historia ceny', 'historia cen', 'historia cenowa', 'cena produktu', 'cena towaru', 'historię ceny', 'wykres ceny'],
  },
  compare_suppliers: {
    patterns: [
      /porównaj\s+dostaw/i,
      /zestawienie\s+dostaw/i,
      /który\s+dostaw/i,
      /porównanie\s+dostaw/i,
      /gdzie\s+najtaniej/i,
      /najtańszy\s+dostaw/i,
    ],
    keywords: ['porównaj dostawców', 'dostawców', 'zestawienie dostawców', 'który dostawca', 'najlepszy dostawca', 'porównanie dostawców', 'gdzie najtaniej', 'najtańszy dostawca'],
  },
  invoices_needing_review: {
    patterns: [
      /faktury\s+(do\s+)?(weryfik|sprawdz|zatwierdz)/i,
      /do\s+(weryfik|sprawdz|zatwierdz)\w+/i,
      /niesprawdzon\w+\s+faktur/i,
      /faktur\w+\s+do\s+weryfik/i,
    ],
    keywords: ['faktury do weryfikacji', 'do weryfikacji', 'do sprawdzenia', 'do zatwierdzenia', 'niepotwierdzone faktury'],
  },
  low_stock: {
    patterns: [
      /niski(m|ch|e)?\s+(stan|stany)/i,
      /mało\s+towaru/i,
      /kończy\s+się/i,
      /stany\s+niski/i,
      /towary\s+z\s+niskim/i,
    ],
    keywords: ['niskim stanem', 'niski stan', 'niskie stany', 'mało towaru', 'kończy się', 'brakuje towaru'],
  },
  order_recommendation: {
    patterns: [
      /co\s+(powinienem\s+)?zamówi/i,
      /rekomendac\w+\s+zakup/i,
      /co\s+kupić/i,
      /co\s+zamówić/i,
    ],
    keywords: ['zamówić', 'powinienem zamówić', 'rekomendacje zakupowe', 'co zamówić', 'co kupić'],
  },
}

const PLACEHOLDER_RESPONSES = {
  purchase_dashboard:
    'Rozpoznałem intencję: dashboard zakupów. W kolejnym etapie podepnę realne dane z faktur i wyświetlę wykresy zakupów za wybrany okres.',
  compare_invoices:
    'Rozpoznałem intencję: porównywanie faktur. W kolejnym etapie podepnę pobieranie dwóch ostatnich faktur i zestawię je pozycja po pozycji.',
  latest_price_changes:
    'Rozpoznałem intencję: zmiany cen. W kolejnym etapie przeszukam faktury i wskażę towary, których cena najbardziej wzrosła.',
  product_price_history:
    'Rozpoznałem intencję: historia ceny produktu. W kolejnym etapie wyciągnę historię cen danego towaru ze wszystkich faktur.',
  compare_suppliers:
    'Rozpoznałem intencję: porównanie dostawców. W kolejnym etapie zestawię dostawców według cen, terminowości i liczby transakcji.',
  invoices_needing_review:
    'Rozpoznałem intencję: faktury do weryfikacji. W kolejnym etapie podepnę filtrowanie faktur oczekujących na zatwierdzenie.',
  low_stock:
    'Rozpoznałem intencję: niskie stany magazynowe. W kolejnym etapie połączę się ze stanami magazynowymi i pokażę towary poniżej minimum.',
  order_recommendation:
    'Rozpoznałem intencję: rekomendacja zamówień. W kolejnym etapie przeanalizuję zużycie i stany, żeby zaproponować listę zakupów.',
  unknown:
    'Na razie umiem analizować faktury, ceny, dostawców, stany magazynowe i alerty. Spróbuj: „pokaż dashboard zakupów z ostatniego miesiąca" albo „co powinienem zamówić?"',
}

export function parseAssistantIntent(input) {
  if (!input || typeof input !== 'string') {
    return { intent: 'unknown', entities: {}, confidence: 0, rawQuery: input ?? '' }
  }

  const normalized = input.trim().toLowerCase()
  let bestIntent = 'unknown'
  let bestScore = 0

  for (const [intentName, def] of Object.entries(INTENT_DEFS)) {
    let score = 0
    for (const pattern of def.patterns) {
      if (pattern.test(normalized)) score += 2
    }
    for (const keyword of def.keywords) {
      if (normalized.includes(keyword.toLowerCase())) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      bestIntent = intentName
    }
  }

  const confidence = bestScore === 0 ? 0 : Math.min(1, bestScore / 4)

  return {
    intent: bestIntent,
    entities: extractEntities(normalized, bestIntent, input.trim()),
    confidence,
    rawQuery: input.trim(),
  }
}

export function getAssistantResponse(parsedResult) {
  return PLACEHOLDER_RESPONSES[parsedResult.intent] ?? PLACEHOLDER_RESPONSES.unknown
}

const PRODUCT_QUERY_STRIP_PREFIXES = [
  /^pokaż\s+historię\s+ceny\s+/i,
  /^historię\s+ceny\s+/i,
  /^historia\s+ceny\s+/i,
  /^historia\s+cen\s+/i,
  /^historia\s+cenowa\s+/i,
  /^wykres\s+ceny\s+/i,
  /^wykres\s+cen\s+/i,
  /^jak\s+zmieniał[ao]?\s+się\s+cen[ao]?\s+(?:produktu\s+|towaru\s+|artykułu\s+)?/i,
  /^ile\s+kosztował[ao]?\s+/i,
  /^pokaż\s+cenę?\s+/i,
  /^cena\s+(?:produktu|towaru|artykułu)\s+/i,
  /^pokaż\s+/i,
]

const PRODUCT_QUERY_STRIP_SUFFIXES = [
  /\s+ostatnio$/i,
  /\s+w\s+czasie$/i,
  /\s+na\s+wykresie$/i,
  /\s+produktu$/i,
  /\s+towaru$/i,
]

const GENERIC_PRODUCT_WORDS = new Set([
  'produktu', 'towaru', 'artykułu', 'produktem', 'towar', 'produkt', 'artykuł',
  'pozycji', 'pozycję', 'pozycja',
])

function extractProductQuery(rawInput) {
  let q = rawInput.trim()

  for (const prefix of PRODUCT_QUERY_STRIP_PREFIXES) {
    const stripped = q.replace(prefix, '')
    if (stripped !== q) { q = stripped; break }
  }

  for (const suffix of PRODUCT_QUERY_STRIP_SUFFIXES) {
    q = q.replace(suffix, '')
  }

  q = q.replace(/[?!.,]+$/, '').trim()

  if (!q || q.length < 2 || GENERIC_PRODUCT_WORDS.has(q.toLowerCase())) return null
  return q
}

const SUPPLIER_QUERY_STRIP_PREFIXES = [
  /^porównaj\s+dostawców?\b\s*(?:dla\s+)?/i,
  /^porównanie\s+dostawców?\b\s*(?:dla\s+)?/i,
  /^zestawienie\s+dostawców?\b\s*(?:dla\s+)?/i,
  /^gdzie\s+najtaniej\s+kupujemy\s+/i,
  /^gdzie\s+najtaniej\s+kupimy\s+/i,
  /^który\s+dostawca\s+(?:jest\s+)?najtańszy\s*(?:(?:dla|do)\s+)?/i,
  /^który\s+dostawca\s+(?:jest\s+)?najlepszy\s*(?:(?:dla|do)\s+)?/i,
  /^u\s+którego\s+dostawcy\s+(?:kupujemy\s+)?(?:najtaniej\s+)?/i,
  /^porównaj\s+ceny\s+(?:między\s+dostawcami\s+)?(?:(?:dla|do)\s+)?/i,
]

function extractSupplierProductQuery(rawInput) {
  let q = rawInput.trim()

  for (const prefix of SUPPLIER_QUERY_STRIP_PREFIXES) {
    const stripped = q.replace(prefix, '')
    if (stripped !== q) { q = stripped; break }
  }

  q = q.replace(/[?!.,]+$/, '').trim()

  if (!q || q.length < 2 || GENERIC_PRODUCT_WORDS.has(q.toLowerCase())) return null
  return q
}

function extractEntities(normalized, intent, rawInput) {
  const entities = {}

  const timeMatch = normalized.match(/ostatni(ego|ej|m)?\s+(miesiąc\w*|tydzień|tygodniu|roku?|kwartał\w*)/i)
  if (timeMatch) entities.timeRef = timeMatch[0]

  const productMatch = normalized.match(/(?:produktu|towaru|artykułu|cena(?:\s+(?:za|dla))?)\s+([a-ząćęłńóśźż][a-ząćęłńóśźż\s-]{1,30})/i)
  if (productMatch) entities.product = productMatch[1].trim()

  if (intent === 'product_price_history') {
    entities.productQuery = extractProductQuery(rawInput ?? '')
  }

  if (intent === 'compare_suppliers') {
    entities.productQuery = extractSupplierProductQuery(rawInput ?? '')
  }

  return entities
}
