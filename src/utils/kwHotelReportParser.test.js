import { describe, it, expect } from 'vitest'
import { parseKwHotelReport, PRIORYTETY, decodeKwHotelFile } from './kwHotelReportParser'

// ── Small, hand-built fixtures (page 1 + page 2 header layouts) ─────────────

const PAGE1_HEADER = '"Apartament";;"Wyjazdy";"Godzina";"Przyjazdy";;"Godzina"'
const PAGE2_HEADER = '"Apartament";"Wyjazdy";"Godzina";"Przyjazdy";"Godzina"'

function buildReport({ checksumWyjazdy, checksumPrzyjazdy } = {}) {
  return [
    '"Rozkład dnia 17.06.2026";;;',
    '',
    PAGE1_HEADER,
    '"Hel Test 01";;"";"";"X";;""', // tylko przyjazd (page1: wyj@2, prz@4)
    '"Jas Test 02";;"X";"";"";;""', // tylko wyjazd
    '"Jas Test 03";;"X";"";"X";;""', // zmiana
    PAGE2_HEADER,
    '"Jura Test 04";"";"";"X";""', // tylko przyjazd (page2: wyj@1, prz@3)
    '"Jura Test 05";"X";"";"";""', // tylko wyjazd
    '"Podsumowanie";"Wyjazdów (łącznie)";"Przyjazdów (łącznie)"',
    `"${checksumWyjazdy}";"${checksumPrzyjazdy}"`,
  ].join('\n')
}

describe('parseKwHotelReport — dynamiczne wykrywanie kolumn', () => {
  it('strona 1: Wyjazdy@2, Przyjazdy@4', () => {
    const { records } = parseKwHotelReport(buildReport({ checksumWyjazdy: 3, checksumPrzyjazdy: 3 }))
    const hel = records.find(r => r.nazwa === 'Hel Test 01')
    expect(hel.wyjazd).toBe(false)
    expect(hel.przyjazd).toBe(true)
  })

  it('strona 2: Wyjazdy@1, Przyjazdy@3', () => {
    const { records } = parseKwHotelReport(buildReport({ checksumWyjazdy: 3, checksumPrzyjazdy: 3 }))
    const jura = records.find(r => r.nazwa === 'Jura Test 04')
    expect(jura.wyjazd).toBe(false)
    expect(jura.przyjazd).toBe(true)
  })
})

describe('parseKwHotelReport — klasyfikacja priorytetów', () => {
  it('wyjazd + przyjazd → priorytet 1 (ZMIANA)', () => {
    const { records } = parseKwHotelReport(buildReport({ checksumWyjazdy: 3, checksumPrzyjazdy: 3 }))
    const z = records.find(r => r.nazwa === 'Jas Test 03')
    expect(z.priorytet).toBe(1)
    expect(z.priorytetLabel).toBe('ZMIANA')
    expect(PRIORYTETY[1].label).toBe('ZMIANA')
  })

  it('tylko przyjazd → priorytet 2 (PRZYJAZD)', () => {
    const { records } = parseKwHotelReport(buildReport({ checksumWyjazdy: 3, checksumPrzyjazdy: 3 }))
    const p = records.find(r => r.nazwa === 'Hel Test 01')
    expect(p.priorytet).toBe(2)
    expect(p.priorytetLabel).toBe('PRZYJAZD')
  })

  it('tylko wyjazd → priorytet 3 (WYJAZD)', () => {
    const { records } = parseKwHotelReport(buildReport({ checksumWyjazdy: 3, checksumPrzyjazdy: 3 }))
    const w = records.find(r => r.nazwa === 'Jas Test 02')
    expect(w.priorytet).toBe(3)
    expect(w.priorytetLabel).toBe('WYJAZD')
  })

  it('lokalizacjaKod wykryty z prefiksu nazwy', () => {
    const { records } = parseKwHotelReport(buildReport({ checksumWyjazdy: 3, checksumPrzyjazdy: 3 }))
    expect(records.find(r => r.nazwa === 'Hel Test 01').lokalizacjaKod).toBe('hel')
    expect(records.find(r => r.nazwa === 'Jas Test 02').lokalizacjaKod).toBe('jas')
    expect(records.find(r => r.nazwa === 'Jura Test 04').lokalizacjaKod).toBe('jurata')
  })

  it('parsuje datę raportu', () => {
    const { date } = parseKwHotelReport(buildReport({ checksumWyjazdy: 3, checksumPrzyjazdy: 3 }))
    expect(date).toBe('2026-06-17')
  })
})

describe('parseKwHotelReport — suma kontrolna', () => {
  it('checksumOk = true gdy suma zgodna z podsumowaniem', () => {
    // 5 rekordów: 3 wyjazdy (Jas02, Jas03, Jura05), 3 przyjazdy (Hel01, Jas03, Jura04)
    const { checksumOk, summary } = parseKwHotelReport(buildReport({ checksumWyjazdy: 3, checksumPrzyjazdy: 3 }))
    expect(summary.sumaWyjazdow).toBe(3)
    expect(summary.sumaPrzyjazdow).toBe(3)
    expect(checksumOk).toBe(true)
  })

  it('checksumOk = false gdy suma celowo zepsuta', () => {
    const { checksumOk } = parseKwHotelReport(buildReport({ checksumWyjazdy: 99, checksumPrzyjazdy: 3 }))
    expect(checksumOk).toBe(false)
  })

  it('checksumOk = false gdy brak wiersza podsumowania', () => {
    const noSummary = buildReport({ checksumWyjazdy: 3, checksumPrzyjazdy: 3 }).split('\n').slice(0, -2).join('\n')
    const { checksumOk } = parseKwHotelReport(noSummary)
    expect(checksumOk).toBe(false)
  })
})

describe('parseKwHotelReport — kodowanie polskich znaków', () => {
  it('czyta polskie znaki w nazwach lokali', () => {
    const csv = [
      '"Rozkład dnia 17.06.2026";;;',
      PAGE1_HEADER,
      '"Wł NaKlifie A21";;"";"";"X";;""',
      '"Jas Jeżyn 5_1";;"";"";"X";;""',
      '"Jas Na Plaży A06";;"";"";"X";;""',
      '"Podsumowanie";"Wyjazdów (łącznie)";"Przyjazdów (łącznie)"',
      '"0";"3"',
    ].join('\n')
    const { records, checksumOk } = parseKwHotelReport(csv)
    expect(records.map(r => r.nazwa)).toEqual(['Wł NaKlifie A21', 'Jas Jeżyn 5_1', 'Jas Na Plaży A06'])
    expect(records[0].lokalizacjaKod).toBe('wl')
    expect(checksumOk).toBe(true)
  })
})

describe('decodeKwHotelFile', () => {
  it('dekoduje bajty windows-1250 do poprawnych polskich znaków', () => {
    // 'ł' = 0xB3, 'ą' = 0xB9, 'ż' = 0xBF w windows-1250
    const bytes = new Uint8Array([0xB3, 0xB9, 0xBF])
    expect(decodeKwHotelFile(bytes.buffer)).toBe('łąż')
  })
})

// ── Pełny plik referencyjny z 17.06.2026 (zweryfikowane liczby) ─────────────

const FULL_REPORT = [
  '"Rozkład dnia 17.06.2026";;;',
  '',
  '"Apartament";;"Wyjazdy";"Godzina";"Przyjazdy";;"Godzina"',
  '',
  '"Hel CasaBaia 04";;"";"";"X";;""',
  ';',
  '"Hel CasaBaia 05";;"";"";"X";;""',
  ';',
  '"Jas ApLand 13";;"";"";"X";;""',
  ';',
  '"Jas Jeżyn 5_1";;"";"";"X";;""',
  ';',
  '"Jas Jeżyn 5_5";;"";"";"X";;""',
  ';',
  '"Jas Las A13";;"";"";"X";;""',
  ';',
  '"Jas Las A19";;"X";"";"X";;""',
  ';',
  '"Jas Las B16";;"X";"";"X";;""',
  ';',
  '"Jas Marina D10";;"X";"";"";;""',
  ';',
  '"Jas Na Plaż A06";;"";"";"X";;""',
  ';',
  '"Jas NadMPark 07";;"";"";"X";;""',
  ';',
  '"Jas NadMPark 10";;"X";"";"X";;""',
  ';',
  '"Jas Wydma 04";;"X";"";"";;""',
  ';',
  '"Jas Wydma 10";;"";"";"X";;""',
  ';',
  '"Jas Wyspa 5/8";;"";"";"X";;""',
  ';',
  '"Jas Zat Harmo 2";;"X";"";"";;""',
  ';',
  '"Jas Zat Kom 09";;"X";"";"X";;""',
  ';',
  '"Jas Zat Kom 16";;"X";"";"";;""',
  ';',
  '"Jas Zat Kom 17";;"";"";"X";;""',
  ';',
  '"Jas Zdroj 343";;"";"";"X";;""',
  ';',
  '"Jas Zdroj 351";;"";"";"X";;""',
  ';',
  '"Jur 4Ż Pow 06";;"";"";"X";;""',
  ';',
  '"Jur Aqua 11";;"X";"";"X";;""',
  ';',
  '"Jur GoldPoint 4";;"X";"";"";;""',
  ';',
  '"Jur Mestw 37_08";;"X";"";"X";;""',
  ';',
  '"Jura LIDO 1001";;"X";"";"";;""',
  ';',
  '"Jura LIDO 1003";;"X";"";"";;""',
  ';',
  '"Jura LIDO 1004";;"X";"";"X";;""',
  ';',
  '"Jura LIDO 1101";;"X";"";"";;""',
  ';',
  '"Jura LIDO 1102";;"X";"";"";;""',
  ';',
  '"Jura LIDO 1108";;"X";"";"";;""',
  ';',
  '"Jura LIDO 1110";;"X";"";"";;""',
  ';',
  '"Apartament";"Wyjazdy";"Godzina";"Przyjazdy";"Godzina"',
  '',
  '"Jura LIDO 1111";"X";"";"";""',
  '',
  '"Jura LIDO 1113";"";"";"X";""',
  '',
  '"Jura LIDO 1214";"X";"";"";""',
  '',
  '"Jura LIDO 1301";"X";"";"";""',
  '',
  '"Jura LIDO 1304";"X";"";"X";""',
  '',
  '"Jura LIDO 1306";"X";"";"";""',
  '',
  '"Jura LIDO 1308";"X";"";"";""',
  '',
  '"Jura LIDO 2004";"X";"";"X";""',
  '',
  '"Jura LIDO 2109";"";"";"X";""',
  '',
  '"Jura LIDO 2113";"X";"";"";""',
  '',
  '"Jura LIDO 2212";"";"";"X";""',
  '',
  '"Jura LIDO 2306";"";"";"X";""',
  '',
  '"Jura LIDO 2312";"";"";"X";""',
  '',
  '"Jura LIDO 2314";"";"";"X";""',
  '',
  '"Mech Anch A03";"";"";"X";""',
  '',
  '"Mech Anch B01";"";"";"X";""',
  '',
  '"Mech Anch B06";"";"";"X";""',
  '',
  '"Mech Anch B35";"";"";"X";""',
  '',
  '"Mech Anch B53";"";"";"X";""',
  '',
  '"Mech Anch B60";"";"";"X";""',
  '',
  '"Mech Porto 28/3";"X";"";"";""',
  '',
  '"Mech Porto 6/1";"";"";"X";""',
  '',
  '"Mech Revit A13";"";"";"X";""',
  '',
  '"Mech Revit B18";"X";"";"";""',
  '',
  '"Puck Katam 08";"X";"";"";""',
  '',
  '"Puck Katam A19";"";"";"X";""',
  '',
  '"Puck Nexo A23";"X";"";"X";""',
  '',
  '"Puck Nexo E01";"";"";"X";""',
  '',
  '"Puck Nexo E09";"X";"";"";""',
  '',
  '"Wł NaKlifie A21";"";"";"X";""',
  '',
  '"Wł NaKlifie A39";"";"";"X";""',
  '',
  '"Wł NaKlifie B09";"";"";"X";""',
  '',
  '"Wł NaKlifie C01";"";"";"X";""',
  '',
  '"Wł NaKlifie C22";"";"";"X";""',
  '',
  '"Apartament";"Wyjazdy";"Godzina";"Przyjazdy";"Godzina"',
  '',
  '"Wł NaKlifie D19";"X";"";"";""',
  '',
  '"Podsumowanie";"Wyjazdów (łącznie)";"Przyjazdów (łącznie)"',
  '',
  '"32";"45"',
].join('\n')

describe('parseKwHotelReport — pełny plik referencyjny (17.06.2026)', () => {
  const result = parseKwHotelReport(FULL_REPORT)

  it('zwraca 67 lokali z aktywnością', () => {
    expect(result.summary.total).toBe(67)
  })

  it('klasyfikuje 10 zmian, 35 tylko przyjazd, 22 tylko wyjazd', () => {
    expect(result.summary.zmiana).toBe(10)
    expect(result.summary.tylkoPrzyjazd).toBe(35)
    expect(result.summary.tylkoWyjazd).toBe(22)
  })

  it('suma kontrolna: 32 wyjazdy, 45 przyjazdów, zgodne z raportem', () => {
    expect(result.summary.sumaWyjazdow).toBe(32)
    expect(result.summary.sumaPrzyjazdow).toBe(45)
    expect(result.checksumOk).toBe(true)
  })
})
