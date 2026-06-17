export const STREFY = {
  polwysep: { nazwa: 'Półwysep Helski', lokalizacje: ['hel', 'jas', 'jurata', 'wl', 'puck'] },
  gdynia: { nazwa: 'Okolice Gdyni', lokalizacje: ['mech'] },
}

function strefaKeyForKod(kod) {
  for (const [key, s] of Object.entries(STREFY)) {
    if (s.lokalizacje.includes(kod)) return key
  }
  return 'inne'
}

/**
 * Grupuje przygotowania w strefy geograficzne i szacuje liczbę potrzebnych ekip.
 * @param {Array<{lokalizacjaKod: string, priorytet: 1|2|3}>} rows
 * @param {{zmianyPerEkipa?: number, przygotowanPerEkipa?: number}} [options]
 */
export function planTeams(rows, { zmianyPerEkipa = 7, przygotowanPerEkipa = 13 } = {}) {
  const byStrefa = {}
  for (const r of rows) {
    const key = strefaKeyForKod(r.lokalizacjaKod)
    if (!byStrefa[key]) byStrefa[key] = []
    byStrefa[key].push(r)
  }

  const strefy = Object.entries(byStrefa).map(([key, strefaRows]) => {
    const nazwa = STREFY[key]?.nazwa || 'Inne'
    const zmiany = strefaRows.filter(r => r.priorytet === 1).length
    const total = strefaRows.length
    const sugerowaneEkipy = Math.max(1, Math.ceil(zmiany / zmianyPerEkipa), Math.ceil(total / przygotowanPerEkipa))
    return { key, nazwa, total, zmiany, sugerowaneEkipy, rows: strefaRows }
  }).sort((a, b) => b.total - a.total)

  const totalSugerowaneEkipy = strefy.reduce((sum, s) => sum + s.sugerowaneEkipy, 0)
  return { strefy, totalSugerowaneEkipy }
}

const POZIOM_PROGI = { niskie: 20, wysokie: 40 }

/**
 * Szacuje roboczogodziny na podstawie liczby zmian/przyjazdów/wyjazdów.
 * @param {Array<{priorytet: 1|2|3}>} rows
 */
export function estimateWorkload(rows, { zmianaH = 1.5, przyjazdH = 1, wyjazdH = 0.5 } = {}) {
  const zmiana = rows.filter(r => r.priorytet === 1).length
  const przyjazd = rows.filter(r => r.priorytet === 2).length
  const wyjazd = rows.filter(r => r.priorytet === 3).length
  const totalHours = zmiana * zmianaH + przyjazd * przyjazdH + wyjazd * wyjazdH
  const level = totalHours < POZIOM_PROGI.niskie ? 'niskie' : totalHours <= POZIOM_PROGI.wysokie ? 'srednie' : 'wysokie'
  return { totalHours, level, breakdown: { zmiana, przyjazd, wyjazd } }
}

export function hoursPerPerson(totalHours, headcount) {
  if (!headcount || headcount <= 0) return null
  return totalHours / headcount
}

/** Czytelny tekst planu dnia do skopiowania na WhatsApp/SMS. */
export function buildPlanText(date, rows, strefyResult) {
  const zmiany = rows.filter(r => r.priorytet === 1).map(r => r.nazwa)
  const przyjazdy = rows.filter(r => r.priorytet === 2).map(r => r.nazwa)
  const wyjazdy = rows.filter(r => r.priorytet === 3).map(r => r.nazwa)

  const lines = [`🏖️ PLAN ${date}`, '']
  if (zmiany.length) lines.push('🔴 ZMIANY (pilne, najpierw!):', `• ${zmiany.join(', ')}`, '')
  if (przyjazdy.length) lines.push('🟡 PRZYJAZDY:', `• ${przyjazdy.join(', ')}`, '')
  if (wyjazdy.length) lines.push('🔵 WYJAZDY:', `• ${wyjazdy.join(', ')}`, '')

  if (strefyResult?.strefy?.length) {
    lines.push('📍 Podział:')
    lines.push(strefyResult.strefy.map(s => `${s.nazwa}: ${s.total}`).join(' | '))
  }

  return lines.join('\n').trim()
}
