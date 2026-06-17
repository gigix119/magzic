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

function classifyPriorytet(wyjazd, przyjazd) {
  return wyjazd && przyjazd ? 1 : przyjazd ? 2 : 3
}

/**
 * Wspólna logika dla parserów KW Hotel (CSV i XLS): klasyfikacja priorytetów,
 * wykrywanie daty/nagłówków kolumn i walidacja sumy kontrolnej.
 * @param {Array<Array<string>>} rowsOfCols - każdy element to gęsta (0-based) tablica
 *   kolumn jednego logicznego wiersza raportu (puste komórki = '').
 */
export function parseKwHotelRows(rowsOfCols) {
  let wyjIdx = null
  let prjIdx = null
  let date = null
  let afterPodsumowanie = false
  let sawPodsumowanie = false
  let reportChecksum = null

  const records = []

  for (const cols of rowsOfCols) {
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
      if (afterPodsumowanie) sawPodsumowanie = true
      continue
    }

    if (afterPodsumowanie) {
      // CSV: liczby w pierwszych dwóch kolumnach wiersza, np. "32";"45".
      // XLS: liczby są w TYCH SAMYCH kolumnach co Wyjazdy/Przyjazdy w danych
      // (Index 3 / Index 5), w odrębnym wierszu po nagłówku podsumowania —
      // czasem oddzielonym pustym wierszem, który po prostu pomijamy.
      const wyjCell = wyjIdx != null ? cols[wyjIdx] : undefined
      const prjCell = prjIdx != null ? cols[prjIdx] : undefined
      if (/^\d+$/.test(wyjCell || '') && /^\d+$/.test(prjCell || '')) {
        reportChecksum = { wyjazdy: Number(wyjCell), przyjazdy: Number(prjCell) }
        afterPodsumowanie = false
        continue
      }
      if (/^\d+$/.test(cols[0] || '') && /^\d+$/.test(cols[1] || '')) {
        reportChecksum = { wyjazdy: Number(cols[0]), przyjazdy: Number(cols[1]) }
        afterPodsumowanie = false
        continue
      }
      if (!first) continue // pusty wiersz-separator między nagłówkiem podsumowania i liczbami
      continue
    }

    if (!first) continue
    if (wyjIdx == null || prjIdx == null) continue

    const wyjazd = (cols[wyjIdx] || '').toUpperCase() === 'X'
    const przyjazd = (cols[prjIdx] || '').toUpperCase() === 'X'
    if (!wyjazd && !przyjazd) continue

    const priorytet = classifyPriorytet(wyjazd, przyjazd)
    records.push({
      nazwa: first,
      wyjazd,
      przyjazd,
      priorytet,
      priorytetLabel: PRIORYTETY[priorytet].label,
      lokalizacjaKod: detectLokalizacjaKod(first),
    })
  }

  if (!reportChecksum && sawPodsumowanie) {
    // Fallback: ostatni niepusty wiersz pliku z dokładnie dwiema liczbami
    // to prawie zawsze podsumowanie, nawet jeśli układ kolumn jest nietypowy.
    for (let i = rowsOfCols.length - 1; i >= 0; i--) {
      const nonEmpty = rowsOfCols[i].filter(c => c !== '')
      if (nonEmpty.length === 2 && nonEmpty.every(c => /^\d+$/.test(c))) {
        reportChecksum = { wyjazdy: Number(nonEmpty[0]), przyjazdy: Number(nonEmpty[1]) }
        break
      }
    }
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
