import * as pdfjs from 'pdfjs-dist'
import { normalizePolishNumber, extractWithPatterns } from './polishInvoicePatterns.js'
import { detectInvoiceStructure } from './invoiceStructureDetector.js'
import { findTableCandidates, chooseBestTableCandidate } from './invoiceTableDetector.js'
import { parseInvoiceLineData } from './invoiceLineParser.js'
import { getTemplateForSupplier, saveTemplateFromExtraction } from './invoiceSupplierTemplates.js'
import { validateInvoiceExtraction } from './invoiceValidation.js'

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
      suma_netto: null,
      suma_brutto: null,
      pozycje: [],
    },
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

    // 2. Structural analysis
    let structure = { pozycje: [], warnings: [] }
    try {
      structure = detectInvoiceStructure(layout)
    } catch (e) {
      result.debug.structureError = String(e)
    }

    // 3. Regex patterns for header fields
    const patterns = extractWithPatterns(layout.fullText)
    result.fields.numer = structure.header?.numer || patterns.numer || null
    result.fields.data_zakupu = structure.header?.dataWystawienia || patterns.data || null
    result.fields.data_wystawienia = result.fields.data_zakupu
    result.fields.kontrahent_nip = structure.sprzedawca?.nip || patterns.nipSprzedawcy || null
    result.fields.kontrahent_nazwa = structure.sprzedawca?.nazwa || null
    result.fields.sprzedawca_nip = result.fields.kontrahent_nip
    result.fields.sprzedawca_nazwa = result.fields.kontrahent_nazwa
    result.fields.suma_netto = patterns.sumaNetto || null
    result.fields.suma_brutto = patterns.sumaBrutto || null

    // 4. Check supplier template for known column map
    let supplierColumnMap = null
    try {
      const template = getTemplateForSupplier(
        result.fields.kontrahent_nip,
        result.fields.kontrahent_nazwa
      )
      if (template?.columnMap && Object.keys(template.columnMap).length > 0) {
        supplierColumnMap = template.columnMap
        result.debug.usedTemplate = template.supplierNip || template.supplierName
      }
    } catch (e) {
      result.debug.templateError = String(e)
    }

    // 5. Table detection — multiple candidates, pick best
    let pozycje = []
    try {
      const candidates = findTableCandidates(layout)
      result.debug.tableCandidates = candidates.length
      const best = chooseBestTableCandidate(candidates)

      if (best) {
        result.debug.tableSelected = { page: best.pageNum, score: best.headerScore, rows: best.rowCount }
        const colMap = supplierColumnMap || best.columnMap || {}
        result.debug.columnMap = colMap

        for (const row of best.rows) {
          try {
            const parsed = parseInvoiceLineData(row.items || [], colMap)
            if (parsed && (parsed.nazwa) && (parsed.cenaNetto > 0 || parsed.wartoscNetto > 0)) {
              pozycje.push(makeItem({ ...parsed, rawName: parsed.nazwa }))
            }
          } catch (e) {
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

    result.fields.pozycje = pozycje

    // 8. Confidence scoring
    let conf = 0
    if (result.fields.numer) conf += 25
    if (result.fields.data_zakupu) conf += 25
    if (result.fields.kontrahent_nip) conf += 20
    if (pozycje.length > 0) conf += 30
    result.confidence = conf
    result.source = 'pdf_text'

    if (structure.warnings?.length) structure.warnings.forEach(w => result.warnings.push(w))
    if (!pozycje.length) result.warnings.push('Nie udało się automatycznie wykryć pozycji. Dodaj ręcznie klikając "+ Dodaj pozycję".')
    if (conf < 50) result.warnings.push('Niska pewność odczytu. Sprawdź wszystkie pola przed zatwierdzeniem.')

    // 9. Validation
    try {
      validateInvoiceExtraction(result)
    } catch (e) {
      result.debug.validationError = String(e)
    }

    // 10. Save supplier template if confident enough
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
      const cena = normalizePolishNumber(simpleMatch[2])
      if (!isNaN(cena) && cena > 0 && cena < 100000) {
        const item = makeItem({
          rawName: simpleMatch[1].trim(),
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
