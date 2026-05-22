// Standalone utility — no imports from our code

export function normalizePolishNumber(str) {
  if (str === null || str === undefined || str === '') return NaN
  const s = String(str).trim().replace(/ /g, ' ')
  // Remove currency symbols and whitespace
  const clean = s.replace(/[zł$€£\s]/g, '')
  if (!clean) return NaN
  // Both dot AND comma: dot = thousands separator (1.234,56 → 1234.56)
  if (clean.includes('.') && clean.includes(',')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.'))
  }
  // Only comma: decimal separator (1234,56 or 1 234,56)
  if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.'))
  }
  // Only dot or integer
  return parseFloat(clean)
}

export function normalizeDate(dateStr) {
  if (!dateStr) return null
  const s = String(dateStr).trim()
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/)
  if (m) {
    const [, d, mo, y] = m
    const year = y.length === 2 ? '20' + y : y
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // YYYY.MM.DD or YYYY/MM/DD
  const m2 = s.match(/^(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})$/)
  if (m2) {
    const [, y, mo, d] = m2
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

const NUMER_PATTERNS = [
  // Common Polish invoice prefixes: FV, FVS, FA, FP, FS, FZ, VAT, RK, WZ, PZ, FVAT
  /\b((?:FV|FVS|FVAT|FP|FA|FS|FZ|VAT|RK|WZ|PZ|MM|ZW|RW)[\s/\-]?\d{1,6}[\w/\-./]*)/i,
  // After keyword "faktura", "nr faktury" etc.
  /(?:faktura\s*(?:vat|zakupu|sprzedaży)?|nr\s+faktury|numer\s+faktury|nr|numer)[:\s#]+([A-Z0-9][\w/\-.]{2,25})/i,
  // After "rachunek", "paragon"
  /(?:rachunek|paragon)\s*(?:nr|numer)?[:\s]+([A-Z0-9][\w/\-.]{2,25})/i,
]

const DATA_PATTERNS = [
  // Labeled date fields
  /(?:data\s+(?:wystawienia|sprzedaży|sprzedazy|zakupu|dokumentu|wystawie[nń]ia))[:\s]+(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i,
  /(?:data)[:\s]+(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/i,
  // ISO date
  /(\d{4}-\d{2}-\d{2})/,
  // DD.MM.YYYY (standalone)
  /(\d{1,2}\.\d{2}\.\d{4})/,
]

export function extractWithPatterns(text) {
  const result = {}

  for (const pat of NUMER_PATTERNS) {
    const m = text.match(pat)
    if (m) {
      result.numer = m[1].trim()
      result.numerConfidence = 0.8
      break
    }
  }

  for (const pat of DATA_PATTERNS) {
    const m = text.match(pat)
    if (m) {
      const d = normalizeDate(m[1] || m[0])
      if (d) {
        result.data = d
        result.dataConfidence = 0.85
        break
      }
    }
  }

  // Extract NIPs: first = sprzedawca, second = nabywca
  const nipMatches = []
  const nipPat = /(?:NIP|N\.I\.P\.)[:\s]*([\d\s\-]{10,15})/gi
  let nipM
  while ((nipM = nipPat.exec(text)) !== null) {
    const clean = nipM[1].replace(/\D/g, '')
    if (clean.length === 10) nipMatches.push(clean)
  }
  // Fallback: look for raw 10-digit sequences
  if (nipMatches.length === 0) {
    const rawPat = /\b(\d{3}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})\b/g
    let rm
    while ((rm = rawPat.exec(text)) !== null) {
      const clean = rm[1].replace(/\D/g, '')
      if (clean.length === 10) nipMatches.push(clean)
    }
  }
  if (nipMatches.length > 0) result.nipSprzedawcy = nipMatches[0]
  if (nipMatches.length > 1) result.nipNabywcy = nipMatches[1]

  // Summary amounts
  const netPat = /(?:razem\s*netto|suma\s*netto|wartość\s*netto|ogółem\s*netto)[:\s]*([\d\s.,]+)/i
  const brutPat = /(?:do\s*zap[łl]aty|razem\s*brutto|suma\s*brutto|łącznie|ogółem)[:\s]*([\d\s.,]+)/i
  const netM = text.match(netPat)
  if (netM) result.sumaNetto = normalizePolishNumber(netM[1])
  const brutM = text.match(brutPat)
  if (brutM) result.sumaBrutto = normalizePolishNumber(brutM[1])

  return result
}
