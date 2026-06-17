import { describe, it, expect } from 'vitest'
import { DEFAULT_CHECKLIST, buildChecklistRows } from './defaultChecklist'

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

describe('buildChecklistRows', () => {
  it('zwraca 12 wierszy z poprawnym zlecenie_id, workspace_id i sort_order', () => {
    const rows = buildChecklistRows('zl-1', 'ws-1')
    expect(rows).toHaveLength(12)
    expect(rows[0]).toMatchObject({ zlecenie_id: 'zl-1', workspace_id: 'ws-1', label: DEFAULT_CHECKLIST[0], sort_order: 0 })
    expect(rows[11]).toMatchObject({ sort_order: 11, label: DEFAULT_CHECKLIST[11] })
  })
})
