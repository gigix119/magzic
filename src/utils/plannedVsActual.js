/**
 * Analizuje efektywność: plan vs faktyczne wydanie.
 *
 * @param {Array} przygotowania - zlecenia ze statusem 'gotowe':
 *   każdy musi mieć: { id, _lokal: string, pozycje: [{ nazwa_pozycji, ilosc, jednostka, wydano }] }
 * @returns {{ perProdukt, perLokal, summary }}
 */
export function analyzePlannedVsActual(przygotowania) {
  const byNazwa = {}
  const byLokal = {}

  for (const z of przygotowania) {
    const lokalNazwa = z._lokal || '—'

    if (!byLokal[lokalNazwa]) {
      byLokal[lokalNazwa] = { lokal: lokalNazwa, planned: 0, actual: 0, przygotowan: 0 }
    }
    byLokal[lokalNazwa].przygotowan++

    for (const p of z.pozycje || []) {
      const ilosc = Number(p.ilosc) || 0
      const actual = p.wydano ? ilosc : 0
      const nazwa = p.nazwa_pozycji || '—'

      if (!byNazwa[nazwa]) {
        byNazwa[nazwa] = { nazwa, jednostka: p.jednostka || 'szt.', planned: 0, actual: 0 }
      }
      byNazwa[nazwa].planned += ilosc
      byNazwa[nazwa].actual += actual

      byLokal[lokalNazwa].planned += ilosc
      byLokal[lokalNazwa].actual += actual
    }
  }

  // diff = planned - actual: >0 = oszczędność, <0 = nadużycie
  const perProdukt = Object.values(byNazwa)
    .map(r => ({
      ...r,
      diff: r.planned - r.actual,
      diffPercent: r.planned > 0 ? Math.round((r.actual / r.planned) * 100) : null,
    }))
    .sort((a, b) => a.diff - b.diff) // nadużycia (ujemne diff) na górze

  const perLokal = Object.values(byLokal)
    .map(r => ({
      ...r,
      efficiency: r.planned > 0 ? Math.round((r.actual / r.planned) * 100) : null,
    }))
    .sort((a, b) => b.przygotowan - a.przygotowan)

  const totalPlanned = perProdukt.reduce((s, r) => s + r.planned, 0)
  const totalActual = perProdukt.reduce((s, r) => s + r.actual, 0)

  return {
    perProdukt,
    perLokal,
    summary: {
      przygotowan: przygotowania.length,
      totalPlanned,
      totalActual,
      efficiency: totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : null,
    },
  }
}
