import { detectColumnMap, parseInvoiceLineData } from './invoiceLineParser.js'
import { normalizePolishNumber, normalizeDate } from './polishInvoicePatterns.js'

const TABLE_HEADER_KEYWORDS = ['lp', 'l.p.', 'nazwa', 'towar', 'ilość', 'ilosc', 'cena', 'wartość', 'netto', 'brutto', 'vat', 'jm', 'j.m.', 'stawka', 'produkt']
const TABLE_END_KEYWORDS = ['razem', 'suma', 'podsumowanie', 'ogółem', 'łącznie', 'do zapłaty', 'razem brutto', 'razem netto']

function lineText(line) {
  return line.items.map(i => i.text).join(' ').trim()
}

function flattenLines(pdfLayout) {
  return pdfLayout.pages.flatMap(page =>
    page.lines.map(line => ({
      ...line,
      pageNum: page.pageNum,
      pageHeight: page.height || 842,
    }))
  )
}

function isTableHeader(line) {
  const text = lineText(line).toLowerCase()
  const found = TABLE_HEADER_KEYWORDS.filter(kw => {
    // Word-boundary matching
    const re = new RegExp(`(?:^|[\\s/])${kw.replace(/\./g, '\\.')}(?:[\\s/]|$)`)
    return re.test(text)
  })
  return found.length >= 2
}

function isTableEnd(line) {
  const text = lineText(line).toLowerCase()
  return TABLE_END_KEYWORDS.some(kw => text.startsWith(kw) || text.includes(' ' + kw))
}

function hasPricelikeNumber(line) {
  const text = lineText(line)
  // Has at least one decimal number (price format)
  return /\d+[.,]\d{2}/.test(text)
}

function extractNip(text) {
  // Match "NIP: XXXXXXXXXX" or "NIP XXXXXXXXXX"
  const labeled = text.match(/(?:NIP|N\.I\.P\.)[:\s]*([\d\s-]{10,15})/i)
  if (labeled) {
    const clean = labeled[1].replace(/\D/g, '')
    if (clean.length === 10) return clean
  }
  // Raw 10-digit (with possible separators)
  const raw = text.match(/\b(\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})\b/)
  if (raw) {
    const clean = raw[1].replace(/\D/g, '')
    if (clean.length === 10) return clean
  }
  return null
}

function extractCompanyBlock(allLines, nipLineIdx) {
  // Look ±5 lines around the NIP line for company name and address
  const start = Math.max(0, nipLineIdx - 5)
  const end = Math.min(allLines.length, nipLineIdx + 3)
  const block = allLines.slice(start, end)

  let nazwa = ''
  let adres = ''
  const nipLine = lineText(allLines[nipLineIdx])
  const nip = extractNip(nipLine) || ''

  for (const line of block) {
    const t = lineText(line)
    if (!t || t.length < 3) continue
    // Skip if this is the NIP line itself or looks like a table header
    if (extractNip(t) && t === nipLine) continue
    if (TABLE_HEADER_KEYWORDS.some(k => t.toLowerCase().includes(k))) continue
    // Company name: meaningful text without numbers at start, decent length
    if (!nazwa && t.length > 3 && !/^\d/.test(t) && !/^(faktura|data|numer|nr|termin)/i.test(t)) {
      nazwa = t
    } else if (!adres && /\d/.test(t) && t.length > 5) {
      adres = t
    }
  }

  return { nazwa, nip, adres }
}

export function detectInvoiceStructure(pdfLayout) {
  const allLines = flattenLines(pdfLayout)
  const warnings = []

  // ── 1. Invoice header (first 30 lines) ──────────────────────────
  const headerLines = allLines.slice(0, Math.min(30, allLines.length))

  let numer = null
  for (const line of headerLines) {
    const text = lineText(line)
    // Try prefix-based match first
    const prefixMatch = text.match(/\b((?:FV|FVS|FVAT|FP|FA|FS|FZ|VAT|RK|WZ|PZ)[\s/-]?\d{1,6}[\w/.-]*)/i)
    if (prefixMatch) { numer = prefixMatch[1].trim(); break }
    // Labeled match
    const labelMatch = text.match(/(?:faktura(?:\s*vat)?|nr\s+faktury|numer\s+faktury|nr|numer)[:\s#]+([A-Z0-9][\w/\-.]{2,25})/i)
    if (labelMatch) { numer = labelMatch[1].trim(); break }
  }

  let dataWystawienia = null
  for (const line of headerLines) {
    const text = lineText(line)
    const labeled = text.match(/(?:data\s+(?:wystawienia|sprzedaży|sprzedazy|zakupu|wystawie[nń]ia))[:\s]+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i)
      || text.match(/data[:\s]+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i)
    if (labeled) { dataWystawienia = normalizeDate(labeled[1]); break }
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/)
    if (iso) { dataWystawienia = iso[1]; break }
    const dmy = text.match(/(\d{1,2}\.\d{2}\.\d{4})/)
    if (dmy) { dataWystawienia = normalizeDate(dmy[1]); break }
  }

  // ── 2. Sprzedawca / Nabywca ──────────────────────────────────────
  // Find lines containing NIP keyword (labeled)
  const nipLineIdxs = allLines
    .map((line, idx) => ({ idx, text: lineText(line) }))
    .filter(({ text }) => /NIP[:\s]/i.test(text))
    .map(({ idx }) => idx)

  // Fallback: find lines with raw 10-digit numbers
  const rawNipIdxs = nipLineIdxs.length === 0
    ? allLines
        .map((line, idx) => ({ idx, nip: extractNip(lineText(line)) }))
        .filter(({ nip }) => nip !== null)
        .map(({ idx }) => idx)
    : []

  const allNipIdxs = [...new Set([...nipLineIdxs, ...rawNipIdxs])]

  let sprzedawca = { nazwa: '', nip: '', adres: '' }
  let nabywca = { nazwa: '', nip: '', adres: '' }

  // ── Label-based detection (highest priority) ─────────────────────────
  const SELLER_LABEL = /^(sprzedawca|sprzedaj[aą]cy|wystawca|wystawiaj[aą]cy|dostawca|nadawca|dane\s+sprzedawcy|dane\s+wystawcy|vendor|supplier|issuer|seller|bill\s+from)\s*[:;]?\s*$/i
  const BUYER_LABEL  = /^(nabywca|odbiorca|buyer|customer|p[łl]atnik|nabywca faktury|zamawiaj[aą]cy|ship\s+to|bill\s+to|dane\s+nabywcy|dane\s+odbiorcy)\s*[:;]?\s*$/i

  function findNipAfterLabel(startIdx, range) {
    for (let j = startIdx; j < Math.min(allLines.length, startIdx + range); j++) {
      const nip = extractNip(lineText(allLines[j]))
      if (nip) return j
    }
    return -1
  }

  // Direct company name extraction from lines after a seller label (even if no NIP follows)
  function extractCompanyAfterLabel(allLines, labelIdx) {
    const LINE_FORBIDDEN_RE = /\b(NIP|REGON|BDO|tel\.|telefon|www\.|http|e-mail|@)\b/i
    let nazwa = ''
    let nip = ''
    let adres = ''
    for (let i = labelIdx + 1; i < Math.min(allLines.length, labelIdx + 6); i++) {
      const t = lineText(allLines[i]).trim()
      if (!t || t.length < 3) continue
      if (BUYER_LABEL.test(t)) break
      if (SELLER_LABEL.test(t) && i > labelIdx + 1) break
      const extracted = extractNip(t)
      if (extracted && !nip) { nip = extracted; continue }
      if (LINE_FORBIDDEN_RE.test(t) || /^\d{26}$/.test(t.replace(/\s/g, ''))) continue
      if (!nazwa && t.length >= 3 && !/^\d/.test(t) && !/^(faktura|numer|data|do\s+zap[łl]aty|razem)/i.test(t)) {
        nazwa = t
      } else if (!adres && /\d/.test(t) && t.length > 5) {
        adres = t
      }
    }
    return { nazwa, nip, adres }
  }

  let sellerNipIdx = -1
  let buyerNipIdx  = -1
  let sellerLabelIdx = -1

  for (let i = 0; i < Math.min(allLines.length, 60); i++) {
    const text = lineText(allLines[i]).trim()
    if (sellerNipIdx === -1 && SELLER_LABEL.test(text)) {
      sellerLabelIdx = i
      const idx = findNipAfterLabel(i + 1, 10)
      if (idx !== -1) sellerNipIdx = idx
    }
    if (buyerNipIdx === -1 && BUYER_LABEL.test(text)) {
      const idx = findNipAfterLabel(i + 1, 10)
      if (idx !== -1) buyerNipIdx = idx
    }
  }

  // Use labels if found, otherwise positional
  if (sellerNipIdx !== -1) {
    sprzedawca = extractCompanyBlock(allLines, sellerNipIdx)
  } else if (sellerLabelIdx !== -1) {
    // Seller label found but no NIP — extract name directly from lines after label
    sprzedawca = extractCompanyAfterLabel(allLines, sellerLabelIdx)
  } else if (allNipIdxs.length >= 1) {
    sprzedawca = extractCompanyBlock(allLines, allNipIdxs[0])
  }

  if (buyerNipIdx !== -1) {
    nabywca = extractCompanyBlock(allLines, buyerNipIdx)
  } else if (allNipIdxs.length >= 2) {
    nabywca = extractCompanyBlock(allLines, allNipIdxs[1])
  }

  // ── 3. Table detection ───────────────────────────────────────────
  let tableHeaderIdx = -1
  let colMap = {}

  for (let i = 0; i < allLines.length; i++) {
    if (isTableHeader(allLines[i])) {
      tableHeaderIdx = i
      colMap = detectColumnMap(allLines[i].items)
      break
    }
  }

  const pozycje = []
  let pendingNazwa = null  // for multi-line product names

  if (tableHeaderIdx >= 0) {
    for (let i = tableHeaderIdx + 1; i < allLines.length; i++) {
      const line = allLines[i]
      const text = lineText(line)
      if (!text || text.length < 3) continue
      if (isTableEnd(line)) break
      // Skip repeated headers
      if (isTableHeader(line)) continue

      const hasPrices = hasPricelikeNumber(line)

      // Multi-line name continuation: text only in nama column range, no prices
      if (!hasPrices && pendingNazwa !== null) {
        const allText = line.items.map(i => i.text).join(' ').trim()
        // Only continues name if items are in the left portion of the page
        const avgX = line.items.length > 0
          ? line.items.reduce((s, it) => s + it.x, 0) / line.items.length
          : 999
        if (avgX < 300 && allText.length > 2) {
          pozycje[pozycje.length - 1].nazwa += ' ' + allText
          continue
        }
      }

      if (!hasPrices) continue

      const parsed = parseInvoiceLineData(line.items, colMap)
      if (parsed && (parsed.cenaNetto > 0 || parsed.wartoscNetto > 0) && parsed.nazwa) {
        pozycje.push(parsed)
        pendingNazwa = parsed.nazwa
      }
    }
  }

  // ── 4. Summary / footer ──────────────────────────────────────────
  const podsumowanie = { netto: null, vat: null, brutto: null }
  const footerLines = allLines.slice(-25)
  for (const line of footerLines) {
    const text = lineText(line)
    const tl = text.toLowerCase()
    if ((tl.includes('razem netto') || tl.includes('suma netto') || tl.includes('wartość netto')) && !podsumowanie.netto) {
      const m = text.match(/([\d\s.,]+)\s*(?:zł|pln)?$/i)
      if (m) podsumowanie.netto = normalizePolishNumber(m[1])
    }
    if ((tl.includes('do zapłaty') || tl.includes('razem brutto') || tl.includes('łącznie')) && !podsumowanie.brutto) {
      const m = text.match(/([\d\s.,]+)\s*(?:zł|pln)?$/i)
      if (m) podsumowanie.brutto = normalizePolishNumber(m[1])
    }
  }

  // ── 5. Confidence ────────────────────────────────────────────────
  let confidence = 0
  if (numer) confidence += 0.25
  if (dataWystawienia) confidence += 0.2
  if (sprzedawca.nip) confidence += 0.2
  if (pozycje.length > 0) confidence += 0.35

  if (pozycje.length === 0 && tableHeaderIdx >= 0) {
    warnings.push('Wykryto nagłówek tabeli, ale nie udało się sparsować pozycji.')
  }
  if (pozycje.length === 0) {
    warnings.push('Nie wykryto pozycji faktury — dodaj ręcznie.')
  }

  return {
    confidence,
    header: { numer, dataWystawienia, dataSprzedazy: null },
    sprzedawca,
    nabywca,
    pozycje,
    podsumowanie,
    warnings,
  }
}
