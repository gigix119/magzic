import { describe, it, expect } from 'vitest'
import { canTransitionRepair, buildRepairFromInput } from './commands'
import { routeSyncEvent } from './eventRouter'

// ── canTransitionRepair ────────────────────────────────────────────────────────

describe('canTransitionRepair', () => {
  it('allows zgloszone → w_realizacji', () => {
    expect(canTransitionRepair('zgloszone', 'w_realizacji')).toBe(true)
  })

  it('allows w_realizacji → zakonczone', () => {
    expect(canTransitionRepair('w_realizacji', 'zakonczone')).toBe(true)
  })

  it('allows w_realizacji → zgloszone (reopen)', () => {
    expect(canTransitionRepair('w_realizacji', 'zgloszone')).toBe(true)
  })

  it('allows zakonczone → zweryfikowane', () => {
    expect(canTransitionRepair('zakonczone', 'zweryfikowane')).toBe(true)
  })

  it('allows zakonczone → w_realizacji (reopen)', () => {
    expect(canTransitionRepair('zakonczone', 'w_realizacji')).toBe(true)
  })

  it('blocks zgloszone → zakonczone (skipping step)', () => {
    expect(canTransitionRepair('zgloszone', 'zakonczone')).toBe(false)
  })

  it('blocks zgloszone → zweryfikowane (skipping multiple steps)', () => {
    expect(canTransitionRepair('zgloszone', 'zweryfikowane')).toBe(false)
  })

  it('blocks zweryfikowane → anything (terminal state)', () => {
    expect(canTransitionRepair('zweryfikowane', 'w_realizacji')).toBe(false)
    expect(canTransitionRepair('zweryfikowane', 'zgloszone')).toBe(false)
  })

  it('returns false for unknown from-status', () => {
    expect(canTransitionRepair('unknown', 'w_realizacji')).toBe(false)
  })

  it('returns false for unknown to-status', () => {
    expect(canTransitionRepair('zgloszone', 'unknown')).toBe(false)
  })
})

// ── buildRepairFromInput ───────────────────────────────────────────────────────

describe('buildRepairFromInput', () => {
  it('returns a valid RepairDraft with all fields', () => {
    const draft = buildRepairFromInput({
      tytul: 'Cieknący kran',
      lokal: 'Apt 3B',
      priorytet: 'pilne',
      opis: 'Kran w łazience',
      notatka_technika: 'Uszczelka do wymiany',
      data_zgloszenia: '2026-06-16',
    })
    expect(draft.tytul).toBe('Cieknący kran')
    expect(draft.lokal).toBe('Apt 3B')
    expect(draft.priorytet).toBe('pilne')
    expect(draft.status).toBe('zgloszone')
    expect(draft.opis).toBe('Kran w łazience')
    expect(draft.notatka_technika).toBe('Uszczelka do wymiany')
    expect(draft.data_zgloszenia).toBe('2026-06-16')
  })

  it('sets status always to zgloszone', () => {
    const draft = buildRepairFromInput({ tytul: 'Test' })
    expect(draft.status).toBe('zgloszone')
  })

  it('defaults priorytet to normalny for invalid value', () => {
    const draft = buildRepairFromInput({ tytul: 'Test', priorytet: 'critical' })
    expect(draft.priorytet).toBe('normalny')
  })

  it('sets lokal to null for empty string', () => {
    const draft = buildRepairFromInput({ tytul: 'Test', lokal: '  ' })
    expect(draft.lokal).toBe(null)
  })

  it('sets opis to null for empty string', () => {
    const draft = buildRepairFromInput({ tytul: 'Test', opis: '' })
    expect(draft.opis).toBe(null)
  })

  it('throws when tytul is missing', () => {
    expect(() => buildRepairFromInput({})).toThrow('tytul is required')
  })

  it('throws when tytul is only whitespace', () => {
    expect(() => buildRepairFromInput({ tytul: '   ' })).toThrow('tytul is required')
  })

  it('provides a default data_zgloszenia when not supplied', () => {
    const draft = buildRepairFromInput({ tytul: 'Test' })
    expect(draft.data_zgloszenia).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ── routeSyncEvent — repair events ────────────────────────────────────────────

describe('routeSyncEvent — repair.created', () => {
  const baseEvent = {
    event_id: 'evt-1',
    event_type: 'repair.created',
    occurred_at: '2026-06-16T10:00:00Z',
    source: 'app',
    payload: {
      repair: {
        tytul: 'Pęknięta szyba',
        lokal: 'Apt 7',
        priorytet: 'pilne',
        opis: 'Okno w salonie',
      },
    },
  }

  it('routes repair.created to createRepair command', () => {
    const { command } = routeSyncEvent(baseEvent)
    expect(command).toBe('createRepair')
  })

  it('normalizes payload fields', () => {
    const { normalizedPayload } = routeSyncEvent(baseEvent)
    expect(normalizedPayload.tytul).toBe('Pęknięta szyba')
    expect(normalizedPayload.lokal).toBe('Apt 7')
    expect(normalizedPayload.priorytet).toBe('pilne')
    expect(normalizedPayload.source).toBe('app')
  })

  it('throws when payload.repair is missing', () => {
    expect(() => routeSyncEvent({ ...baseEvent, payload: {} })).toThrow('Missing payload.repair')
  })
})

describe('routeSyncEvent — repair.status_changed', () => {
  const event = {
    event_id: 'evt-2',
    event_type: 'repair.status_changed',
    occurred_at: '2026-06-16T11:00:00Z',
    source: 'app',
    payload: {
      repair: {
        repair_id: 'rep-42',
        from_status: 'zgloszone',
        to_status: 'w_realizacji',
        notatka_technika: 'Rozpoczynam prace',
      },
    },
  }

  it('routes repair.status_changed to updateRepairStatus command', () => {
    const { command } = routeSyncEvent(event)
    expect(command).toBe('updateRepairStatus')
  })

  it('normalizes status transition fields', () => {
    const { normalizedPayload } = routeSyncEvent(event)
    expect(normalizedPayload.repair_id).toBe('rep-42')
    expect(normalizedPayload.from_status).toBe('zgloszone')
    expect(normalizedPayload.to_status).toBe('w_realizacji')
    expect(normalizedPayload.notatka_technika).toBe('Rozpoczynam prace')
  })

  it('throws when payload.repair is missing', () => {
    expect(() => routeSyncEvent({ ...event, payload: {} })).toThrow('Missing payload.repair')
  })
})
