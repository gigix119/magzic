export function normalizeProductName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]/g, '')
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

export function findBestMatch(name, products, threshold = 0.5) {
  let best = null
  let bestScore = 0

  for (const product of products) {
    const score = similarityScore(name, product.nazwa)
    const scoreTyp = similarityScore(name, product.typ || '')
    const maxScore = Math.max(score, scoreTyp)

    if (maxScore > bestScore && maxScore >= threshold) {
      bestScore = maxScore
      best = { product, score: maxScore }
    }
  }

  return best
}
