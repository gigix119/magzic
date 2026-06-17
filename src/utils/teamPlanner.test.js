import { describe, it, expect } from 'vitest'
import { planTeams, estimateWorkload, hoursPerPerson, buildPlanText } from './teamPlanner'

function row(lokalizacjaKod, priorytet, nazwa = `${lokalizacjaKod}-${priorytet}`) {
  return { nazwa, lokalizacjaKod, priorytet }
}

describe('planTeams — grupowanie stref geograficznych', () => {
  it('grupuje hel/jas/jurata/wl/puck do Półwyspu Helskiego, mech do Okolic Gdyni', () => {
    const rows = [row('hel', 2), row('jas', 1), row('jurata', 3), row('wl', 2), row('puck', 3), row('mech', 2)]
    const { strefy } = planTeams(rows)
    const polwysep = strefy.find(s => s.key === 'polwysep')
    const gdynia = strefy.find(s => s.key === 'gdynia')
    expect(polwysep.total).toBe(5)
    expect(gdynia.total).toBe(1)
  })

  it('liczy zmiany per strefa', () => {
    const rows = [row('jas', 1), row('jas', 1), row('jas', 2)]
    const { strefy } = planTeams(rows)
    expect(strefy[0].zmiany).toBe(2)
    expect(strefy[0].total).toBe(3)
  })

  it('sugeruje min. 1 ekipę nawet dla małej strefy', () => {
    const { strefy } = planTeams([row('mech', 2)])
    expect(strefy[0].sugerowaneEkipy).toBe(1)
  })

  it('sugeruje więcej ekip przy dużej liczbie zmian (próg zmianyPerEkipa)', () => {
    const rows = Array.from({ length: 15 }, () => row('jas', 1))
    const { strefy } = planTeams(rows, { zmianyPerEkipa: 7, przygotowanPerEkipa: 100 })
    expect(strefy[0].sugerowaneEkipy).toBe(3) // ceil(15/7) = 3
  })

  it('nieznana lokalizacja trafia do strefy "inne"', () => {
    const { strefy } = planTeams([row('inne', 2)])
    expect(strefy[0].nazwa).toBe('Inne')
  })
})

describe('estimateWorkload', () => {
  it('sumuje roboczogodziny wg domyślnych wag (zmiana 1.5h, przyjazd 1h, wyjazd 0.5h)', () => {
    const rows = [row('jas', 1), row('jas', 2), row('jas', 3)]
    const { totalHours, breakdown } = estimateWorkload(rows)
    expect(totalHours).toBe(3) // 1.5 + 1 + 0.5
    expect(breakdown).toEqual({ zmiana: 1, przyjazd: 1, wyjazd: 1 })
  })

  it('poziom niskie gdy < 20h', () => {
    expect(estimateWorkload([row('jas', 3)]).level).toBe('niskie')
  })

  it('poziom wysokie gdy > 40h', () => {
    const rows = Array.from({ length: 30 }, () => row('jas', 1)) // 45h
    expect(estimateWorkload(rows).level).toBe('wysokie')
  })

  it('poziom srednie gdy 20-40h', () => {
    const rows = Array.from({ length: 20 }, () => row('jas', 1)) // 30h
    expect(estimateWorkload(rows).level).toBe('srednie')
  })
})

describe('hoursPerPerson', () => {
  it('dzieli godziny przez liczbę osób', () => {
    expect(hoursPerPerson(45, 6)).toBe(7.5)
  })

  it('zwraca null gdy headcount <= 0', () => {
    expect(hoursPerPerson(45, 0)).toBeNull()
  })
})

describe('buildPlanText', () => {
  it('zawiera datę, sekcje priorytetów i podział na strefy', () => {
    const rows = [row('jas', 1, 'Jas Las A19'), row('mech', 2, 'Mech Anch A03')]
    const strefyResult = planTeams(rows)
    const text = buildPlanText('17.06.2026', rows, strefyResult)
    expect(text).toContain('PLAN 17.06.2026')
    expect(text).toContain('ZMIANY')
    expect(text).toContain('Jas Las A19')
    expect(text).toContain('PRZYJAZDY')
    expect(text).toContain('Mech Anch A03')
    expect(text).toContain('Podział')
  })

  it('pomija sekcję jeśli brak rekordów danego priorytetu', () => {
    const rows = [row('jas', 2, 'Jas X')]
    const text = buildPlanText('17.06.2026', rows, planTeams(rows))
    expect(text).not.toContain('ZMIANY')
    expect(text).not.toContain('WYJAZDY')
  })
})
