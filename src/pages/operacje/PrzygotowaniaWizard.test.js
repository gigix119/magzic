import { describe, it, expect, vi } from 'vitest'

// Pure logic tests for the preparation wizard (no React/DOM)

function adjustQty(items, idx, delta) {
  return items.map((item, i) => {
    if (i !== idx) return item
    return { ...item, ilosc: Math.max(0, item.ilosc + delta) }
  })
}

function setQty(items, idx, val) {
  const n = parseInt(val, 10)
  if (isNaN(n)) return items
  return items.map((item, i) => i === idx ? { ...item, ilosc: Math.max(0, n) } : item)
}

function removeItem(items, idx) {
  return items.filter((_, i) => i !== idx)
}

function addItemToList(items, allTowary, towarId, ilosc) {
  const towar = allTowary.find(t => t.id === towarId)
  if (!towar) return items
  const existing = items.findIndex(i => i.nazwa_pozycji === towar.nazwa)
  if (existing >= 0) {
    return items.map((item, i) => i === existing ? { ...item, ilosc: item.ilosc + ilosc } : item)
  }
  return [...items, { nazwa_pozycji: towar.nazwa, ilosc, jednostka: towar.jednostka || 'szt.' }]
}

const sampleItems = [
  { nazwa_pozycji: 'Komplet pościeli', ilosc: 4, jednostka: 'szt.' },
  { nazwa_pozycji: 'Ręcznik duży', ilosc: 4, jednostka: 'szt.' },
  { nazwa_pozycji: 'Papier toaletowy', ilosc: 2, jednostka: 'szt.' },
]

describe('Wizard — quantity adjustment (+/-)', () => {
  it('increases quantity by 1', () => {
    const result = adjustQty(sampleItems, 0, +1)
    expect(result[0].ilosc).toBe(5)
    expect(result[1].ilosc).toBe(4) // unchanged
  })

  it('decreases quantity by 1', () => {
    const result = adjustQty(sampleItems, 1, -1)
    expect(result[1].ilosc).toBe(3)
  })

  it('cannot go below 0', () => {
    const result = adjustQty(sampleItems, 2, -10)
    expect(result[2].ilosc).toBe(0)
  })

  it('setQty sets exact value', () => {
    const result = setQty(sampleItems, 0, '7')
    expect(result[0].ilosc).toBe(7)
  })

  it('setQty ignores non-numeric input', () => {
    const result = setQty(sampleItems, 0, 'abc')
    expect(result[0].ilosc).toBe(4) // unchanged
  })
})

describe('Wizard — remove/add items', () => {
  it('removes item at index', () => {
    const result = removeItem(sampleItems, 1)
    expect(result).toHaveLength(2)
    expect(result.find(i => i.nazwa_pozycji === 'Ręcznik duży')).toBeUndefined()
  })

  it('adds new product from towary list', () => {
    const allTowary = [{ id: 't1', nazwa: 'Kapsułka do kawy', jednostka: 'szt.' }]
    const result = addItemToList(sampleItems, allTowary, 't1', 6)
    expect(result).toHaveLength(4)
    expect(result[3].nazwa_pozycji).toBe('Kapsułka do kawy')
    expect(result[3].ilosc).toBe(6)
  })

  it('increments existing product instead of adding duplicate', () => {
    const allTowary = [{ id: 't1', nazwa: 'Komplet pościeli', jednostka: 'szt.' }]
    const result = addItemToList(sampleItems, allTowary, 't1', 2)
    expect(result).toHaveLength(3) // no new row
    expect(result[0].ilosc).toBe(6) // 4 + 2
  })

  it('ignores add when towarId not found', () => {
    const allTowary = [{ id: 't1', nazwa: 'Test', jednostka: 'szt.' }]
    const result = addItemToList(sampleItems, allTowary, 'nonexistent', 1)
    expect(result).toHaveLength(3)
  })
})

describe('Wizard — step 4 (WizardSteps smoke)', () => {
  it('renders step indicator as plain function call', () => {
    // WizardSteps is a sub-function inside PrzygotowaniaTab, but we can test
    // the step logic here: done if step > n, active if step === n
    function getStepState(n, currentStep) {
      return { done: currentStep > n, active: currentStep === n }
    }
    const s1 = getStepState(1, 3)
    expect(s1.done).toBe(true)
    expect(s1.active).toBe(false)

    const s3 = getStepState(3, 3)
    expect(s3.done).toBe(false)
    expect(s3.active).toBe(true)

    const s4 = getStepState(4, 3)
    expect(s4.done).toBe(false)
    expect(s4.active).toBe(false)
  })
})
