import { describe, it, expect } from 'vitest'

// Inlined from WorkerZadanie.jsx — pure logic, tested in isolation (no React/DOM needed)
function checkGate(zlecenie, pozycje, checklistItems, photos, readinessChecked) {
  const issues = []
  if (pozycje.length > 0 && !pozycje.every(p => p.wydano)) {
    const n = pozycje.filter(p => !p.wydano).length
    issues.push(`${n} ${n === 1 ? 'pozycja nie wydana' : 'pozycji nie wydano'}`)
  }
  if (checklistItems.length > 0 && !checklistItems.every(c => c.checked)) {
    const n = checklistItems.filter(c => !c.checked).length
    issues.push(`${n} ${n === 1 ? 'punkt checklisty nieodhaczony' : 'punktów checklisty nieodhaczonych'}`)
  }
  const reqPhotos = zlecenie?.required_photos || 0
  if (reqPhotos > 0 && photos.length < reqPhotos) {
    issues.push(`Brak wymaganych zdjęć (${photos.length}/${reqPhotos})`)
  }
  if (!readinessChecked) issues.push('Potwierdź gotowość obiektu')
  return { ok: issues.length === 0, issues }
}

// Inlined toggle helpers — same shape as setPozycje/setChecklistItems updater functions
function togglePozycjaWydano(pozycje, id) {
  return pozycje.map(p => p.id === id ? { ...p, wydano: !p.wydano } : p)
}

function toggleChecklistChecked(items, id) {
  return items.map(c => c.id === id ? { ...c, checked: !c.checked } : c)
}

describe('WorkerZadanie — checkGate', () => {
  it('blocks when materials are not all wydano', () => {
    const gate = checkGate({}, [{ id: 1, wydano: false }], [], [], true)
    expect(gate.ok).toBe(false)
    expect(gate.issues[0]).toMatch(/wydan/)
  })

  it('blocks when checklist is incomplete', () => {
    const gate = checkGate({}, [], [{ id: 1, checked: false }], [], true)
    expect(gate.ok).toBe(false)
    expect(gate.issues[0]).toMatch(/checklisty/)
  })

  it('blocks when readiness not confirmed', () => {
    const gate = checkGate({}, [], [], [], false)
    expect(gate.ok).toBe(false)
    expect(gate.issues[0]).toMatch(/gotowość/)
  })

  it('blocks when required photos are missing', () => {
    const gate = checkGate({ required_photos: 2 }, [], [], [{ id: 1 }], true)
    expect(gate.ok).toBe(false)
    expect(gate.issues[0]).toMatch(/zdjęć/)
  })

  it('passes when all conditions are met', () => {
    const gate = checkGate(
      { required_photos: 1 },
      [{ id: 1, wydano: true }],
      [{ id: 1, checked: true }],
      [{ id: 1 }],
      true,
    )
    expect(gate.ok).toBe(true)
    expect(gate.issues).toHaveLength(0)
  })

  it('passes with no materials/checklist/photos required, once readiness confirmed', () => {
    const gate = checkGate({}, [], [], [], true)
    expect(gate.ok).toBe(true)
  })
})

describe('WorkerZadanie — toggle wydano', () => {
  it('flips wydano only for the matching position', () => {
    const pozycje = [{ id: 'a', wydano: false }, { id: 'b', wydano: false }]
    const result = togglePozycjaWydano(pozycje, 'a')
    expect(result[0].wydano).toBe(true)
    expect(result[1].wydano).toBe(false)
  })

  it('toggling twice returns to original state', () => {
    const pozycje = [{ id: 'a', wydano: false }]
    const once = togglePozycjaWydano(pozycje, 'a')
    const twice = togglePozycjaWydano(once, 'a')
    expect(twice[0].wydano).toBe(false)
  })
})

describe('WorkerZadanie — toggle checklist', () => {
  it('flips checked only for the matching item', () => {
    const items = [{ id: 'x', checked: false }, { id: 'y', checked: true }]
    const result = toggleChecklistChecked(items, 'x')
    expect(result[0].checked).toBe(true)
    expect(result[1].checked).toBe(true)
  })
})
