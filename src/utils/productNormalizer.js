function normDiacritics(text) {
  return String(text)
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, c => ({ ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z' })[c] || c)
}

const POLISH_STOPWORDS = new Set([
  'do', 'dla', 'na', 'w', 'z', 'i', 'oraz', 'lub',
  'szt', 'sztuk', 'sztuka', 'kg', 'g', 'ml', 'l',
  'mm', 'cm', 'm', 'cal', 'cali',
])

const TECH_PARAM_PATTERNS = [
  /\b(\d+(?:[.,]\d+)?)\s*w\b/i,
  /\b(\d+(?:[.,]\d+)?)\s*ml\b/i,
  /\b(\d+(?:[.,]\d+)?)\s*l\b/i,
  /\b(\d+(?:[.,]\d+)?)\s*kg\b/i,
  /\b(\d+(?:[.,]\d+)?)\s*g\b(?!u)/i,
  /\b(\d+(?:[.,]\d+)?)\s*m2\b/i,
  /\b(\d+(?:[.,]\d+)?)\s*mb\b/i,
  /\b(g9|e27|e14|e40|b22|gu10|gu5\.?3)\b/i,
  /\b(\d{3,4})\s*x\s*(\d{3,4})\b/i,
  /\b(\d+(?:[.,]\d+)?)\s*%/,
]

function extractTechParams(name) {
  const n = normDiacritics(name)
  const params = []
  for (const pat of TECH_PARAM_PATTERNS) {
    const m = n.match(pat)
    if (m) params.push(m[0].toLowerCase().replace(/\s+/g, '').replace(',', '.'))
  }
  return params
}

export function normalizeProductName(name) {
  if (!name) return ''
  const normalized = normDiacritics(name)
    .replace(/[.,;:!?()[\]{}"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = normalized.split(' ').filter(w =>
    w.length > 1 && !POLISH_STOPWORDS.has(w.toLowerCase())
  )
  return words.join(' ').trim()
}

export function similarityScore(a, b) {
  if (!a || !b) return 0
  const na = normalizeProductName(a)
  const nb = normalizeProductName(b)

  if (na === nb) return 1.0
  if (na.includes(nb) || nb.includes(na)) return 0.85

  const tokensA = new Set(na.split(' ').filter(t => t.length > 2))
  const tokensB = new Set(nb.split(' ').filter(t => t.length > 2))
  const intersection = [...tokensA].filter(t => tokensB.has(t))
  const union = new Set([...tokensA, ...tokensB])

  if (union.size === 0) return 0
  return intersection.length / union.size
}

export function advancedSimilarity(rawName, product, aliasLookup = null) {
  if (!rawName || !product) return { score: 0, confidenceLabel: 'weak', reasons: [], warnings: [] }

  const reasons = []
  const warnings = []

  if (aliasLookup) {
    const aliasId = aliasLookup(rawName)
    if (aliasId === product.id) {
      return { score: 1.0, confidenceLabel: 'strong', reasons: ['alias match'], warnings: [] }
    }
  }

  // SKU exact match (highest priority after alias)
  if (product.sku) {
    const rawUpper = rawName.toUpperCase()
    const skuUpper = product.sku.toUpperCase().trim()
    if (rawUpper === skuUpper || rawUpper.includes(skuUpper)) {
      return { score: 1.0, confidenceLabel: 'strong', reasons: ['sku match'], warnings: [] }
    }
  }

  const na = normalizeProductName(rawName)
  const nb = normalizeProductName(product.nazwa || '')
  const nt = normalizeProductName(product.typ || '')

  if (na === nb) {
    return { score: 1.0, confidenceLabel: 'strong', reasons: ['exact match'], warnings: [] }
  }

  let baseScore

  if (na.includes(nb) || nb.includes(na)) {
    baseScore = 0.85
    reasons.push('contains match')
  } else {
    const tokensA = new Set(na.split(' ').filter(t => t.length > 2))
    const tokensB = new Set(nb.split(' ').filter(t => t.length > 2))
    const intersection = [...tokensA].filter(t => tokensB.has(t))
    const union = new Set([...tokensA, ...tokensB])
    baseScore = union.size > 0 ? intersection.length / union.size : 0

    // Bonus za długie wspólne słowa (np. model produktu)
    const longCommon = intersection.filter(w => w.length > 5).length
    baseScore = Math.min(0.95, baseScore + Math.min(0.15, longCommon * 0.05))

    if (baseScore > 0) reasons.push(`token ${Math.round(baseScore * 100)}%`)

    if (nt) {
      const typScore = similarityScore(rawName, product.typ || '') * 0.9
      if (typScore > baseScore) {
        baseScore = typScore
        reasons.push(`typ ${Math.round(typScore * 100)}%`)
      }
    }
  }

  const paramsRaw = extractTechParams(rawName)
  const paramsProduct = extractTechParams(product.nazwa || '')

  if (paramsRaw.length > 0 && paramsProduct.length > 0) {
    const matching = paramsRaw.filter(p => paramsProduct.includes(p))
    const conflicting = paramsRaw.filter(p => {
      const unit = p.replace(/[\d.]+/, '').trim()
      return unit && paramsProduct.some(pp => pp.replace(/[\d.]+/, '').trim() === unit && pp !== p)
    })

    if (matching.length > 0) {
      baseScore = Math.min(1.0, baseScore + 0.15)
      reasons.push(`param: ${matching.join(', ')}`)
    }
    if (conflicting.length > 0) {
      baseScore = Math.max(0, baseScore - 0.3)
      warnings.push(`param conflict: ${conflicting.join(', ')}`)
    }
  }

  const score = Math.round(baseScore * 1000) / 1000
  const confidenceLabel = score >= 0.85 ? 'strong' : score >= 0.65 ? 'review' : 'weak'
  return { score, confidenceLabel, reasons, warnings }
}

export function findBestMatch(name, products, threshold = 0.5) {
  let best = null
  let bestScore = 0

  for (const product of products) {
    const { score } = advancedSimilarity(name, product)
    if (score > bestScore && score >= threshold) {
      bestScore = score
      best = { product, score }
    }
  }

  return best
}

// SKU-first matching — call from extractor per pozycja
export async function matchProductBySkuFirst(item, supabase) {
  // 1. Exact SKU match
  const sku = (item.indeks || item.sku || '').trim()
  if (sku) {
    const { data } = await supabase
      .from('towary')
      .select('id, nazwa, sku, jednostka')
      .or(`sku.eq.${sku},sku.eq.${sku.toUpperCase()},sku.eq.${sku.toLowerCase()}`)
      .limit(1)

    if (data?.[0]) {
      return {
        towarId: data[0].id,
        towarNazwa: data[0].nazwa,
        matchScore: 1.0,
        matchedBy: 'sku_exact',
      }
    }
  }

  // 2. Learned alias match (localStorage)
  const rawName = item.rawName || item.nazwa || ''
  if (rawName) {
    try {
      const aliases = JSON.parse(localStorage.getItem('magzic_product_aliases') || '{}')
      const entry = aliases[rawName.toLowerCase().trim()]
      const aliasId = entry?.productId || entry
      if (aliasId) {
        const { data } = await supabase
          .from('towary')
          .select('id, nazwa, jednostka')
          .eq('id', aliasId)
          .maybeSingle()

        if (data) {
          return {
            towarId: data.id,
            towarNazwa: data.nazwa,
            matchScore: 0.95,
            matchedBy: 'learned_alias',
          }
        }
      }
    } catch { /* localStorage not available */ }
  }

  return { towarId: null, matchScore: 0, matchedBy: null }
}
