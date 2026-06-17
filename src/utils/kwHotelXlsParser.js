import { parseKwHotelRows } from './kwHotelShared'

const ROW_RE = /<(?:\w+:)?Row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Row>/g
const CELL_RE = /<(?:\w+:)?Cell\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?Cell>/g
const DATA_RE = /<(?:\w+:)?Data\b[^>]*>([\s\S]*?)<\/(?:\w+:)?Data>/
const INDEX_RE = /(?:^|\s)(?:\w+:)?Index="(\d+)"/

function normalizeSelfClosing(xml, tag) {
  const re = new RegExp(`<((?:\\w+:)?${tag})\\b([^>]*?)\\/>`, 'g')
  return xml.replace(re, '<$1$2></$1>')
}

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
}

/**
 * Wyciąga wiersze raportu SpreadsheetML (format XLS z KW Hotel) jako gęste
 * (0-based) tablice kolumn — analogicznie do wyniku splitSemicolonLine z CSV.
 * Czysty regex, bez DOMParser, żeby działało identycznie w przeglądarce i w testach (Node).
 * @param {string} xmlText
 * @returns {Array<Array<string>>}
 */
export function parseSpreadsheetMlRows(xmlText) {
  const xml = normalizeSelfClosing(normalizeSelfClosing(xmlText, 'Cell'), 'Row')

  const rowsOfCols = []
  let rowMatch
  ROW_RE.lastIndex = 0
  while ((rowMatch = ROW_RE.exec(xml))) {
    const rowContent = rowMatch[1]
    const cellMap = {}
    let nextIndex = 1
    let cellMatch
    CELL_RE.lastIndex = 0
    while ((cellMatch = CELL_RE.exec(rowContent))) {
      const attrs = cellMatch[1]
      const inner = cellMatch[2]
      const idxMatch = attrs.match(INDEX_RE)
      const idx = idxMatch ? Number(idxMatch[1]) : nextIndex
      const dataMatch = inner.match(DATA_RE)
      cellMap[idx] = dataMatch ? decodeXmlEntities(dataMatch[1]).trim() : ''
      nextIndex = idx + 1
    }
    const maxIdx = Math.max(0, ...Object.keys(cellMap).map(Number))
    const cols = []
    for (let i = 1; i <= maxIdx; i++) cols.push(cellMap[i] || '')
    rowsOfCols.push(cols)
  }
  return rowsOfCols
}

/**
 * Parsuje raport "Rozkład dnia" z KW Hotel, format XLS (SpreadsheetML XML).
 * Współdzieli klasyfikację priorytetów i walidację sumy kontrolnej z parserem CSV
 * (zwraca identyczny kształt wyniku — zob. kwHotelReportParser.parseKwHotelReport).
 * @param {string} xmlText - zawartość pliku zdekodowana jako UTF-8
 */
export function parseKwHotelXls(xmlText) {
  return parseKwHotelRows(parseSpreadsheetMlRows(xmlText))
}

/** Wykrywa, czy zawartość pliku to SpreadsheetML (XLS) a nie CSV. */
export function isSpreadsheetMlContent(text) {
  return text.trimStart().startsWith('<?xml') || text.includes('urn:schemas-microsoft-com:office:spreadsheet')
}
