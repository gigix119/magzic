import { LOKALIZACJE } from './lokaleImportParser'

const LOC_PREFIXES = ['Jura', 'Jur', 'Hel', 'Jas', 'Mech', 'Puck', 'Wł']

export const PRIORYTETY = {
  1: { label: 'ZMIANA', kolor: 'critical', opis: 'Wyjazd + przyjazd tego samego dnia' },
  2: { label: 'PRZYJAZD', kolor: 'attention', opis: 'Tylko przyjazd' },
  3: { label: 'WYJAZD', kolor: 'muted', opis: 'Tylko wyjazd' },
}

export function detectLokalizacjaKod(nazwa) {
  const first = nazwa.trim().split(/\s+/)[0]
  for (const key of LOC_PREFIXES) {
    if (first === key) return LOKALIZACJE[key].kod
  }
  return 'inne'
}

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
 * Parsuje raport "Rozkład dnia" z KW Hotel (In/Out).
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

  let wyjIdx = null
  let prjIdx = null
  let date = null
  let afterPodsumowanie = false
  let reportChecksum = null

  const records = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    const cols = splitSemicolonLine(line)
    const first = cols[0] || ''

    if (!date) {
      const m = first.match(/Rozkład dnia (\d{2})\.(\d{2})\.(\d{4})/)
      if (m) date = `${m[3]}-${m[2]}-${m[1]}`
    }

    if (first === 'Apartament') {
      const wi = cols.findIndex(c => c === 'Wyjazdy')
      const pi = cols.findIndex(c => c === 'Przyjazdy')
      if (wi >= 0) wyjIdx = wi
      if (pi >= 0) prjIdx = pi
      continue
    }

    if (/^Rozkład/.test(first) || /^Podsumowanie/.test(first)) {
      afterPodsumowanie = /^Podsumowanie/.test(first)
      continue
    }

    if (/^\d+$/.test(first)) {
      if (afterPodsumowanie) {
        reportChecksum = { wyjazdy: Number(cols[0]), przyjazdy: Number(cols[1]) }
        afterPodsumowanie = false
      }
      continue
    }

    if (!first) continue
    if (wyjIdx == null || prjIdx == null) continue

    const wyjazd = (cols[wyjIdx] || '').toUpperCase() === 'X'
    const przyjazd = (cols[prjIdx] || '').toUpperCase() === 'X'
    if (!wyjazd && !przyjazd) continue

    const priorytet = wyjazd && przyjazd ? 1 : przyjazd ? 2 : 3
    records.push({
      nazwa: first,
      wyjazd,
      przyjazd,
      priorytet,
      priorytetLabel: PRIORYTETY[priorytet].label,
      lokalizacjaKod: detectLokalizacjaKod(first),
    })
  }

  const summary = {
    zmiana: records.filter(r => r.priorytet === 1).length,
    tylkoPrzyjazd: records.filter(r => r.priorytet === 2).length,
    tylkoWyjazd: records.filter(r => r.priorytet === 3).length,
    total: records.length,
    sumaWyjazdow: records.filter(r => r.wyjazd).length,
    sumaPrzyjazdow: records.filter(r => r.przyjazd).length,
  }

  const checksumOk = !!reportChecksum
    && reportChecksum.wyjazdy === summary.sumaWyjazdow
    && reportChecksum.przyjazdy === summary.sumaPrzyjazdow

  return { records, summary, checksumOk, date, reportChecksum }
}
