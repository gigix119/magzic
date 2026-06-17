import { describe, it, expect } from 'vitest'
import { DEFAULT_CHECKLIST } from './defaultChecklist'

describe('DEFAULT_CHECKLIST', () => {
  it('ma dokładnie 12 elementów', () => {
    expect(DEFAULT_CHECKLIST).toHaveLength(12)
  })

  it('każdy element to niepusty string', () => {
    for (const item of DEFAULT_CHECKLIST) {
      expect(typeof item).toBe('string')
      expect(item.trim().length).toBeGreaterThan(0)
    }
  })

  it('brak duplikatów', () => {
    const set = new Set(DEFAULT_CHECKLIST)
    expect(set.size).toBe(DEFAULT_CHECKLIST.length)
  })
})
