/**
 * Pure helpers for contractor NIP normalization and matching.
 * No side effects — fully testable.
 */

// ── Internal helpers ───────────────────────────────────────────────────────────

function tokenize(name) {
  return normalizeContractorName(name)
    .split(/\s+/)
    .filter(t => t.length >= 3)
}

function tokenJaccard(nameA, nameB) {
  const sa = new Set(tokenize(nameA))
  const sb = new Set(tokenize(nameB))
  if (!sa.size || !sb.size) return 0
  let intersection = 0
  for (const t of sa) { if (sb.has(t)) intersection++ }
  return intersection / (sa.size + sb.size - intersection)
}

// ── Public exports ─────────────────────────────────────────────────────────────

export function normalizeNip(nip) {
  if (nip === null || nip === undefined || nip === '') return null
  const result = String(nip)
    .replace(/^PL/i, '')
    .replace(/[\s\-\.]/g, '')
    .replace(/\D/g, '')
    .trim()
  return result.length >= 8 ? result : null
}

export function normalizeContractorName(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/,?\s*sp\.?\s*z\s*o\.?\s*o\.?\.?\s*/gi, ' ')
    .replace(/,?\s*spółka\s+z\s+ograniczoną\s+odpowiedzialnością\s*/gi, ' ')
    .replace(/,?\s*s\.?\s*a\.?\s*$/i, '')
    .replace(/,?\s*ltd\.?\s*$/i, '')
    .replace(/,?\s*gmbh\.?\s*$/i, '')
    .replace(/,?\s*s\.?\s*c\.?\s*$/i, '')
    .replace(/,?\s*s\.?\s*j\.?\s*$/i, '')
    .replace(/,?\s*s\.?\s*k\.?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getContractorDisplayName(contractor) {
  if (!contractor) return ''
  const parts = [contractor.nazwa]
  if (contractor.nip) parts.push(`NIP: ${contractor.nip}`)
  return parts.join(' · ')
}

export function isSameNip(a, b) {
  const na = normalizeNip(a)
  const nb = normalizeNip(b)
  return !!(na && nb && na === nb)
}

export function prepareContractorFromInvoice(extracted) {
  if (!extracted?.fields) return null
  const {
    kontrahent_nip, kontrahent_nazwa,
    sprzedawca_nip, sprzedawca_nazwa, sprzedawca_adres,
    contractorConfidence,
  } = extracted.fields
  const nip = kontrahent_nip || sprzedawca_nip || null
  const nazwa = kontrahent_nazwa || sprzedawca_nazwa || null
  if (!nip && !nazwa) return null
  return {
    nazwa: nazwa || '',
    nip: normalizeNip(nip),
    email: null,
    telefon: null,
    adres: sprzedawca_adres || null,
    confidence: contractorConfidence ?? null,
  }
}

/**
 * Returns:
 *   { match: contractor, suggestions: [], confidence: 'exact'|'high'|'low', matchedBy: 'nip'|'name'|'name_partial' }
 *   { match: null, suggestions: [], confidence: 'none', matchedBy: null }
 *   { match: null, suggestions: [array], confidence: 'ambiguous', matchedBy: '...' }
 */
export function findMatchingContractor(extractedContractor, contractors) {
  if (!extractedContractor || !contractors?.length) {
    return { match: null, suggestions: [], confidence: 'none', matchedBy: null }
  }

  // 1. Exact NIP match — highest priority
  if (extractedContractor.nip) {
    for (const c of contractors) {
      if (isSameNip(c.nip, extractedContractor.nip)) {
        return { match: c, suggestions: [], confidence: 'exact', matchedBy: 'nip' }
      }
    }
  }

  // 2. Normalized name — exact match after suffix removal
  if (extractedContractor.nazwa) {
    const extNorm = normalizeContractorName(extractedContractor.nazwa)
    if (extNorm.length >= 3) {
      const exactMatches = contractors.filter(
        c => normalizeContractorName(c.nazwa) === extNorm
      )
      if (exactMatches.length === 1) {
        return { match: exactMatches[0], suggestions: [], confidence: 'high', matchedBy: 'name' }
      }
      if (exactMatches.length > 1) {
        return { match: null, suggestions: exactMatches, confidence: 'ambiguous', matchedBy: 'name' }
      }

      // 2.5. Token Jaccard similarity — covers abbreviations and word-order variants
      if (extNorm.length >= 5) {
        const TOKEN_THRESHOLD = 0.5
        const tokenScored = contractors
          .map(c => ({ c, score: tokenJaccard(extractedContractor.nazwa, c.nazwa) }))
          .filter(x => x.score >= TOKEN_THRESHOLD)
          .sort((a, b) => b.score - a.score)

        if (tokenScored.length > 0) {
          const top = tokenScored[0]
          // Clear winner (highest score alone, or ≥0.7 dominating)
          if (tokenScored.length === 1 || top.score >= 0.7) {
            return { match: top.c, suggestions: tokenScored.map(x => x.c).slice(0, 5), confidence: 'fuzzy', matchedBy: 'name_tokens' }
          }
          return { match: null, suggestions: tokenScored.map(x => x.c).slice(0, 5), confidence: 'ambiguous', matchedBy: 'name_tokens' }
        }
      }

      // 3. Partial name match (prefix of up to 15 chars)
      if (extNorm.length >= 5) {
        const prefixLen = Math.min(extNorm.length, 15)
        const extPrefix = extNorm.slice(0, prefixLen)
        const partialMatches = contractors.filter(c => {
          const cn = normalizeContractorName(c.nazwa)
          return (
            cn.includes(extPrefix) ||
            extNorm.includes(cn.slice(0, Math.min(cn.length, prefixLen)))
          )
        })
        if (partialMatches.length === 1) {
          return { match: partialMatches[0], suggestions: [], confidence: 'low', matchedBy: 'name_partial' }
        }
        if (partialMatches.length > 1 && partialMatches.length <= 5) {
          return { match: null, suggestions: partialMatches, confidence: 'ambiguous', matchedBy: 'name_partial' }
        }
      }
    }
  }

  return { match: null, suggestions: [], confidence: 'none', matchedBy: null }
}

export function findContractorDuplicates(candidate, contractors) {
  if (!candidate || !contractors?.length) return []

  // NIP match takes absolute priority
  if (candidate.nip) {
    const byNip = contractors.filter(c => isSameNip(c.nip, candidate.nip))
    if (byNip.length > 0) return byNip
  }

  // Normalized name exact match
  if (candidate.nazwa) {
    const norm = normalizeContractorName(candidate.nazwa)
    if (norm.length >= 3) {
      return contractors.filter(c => normalizeContractorName(c.nazwa) === norm)
    }
  }

  return []
}
