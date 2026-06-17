import { describe, it, expect } from 'vitest'
import { sortWorkerTasks, suggestPhotoLabel } from './workerTasks'

describe('sortWorkerTasks', () => {
  it('puts pilny priority first regardless of status', () => {
    const items = [
      { id: 'a', priorytet: 'normalny', status: 'w_realizacji', created_at: '2026-06-17T08:00:00Z' },
      { id: 'b', priorytet: 'pilny', status: 'nowe', created_at: '2026-06-17T09:00:00Z' },
    ]
    const sorted = sortWorkerTasks(items)
    expect(sorted[0].id).toBe('b')
  })

  it('orders w_realizacji before nowe within the same priority', () => {
    const items = [
      { id: 'a', priorytet: 'normalny', status: 'nowe', created_at: '2026-06-17T08:00:00Z' },
      { id: 'b', priorytet: 'normalny', status: 'w_realizacji', created_at: '2026-06-17T09:00:00Z' },
    ]
    const sorted = sortWorkerTasks(items)
    expect(sorted[0].id).toBe('b')
    expect(sorted[1].id).toBe('a')
  })

  it('falls back to created_at order within same priority and status', () => {
    const items = [
      { id: 'a', priorytet: 'normalny', status: 'nowe', created_at: '2026-06-17T09:00:00Z' },
      { id: 'b', priorytet: 'normalny', status: 'nowe', created_at: '2026-06-17T08:00:00Z' },
    ]
    const sorted = sortWorkerTasks(items)
    expect(sorted[0].id).toBe('b')
  })

  it('does not mutate the input array', () => {
    const items = [
      { id: 'a', priorytet: 'niski', status: 'nowe' },
      { id: 'b', priorytet: 'pilny', status: 'nowe' },
    ]
    const original = [...items]
    sortWorkerTasks(items)
    expect(items).toEqual(original)
  })

  it('treats missing priorytet/status as normalny/nowe defaults', () => {
    const items = [
      { id: 'a' },
      { id: 'b', priorytet: 'pilny', status: 'nowe' },
    ]
    const sorted = sortWorkerTasks(items)
    expect(sorted[0].id).toBe('b')
  })
})

describe('suggestPhotoLabel', () => {
  it('suggests "przed" when checklist is under 50% complete', () => {
    expect(suggestPhotoLabel(0)).toBe('przed')
    expect(suggestPhotoLabel(49)).toBe('przed')
  })

  it('suggests "po" when checklist is 50% or more complete', () => {
    expect(suggestPhotoLabel(50)).toBe('po')
    expect(suggestPhotoLabel(100)).toBe('po')
  })
})
