import * as pdfjs from 'pdfjs-dist'
import { normalizePolishNumber, extractWithPatterns, isKsefInvoiceId } from './polishInvoicePatterns.js'
import { detectInvoiceStructure } from './invoiceStructureDetector.js'
import { findTableCandidates, chooseBestTableCandidate } from './invoiceTableDetector.js'
import { parseInvoiceLineData } from './invoiceLineParser.js'
import { getTemplateForSupplier, saveTemplateFromExtraction, findSupplierTemplate, applyItemRulesFromTemplate } from './invoiceSupplierTemplates.js'
import { validateInvoiceExtraction, calculateConfidence } from './invoiceValidation.js'
import { classifyDocument, classifyItem } from './invoiceDocumentClassifier.js'
import { isForbiddenAsInvoiceItem } from './invoiceLineGuards.js'
import { detectKsefComarchDocument, parseKsefComarchItems, isKsefMetadataLine } from './invoiceKsefComarchParser.js'
import { recoverAmountsForItem } from './invoiceAmountRecovery.js'

// Extract the FIRST well-formed money token from a string that may contain multiple
// space-separated values (e.g. "79,90 319,60 23" → 79.90).
//
// Root cause of the 79.90319 bug:
//   The regex `([\d][\d\s.,]*)` captures price + net + VAT number as one string.
//   normalizePolishNumber("79,90 319,60 23") removes spaces → "79,90319,6023"
//   → replaces first comma → "79.90319,6023" → parseFloat → 79.90319.
//
// Fix: extract only the FIRST money token before parsing.
//   Supports Polish thousands: "1 249,00" → 1249, "1 250 000,00" → 1250000.
//   Plain comma-decimal:       "79,90"    → 79.90.
//   English dot-decimal:       "79.90"    → 79.90.
export function parseFirstMoneyToken(text) {
  if (!text) return NaN
  const str = String(text).trim()
  // Polish format: 1–3 digits, optional space-separated 3-digit groups, comma decimal
  const plMatch = str.match(/(\d{1,3}(?:[\s ]\d{3})*[,]\d{1,2})/)
  if (plMatch) return normalizePolishNumber(plMatch[1])
  // English format: digits with dot decimal
  const enMatch = str.match(/(\d+[.]\d{1,2})/)
  if (enMatch) return normalizePolishNumber(enMatch[1])
  // Plain integer (no decimal separator)
  const intMatch = str.match(/^(\d+)/)
  if (intMatch) return normalizePolishNumber(intMatch[1])
  return NaN
}

// Per-row regex fallback for column-based parser rows where cenaNetto ended up 0.
// Mirrors the regex in parseInvoiceItems but returns a structured object for one line.
// Used when column assignment puts the unit token into the cenaNetto field (causing NaN).
const _ROW_REGEX = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(szt\.?|opak\.?|op\.?|rolk[ai]|pary?|kpl\.?|litr[wy]?|l|kg|g|ml|m2|m²|m3|m³|mb|usł\.?|usl\.?|godz\.?|h|pcs?|zest\.?)\s+([\d][\d\s.,]*)/i
function parseInvoiceLineByRegex(rowText) {
  if (!rowText || rowText.length < 5) return null
  const m = rowText.match(_ROW_REGEX)
  if (!m) return null
  const ilosc = parseFloat(String(m[2]).replace(',', '.'))
  // Use parseFirstMoneyToken to avoid merging price+net into a malformed decimal
  const cena  = parseFirstMoneyToken(m[4])
  if (!(ilosc > 0) || isNaN(cena) || !(cena > 0)) return null
  return {
    nazwa:        m[1].trim(),
    ilosc,
    jednostka:    m[3].toLowerCase().replace(/\.$/, ''),
    cenaNetto:    cena,
    wartoscNetto: Math.round(ilosc * cena * 100) / 100,
    vat:          23,
    confidence:   0.6,
  }
}

// detectColumnBoundaries (invoiceTableDetector) returns { LP: {x, rightBound}, NAZWA: {x,…}, … }
// parseInvoiceLineData / assignToColumn expects { lp: x, nazwa: x, … } (lowercase camelCase, numbers)
const _COL_KEY_MAP = {
  LP: 'lp', NAZWA: 'nazwa', ILOSC: 'ilosc', JEDNOSTKA: 'jednostka',
  CENA_NETTO: 'cenaNetto', WARTOSC_NETTO: 'wartoscNetto',
  VAT: 'vat', KWOTA_VAT: 'kwotaVat', WARTOSC_BRUTTO: 'wartoscBrutto',
  CENA_BRUTTO: 'cenaBrutto', KOD: 'indeks', RABAT: 'rabat',
}

function adaptColMap(raw) {
  if (!raw) return {}
  const out = {}
  for (const [k, v] of Object.entries(raw)) {
    const nk = _COL_KEY_MAP[k]
    if (!nk) continue
    const x = (v !== null && typeof v === 'object') ? v.x : v
    if (typeof x === 'number' && isFinite(x)) out[nk] = x
  }
  return out
}

pdfjs.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

export function EMPTY_RESULT() {
  return {
    rawText: '',
    fields: {
      numer: null,
      data_zakupu: null,
      data_wystawienia: null,
      kontrahent_nip: null,
      kontrahent_nazwa: null,
      sprzedawca_nip: null,
      sprzedawca_nazwa: null,
      sprzedawca_adres: null,
      contractorConfidence: null,
      suma_netto: null,
      suma_brutto: null,
      pozycje: [],
    },
    documentType: 'unknown',
    confidence: 0,
    source: 'manual',
    warnings: [],
    debug: {},
    validation: null,
  }
}

function medianHeight(items) {
  const heights = items.map(i => i.height || 10).filter(h => h > 0)
  if (!heights.length) return 10
  heights.sort((a, b) => a - b)
  const mid = Math.floor(heights.length / 2)
  return heights.length % 2 !== 0 ? heights[mid] : (heights[mid - 1] + heights[mid]) / 2
}

// Canonical unit normalization: maps all Polish/common variants to one canonical form.
// Used by makeItem (all parse paths) and exported for tests/UI.
export function normalizeInvoiceItemUnit(raw) {
  if (!raw) return null
  const u = String(raw).toLowerCase().trim()
  const MAP = {
    'szt.': 'szt', 'szt': 'szt',
    'op.': 'op', 'op': 'op', 'opak.': 'op', 'opak': 'op',
    'kpl.': 'kpl', 'kpl': 'kpl',
    'm²': 'm2', 'm2': 'm2',
    'm³': 'm3', 'm3': 'm3',
    'mb': 'mb', 'm': 'm',
    'usł.': 'usl', 'usł': 'usl', 'usl.': 'usl', 'usl': 'usl',
    'litr': 'l', 'litry': 'l', 'l': 'l', 'ml': 'ml',
    'kg': 'kg', 'g': 'g',
    'para': 'para', 'pary': 'para',
    'rolka': 'rolka', 'rolki': 'rolka',
    'godz.': 'godz', 'godz': 'godz', 'h': 'h',
    'zest.': 'zest', 'zest': 'zest',
    'pcs': 'pcs', 'pc': 'pcs',
  }
  return MAP[u] ?? u.replace(/\.$/, '')
}

function makeItem(raw) {
  const ilosc = raw.ilosc ?? raw.quantity ?? 1
  const cenaNetto = raw.cenaNetto ?? raw.unitPriceNet ?? 0
  const wartoscNetto = raw.wartoscNetto ?? raw.totalNet ?? (ilosc * cenaNetto)
  const rawUnit = raw.jednostka || raw.unit
  const unit = rawUnit ? (normalizeInvoiceItemUnit(rawUnit) || rawUnit) : 'szt'
  return {
    rawName: raw.rawName || raw.nazwa || '',
    normalizedName: (raw.rawName || raw.nazwa || '').toLowerCase().trim(),
    ilosc,
    quantity: ilosc,
    jednostka: unit,
    unit,
    cenaNetto,
    unitPriceNet: cenaNetto,
    wartoscNetto,
    totalNet: wartoscNetto,
    vat: raw.vat ?? null,
    confidence: raw.confidence ?? 0.7,
    warnings: raw.warnings || [],
    matchedProductId: null,
    itemType: raw.itemType ?? null,
    shouldAffectInventory: raw.shouldAffectInventory ?? null,
  }
}

export async function extractPdfTextWithLayout(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  const pages = []
  let fullText = ''

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()

    const validItems = content.items.filter(i => i.str?.trim())
    const mh = medianHeight(validItems.map(i => ({ height: Math.abs(i.transform[3]) })))
    const yTolerance = Math.max(2, Math.min(8, mh * 0.4))

    const lineMap = new Map()

    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue
      const x = Math.round(item.transform[4])
      const y = Math.round(item.transform[5])
      const h = Math.abs(item.transform[3]) || 10

      let lineY = null
      for (const ky of lineMap.keys()) {
        if (Math.abs(ky - y) <= yTolerance) { lineY = ky; break }
      }
      if (lineY === null) { lineY = y; lineMap.set(lineY, []) }
      lineMap.get(lineY).push({ x, y, height: h, text: item.str.trim() })
    }

    const lines = [...lineMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([y, items]) => {
        const sorted = items.sort((a, b) => a.x - b.x)
        return { y, items: sorted, text: sorted.map(i => i.text).join(' ') }
      })

    const rawText = lines.map(l => l.text).join('\n')
    fullText += rawText + '\n'
    pages.push({ pageNum, height: viewport.height, lines, rawText })
  }

  return { pages, fullText: fullText.trim() }
}

export async function extractFromFile(file) {
  const result = EMPTY_RESULT()

  if (file.type !== 'application/pdf') {
    if (file.type.startsWith('image/')) {
      result.warnings.push('Obrazy wymagają ręcznego uzupełnienia. Dla lepszego odczytu użyj PDF z warstwą tekstową.')
    } else {
      result.warnings.push('Obsługiwane są pliki PDF z warstwą tekstową.')
    }
    return result
  }

  try {
    // 1. Extract text with layout
    const layout = await extractPdfTextWithLayout(file)
    result.rawText = layout.fullText
    result.debug.pages = layout.pages.length

    if (layout.fullText.length < 50) {
      result.warnings.push('PDF nie zawiera warstwy tekstowej (skan). Wypełnij dane ręcznie.')
      return result
    }

    // Store layout reference for DEV debug export
    result._debugLayout = layout

    // 2. Structural analysis
    let structure = { pozycje: [], warnings: [] }
    try {
      structure = detectInvoiceStructure(layout)
    } catch (e) {
      result.debug.structureError = String(e)
    }

    // 3. Regex patterns for header fields
    const patterns = extractWithPatterns(layout.fullText)
    // Prefer structure detector numer, but reject KSeF structured identifiers (NIP-DATE-HEX-CHECK)
    const structureNumer = structure.header?.numer
    result.fields.numer = (structureNumer && !isKsefInvoiceId(structureNumer))
      ? structureNumer
      : (patterns.numer || null)
    result.fields.data_zakupu = structure.header?.dataWystawienia || patterns.data || null
    result.fields.data_wystawienia = result.fields.data_zakupu
    result.fields.kontrahent_nip = structure.sprzedawca?.nip || patterns.nipSprzedawcy || null
    result.fields.kontrahent_nazwa = structure.sprzedawca?.nazwa || null
    result.fields.sprzedawca_nip = result.fields.kontrahent_nip
    result.fields.sprzedawca_nazwa = result.fields.kontrahent_nazwa
    result.fields.sprzedawca_adres = structure.sprzedawca?.adres || null

    // Fallback: text-based supplier detection when structure detector found nothing.
    // Uses dynamic import so a load error never prevents the main extractor from running.
    if (!result.fields.kontrahent_nazwa) {
      try {
        const { detectSupplierFromLines } = await import('./invoiceSupplierDetector.js')
        const lines = layout.fullText.split('\n')
        const detected = detectSupplierFromLines(lines)
        if (detected && detected.confidence !== 'none' && detected.nazwa) {
          result.fields.kontrahent_nazwa = detected.nazwa
          result.fields.sprzedawca_nazwa = detected.nazwa
          if (!result.fields.kontrahent_nip && detected.nip) {
            result.fields.kontrahent_nip = detected.nip
            result.fields.sprzedawca_nip = detected.nip
          }
          if (detected.confidence === 'low') {
            result.warnings.push('Nie udało się pewnie wykryć nazwy sprzedawcy — sprawdź kontrahenta ręcznie.')
          }
          result.debug.supplierDetectorUsed = true
          result.debug.supplierDetectorScore = detected.score
          result.debug.supplierDetectorSource = detected.source
        }
      } catch (e) {
        console.warn('[invoice] supplier detection failed (non-critical):', e?.message || String(e))
        result.debug.supplierDetectorError = String(e)
      }
    }

    // 0–1 confidence for contractor identification (NIP present + name present)
    const _cNip = result.fields.kontrahent_nip
    const _cNazwa = result.fields.kontrahent_nazwa
    result.fields.contractorConfidence =
      (_cNip && _cNip.replace(/\D/g, '').length >= 9 ? 0.6 : 0) +
      (_cNazwa && _cNazwa.trim().length >= 3 ? 0.4 : 0)
    result.fields.suma_netto = patterns.sumaNetto || null
    result.fields.suma_brutto = patterns.sumaBrutto || null

    // 4. Check supplier template (built-in catalog + localStorage learning)
    let supplierColumnMap = null
    let activeSupplierMatch = { template: null, matchedBy: null, confidence: 0 }
    try {
      // Built-in catalog first
      const catalogMatch = findSupplierTemplate(
        result.fields.kontrahent_nip,
        result.fields.kontrahent_nazwa,
        layout.fullText
      )
      if (catalogMatch.template) {
        activeSupplierMatch = catalogMatch
        result.documentType = catalogMatch.template.documentType
        result.supplierTemplate = {
          name: catalogMatch.template.name,
          matchedBy: catalogMatch.matchedBy,
          confidence: catalogMatch.confidence,
        }
        if (import.meta.env.DEV) {
          console.log('[invoiceExtractor] Wykryto dostawcę:', catalogMatch.template.name,
            '(match:', catalogMatch.matchedBy, ', confidence:', catalogMatch.confidence, ')')
        }
      }

      // localStorage learning template (column map override)
      const learnedTemplate = getTemplateForSupplier(
        result.fields.kontrahent_nip,
        result.fields.kontrahent_nazwa
      )
      if (learnedTemplate?.columnMap && Object.keys(learnedTemplate.columnMap).length > 0) {
        supplierColumnMap = learnedTemplate.columnMap
        result.debug.usedTemplate = learnedTemplate.supplierNip || learnedTemplate.supplierName
      }
    } catch (e) {
      result.debug.templateError = String(e)
    }

    // 5. Table detection — multiple candidates, pick best
    let pozycje = []
    let tableCandidates = []
    try {
      tableCandidates = findTableCandidates(layout)
      result.debug.tableCandidates = tableCandidates.length
      const best = chooseBestTableCandidate(tableCandidates)

      if (best) {
        result.debug.tableSelected = { page: best.pageNum, score: best.headerScore, rows: best.rowCount }

        // Adapt column map format: { LP: {x,rightBound},… } → { lp: x,… }
        const adapted = adaptColMap(best.columnMap)
        const colMap = supplierColumnMap || (Object.keys(adapted).length > 1 ? adapted : {})
        result.debug.columnMap = colMap

        // Merge continuation rows: products split across multiple PDF lines.
        // A continuation row has no letter content near the name column (no product name items).
        const nomeX = colMap.nazwa
        const mergedRows = []
        for (const row of best.rows) {
          const items = row.items || []
          const isContinuation = nomeX !== undefined && items.length > 0 &&
            !items.some(it =>
              it.x >= nomeX - 30 && it.x <= nomeX + 130 &&
              /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]{2,}/.test(it.text)
            )
          if (isContinuation && mergedRows.length > 0) {
            const prev = mergedRows[mergedRows.length - 1]
            mergedRows[mergedRows.length - 1] = {
              ...prev,
              items: [...(prev.items || []), ...items],
              text: ((prev.text || '') + ' ' + (row.text || '')).trim(),
            }
          } else {
            mergedRows.push({ ...row, items: [...items] })
          }
        }

        for (const row of mergedRows) {
          try {
            let parsed = parseInvoiceLineData(row.items || [], colMap)

            // Per-row regex fallback: column parser produced cenaNetto=0, which means
            // the unit token ended up in the cenaNetto column (making it NaN) or some
            // other misassignment occurred despite the repair helpers in parseInvoiceLineData.
            // The row.text (items joined by space) is fed to a unit-aware regex that
            // correctly identifies name / qty / unit / unitNetPrice regardless of column positions.
            if (parsed && parsed.nazwa && parsed.cenaNetto <= 0) {
              const rowText = row.text || (row.items || []).map(i => i.text).join(' ')
              const rx = parseInvoiceLineByRegex(rowText.trim())
              if (rx && rx.cenaNetto > 0) {
                parsed = {
                  ...parsed,
                  ilosc:        rx.ilosc,
                  jednostka:    rx.jednostka,
                  cenaNetto:    rx.cenaNetto,
                  wartoscNetto: rx.wartoscNetto,
                  confidence:   Math.min(parsed.confidence || 0.6, rx.confidence),
                }
                if (import.meta.env.DEV) {
                  console.debug('[invoice] row-regex fallback used for:', parsed.nazwa)
                }
              }
            }

            if (parsed && parsed.nazwa && (parsed.cenaNetto > 0 || parsed.wartoscNetto > 0)) {
              pozycje.push(makeItem({ ...parsed, rawName: parsed.nazwa }))
            }
          } catch {
            result.debug.rowParseErrors = (result.debug.rowParseErrors || 0) + 1
          }
        }
      }
    } catch (e) {
      result.debug.tableDetectionError = String(e)
    }

    // 6. Fallback to structure detector pozycje
    if (!pozycje.length && structure.pozycje?.length > 0) {
      for (const p of structure.pozycje) {
        if (p.nazwa && (p.cenaNetto > 0 || p.wartoscNetto > 0)) {
          pozycje.push(makeItem({ ...p, rawName: p.nazwa, confidence: p.confidence ?? 0.6 }))
        }
      }
    }

    // 7. LP-anchored text fallback — handles split headers, multi-line products, concatenated rows
    if (!pozycje.length) {
      try {
        pozycje = parseInvoiceItemsLP(layout.fullText)
        result.debug.lpParserUsed = pozycje.length > 0
      } catch (e) {
        result.debug.lpParserError = String(e)
      }
    }

    // 7.5. Final regex fallback
    if (!pozycje.length) {
      pozycje = parseInvoiceItems(layout.fullText)
    }

    // 7.5. KSeF/Comarch fallback — add missing product lines
    try {
      const ksefDetected = detectKsefComarchDocument(layout, layout.fullText)
      result.debug.ksefComarchDetected = ksefDetected
      if (ksefDetected) {
        const ksefItems = parseKsefComarchItems(layout)
        result.debug.ksefItemsFound = ksefItems.length
        // Merge: add KSeF items not already found by standard parser
        const existingNames = new Set(
          pozycje.map(p => (p.rawName || '').toLowerCase().trim().slice(0, 30))
        )
        for (const ki of ksefItems) {
          const kName = (ki.rawName || '').toLowerCase().trim().slice(0, 30)
          if (!existingNames.has(kName)) {
            pozycje.push(makeItem(ki))
          }
        }
      }
    } catch (e) {
      result.debug.ksefParserError = String(e)
    }

    // 7.6. Amount recovery for items with cenaNetto=0
    try {
      const allLayoutLines = layout.pages.flatMap(p => p.lines || [])
      let recoveryAttempts = 0
      for (const item of pozycje) {
        if ((item.cenaNetto || 0) > 0) continue

        // Simple case: wartoscNetto > 0 — derive unit price
        const wn = item.wartoscNetto || item.totalNet || 0
        const qty = item.ilosc || item.quantity || 1
        if (wn > 0 && qty > 0) {
          item.cenaNetto = wn / qty
          item.unitPriceNet = item.cenaNetto
          item.recoveredAmount = true
          item.warnings = [...(item.warnings || []), 'Cena wyliczona z wartości — sprawdź przed zatwierdzeniem.']
          continue
        }

        // Complex case: search nearby layout lines
        recoveryAttempts++
        const recovery = recoverAmountsForItem(item, allLayoutLines)
        if (recovery) {
          item.cenaNetto = recovery.recoveredValue
          item.unitPriceNet = recovery.recoveredValue
          item.wartoscNetto = recovery.recoveredValue * qty
          item.totalNet = item.wartoscNetto
          item.recoveredAmount = true
          item.warnings = [...(item.warnings || []), recovery.warning]
        }
      }
      result.debug.amountRecoveryAttempts = recoveryAttempts
    } catch (e) {
      result.debug.amountRecoveryError = String(e)
    }

    // 8. Document classification
    try {
      result.documentType = classifyDocument(layout.fullText, tableCandidates)
    } catch (e) {
      result.debug.classifyError = String(e)
      result.documentType = 'unknown'
    }

    // 9. Filter forbidden lines, classify each item, apply supplier template rules
    const filteredPozycje = []
    const ignoredLines = []
    for (let poz of pozycje) {
      const ctx = { hasPrice: poz.cenaNetto > 0, hasUnit: !!(poz.jednostka) }
      const rawName = poz.rawName || ''
      if (isForbiddenAsInvoiceItem(rawName, ctx)) {
        ignoredLines.push({ text: rawName, reason: 'forbidden' })
        continue
      }
      if (isKsefMetadataLine(rawName)) {
        ignoredLines.push({ text: rawName, reason: 'ksef_metadata' })
        continue
      }

      const { itemType, shouldAffectInventory } = classifyItem(poz, result.documentType)
      poz.itemType = itemType
      poz.shouldAffectInventory = shouldAffectInventory

      // Apply built-in supplier template item rules (overrides classifyItem for known prefixes)
      if (activeSupplierMatch.template) {
        poz = applyItemRulesFromTemplate(poz, activeSupplierMatch.template)
      }

      if (itemType === 'service_item') {
        if (!poz.jednostka || poz.jednostka === 'szt') { poz.jednostka = 'usl'; poz.unit = 'usl' }
        if (!poz.ilosc || poz.ilosc === 0) { poz.ilosc = 1; poz.quantity = 1 }
      }

      if (itemType !== 'summary_line' && itemType !== 'payment_info' && poz.rawName && poz.rawName.trim().length > 1) {
        filteredPozycje.push(poz)
      }
    }
    pozycje = filteredPozycje
    result.fields.pozycje = pozycje
    result.debug.ignoredLines = ignoredLines
    result.debug.ksefMetadataBlocked = ignoredLines.filter(l => l.reason === 'ksef_metadata').length

    // 10. Preliminary confidence (needed for validateInvoiceExtraction thresholds)
    let conf = 0
    if (result.fields.numer) conf += 25
    if (result.fields.data_zakupu) conf += 25
    if (result.fields.kontrahent_nip) conf += 20
    if (pozycje.length > 0) conf += 30
    // Bonus za trafiony template (pewność identyfikacji dostawcy)
    if (activeSupplierMatch.confidence >= 100) conf += 5
    else if (activeSupplierMatch.confidence >= 75) conf += 3
    result.confidence = Math.min(conf, 95)
    result.source = 'pdf_text'

    if (structure.warnings?.length) structure.warnings.forEach(w => result.warnings.push(w))
    if (!pozycje.length) result.warnings.push('Nie udało się automatycznie wykryć pozycji. Dodaj ręcznie klikając "+ Dodaj pozycję".')
    if (result.confidence < 50) result.warnings.push('Niska pewność odczytu. Sprawdź wszystkie pola przed zatwierdzeniem.')

    // 11. Validation (sets result.validation with errors/warnings/suggestedAction)
    try {
      validateInvoiceExtraction(result)
    } catch (e) {
      result.debug.validationError = String(e)
    }

    // 12. Final confidence using validation data (replaces preliminary)
    try {
      const finalConf = calculateConfidence(result, result.documentType)
      result.confidence = finalConf
      if (result.validation) {
        result.validation.confidence = finalConf
        if (result.validation.errors.length > 0) {
          result.validation.suggestedAction = 'manual_required'
        } else if (finalConf < 60 || result.validation.warnings.length > 2) {
          result.validation.suggestedAction = 'review_required'
        } else if (finalConf < 85) {
          result.validation.suggestedAction = 'review_required'
        } else {
          result.validation.suggestedAction = 'auto_fill'
        }
      }
    } catch (e) {
      result.debug.confidenceError = String(e)
    }

    // 13. Save supplier template if confident enough
    try {
      saveTemplateFromExtraction(result)
    } catch (e) {
      result.debug.templateSaveError = String(e)
    }

  } catch (err) {
    result.debug.extractionError = String(err)
    result.warnings.push('Błąd odczytu pliku. Wypełnij formularz ręcznie.')
  }

  return result
}

export function parseInvoiceItems(text) {
  const items = []
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3)

  for (const line of lines) {
    // Skip forbidden lines before trying to parse
    if (isForbiddenAsInvoiceItem(line, {})) continue

    const match = line.match(
      /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(szt\.?|opak\.?|op\.?|rolk[ai]|pary?|kpl\.?|litr[wy]?|l|kg|g|ml|m2|m²|m3|m³|mb|usł\.?|usl\.?|godz\.?)\s+([\d][\d\s.,]*)/i
    )
    if (match) {
      const ilosc = parseFloat(match[2].replace(',', '.'))
      const cena = parseFirstMoneyToken(match[4])  // first token only — avoids "79,90 319,60 23" → 79.90319
      if (ilosc > 0 && !isNaN(cena) && cena > 0) {
        items.push(makeItem({
          rawName: match[1].trim(),
          ilosc,
          jednostka: match[3].toLowerCase().replace(/\.$/, ''),
          cenaNetto: cena,
          wartoscNetto: ilosc * cena,
          confidence: 0.7,
        }))
        continue
      }
    }

    const simpleMatch = line.match(/^(.{5,60}?)\s+([\d]+[.,]\d{2})\s*(?:zł|PLN)?$/)
    if (simpleMatch) {
      const rawName = simpleMatch[1].trim()
      // Double-check name is not forbidden
      if (isForbiddenAsInvoiceItem(rawName, {})) continue
      const cena = normalizePolishNumber(simpleMatch[2])
      if (!isNaN(cena) && cena > 0 && cena < 100000) {
        const item = makeItem({
          rawName,
          ilosc: 1,
          jednostka: 'szt',
          cenaNetto: cena,
          wartoscNetto: cena,
          confidence: 0.4,
        })
        item.warnings.push('Niska pewność — sprawdź ilość i jednostkę')
        items.push(item)
      }
    }
  }

  return items
}

// ── LP-anchored text parser ───────────────────────────────────────────────────
// Handles split headers, multi-line products, and concatenated invoice rows.
// Works on raw text only — no pdfjs layout required.
//
// Key rule: a new product starts with LP_number followed by a word with LETTERS.
// "2 249,00 zł..." is NOT a new product — no letters after the leading number.

const _TABLE_END_LP = /^(razem|do\s*zap[łl]at|p[łl]atno[śs][ćc]|termin|numer\s+rachunk|konto:|uwagi|wystawił|odebra[łl]|podpis|s[łl]owni|podsumowanie|podstawa\s+op|suma\b|vat\s*\d)/i
// Invoice units used as the actual "product unit" column in Polish invoices.
// Uses Unicode lookbehind/lookahead (u flag) so Polish letters like "ł" in "usł."
// are handled correctly — plain \b doesn't work for non-ASCII chars.
// Longer tokens (ml, m2, m3) appear before shorter overlapping ones (l, m).
const _UNIT_TOKEN = /(?<!\p{L})(szt\.?|opak\.?|op\.?|kpl\.?|mb|m2|m²|m3|m³|kg|g|ml|litr[wy]?|l|godz\.?|h|usł\.?|usl\.?|para|pary|rolk[ai]|zest\.?|pcs|pc)(?!\p{L})/iu
// Broader set for the LP false-positive guard — also covers measurement specs
// (e.g. "806 lm", "32 mm", "31 cl") so they're not treated as new LP items.
const _UNIT_TOKEN_LP = /(?<!\p{L})(szt\.?|opak\.?|op\.?|kpl\.?|mb|m2|m²|m3|m³|mm|cm|dm|km|lm|cl|dl|kg|g|mg|ml|litr[wy]?|l|godz\.?|h|kw|kva|usł\.?|usl\.?|para|pary|rolk[ai]|zest\.?|pcs|pc)(?!\p{L})/iu

function _isTableEndLP(line) {
  return _TABLE_END_LP.test(line.trim().toLowerCase())
}

// True when a line starts with a number but has no product-name letters after it —
// it's a price-continuation of the previous item, not a new LP.
// e.g. "2 249,00 zł 498,00 zł 23% 114,54 zł 612,54 zł" → continuation of LP 1 (BILLY)
function _isPriceContinuation(line) {
  const firstWord = (line.match(/^(\S+)/) || [])[1] || ''
  if (!/^\d/.test(firstWord)) return false  // doesn't start with a digit
  const afterFirstWord = line.slice(firstWord.length).trim()
  if (!afterFirstWord) return false
  // First token after the leading number must be a digit/price, not a product name
  const firstTokenAfter = (afterFirstWord.match(/^(\S+)/) || [])[1] || ''
  return /^[\d,.]/.test(firstTokenAfter) && !/\p{L}{2,}/u.test(firstTokenAfter)
}

// Extract numeric values from a price region (after the unit).
// Each whitespace-separated token is parsed independently so "2 249,00" → [2, 249.00]
// (not 2249.00), which is correct for the qty + unitPrice context.
function _extractAmounts(text) {
  const nums = []
  const clean = text
    .replace(/\bzł\b|\bPLN\b/gi, ' ')
    .replace(/\b\d{1,2}\s*%/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  for (const tok of clean.split(' ')) {
    if (!tok) continue
    const stripped = tok.replace(/[^\d,.-]/g, '')
    if (!stripped) continue
    const v = normalizePolishNumber(stripped)
    if (!isNaN(v) && v > 0) nums.push(v)
  }
  return nums
}

// Parse one product segment (isolated by LP split) into an item.
function _parseSegment(seg) {
  const { text } = seg
  if (!text || text.length < 3) return null
  if (_isTableEndLP(text)) return null
  if (isForbiddenAsInvoiceItem(text.slice(0, 80), {})) return null

  // VAT rate
  const vatMatch = text.match(/\b(\d{1,2})\s*%/)
  const vat = vatMatch ? parseInt(vatMatch[1]) : 23
  if (vat > 100) return null

  // Strip LP prefix to get name-bearing portion.
  const withoutLP = text.replace(/^\d{1,4}\s+/, '')
  const lpPrefixLen = text.length - withoutLP.length

  // Find ALL unit token occurrences and pick the RIGHTMOST one that has ≥ 2
  // numeric amounts after it. This correctly handles multi-unit rows like:
  //   "Baterie AA 12 szt. op. 3 18,90 23%"  → unit = "op", name contains "12 szt."
  //   "Domestos 750 ml szt. 6 8,49"          → unit = "szt", name contains "750 ml"
  const _UNIT_TOKEN_G = new RegExp(_UNIT_TOKEN.source, 'gi')
  const allUnitMatches = []
  let m
  while ((m = _UNIT_TOKEN_G.exec(text)) !== null) {
    allUnitMatches.push({ match: m[0], index: m.index, token: m[1] })
  }

  let chosenUnit = null  // { match, index, token }
  for (let i = allUnitMatches.length - 1; i >= 0; i--) {
    const candidate = allUnitMatches[i]
    const afterCandidate = text.slice(candidate.index + candidate.match.length)
    if (_extractAmounts(afterCandidate).length >= 2) {
      chosenUnit = candidate
      break
    }
  }
  // If no unit has ≥ 2 amounts after it, fall back to first occurrence
  if (!chosenUnit && allUnitMatches.length > 0) {
    chosenUnit = allUnitMatches[0]
  }

  const unit = chosenUnit ? normalizeInvoiceItemUnit(chosenUnit.token) || 'szt' : 'szt'
  const unitInferred = !chosenUnit
  const segWarnings = unitInferred ? ['unit_inferred_default_szt'] : []

  // Product name = everything between LP prefix and the chosen unit token.
  let name = withoutLP
  if (chosenUnit) {
    const uIdxInWithoutLP = chosenUnit.index - lpPrefixLen
    if (uIdxInWithoutLP > 0) name = withoutLP.slice(0, uIdxInWithoutLP).trim()
    else name = withoutLP.split(/\s+/).slice(0, 3).join(' ')
  } else {
    // No unit — take text before first decimal price
    const pIdx = withoutLP.search(/\b\d+[,.]\d{2}\b/)
    if (pIdx > 0) name = withoutLP.slice(0, pIdx).trim()
  }
  name = name.replace(/\s+/g, ' ').trim()
  if (!name || name.length < 2) return null
  if (!/\p{L}{2,}/u.test(name)) return null
  // Reject names that are just a unit token (e.g. "lm", "szt", "cm")
  if (_UNIT_TOKEN_LP.test(name) && name.replace(/\.$/, '').length <= 4) return null

  // Amounts — everything after the chosen unit (or after the name)
  const uPos = chosenUnit
    ? (chosenUnit.index + chosenUnit.match.length)
    : text.indexOf(name) + name.length
  const afterUnit = text.slice(uPos)
  const nums = _extractAmounts(afterUnit)
  if (nums.length < 2) return null

  const qty = nums[0]
  const unitPriceNet = nums[1]
  const totalNet = nums[2] ?? Math.round(qty * unitPriceNet * 100) / 100
  if (qty <= 0 || unitPriceNet <= 0) return null

  return makeItem({
    rawName: name,
    ilosc: qty,
    jednostka: unit,
    cenaNetto: unitPriceNet,
    wartoscNetto: totalNet,
    vat,
    confidence: 0.75,
    warnings: segWarnings,
  })
}

export function parseInvoiceItemsLP(rawText) {
  if (!rawText || rawText.length < 10) return []

  // Keep single-char lines: standalone LP numbers like "1" on their own row are valid.
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  // Find table region: first line that is "1 <NAME_WITH_LETTERS>" starts the table.
  // Also handles standalone LP: "1" alone on its own line when the next line has letters.
  let tableStartLine = -1
  let tableEndLine = lines.length

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (_isTableEndLP(line) && tableStartLine !== -1) { tableEndLine = i; break }
    if (tableStartLine === -1) {
      if (/^1\s+\p{L}{2}/u.test(line)) {
        // LP + name on same line: "1 MALM komoda..."
        tableStartLine = i
      } else if (/^\d{1,4}$/.test(line.trim()) && i + 1 < lines.length && /\p{L}{2}/u.test((lines[i + 1] || '').trim())) {
        // Standalone LP "1" on its own line, next line is the product name
        tableStartLine = i
      }
    }
  }

  if (tableStartLine === -1) return []

  // Build joined lines:
  // - standalone LP numbers ("1" alone) are merged with the next name line
  // - price-continuation lines are appended to the previous line
  // - all other lines stand on their own (each may start a new LP)
  // NOTE: do NOT run isForbiddenAsInvoiceItem here — concatenated table lines
  // (LEDARE+TJENA+VARDAGEN in one line) are >120 chars and would be falsely filtered.
  // _parseSegment handles filtering on individual segments (first 80 chars) instead.
  const joinedLines = []
  for (let i = tableStartLine; i < tableEndLine; i++) {
    const line = lines[i]
    if (_isTableEndLP(line)) break

    // Standalone LP: single number on its own line — merge with the following name line.
    // e.g. PDF row "1" on line i, "MALM komoda..." on line i+1 →  "1 MALM komoda..."
    if (/^\d{1,4}$/.test(line.trim()) && i + 1 < tableEndLine) {
      const nextLine = (lines[i + 1] || '').trim()
      if (nextLine && !_isTableEndLP(nextLine) && /\p{L}{2}/u.test(nextLine)) {
        joinedLines.push(line.trim() + ' ' + nextLine)
        i++ // consumed next line
        continue
      }
    }

    if (_isPriceContinuation(line) && joinedLines.length > 0) {
      joinedLines[joinedLines.length - 1] += ' ' + line
    } else {
      joinedLines.push(line)
    }
  }

  // Flatten to one string and split on "N LETTERS" boundaries (LP candidates).
  // Use \d{1,4} to support LP 1–9999; spurious matches are eliminated by:
  //   1. Sequential filter (LP = prev+1): rejects numbers embedded in names
  //      that aren't the next expected item, e.g. "806 lm" when LP 3 is expected.
  //   2. Unit-start check: rejects "200 szt." or "100 cm" where the word after
  //      the number is a measurement unit rather than a product name.
  const tableText = joinedLines.join(' ')
  const LP_SPLIT_RE = /(?:^|\s)(\d{1,4})\s+(?=\p{L}{2})/gu
  const rawPositions = []
  let m
  while ((m = LP_SPLIT_RE.exec(tableText)) !== null) {
    rawPositions.push({ pos: m.index === 0 ? 0 : m.index + 1, lp: parseInt(m[1]) })
  }
  if (rawPositions.length === 0) return []

  // Keep only sequential LP positions. When a candidate LP matches the expected
  // next number but its first word is a unit token ("200 szt.", "100 cm") it's
  // treated as a quantity/measurement inside the current item, not a new LP.
  const positions = []
  let expectedLp = -1
  for (const p of rawPositions) {
    if (expectedLp === -1) {
      positions.push(p)
      expectedLp = p.lp
    } else if (p.lp === expectedLp + 1) {
      // Extra guard: first word after LP must not be a measurement unit token
      // (uses broad set so "100 mm", "200 szt.", "5 cm" are all rejected as LP).
      const afterLP = tableText.slice(p.pos + String(p.lp).length).trimStart()
      const firstWord = (afterLP.match(/^(\S+)/) || [])[1] || ''
      if (!_UNIT_TOKEN_LP.test(firstWord)) {
        positions.push(p)
        expectedLp = p.lp
      }
      // else: LP followed by unit → quantity inside current item, not a new LP
    }
    // else: non-sequential → spurious number inside a product name, skip
  }
  if (positions.length === 0) return []

  const items = []
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos
    const end = positions[i + 1]?.pos ?? tableText.length
    const segText = tableText.slice(start, end).trim()
    if (!segText || segText.length < 3) continue
    try {
      const item = _parseSegment({ lp: positions[i].lp, text: segText })
      if (item) items.push(item)
    } catch { /* single-segment failure doesn't block others */ }
  }

  return items
}
