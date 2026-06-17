import { describe, it, expect } from 'vitest'
import { parseKwHotelXls, parseSpreadsheetMlRows, isSpreadsheetMlContent } from './kwHotelXlsParser'
import { parseKwHotelReport } from './kwHotelReportParser'

function cell(index, value, type = 'String') {
  return value == null ? `<Cell ss:Index="${index}"/>` : `<Cell ss:Index="${index}"><Data ss:Type="${type}">${value}</Data></Cell>`
}

function buildXls({ rows, checksumWyjazdy, checksumPrzyjazdy }) {
  const header = [
    cell(1, 'Rozkład dnia 17.06.2026'),
    cell(1, 'Apartament') + cell(3, 'Wyjazdy') + cell(5, 'Przyjazdy'),
  ]
  const body = rows.map(([nazwa, wyjazd, przyjazd]) =>
    cell(1, nazwa) + (wyjazd ? cell(3, 'X') : '') + (przyjazd ? cell(5, 'X') : ''))
  const footer = [
    cell(1, 'Podsumowanie'),
    cell(1, String(checksumWyjazdy), 'Number') + cell(2, String(checksumPrzyjazdy), 'Number'),
  ]
  const allRows = [...header, ...body, ...footer].map(r => `<Row>${r}</Row>`).join('\n')
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Sheet1"><Table>
${allRows}
</Table></Worksheet>
</Workbook>`
}

describe('parseKwHotelXls — daje ten sam kształt co CSV', () => {
  const xml = buildXls({
    rows: [
      ['Hel CasaBaia 04', false, true],   // tylko przyjazd
      ['Jas Las A19', true, true],        // zmiana
      ['Jas Marina D10', true, false],    // tylko wyjazd
    ],
    checksumWyjazdy: 2,
    checksumPrzyjazdy: 2,
  })
  const result = parseKwHotelXls(xml)

  it('klasyfikuje priorytety identycznie jak CSV', () => {
    expect(result.records.find(r => r.nazwa === 'Hel CasaBaia 04').priorytet).toBe(2)
    expect(result.records.find(r => r.nazwa === 'Jas Las A19').priorytet).toBe(1)
    expect(result.records.find(r => r.nazwa === 'Jas Marina D10').priorytet).toBe(3)
  })

  it('wykrywa lokalizację z prefiksu nazwy', () => {
    expect(result.records.find(r => r.nazwa === 'Hel CasaBaia 04').lokalizacjaKod).toBe('hel')
    expect(result.records.find(r => r.nazwa === 'Jas Las A19').lokalizacjaKod).toBe('jas')
  })

  it('parsuje datę raportu', () => {
    expect(result.date).toBe('2026-06-17')
  })

  it('ma identyczny kształt wyniku co parseKwHotelReport (records/summary/checksumOk/date/reportChecksum)', () => {
    expect(Object.keys(result).sort()).toEqual(
      Object.keys(parseKwHotelReport('"Rozkład dnia 01.01.2026"')).sort()
    )
  })
})

describe('parseKwHotelXls — suma kontrolna własna pliku', () => {
  it('checksumOk = true gdy własne podsumowanie (5 wyjazdów / 7 przyjazdów) się zgadza', () => {
    const xml = buildXls({
      rows: [
        ['Jur A 01', true, false],
        ['Jur A 02', true, false],
        ['Jur A 03', true, false],
        ['Jur A 04', true, false],
        ['Jur A 05', true, true],
        ['Jur A 06', false, true],
        ['Jur A 07', false, true],
        ['Jur A 08', false, true],
        ['Jur A 09', false, true],
        ['Jur A 10', false, true],
        ['Jur A 11', false, true],
      ],
      checksumWyjazdy: 5,
      checksumPrzyjazdy: 7,
    })
    const result = parseKwHotelXls(xml)
    expect(result.summary.sumaWyjazdow).toBe(5)
    expect(result.summary.sumaPrzyjazdow).toBe(7)
    expect(result.checksumOk).toBe(true)
  })

  it('checksumOk = false gdy suma nie zgadza się z podsumowaniem w TYM pliku', () => {
    const xml = buildXls({
      rows: [['Jur A 01', true, false]],
      checksumWyjazdy: 99,
      checksumPrzyjazdy: 0,
    })
    expect(parseKwHotelXls(xml).checksumOk).toBe(false)
  })
})

describe('parseKwHotelXls — polskie znaki i puste komórki', () => {
  it('czyta polskie znaki w nazwach lokali', () => {
    const xml = buildXls({
      rows: [
        ['Wł NaKlifie A21', false, true],
        ['Jas Jeżyn 5_1', false, true],
      ],
      checksumWyjazdy: 0,
      checksumPrzyjazdy: 2,
    })
    const { records, checksumOk } = parseKwHotelXls(xml)
    expect(records.map(r => r.nazwa)).toEqual(['Wł NaKlifie A21', 'Jas Jeżyn 5_1'])
    expect(records[0].lokalizacjaKod).toBe('wl')
    expect(checksumOk).toBe(true)
  })

  it('dekoduje encje XML (&amp; itp.)', () => {
    const xml = buildXls({ rows: [['Jas &amp; Las', false, true]], checksumWyjazdy: 0, checksumPrzyjazdy: 1 })
    expect(parseKwHotelXls(xml).records[0].nazwa).toBe('Jas & Las')
  })

  it('toleruje samozamykające się puste komórki <Cell .../>', () => {
    const xmlWithSelfClosed = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet><Table>
<Row>${cell(1, 'Apartament')}${cell(3, 'Wyjazdy')}${cell(5, 'Przyjazdy')}</Row>
<Row>${cell(1, 'Jas Test')}<Cell ss:Index="3"/>${cell(5, 'X')}</Row>
<Row>${cell(1, 'Podsumowanie')}</Row>
<Row>${cell(1, '0', 'Number')}${cell(2, '1', 'Number')}</Row>
</Table></Worksheet></Workbook>`
    const result = parseKwHotelXls(xmlWithSelfClosed)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].przyjazd).toBe(true)
    expect(result.checksumOk).toBe(true)
  })
})

describe('parseSpreadsheetMlRows — gęste kolumny z pustymi (pominiętymi) komórkami', () => {
  it('wypełnia brakujące indeksy pustym stringiem', () => {
    const xml = `<Row>${cell(1, 'A')}${cell(3, 'B')}</Row>`
    const rows = parseSpreadsheetMlRows(xml)
    expect(rows[0]).toEqual(['A', '', 'B'])
  })
})

describe('isSpreadsheetMlContent — auto-detekcja formatu', () => {
  it('rozpoznaje XML/SpreadsheetML jako XLS', () => {
    expect(isSpreadsheetMlContent('<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet">')).toBe(true)
  })

  it('rozpoznaje tekst z ";" jako CSV (nie XLS)', () => {
    expect(isSpreadsheetMlContent('"Rozkład dnia 17.06.2026";;;')).toBe(false)
  })
})
