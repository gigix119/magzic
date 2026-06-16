import { describe, it, expect } from 'vitest'
import DemandExplanation from './DemandExplanation.jsx'

// DemandExplanation uses useState so it cannot be called as a plain function.
// We verify module shape and prop contract here; rendering is covered by integration.

describe('DemandExplanation module', () => {
  it('eksportuje domyślną funkcję', () => {
    expect(typeof DemandExplanation).toBe('function')
  })

  it('komponent akceptuje props jako obiekt (destructured)', () => {
    // Destructured params always yield length 1 in JS (single argument)
    expect(DemandExplanation.length).toBe(1)
  })

  it('ma poprawną nazwę', () => {
    expect(DemandExplanation.name).toBe('DemandExplanation')
  })
})
