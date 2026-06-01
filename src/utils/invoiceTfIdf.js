// Local TF-IDF product matching for invoice item → warehouse product scoring.
// Zero dependencies, zero network calls — all computation is in-memory.

const POLISH_DIACRITICS_MAP = {
  'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
  'Ą': 'a', 'Ć': 'c', 'Ę': 'e', 'Ł': 'l', 'Ń': 'n', 'Ó': 'o', 'Ś': 's', 'Ź': 'z', 'Ż': 'z',
}

const POLISH_STOPWORDS = new Set([
  'do', 'na', 'i', 'w', 'we', 'z', 'ze', 'za', 'dla', 'od', 'oraz', 'lub', 'albo',
  'pod', 'nad', 'przy', 'bez', 'przez', 'po', 'o', 'u', 'a',
  'the', 'and', 'of', 'for', 'to', 'in',
])

// One-way aliases: normalise product/query tokens to a canonical form
const TOKEN_ALIASES = {
  'kat6':  'cat6',
  'kat5e': 'cat5e',
  'kat5':  'cat5',
  'kat7':  'cat7',
  'kat8':  'cat8',
  'przewod': 'kabel',   // przewód → (diacritics removed) przewod → kabel
}

// ── normalizeText ─────────────────────────────────────────────────────────────

export function normalizeText(input) {
  if (input == null) return ''
  let s = String(input).toLowerCase().trim()

  // 1. Polish diacritics → ASCII equivalents
  s = s.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, c => POLISH_DIACRITICS_MAP[c] || c)

  // 2. Normalise cat/kat + separator + digit variants BEFORE removing punctuation
  //    Handles: cat.6, cat 6, cat. 6 → cat6 ; kat.6, kat 6, kat. 6 → kat6
  s = s.replace(/cat[.\s]*(\d)/g, 'cat$1')
  s = s.replace(/kat[.\s]*(\d)/g, 'kat$1')

  // 3. Strip trailing quote from size fractions (1/2" → 1/2, 3/4" → 3/4)
  s = s.replace(/(\d+\/\d+)"/g, '$1')
  s = s.replace(/(\d+)\s+(\d+\/\d+)"/g, '$1 $2')

  // 4. Replace everything except letters, digits, slash, space with a space
  s = s.replace(/[^a-z0-9/\s]/g, ' ')

  // 5. Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim()

  return s
}

// ── tokenize ──────────────────────────────────────────────────────────────────

export function tokenize(input) {
  const text = normalizeText(input)
  if (!text) return []

  const result = []
  for (const raw of text.split(' ')) {
    const token = raw.trim()
    if (!token) continue
    if (POLISH_STOPWORDS.has(token)) continue
    // Drop tokens shorter than 2 chars unless they contain a digit (e.g. "1/2", "m2")
    if (token.length < 2 && !/\d/.test(token)) continue
    // Apply canonical aliases
    result.push(TOKEN_ALIASES[token] ?? token)
  }
  return result
}

// ── buildTfIdfIndex ───────────────────────────────────────────────────────────

export function buildTfIdfIndex(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return { products: [], documents: [], vocabulary: {}, idf: {}, vectors: [], norms: [] }
  }

  // Build token arrays from product fields (defensive: handle null/missing)
  const documents = products.map(p => {
    if (!p || typeof p !== 'object') return []
    const namePart = p.nazwa || p.name || p.title || ''
    const skuPart  = p.sku  || p.code || p.symbol || p.indeks || ''
    const text = [namePart, skuPart].filter(Boolean).join(' ')
    return tokenize(text)
  })

  const N = documents.length

  // Count how many documents contain each term (document frequency)
  const df = {}
  for (const doc of documents) {
    for (const term of new Set(doc)) {
      df[term] = (df[term] || 0) + 1
    }
  }

  // Vocabulary: term → sequential index (for reference / debugging)
  const vocabulary = {}
  let vocabIdx = 0
  for (const term in df) vocabulary[term] = vocabIdx++

  // IDF: log((1+N) / (1+df)) + 1  — smoothed, always ≥ 1
  const idf = {}
  for (const term in df) {
    idf[term] = Math.log((1 + N) / (1 + df[term])) + 1
  }

  // TF-IDF vectors (sparse objects: term → weight)
  const vectors = documents.map(doc => {
    if (doc.length === 0) return {}
    const counts = {}
    for (const term of doc) counts[term] = (counts[term] || 0) + 1
    const total = doc.length
    const vec = {}
    for (const [term, count] of Object.entries(counts)) {
      vec[term] = (count / total) * (idf[term] || 1)
    }
    return vec
  })

  // Precompute L2 norms for cosine similarity (avoid division by zero via || 1)
  const norms = vectors.map(vec => {
    const sumSq = Object.values(vec).reduce((s, v) => s + v * v, 0)
    return Math.sqrt(sumSq) || 1
  })

  return { products, documents, vocabulary, idf, vectors, norms }
}

// ── queryTfIdf ────────────────────────────────────────────────────────────────

export function queryTfIdf(rawName, index, topK = 5) {
  if (!rawName || !index || !Array.isArray(index.vectors) || index.vectors.length === 0) {
    return []
  }

  const queryTokens = tokenize(rawName)
  if (queryTokens.length === 0) return []

  // Build query TF-IDF vector — only for terms known in the index
  const counts = {}
  for (const t of queryTokens) counts[t] = (counts[t] || 0) + 1
  const total = queryTokens.length
  const queryVec = {}
  for (const [term, count] of Object.entries(counts)) {
    if (index.idf[term] !== undefined) {
      queryVec[term] = (count / total) * index.idf[term]
    }
  }

  const queryNorm = Math.sqrt(Object.values(queryVec).reduce((s, v) => s + v * v, 0))
  if (!queryNorm) return []   // no query terms found in vocabulary

  // Score each document by cosine similarity
  const scored = index.vectors.map((docVec, i) => {
    let dot = 0
    for (const [term, qw] of Object.entries(queryVec)) {
      if (docVec[term]) dot += qw * docVec[term]
    }
    const cosine = dot / (queryNorm * index.norms[i])
    return {
      productId: index.products[i]?.id ?? index.products[i]?.product_id ?? i,
      score: Math.max(0, Math.min(1, cosine)),
      product: index.products[i],
    }
  })

  // Sort descending by score; break ties by productId string for determinism
  scored.sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : String(a.productId).localeCompare(String(b.productId))
  )

  return scored.slice(0, topK)
}
