/**
 * Oblicza prognozę zapotrzebowania na towary na podstawie nadchodzących rezerwacji.
 *
 * @param {Object} params
 * @param {Array}  params.rezerwacje       - rezerwacje z lokal_id, przygotowanie_id
 * @param {Object} params.lokaleMap        - { lokal_id: { domyslny_pakiet_id } }
 * @param {Object} params.pakietyMap       - { pakiet_id: [{ towar_id, ilosc }] }
 * @param {Object} params.stanyMap         - { towar_id: totalQty (suma magazynów) }
 * @param {Object} params.towaryMap        - { towar_id: { nazwa, jednostka } }
 * @param {Object} params.zleceniePozycjeMap - { przygotowanie_id: [{ nazwa_pozycji, ilosc }] }
 * @param {Object} params.towaryByName     - { 'nazwa_lower': towar_id }
 * @returns {Array<ForecastLine>} posortowane: braki na górze
 */
export function calculateForecast({
  rezerwacje,
  lokaleMap,
  pakietyMap,
  stanyMap,
  towaryMap,
  zleceniePozycjeMap = {},
  towaryByName = {},
}) {
  const demand = {}

  for (const rez of rezerwacje) {
    const lokal = lokaleMap[rez.lokal_id]
    if (!lokal) continue

    let items = []

    if (rez.przygotowanie_id && zleceniePozycjeMap[rez.przygotowanie_id]) {
      // Rezerwacja ma już przygotowanie → bierz pozycje z zlecenia (mogły być ręcznie zmienione)
      for (const p of zleceniePozycjeMap[rez.przygotowanie_id]) {
        const towarId = towaryByName[(p.nazwa_pozycji || '').toLowerCase().trim()]
        if (towarId) items.push({ towar_id: towarId, ilosc: Number(p.ilosc) || 0 })
      }
    } else if (lokal.domyslny_pakiet_id && pakietyMap[lokal.domyslny_pakiet_id]) {
      items = pakietyMap[lokal.domyslny_pakiet_id].map(e => ({
        towar_id: e.towar_id,
        ilosc: Number(e.ilosc) || 0,
      }))
    }

    for (const item of items) {
      if (!item.towar_id || item.ilosc <= 0) continue
      if (!demand[item.towar_id]) demand[item.towar_id] = { potrzebne: 0, przygotowan: 0 }
      demand[item.towar_id].potrzebne += item.ilosc
      demand[item.towar_id].przygotowan++
    }
  }

  return Object.entries(demand)
    .map(([towar_id, d]) => {
      const towar = towaryMap[towar_id] || {}
      const dostepne = stanyMap[towar_id] || 0
      const doZamowienia = Math.max(0, d.potrzebne - dostepne)
      return {
        towar_id,
        nazwa: towar.nazwa || towar_id,
        jednostka: towar.jednostka || 'szt.',
        potrzebne: d.potrzebne,
        dostepne,
        doZamowienia,
        przygotowan: d.przygotowan,
      }
    })
    .sort((a, b) => b.doZamowienia - a.doZamowienia || a.nazwa.localeCompare(b.nazwa, 'pl'))
}
