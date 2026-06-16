import { describe, it, expect } from 'vitest'
import { parseLokalRow, parseCSV, LOKALIZACJE } from './lokaleImportParser'

describe('parseLokalRow', () => {
  it('wykrywa lokalizację Hel', () => {
    const r = parseLokalRow({ nazwa: 'Hel 5', opis: 'Apartament 4-osobowy parking: tak' })
    expect(r.lokalizacja_kod).toBe('hel')
    expect(r.lokalizacja).toBe('Hel')
  })

  it('Jur i Jura trafiają do tej samej lokalizacji Jurata', () => {
    const jur  = parseLokalRow({ nazwa: 'Jur 1',  opis: 'Apartament 4-osobowy' })
    const jura = parseLokalRow({ nazwa: 'Jura 1', opis: 'Apartament 4-osobowy' })
    expect(jur.lokalizacja_kod).toBe('jurata')
    expect(jura.lokalizacja_kod).toBe('jurata')
    expect(jur.lokalizacja).toBe('Jurata')
    expect(jura.lokalizacja).toBe('Jurata')
  })

  it('parsuje pojemność z opisu', () => {
    const r = parseLokalRow({ nazwa: 'Puck 3', opis: 'Apartament 6-osobowy' })
    expect(r.pojemnosc).toBe(6)
  })

  it('domyślna pojemność 4 gdy brak w opisie', () => {
    const r = parseLokalRow({ nazwa: 'Hel 1', opis: 'Apartament bez danych' })
    expect(r.pojemnosc).toBe(4)
  })

  it('wykrywa brak parkingu', () => {
    const r = parseLokalRow({ nazwa: 'Jas 4', opis: 'Apartament 2-osobowy bez parkingu' })
    expect(r.parking).toBe(false)
  })

  it('parking domyślnie true gdy brak frazy "bez parkingu"', () => {
    const r = parseLokalRow({ nazwa: 'Mech 1', opis: 'Apartament 4-osobowy parking: tak' })
    expect(r.parking).toBe(true)
  })

  it('wykrywa zwierzęta', () => {
    const r = parseLokalRow({ nazwa: 'Jura 21', opis: 'Apartament 4-osobowy zwierzeta - tak' })
    expect(r.zwierzeta_ok).toBe(true)
  })

  it('studio jako typ', () => {
    const r = parseLokalRow({ nazwa: 'Hel 6', opis: 'Studio 2-osobowy bez parkingu' })
    expect(r.typ).toBe('studio')
  })

  it('apartament jako typ domyślny', () => {
    const r = parseLokalRow({ nazwa: 'Wł 1', opis: 'Apartament 4-osobowy' })
    expect(r.typ).toBe('apartament')
  })

  it('Wł mapuje do Władysławowo', () => {
    const r = parseLokalRow({ nazwa: 'Wł 10', opis: 'Apartament 4-osobowy' })
    expect(r.lokalizacja_kod).toBe('wl')
    expect(r.lokalizacja).toBe('Władysławowo')
  })

  it('nieznany prefix → inne', () => {
    const r = parseLokalRow({ nazwa: 'XYZ 1', opis: 'Apartament 4-osobowy' })
    expect(r.lokalizacja_kod).toBe('inne')
  })

  it('parsuje metraż', () => {
    const r = parseLokalRow({ nazwa: 'Puck 5', opis: 'Apartament 4-osobowy 45m2' })
    expect(r.metraz).toBe(45)
  })
})

describe('parseCSV', () => {
  it('parsuje nagłówek i wiersze', () => {
    const csv = 'nazwa,opis\nHel 1,Apartament 4-osobowy parking: tak\nJas 2,Apartament 2-osobowy bez parkingu'
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0].lokalizacja_kod).toBe('hel')
    expect(rows[1].parking).toBe(false)
  })

  it('pomija puste wiersze', () => {
    const csv = 'nazwa,opis\nHel 1,Apartament 4-osobowy\n\n\nJas 2,Apartament 2-osobowy'
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(2)
  })
})

describe('LOKALIZACJE', () => {
  it('zawiera 7 lokalizacji', () => {
    expect(Object.keys(LOKALIZACJE)).toHaveLength(7)
  })
})
