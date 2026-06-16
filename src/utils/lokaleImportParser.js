export const LOKALIZACJE = {
  'Hel':  { kod: 'hel',  nazwa: 'Hel' },
  'Jas':  { kod: 'jas',  nazwa: 'Jastarnia' },
  'Jur':  { kod: 'jurata', nazwa: 'Jurata' },
  'Jura': { kod: 'jurata', nazwa: 'Jurata' },
  'Mech': { kod: 'mech', nazwa: 'Mechelinki' },
  'Puck': { kod: 'puck', nazwa: 'Puck' },
  'Wł':   { kod: 'wl',   nazwa: 'Władysławowo' },
}

export function parseLokalRow({ nazwa, opis }) {
  const parts = nazwa.trim().split(/\s+/)
  // Jura must be checked before Jur (longer prefix first)
  let loc = null
  for (const key of ['Jura', 'Jur', 'Hel', 'Jas', 'Mech', 'Puck', 'Wł']) {
    if (parts[0] === key) { loc = LOKALIZACJE[key]; break }
  }
  if (!loc) loc = { kod: 'inne', nazwa: 'Inne' }

  const o = (opis || '').toLowerCase()
  const pojM = o.match(/(\d+)\s*-?\s*os(?:ob)?/)
  const metM = o.match(/(\d+)\s*m(?:2|²|\s*kw)?(?!\w)/)
  const zwierzeta_ok = /zwierz\w*\s*[-:]?\s*tak/.test(o)
  const parkingBrak = /bez parkingu|zakaz parkingu|brak parkingu/.test(o)
  const typ = o.includes('studio') ? 'studio' : 'apartament'
  const adresM = opis.match(/adres:\s*(.+)$/i)

  return {
    nazwa: nazwa.trim(),
    lokalizacja: loc.nazwa,
    lokalizacja_kod: loc.kod,
    typ,
    pojemnosc: pojM ? Number(pojM[1]) : 4,
    metraz: metM ? Number(metM[1]) : null,
    zwierzeta_ok,
    parking: !parkingBrak,
    adres: adresM ? adresM[1].trim() : loc.nazwa,
    notatki: opis.trim(),
  }
}

export function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))

  const results = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = splitCSVLine(line)
    const row = {}
    header.forEach((h, j) => { row[h] = (cols[j] || '').replace(/^"|"$/g, '').trim() })
    if (row.nazwa) results.push(parseLokalRow(row))
  }
  return results
}

function splitCSVLine(line) {
  const result = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQ = !inQ }
    else if (c === ',' && !inQ) { result.push(cur); cur = '' }
    else { cur += c }
  }
  result.push(cur)
  return result
}
