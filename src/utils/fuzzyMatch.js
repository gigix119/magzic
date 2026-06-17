export function normalizeName(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function matchLokal(nazwa, lokale) {
  const n = normalizeName(nazwa)
  const exact = lokale.find(l => normalizeName(l.nazwa) === n)
  if (exact) return exact
  const fuzzy = lokale.find(l => {
    const ln = normalizeName(l.nazwa)
    return ln.includes(n) || n.includes(ln)
  })
  return fuzzy || null
}

function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/** Top N najbliższych dopasowań nazwy z raportu do listy lokali (dystans Levenshteina). */
export function fuzzyTopMatches(nazwa, lokale, topN = 3) {
  const n = normalizeName(nazwa)
  return lokale
    .map(l => ({ lokal: l, dist: levenshtein(n, normalizeName(l.nazwa)) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, topN)
    .map(x => x.lokal)
}
