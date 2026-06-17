import { describe, it, expect } from 'vitest'
import { calculateForecast } from './forecastEngine'

const towaryMap = {
  't-1': { nazwa: 'Kapsułka do kawy', jednostka: 'szt.' },
  't-2': { nazwa: 'Ręcznik duży',     jednostka: 'szt.' },
  't-3': { nazwa: 'Komplet pościeli', jednostka: 'kpl.' },
}

const stanyMap = { 't-1': 57, 't-2': 100, 't-3': 8 }

const pakietyMap = {
  'pak-1': [
    { towar_id: 't-3', ilosc: 4 },
    { towar_id: 't-2', ilosc: 2 },
  ],
}

const lokaleMap = {
  'lok-1': { domyslny_pakiet_id: 'pak-1' },
}

describe('calculateForecast', () => {
  it('agreguje zapotrzebowanie z pakietów dla 3 rezerwacji', () => {
    const rezerwacje = [
      { id: 'r1', lokal_id: 'lok-1', przygotowanie_id: null },
      { id: 'r2', lokal_id: 'lok-1', przygotowanie_id: null },
      { id: 'r3', lokal_id: 'lok-1', przygotowanie_id: null },
    ]
    const result = calculateForecast({ rezerwacje, lokaleMap, pakietyMap, stanyMap, towaryMap })

    const posciel = result.find(r => r.towar_id === 't-3')
    expect(posciel.potrzebne).toBe(12)    // 3 × 4
    expect(posciel.dostepne).toBe(8)
    expect(posciel.doZamowienia).toBe(4)  // 12 - 8 = 4

    const recznik = result.find(r => r.towar_id === 't-2')
    expect(recznik.potrzebne).toBe(6)     // 3 × 2
    expect(recznik.dostepne).toBe(100)
    expect(recznik.doZamowienia).toBe(0)  // wystarczy
  })

  it('używa pozycji ze zlecenia gdy rezerwacja ma przygotowanie_id', () => {
    const rezerwacje = [{ id: 'r1', lokal_id: 'lok-1', przygotowanie_id: 'zl-1' }]
    const zleceniePozycjeMap = {
      'zl-1': [
        { nazwa_pozycji: 'Kapsułka do kawy', ilosc: 10 },
        { nazwa_pozycji: 'Komplet pościeli', ilosc: 3 },
      ],
    }
    const towaryByName = {
      'kapsułka do kawy': 't-1',
      'komplet pościeli': 't-3',
    }
    const result = calculateForecast({
      rezerwacje, lokaleMap, pakietyMap, stanyMap, towaryMap,
      zleceniePozycjeMap, towaryByName,
    })

    // Powinien użyć pozycji ze zlecenia, nie z pakietu
    const kawa = result.find(r => r.towar_id === 't-1')
    expect(kawa.potrzebne).toBe(10)
    expect(kawa.dostepne).toBe(57)
    expect(kawa.doZamowienia).toBe(0)     // stan wystarczający

    const posciel = result.find(r => r.towar_id === 't-3')
    expect(posciel.potrzebne).toBe(3)     // ze zlecenia (pakiet dałby 4)
  })

  it('zwraca pustą prognozę gdy brak rezerwacji', () => {
    const result = calculateForecast({ rezerwacje: [], lokaleMap, pakietyMap, stanyMap, towaryMap })
    expect(result).toHaveLength(0)
  })

  it('pomija rezerwacje bez dopasowanego lokalu', () => {
    const result = calculateForecast({
      rezerwacje: [{ id: 'r1', lokal_id: 'nieznany', przygotowanie_id: null }],
      lokaleMap, pakietyMap, stanyMap, towaryMap,
    })
    expect(result).toHaveLength(0)
  })

  it('braki są sortowane na górze (doZamowienia malejąco)', () => {
    const rezerwacje = [
      { id: 'r1', lokal_id: 'lok-1', przygotowanie_id: null },
      { id: 'r2', lokal_id: 'lok-1', przygotowanie_id: null },
      { id: 'r3', lokal_id: 'lok-1', przygotowanie_id: null },
    ]
    const result = calculateForecast({ rezerwacje, lokaleMap, pakietyMap, stanyMap, towaryMap })
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].doZamowienia).toBeGreaterThanOrEqual(result[i].doZamowienia)
    }
    // Pościel powinna być pierwsza (brak 4) przed ręcznikiem (brak 0)
    expect(result[0].towar_id).toBe('t-3')
  })
})
