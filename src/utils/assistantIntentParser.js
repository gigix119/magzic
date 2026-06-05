import { tokenize, normalizeText } from './invoiceTfIdf'

// ── Levenshtein distance ───────────────────────────────────────────────────
function levenshteinDistance(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1]
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// ── Fuzzy keyword match against sliding n-grams (diacritics-agnostic) ────────
function fuzzyKeywordMatch(inputWords, keyword, threshold = 0.75) {
  const kwWords = normalizeText(keyword).split(/\s+/)
  const kwLen = kwWords.length
  const normalizedInputWords = inputWords.map(w => normalizeText(w))
  const windowSize = Math.max(1, kwLen)
  let bestSim = 0
  for (let i = 0; i <= normalizedInputWords.length - windowSize; i++) {
    const window = normalizedInputWords.slice(i, i + windowSize).join(' ')
    const kwStr = kwWords.join(' ')
    const maxLen = Math.max(window.length, kwStr.length)
    if (maxLen === 0) continue
    const sim = 1 - levenshteinDistance(window, kwStr) / maxLen
    if (sim > bestSim) bestSim = sim
  }
  // Also try ±1 word windows
  for (let size = Math.max(1, windowSize - 1); size <= windowSize + 1; size++) {
    for (let i = 0; i <= normalizedInputWords.length - size; i++) {
      const window = normalizedInputWords.slice(i, i + size).join(' ')
      const kwStr = kwWords.join(' ')
      const maxLen = Math.max(window.length, kwStr.length)
      if (maxLen === 0) continue
      const sim = 1 - levenshteinDistance(window, kwStr) / maxLen
      if (sim > bestSim) bestSim = sim
    }
  }
  return bestSim >= threshold ? bestSim : 0
}

// ── Time reference resolver ────────────────────────────────────────────────
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10) }
function today() { return new Date().toISOString().slice(0, 10) }

export function resolveTimeRef(timeRef) {
  if (!timeRef) return null
  const t = timeRef.toLowerCase()
  if (/tydzi|tygodn/i.test(t)) return { from: daysAgo(7), to: today() }
  if (/kwartał/i.test(t)) return { from: daysAgo(90), to: today() }
  if (/pół\s*roku|półrocz/i.test(t)) return { from: daysAgo(180), to: today() }
  if (/rok|roku/i.test(t)) return { from: daysAgo(365), to: today() }
  if (/miesiąc|miesięc/i.test(t)) return { from: daysAgo(30), to: today() }
  // Named months (approximate)
  const monthMap = { stycz: 0, lut: 1, marc: 2, kwie: 3, maj: 4, czerw: 5, lip: 6, sierp: 7, wrze: 8, paźdz: 9, listo: 10, grud: 11 }
  for (const [prefix, month] of Object.entries(monthMap)) {
    if (new RegExp(prefix, 'i').test(t)) {
      const now = new Date()
      const yearMatch = t.match(/\d{4}/)
      const year = yearMatch ? parseInt(yearMatch[0]) : now.getFullYear()
      const from = new Date(year, month, 1).toISOString().slice(0, 10)
      const to = new Date(year, month + 1, 0).toISOString().slice(0, 10)
      return { from, to }
    }
  }
  return null
}

// ── Intent definitions ─────────────────────────────────────────────────────
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
  product_search: {
    patterns: [
      /znajdź\s+towar/i,
      /szukaj\s+towar/i,
      /wyszukaj/i,
      /czy\s+mamy\s+/i,
      /ile\s+mamy\s+/i,
      /stan\s+towaru/i,
      /znajdź\s+produkt/i,
      /szukaj\s+produkt/i,
    ],
    keywords: ['znajdź towar', 'szukaj', 'wyszukaj', 'czy mamy', 'ile mamy', 'stan towaru'],
  },
  create_price_alert: {
    patterns: [
      /ustaw\s+alert/i,
      /dodaj\s+alert/i,
      /stwórz\s+alert/i,
      /alert\s+(?:na|dla|cenow)/i,
      /powiadom\s+(?:mnie\s+)?(?:gdy|kiedy|jak)/i,
      /monitoruj\s+cen/i,
    ],
    keywords: ['ustaw alert', 'dodaj alert', 'alert cenowy', 'powiadom gdy', 'monitoruj cenę'],
  },
  contractor_search: {
    patterns: [
      /faktury\s+(?:od|z|u|z\s+firmy)\s+/i,
      /kontrahent\w*\s+/i,
      /dostawc\w+\s+\w+/i,
      /ile\s+wydali[śs]my\s+(?:u|w|na)\s+/i,
      /pokaż\s+(?:kontrahent|dostawc)/i,
      /znajdź\s+(?:kontrahent|dostawc|firm)/i,
    ],
    keywords: ['faktury od', 'kontrahent', 'dostawca', 'ile wydaliśmy u', 'znajdź firmę', 'znajdź dostawcę'],
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
  product_search:
    'Szukam towaru w magazynie…',
  create_price_alert:
    'Szukam towaru i przygotowuję alert cenowy…',
  contractor_search:
    'Szukam kontrahenta…',
  unknown:
    'Na razie umiem analizować faktury, ceny, dostawców, stany magazynowe i alerty. Spróbuj: „pokaż dashboard zakupów z ostatniego miesiąca" albo „co powinienem zamówić?"',
}

// ── TF-IDF fallback index (flat keyword → intent map) ──────────────────────
function buildIntentKeywordIndex() {
  const docs = []
  for (const [intentName, def] of Object.entries(INTENT_DEFS)) {
    const allTerms = [...def.keywords, ...def.patterns.map(p => p.source.replace(/\\[swWdD]/g, ' ').replace(/[^a-ząćęłńóśźż\s]/gi, ' '))]
    docs.push({ intentName, text: allTerms.join(' ') })
  }
  return docs
}

const INTENT_KEYWORD_DOCS = buildIntentKeywordIndex()

function tfIdfFallbackMatch(normalized) {
  const queryTokens = new Set(tokenize(normalizeText(normalized)))
  if (queryTokens.size === 0) return null

  let bestIntent = null
  let bestScore = 0

  for (const doc of INTENT_KEYWORD_DOCS) {
    const docTokens = new Set(tokenize(normalizeText(doc.text)))
    let overlap = 0
    for (const t of queryTokens) { if (docTokens.has(t)) overlap++ }
    const score = overlap / Math.sqrt(queryTokens.size * docTokens.size + 1)
    if (score > bestScore) { bestScore = score; bestIntent = doc.intentName }
  }

  return bestScore > 0.15 ? { intent: bestIntent, confidence: bestScore * 0.6 } : null
}

// ── Context resolution for multi-turn conversations ───────────────────────
function resolveContextIntent(input, conversationHistory) {
  if (!conversationHistory || conversationHistory.length === 0) return null
  const normalized = input.trim().toLowerCase()
  // Only resolve for short/ambiguous inputs
  if (normalized.split(/\s+/).length > 6) return null

  const lastAssistant = [...conversationHistory].reverse().find(m => m.role === 'assistant' && m.intent && m.intent !== 'unknown')
  if (!lastAssistant) return null

  const prevIntent = lastAssistant.intent

  // "a teraz za [okres]" or "za ostatni [okres]" — inherit intent, new timeRef
  const followUpTime = normalized.match(/(?:a\s+(?:teraz|za)|za|w\s+tym)\s+(?:ostatni\w*\s+)?(?:tydzi\w+|miesiąc\w*|rok\w*|kwartał\w*|półrocz\w*|stycz\w*|lut\w*|marc\w*|kwie\w*|maj\w*|czerw\w*|lip\w*|sierp\w*|wrze\w*|paźdz\w*|listo\w*|grud\w*)/i)
  if (followUpTime) return { inheritIntent: prevIntent, timeRefOverride: followUpTime[0] }

  // "dla [produkt]" or "a [produkt]?" — inherit intent, new product
  const followUpProduct = normalized.match(/^(?:a\s+|dla\s+|o\s+)?([a-ząćęłńóśźż][a-ząćęłńóśźż\s-]{1,30})\??$/)
  if (followUpProduct && !followUpTime) return { inheritIntent: prevIntent, productOverride: followUpProduct[1].trim() }

  // "pokaż wykres" / "na wykresie"
  if (/wykres|na\s+wykresie|pokaż\s+wykres/i.test(normalized)) {
    return { inheritIntent: 'product_price_history', productOverride: lastAssistant.entities?.productQuery ?? null }
  }

  return null
}

// ── Entity extraction ──────────────────────────────────────────────────────
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
  for (const suffix of PRODUCT_QUERY_STRIP_SUFFIXES) q = q.replace(suffix, '')
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

const PRODUCT_SEARCH_STRIP_PREFIXES = [
  /^znajdź\s+towar\s+/i,
  /^znajdź\s+produkt\s+/i,
  /^szukaj\s+towaru?\s+/i,
  /^szukaj\s+produktu?\s+/i,
  /^wyszukaj\s+/i,
  /^czy\s+mamy\s+/i,
  /^ile\s+mamy\s+/i,
  /^stan\s+towaru\s+/i,
]

function extractSearchQuery(rawInput) {
  let q = rawInput.trim()
  for (const prefix of PRODUCT_SEARCH_STRIP_PREFIXES) {
    const stripped = q.replace(prefix, '')
    if (stripped !== q) { q = stripped; break }
  }
  q = q.replace(/[?!.,]+$/, '').trim()
  if (!q || q.length < 2) return null
  return q
}

function extractEntities(normalized, intent, rawInput) {
  const entities = {}

  // Time reference extraction — extended patterns
  const timeMatch = normalized.match(/(?:ostatni(?:ego|ej|m)?\s+)?(?:miesiąc\w*|tydzień|tygodniu|roku?|kwartał\w*|półrocz\w*)/i)
    ?? normalized.match(/(?:za|w|od|z)\s+(?:ostatni\w*\s+)?(?:tydzi\w+|miesiąc\w*|rok\w*|kwartał\w*|półrocz\w*|stycz\w*|lut\w*|marc\w*|kwie\w*|maj\w*|czerw\w*|lip\w*|sierp\w*|wrze\w*|paźdz\w*|listo\w*|grud\w*)(?:\s+\d{4})?/i)
  if (timeMatch) entities.timeRef = timeMatch[0]
  entities.dateRange = resolveTimeRef(entities.timeRef ?? null)

  const productMatch = normalized.match(/(?:produktu|towaru|artykułu|cena(?:\s+(?:za|dla))?)\s+([a-ząćęłńóśźż][a-ząćęłńóśźż\s-]{1,30})/i)
  if (productMatch) entities.product = productMatch[1].trim()

  if (intent === 'product_price_history') {
    entities.productQuery = extractProductQuery(rawInput ?? '')
  }

  if (intent === 'compare_suppliers') {
    entities.productQuery = extractSupplierProductQuery(rawInput ?? '')
  }

  if (intent === 'product_search') {
    entities.searchQuery = extractSearchQuery(rawInput ?? '')
  }

  // Invoice numbers: FV/001/2024, S1/FAV/2026/0888336, FA-123/2024, etc.
  const invoiceNumberPattern = /(?:FV|FA|FAV|S\d+\/FAV|FVAT|FZ|PA)[\s/\\-]*[\d/\\-]*\d{4}/gi
  const invoiceMatches = rawInput ? rawInput.match(invoiceNumberPattern) : null
  if (invoiceMatches && invoiceMatches.length >= 2) {
    entities.invoiceNumbers = invoiceMatches.slice(0, 2).map(n => n.replace(/\s+/g, ''))
  }

  if (intent === 'create_price_alert') {
    const pctMatch = rawInput ? rawInput.match(/(\d+)\s*%/) : null
    entities.alertThreshold = pctMatch ? parseInt(pctMatch[1]) : 10
    let alertProduct = (rawInput ?? '')
      .replace(/^(ustaw|dodaj|stwórz)\s+alert\s*(cenowy\s+)?(na|dla|do)\s+/i, '')
      .replace(/\d+\s*%.*$/, '')
      .replace(/[?!.,]+$/, '')
      .trim()
    if (alertProduct.length >= 2) entities.alertProduct = alertProduct
  }

  if (intent === 'contractor_search') {
    const contractorStripPrefixes = [
      /^(?:pokaż\s+)?faktury\s+(?:od|z|u|z\s+firmy)\s+/i,
      /^pokaż\s+(?:kontrahenta?|dostawcę?)\s+/i,
      /^znajdź\s+(?:kontrahenta?|dostawcę?|firmę?)\s+/i,
      /^ile\s+wydali[śs]my\s+(?:u|w|na)\s+/i,
      /^kontrahent\s+/i,
      /^dostawca\s+/i,
    ]
    let cq = rawInput ?? ''
    for (const p of contractorStripPrefixes) {
      const s = cq.replace(p, '')
      if (s !== cq) { cq = s; break }
    }
    cq = cq.replace(/[?!.,]+$/, '').trim()
    if (cq.length >= 2) entities.contractorQuery = cq
  }

  return entities
}

// ── Main parser ────────────────────────────────────────────────────────────
export function parseAssistantIntent(input, conversationHistory = []) {
  if (!input || typeof input !== 'string') {
    return { intent: 'unknown', entities: {}, confidence: 0, rawQuery: input ?? '' }
  }

  const rawInput = input.trim()
  const normalized = rawInput.toLowerCase()
  const inputWords = normalized.split(/\s+/)

  // Multi-turn context resolution
  const contextResult = resolveContextIntent(rawInput, conversationHistory)
  if (contextResult?.inheritIntent) {
    const inheritedEntities = extractEntities(normalized, contextResult.inheritIntent, rawInput)
    if (contextResult.timeRefOverride) {
      inheritedEntities.timeRef = contextResult.timeRefOverride
      inheritedEntities.dateRange = resolveTimeRef(contextResult.timeRefOverride)
    }
    if (contextResult.productOverride) {
      inheritedEntities.productQuery = contextResult.productOverride
      inheritedEntities.searchQuery = contextResult.productOverride
    }
    return {
      intent: contextResult.inheritIntent,
      entities: inheritedEntities,
      confidence: 0.7,
      rawQuery: rawInput,
    }
  }

  let bestIntent = 'unknown'
  let bestScore = 0

  for (const [intentName, def] of Object.entries(INTENT_DEFS)) {
    let score = 0
    for (const pattern of def.patterns) {
      if (pattern.test(normalized)) score += 3
    }
    for (const keyword of def.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        score += 2
      } else {
        const fuzzy = fuzzyKeywordMatch(inputWords, keyword)
        if (fuzzy > 0) score += 1
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestIntent = intentName
    }
  }

  // TF-IDF fallback when nothing matched
  if (bestScore === 0) {
    const fallback = tfIdfFallbackMatch(normalized)
    if (fallback) {
      return {
        intent: fallback.intent,
        entities: extractEntities(normalized, fallback.intent, rawInput),
        confidence: fallback.confidence,
        rawQuery: rawInput,
      }
    }
  }

  const confidence = bestScore === 0 ? 0 : Math.min(1, bestScore / 5)

  return {
    intent: bestIntent,
    entities: extractEntities(normalized, bestIntent, rawInput),
    confidence,
    rawQuery: rawInput,
  }
}

export function getAssistantResponse(parsedResult) {
  return PLACEHOLDER_RESPONSES[parsedResult.intent] ?? PLACEHOLDER_RESPONSES.unknown
}

const INTENT_SUGGESTIONS = {
  purchase_dashboard: 'Pokaż dashboard zakupów',
  compare_invoices: 'Porównaj dwie ostatnie faktury',
  latest_price_changes: 'Co najbardziej podrożało?',
  product_price_history: 'Historia ceny [nazwa towaru]',
  compare_suppliers: 'Porównaj dostawców',
  invoices_needing_review: 'Pokaż faktury do weryfikacji',
  low_stock: 'Pokaż niskie stany',
  order_recommendation: 'Co powinienem zamówić?',
  product_search: 'Znajdź towar [nazwa]',
  create_price_alert: 'Ustaw alert na [towar] [%]',
  contractor_search: 'Faktury od [kontrahent]',
}

export function getSmartFallbackSuggestions(rawQuery) {
  if (!rawQuery || rawQuery.length < 3) return []
  const normalized = rawQuery.trim().toLowerCase()
  const inputWords = normalized.split(/\s+/)

  const intentScores = []
  for (const [intentName, def] of Object.entries(INTENT_DEFS)) {
    let score = 0
    for (const keyword of def.keywords) {
      const fuzzy = fuzzyKeywordMatch(inputWords, keyword, 0.55)
      if (fuzzy > 0) score = Math.max(score, fuzzy)
    }
    if (score > 0.3) intentScores.push({ intentName, score })
  }

  intentScores.sort((a, b) => b.score - a.score)
  return intentScores.slice(0, 3).map(s => INTENT_SUGGESTIONS[s.intentName] ?? s.intentName)
}
