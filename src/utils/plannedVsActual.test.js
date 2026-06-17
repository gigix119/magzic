import { describe, it, expect } from 'vitest'
import { analyzePlannedVsActual } from './plannedVsActual'

function makePrzygotowanie(id, lokal, pozycje) {
  return {
    id,
    _lokal: lokal,
    pozycje: pozycje.map(([nazwa, ilosc, wydano]) => ({
      id: `p-${Math.random()}`,
      nazwa_pozycji: nazwa,
      ilosc,
      jednostka: 'szt.',
      wydano,
    })),
  }
}

describe('analyzePlannedVsActual', () => {
  it('oblicza summary: totalPlanned, totalActual, efficiency', () => {
    const data = [
      makePrzygotowanie('z1', 'Lokal A', [
        ['Ręcznik',  4, true],
        ['Pościel',  2, true],
      ]),
      makePrzygotowanie('z2', 'Lokal A', [
        ['Ręcznik',  4, false],  // nie wydano
      ]),
    ]
    const { summary } = analyzePlannedVsActual(data)
    expect(summary.przygotowan).toBe(2)
    expect(summary.totalPlanned).toBe(10)   // 4+2+4
    expect(summary.totalActual).toBe(6)     // 4+2 (z2 nie wydano)
    expect(summary.efficiency).toBe(60)     // 6/10 * 100
  })

  it('grupuje perProdukt z diff i diffPercent', () => {
    const data = [
      makePrzygotowanie('z1', 'Lokal A', [['Kawa', 10, true]]),
      makePrzygotowanie('z2', 'Lokal B', [['Kawa',  5, false]]),
    ]
    const { perProdukt } = analyzePlannedVsActual(data)
    const kawa = perProdukt.find(r => r.nazwa === 'Kawa')
    expect(kawa.planned).toBe(15)
    expect(kawa.actual).toBe(10)
    expect(kawa.diff).toBe(5)            // 15 - 10 = 5 (oszczędność)
    expect(kawa.diffPercent).toBe(67)    // round(10/15*100) = 67
  })

  it('grupuje perLokal z przygotowan i efficiency', () => {
    const data = [
      makePrzygotowanie('z1', 'Lokal A', [['Produkt', 5, true]]),
      makePrzygotowanie('z2', 'Lokal A', [['Produkt', 3, false]]),
      makePrzygotowanie('z3', 'Lokal B', [['Produkt', 4, true]]),
    ]
    const { perLokal } = analyzePlannedVsActual(data)
    const lokalA = perLokal.find(r => r.lokal === 'Lokal A')
    expect(lokalA.przygotowan).toBe(2)
    expect(lokalA.planned).toBe(8)
    expect(lokalA.actual).toBe(5)

    const lokalB = perLokal.find(r => r.lokal === 'Lokal B')
    expect(lokalB.przygotowan).toBe(1)
    expect(lokalB.planned).toBe(4)
    expect(lokalB.actual).toBe(4)
    expect(lokalB.efficiency).toBe(100)
  })

  it('zwraca puste wyniki dla pustej listy przygotowań', () => {
    const { perProdukt, perLokal, summary } = analyzePlannedVsActual([])
    expect(perProdukt).toHaveLength(0)
    expect(perLokal).toHaveLength(0)
    expect(summary.przygotowan).toBe(0)
    expect(summary.efficiency).toBeNull()
  })
})
