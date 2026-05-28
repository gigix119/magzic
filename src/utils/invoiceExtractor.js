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

function makeItem(raw) {
  const ilosc = raw.ilosc ?? raw.quantity ?? 1
  const cenaNetto = raw.cenaNetto ?? raw.unitPriceNet ?? 0
  const wartoscNetto = raw.wartoscNetto ?? raw.totalNet ?? (ilosc * cenaNetto)
  return {
    rawName: raw.rawName || raw.nazwa || '',
    normalizedName: (raw.rawName || raw.nazwa || '').toLowerCase().trim(),
    ilosc,
    quantity: ilosc,
    jednostka: raw.jednostka || raw.unit || 'szt',
    unit: raw.jednostka || raw.unit || 'szt',
    cenaNetto,
    unitPriceNet: cenaNetto,
    wartoscNetto,
    totalNet: wartoscNetto,
    vat: raw.vat ?? null,
    confidence: raw.confidence ?? 0.7,
    warnings: [],
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
            const parsed = parseInvoiceLineData(row.items || [], colMap)
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

    // 7. Final regex fallback
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
        if (!poz.jednostka || poz.jednostka === 'szt') { poz.jednostka = 'usł.'; poz.unit = 'usł.' }
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
      /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(szt\.?|opak\.?|rolka|para|kpl\.?|l|kg|ml|m2|mb|godz)\s+([\d][\d\s.,]*)/i
    )
    if (match) {
      const ilosc = parseFloat(match[2].replace(',', '.'))
      const cena = normalizePolishNumber(match[4])
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
