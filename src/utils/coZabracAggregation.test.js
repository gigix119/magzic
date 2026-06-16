import { describe, it, expect } from 'vitest'
import { aggregateDemand } from './coZabracAggregation'

describe('aggregateDemand', () => {
  it('agreguje pozycje z dwóch przygotowan — 2×3 ręczniki = 6, stan 4 → brak 2', () => {
    const pozycje = [
      { nazwa_pozycji: 'Ręcznik', ilosc: 3, jednostka: 'szt.' },
      { nazwa_pozycji: 'Ręcznik', ilosc: 3, jednostka: 'szt.' },
    ]
    const result = aggregateDemand(pozycje, { 'Ręcznik': 4 })
    expect(result).toHaveLength(1)
    expect(result[0].wymagane).toBe(6)
    expect(result[0].dostepne).toBe(4)
    expect(result[0].brak).toBe(2)
  })

  it('brak = 0 gdy wystarczy stanu', () => {
    const pozycje = [{ nazwa_pozycji: 'Mydło', ilosc: 2, jednostka: 'szt.' }]
    const result = aggregateDemand(pozycje, { 'Mydło': 10 })
    expect(result[0].brak).toBe(0)
    expect(result[0].wymagane).toBe(2)
  })

  it('dostepne = null gdy produkt nie ma stanu w magazynie', () => {
    const pozycje = [{ nazwa_pozycji: 'Nowy towar', ilosc: 5, jednostka: 'szt.' }]
    const result = aggregateDemand(pozycje, {})
    expect(result[0].dostepne).toBeNull()
    expect(result[0].brak).toBeNull()
  })

  it('sortuje braki na górze', () => {
    const pozycje = [
      { nazwa_pozycji: 'OK produkt', ilosc: 1, jednostka: 'szt.' },
      { nazwa_pozycji: 'Brakujący', ilosc: 10, jednostka: 'szt.' },
    ]
    const result = aggregateDemand(pozycje, { 'OK produkt': 5, 'Brakujący': 3 })
    expect(result[0].nazwa).toBe('Brakujący')
    expect(result[0].brak).toBe(7)
  })

  it('pomija pozycje bez nazwy', () => {
    const pozycje = [
      { nazwa_pozycji: '', ilosc: 3 },
      { nazwa_pozycji: 'Ręcznik', ilosc: 2 },
    ]
    const result = aggregateDemand(pozycje, {})
    expect(result).toHaveLength(1)
    expect(result[0].nazwa).toBe('Ręcznik')
  })
})
