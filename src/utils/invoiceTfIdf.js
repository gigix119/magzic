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

// ── Trigram generator ────────────────────────────────────────────────────────
export function generateTrigrams(str) {
  const s = normalizeText(str)
  if (s.length < 3) return new Set([s])
  const trigrams = new Set()
  for (let i = 0; i <= s.length - 3; i++) {
    trigrams.add(s.slice(i, i + 3))
  }
  return trigrams
}

// ── Trigram similarity (Dice coefficient) ────────────────────────────────────
export function trigramSimilarity(a, b) {
  const tA = generateTrigrams(a)
  const tB = generateTrigrams(b)
  if (tA.size === 0 || tB.size === 0) return 0
  let intersection = 0
  for (const t of tA) { if (tB.has(t)) intersection++ }
  return (2 * intersection) / (tA.size + tB.size)
}

// ── Substring containment check (diacritics-agnostic) ────────────────────────
export function substringMatch(query, target) {
  const q = normalizeText(query)
  const t = normalizeText(target)
  if (!q || !t) return 0
  if (t.includes(q)) return 1.0
  const qWords = q.split(' ').filter(w => w.length >= 2)
  if (qWords.length === 0) return 0
  const matchCount = qWords.filter(w => t.includes(w)).length
  return matchCount / qWords.length
}

// ── Subsequence match (abbreviation-friendly) ────────────────────────────────
// "dmst" is a subsequence of "domestos" → score based on coverage
export function subsequenceMatch(query, target) {
  const q = normalizeText(query)
  const t = normalizeText(target)
  if (!q || !t) return 0
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  if (qi < q.length) return 0
  return q.length / t.length
}

// ── Combined product scoring ──────────────────────────────────────────────────
// Combines substring (exact/partial), trigram (abbreviations), token overlap,
// and subsequence (letter abbreviations like "dmst" → "domestos").
export function combinedProductScore(query, productName) {
  if (!query || !productName) return 0
  const tfidfTokens = tokenize(query)
  const productTokens = tokenize(productName)

  const qSet = new Set(tfidfTokens)
  const pSet = new Set(productTokens)
  let tokenOverlap = 0
  for (const t of qSet) { if (pSet.has(t)) tokenOverlap++ }
  const overlapScore = qSet.size > 0 ? tokenOverlap / qSet.size : 0

  const trigramScore = trigramSimilarity(query, productName)
  const subScore = substringMatch(query, productName)
  const subseqScore = subsequenceMatch(query, productName)

  return Math.min(1, subScore * 0.4 + trigramScore * 0.25 + overlapScore * 0.15 + subseqScore * 0.2)
}
