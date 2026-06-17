import { parseKwHotelRows, PRIORYTETY, detectLokalizacjaKod } from './kwHotelShared'

export { PRIORYTETY, detectLokalizacjaKod }

function splitSemicolonLine(line) {
  const result = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQ = !inQ }
    else if (c === ';' && !inQ) { result.push(cur); cur = '' }
    else { cur += c }
  }
  result.push(cur)
  return result.map(c => c.trim())
}

/**
 * Decodes a KW Hotel CSV export. Files are exported as windows-1250;
 * falls back to utf-8 if that decoding fails (e.g. file already saved as UTF-8).
 * @param {ArrayBuffer} buffer
 */
export function decodeKwHotelFile(buffer) {
  try {
    return new TextDecoder('windows-1250').decode(buffer)
  } catch {
    return new TextDecoder('utf-8').decode(buffer)
  }
}

/**
 * Parsuje raport "Rozkład dnia" z KW Hotel (In/Out), format CSV.
 * @param {string} csvText - surowa zawartość CSV (już zdekodowana do stringa)
 * @returns {{
 *   records: Array<{nazwa: string, wyjazd: boolean, przyjazd: boolean, priorytet: 1|2|3, priorytetLabel: string, lokalizacjaKod: string}>,
 *   summary: {zmiana: number, tylkoPrzyjazd: number, tylkoWyjazd: number, total: number, sumaWyjazdow: number, sumaPrzyjazdow: number},
 *   checksumOk: boolean,
 *   date: string|null,
 *   reportChecksum: {wyjazdy: number, przyjazdy: number}|null,
 * }}
 */
export function parseKwHotelReport(csvText) {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const rowsOfCols = lines.map(rawLine => {
    const line = rawLine.trim()
    return line ? splitSemicolonLine(line) : []
  })
  return parseKwHotelRows(rowsOfCols)
}
