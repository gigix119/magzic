/**
 * Aggregates demand from a flat list of zlecenia_pozycje entries.
 * Pure function — no side effects, no Supabase.
 *
 * @param {Array<{nazwa_pozycji: string, ilosc: number|string, jednostka?: string}>} pozycje
 * @param {Record<string, number>} stanyByName - map of product name → total stock
 * @returns {Array<{nazwa: string, jednostka: string, wymagane: number, dostepne: number, brak: number}>}
 */
export function aggregateDemand(pozycje, stanyByName = {}) {
  const map = {}
  for (const p of pozycje) {
    const key = p.nazwa_pozycji || ''
    if (!key) continue
    if (!map[key]) map[key] = { nazwa: key, jednostka: p.jednostka || 'szt.', wymagane: 0 }
    map[key].wymagane += Number(p.ilosc) || 0
  }
  return Object.values(map)
    .map(row => {
      const dostepne = stanyByName[row.nazwa] ?? null
      const brak = dostepne !== null ? Math.max(0, row.wymagane - dostepne) : null
      return { ...row, dostepne, brak }
    })
    .sort((a, b) => {
      const aBrak = a.brak ?? 0
      const bBrak = b.brak ?? 0
      if (bBrak !== aBrak) return bBrak - aBrak
      return b.wymagane - a.wymagane
    })
}
