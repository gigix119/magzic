// Pure text-based supplier/contractor detection from invoice lines.
// Works on plain strings — no pdfjs objects needed, fully testable.

const SELLER_LABEL_SET = new Set([
  'sprzedawca', 'sprzedający', 'sprzedajacy',
  'wystawca', 'wystawiający', 'wystawiajacy',
  'dostawca', 'nadawca',
  'dane sprzedawcy', 'dane wystawcy',
  'seller', 'supplier', 'issuer', 'vendor', 'bill from',
])

const BUYER_LABEL_SET = new Set([
  'nabywca', 'odbiorca', 'kupujący', 'kupujacy',
  'nabywca faktury', 'zamawiający', 'zamawiajacy',
  'płatnik', 'platnik',
  'buyer', 'customer',
  'ship to', 'bill to',
  'dane nabywcy', 'dane odbiorcy',
])

const LEGAL_FORM_RE = /\b(sp\.?\s*z\s*o\.?\s*o\.?|spółka\s+z\s+ograniczon[aą]\s+odpowiedzialnością|s\.?\s*a\.?|sp\.?\s*k\.?|sp\.?\s*j\.?|s\.?\s*c\.?|jdg|gmbh|g\.m\.b\.h\.|ltd\.?|llc\.?|inc\.?|s\.r\.o\.?|o\.u\.?|s\.r\.l\.?)\b/i

const TRADE_WORD_RE = /\b(sklep|hurtownia|serwis|handlowy|handel|company|trade|group|service|services|solutions|system|systemy|technik|technologie|technologia|dystrybucja|import|export|wholesale|producent|zakład|firma|przedsiębiorstwo)\b/i

const IS_NIP_LINE_RE = /\b(NIP|N\.I\.P\.|REGON|R\.E\.G\.O\.N\.|BDO|PESEL)\b/i
const IS_BANK_RE = /\b\d{26}\b|IBAN\b|nr\s+konta|rachunek\s+bankowy/i
const IS_PHONE_RE = /\btel\.?\s*[:.]?\s*\+?[\d\s()-]{7,}/i
const IS_EMAIL_RE = /@[\w.-]+\.\w{2,}/
const IS_URL_RE = /www\.|https?:\/\//i
const IS_INVOICE_META_RE = /^(faktura(\s+vat)?|numer\s+faktury|nr\s+faktury|data\s+wystawienia|data\s+sprzedaży|data\s+zakupu|termin\s+p[łl]atno[śs]ci|do\s+zap[łl]aty|razem|suma|og[óo][łl]em|[łl][aą]cznie|podsumowanie|ksef|nr\s+konta|rachunek)\b/i
const IS_ADDRESS_RE = /^\d{2}-\d{3}|^\d+[,.]?\s*(ul\.|al\.|pl\.|str\.|ulica|aleja|plac)\b/i

function normalizeLabel(s) {
  return s.toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/[:;]\s*$/, '')
    .trim()
}

export function isSellerLabel(line) {
  return SELLER_LABEL_SET.has(normalizeLabel(line))
}

export function isBuyerLabel(line) {
  return BUYER_LABEL_SET.has(normalizeLabel(line))
}

export function isForbiddenSupplierLine(line) {
  const t = line.trim()
  if (!t || t.length < 3 || t.length > 120) return true
  if (IS_NIP_LINE_RE.test(t)) return true
  if (IS_BANK_RE.test(t)) return true
  if (IS_PHONE_RE.test(t)) return true
  if (IS_EMAIL_RE.test(t)) return true
  if (IS_URL_RE.test(t)) return true
  if (IS_INVOICE_META_RE.test(t)) return true
  if (IS_ADDRESS_RE.test(t)) return true
  if (/^\d+[\d\s,.]*$/.test(t)) return true
  return false
}

function isAllCapsMultiWord(text) {
  const words = text.trim().split(/\s+/).filter(w => w.length >= 2)
  if (words.length < 2) return false
  return words.every(w => /^[A-ZĄĆĘŁŃÓŚŹŻ0-9&.()-]+$/.test(w) && /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(w))
}

/**
 * Score a single text line as a potential supplier name.
 * context.lineAfterSellerLabel: 1–5 distance from seller label
 * context.hasNipNearby: boolean — NIP found in same section
 * context.inBuyerSection: boolean — line is in buyer section
 */
export function scoreSupplierCandidate(text, context = {}) {
  const t = text.trim()
  if (isForbiddenSupplierLine(t)) return { score: -99, forbidden: true, reasons: ['forbidden'] }
  if (isBuyerLabel(t)) return { score: -99, forbidden: true, reasons: ['buyer_label'] }

  let score = 0
  const reasons = []

  // Buyer section — hard disqualification
  if (context.inBuyerSection) { score -= 20; reasons.push('buyer_section') }

  // Proximity bonus to seller label
  const dist = context.lineAfterSellerLabel ?? 999
  if (dist === 1)      { score += 10; reasons.push('dist_1') }
  else if (dist === 2) { score += 7;  reasons.push('dist_2') }
  else if (dist <= 5)  { score += 3;  reasons.push('dist_near') }

  // Legal form
  if (LEGAL_FORM_RE.test(t)) { score += 5; reasons.push('legal_form') }

  // ALL CAPS multi-word
  if (isAllCapsMultiWord(t)) { score += 3; reasons.push('all_caps') }

  // Trade/company indicator word
  if (TRADE_WORD_RE.test(t)) { score += 3; reasons.push('trade_word') }

  // NIP in same section
  if (context.hasNipNearby) { score += 2; reasons.push('nip_nearby') }

  // Good name length (not too short, not too long)
  if (t.length >= 4 && t.length <= 70) { score += 1; reasons.push('good_length') }

  // Starts with digit (likely address/number) — penalty
  if (/^\d/.test(t)) { score -= 4; reasons.push('starts_digit') }

  return { score, forbidden: false, reasons }
}

function extractNipFromLine(line) {
  const m = line.match(/(?:NIP[:\s]*)?([\d]{3}[\s-]?[\d]{3}[\s-]?[\d]{2}[\s-]?[\d]{2})/)
  if (!m) return null
  const clean = m[1].replace(/\D/g, '')
  return clean.length === 10 ? clean : null
}

/**
 * Detect supplier/contractor name from plain text lines.
 * Returns { nazwa, nip, score, confidence, source, warnings }
 *   confidence: 'high' | 'medium' | 'low' | 'none'
 *   source: 'seller_label' | 'nip_proximity' | null
 */
export function detectSupplierFromLines(textLines) {
  if (!Array.isArray(textLines) || textLines.length === 0) {
    return { nazwa: null, nip: null, score: 0, confidence: 'none', source: null, warnings: [] }
  }

  const warnings = []

  // Find label positions
  const sellerLabelIdxs = []
  const buyerLabelIdxs = []
  for (let i = 0; i < textLines.length; i++) {
    if (isSellerLabel(textLines[i])) sellerLabelIdxs.push(i)
    if (isBuyerLabel(textLines[i])) buyerLabelIdxs.push(i)
  }

  // Check if a line index falls inside a buyer section (8 lines after buyer label)
  function inBuyerSection(lineIdx) {
    return buyerLabelIdxs.some(bs => lineIdx > bs && lineIdx <= bs + 8)
  }

  let best = { nazwa: null, nip: null, score: -Infinity, source: null }

  // Strategy 1: lines immediately after seller labels
  for (const sIdx of sellerLabelIdxs) {
    let sectionNip = null
    const candidates = []

    for (let j = sIdx + 1; j <= Math.min(textLines.length - 1, sIdx + 5); j++) {
      const line = textLines[j].trim()
      if (!line) continue
      if (isBuyerLabel(line)) break
      if (isSellerLabel(line)) break

      const nip = extractNipFromLine(line)
      if (nip) { sectionNip = nip; continue }

      const { score, forbidden } = scoreSupplierCandidate(line, {
        lineAfterSellerLabel: j - sIdx,
        hasNipNearby: false,
        inBuyerSection: inBuyerSection(j),
      })
      if (!forbidden) candidates.push({ text: line, score })
    }

    for (const c of candidates) {
      const finalScore = sectionNip ? c.score + 2 : c.score
      if (finalScore > best.score) {
        best = { nazwa: c.text, nip: sectionNip, score: finalScore, source: 'seller_label' }
      }
    }
  }

  // Strategy 2: if no label found, look for company name above first non-buyer NIP line (top 50 lines)
  if (!best.nazwa) {
    for (let i = 0; i < Math.min(textLines.length, 50); i++) {
      const line = textLines[i].trim()
      const nip = extractNipFromLine(line)
      if (!nip) continue
      if (inBuyerSection(i)) continue

      for (let j = Math.max(0, i - 4); j < i; j++) {
        const candidate = textLines[j].trim()
        if (!candidate || isForbiddenSupplierLine(candidate)) continue
        if (inBuyerSection(j)) continue
        if (isBuyerLabel(candidate)) continue

        const { score, forbidden } = scoreSupplierCandidate(candidate, {
          lineAfterSellerLabel: 999,
          hasNipNearby: true,
          inBuyerSection: false,
        })
        if (!forbidden && score > best.score) {
          best = { nazwa: candidate, nip, score, source: 'nip_proximity' }
        }
      }
      break
    }
  }

  if (!best.nazwa || best.score < 0) {
    return { nazwa: null, nip: null, score: 0, confidence: 'none', source: null, warnings }
  }

  const confidence = best.score >= 12 ? 'high'
    : best.score >= 6  ? 'medium'
    : best.score >= 2  ? 'low'
    : 'none'

  if (confidence === 'low') warnings.push('supplier_detection_uncertain')
  if (confidence === 'none') {
    return { nazwa: null, nip: null, score: 0, confidence: 'none', source: null, warnings }
  }

  return {
    nazwa: best.nazwa,
    nip: best.nip || null,
    score: best.score,
    confidence,
    source: best.source,
    warnings,
  }
}
