import { describe, it, expect } from 'vitest'
import { buildPreparationFromReservation, recalculateDemand, diffReservationUpdate } from './commands.js'

const SAMPLE_RESERVATION = {
  external_reservation_id: 'RES-001',
  external_apartment_id: 'APT-3B',
  apartment_label: 'Apartament 3B',
  checkout_at: '2026-06-15T10:00:00Z',
  next_checkin_at: '2026-06-15T15:00:00Z',
  guests_count: 3,
  flags: { pet: false, child: true, extra_bed: false },
  notes: 'Prosi o dodatkowe ręczniki.',
  occurred_at: '2026-06-15T10:05:00Z',
  source: 'pms_test',
}

describe('buildPreparationFromReservation', () => {
  it('sets deadline from next_checkin_at', () => {
    const draft = buildPreparationFromReservation(SAMPLE_RESERVATION)
    expect(draft.deadline).toBe('2026-06-15T15:00:00Z')
  })

  it('sets status to nowe', () => {
    const draft = buildPreparationFromReservation(SAMPLE_RESERVATION)
    expect(draft.status).toBe('nowe')
  })

  it('copies guests_count and flags', () => {
    const draft = buildPreparationFromReservation(SAMPLE_RESERVATION)
    expect(draft.guests_count).toBe(3)
    expect(draft.flags.child).toBe(true)
  })

  it('preserves notes', () => {
    const draft = buildPreparationFromReservation(SAMPLE_RESERVATION)
    expect(draft.notes).toBe('Prosi o dodatkowe ręczniki.')
  })

  it('starts with empty demand array (populated later by recalculateDemand)', () => {
    const draft = buildPreparationFromReservation(SAMPLE_RESERVATION)
    expect(draft.demand).toEqual([])
  })

  it('handles missing flags gracefully', () => {
    const draft = buildPreparationFromReservation({ ...SAMPLE_RESERVATION, flags: undefined })
    expect(draft.flags).toEqual({})
  })
})

describe('recalculateDemand', () => {
  const draft = buildPreparationFromReservation(SAMPLE_RESERVATION) // 3 guests

  const packageVersion = [
    { product_id: 'p1', product_name: 'Ręcznik', base_qty: 2, per_guest_qty: 1 },
    { product_id: 'p2', product_name: 'Szampon', base_qty: 0, per_guest_qty: 1 },
    { product_id: 'p3', product_name: 'Worek', base_qty: 3, per_night_qty: 1 },
  ]

  it('computes base + per_guest correctly (ręcznik: 2 + 3×1 = 5)', () => {
    const lines = recalculateDemand(draft, packageVersion, { nights: 1 })
    const recznik = lines.find(l => l.product_id === 'p1')
    expect(recznik.quantity).toBe(5)
  })

  it('includes reason string with explainable components', () => {
    const lines = recalculateDemand(draft, packageVersion, { nights: 1 })
    const recznik = lines.find(l => l.product_id === 'p1')
    expect(recznik.reason).toContain('2 bazowe')
    expect(recznik.reason).toContain('3 (3 gości')
  })

  it('computes per_guest only (szampon: 0 + 3×1 = 3)', () => {
    const lines = recalculateDemand(draft, packageVersion, { nights: 1 })
    const szampon = lines.find(l => l.product_id === 'p2')
    expect(szampon.quantity).toBe(3)
  })

  it('computes base + per_night (worek: 3 + 2 nights = 5)', () => {
    const lines = recalculateDemand(draft, packageVersion, { nights: 2 })
    const worek = lines.find(l => l.product_id === 'p3')
    expect(worek.quantity).toBe(5)
  })

  it('returns empty array for empty package', () => {
    const lines = recalculateDemand(draft, [])
    expect(lines).toEqual([])
  })

  it('defaults nights to 1 when rules not provided', () => {
    const lines = recalculateDemand(draft, packageVersion)
    const worek = lines.find(l => l.product_id === 'p3')
    expect(worek.quantity).toBe(4) // 3 base + 1 night × 1
  })
})

describe('diffReservationUpdate', () => {
  const prev = { ...SAMPLE_RESERVATION }

  it('detects deadline change', () => {
    const next = { ...prev, next_checkin_at: '2026-06-16T12:00:00Z' }
    const diff = diffReservationUpdate(prev, next)
    expect(diff.deadlineChanged).toBe(true)
    expect(diff.newDeadline).toBe('2026-06-16T12:00:00Z')
  })

  it('detects guest count change', () => {
    const next = { ...prev, guests_count: 5 }
    const diff = diffReservationUpdate(prev, next)
    expect(diff.guestsChanged).toBe(true)
    expect(diff.newGuests).toBe(5)
  })

  it('detects flag change', () => {
    const next = { ...prev, flags: { ...prev.flags, pet: true } }
    const diff = diffReservationUpdate(prev, next)
    expect(diff.flagsChanged).toBe(true)
    expect(diff.newFlags?.pet).toBe(true)
  })

  it('returns no changes when reservations are identical', () => {
    const diff = diffReservationUpdate(prev, prev)
    expect(diff.deadlineChanged).toBe(false)
    expect(diff.guestsChanged).toBe(false)
    expect(diff.flagsChanged).toBe(false)
    expect(diff.newDeadline).toBeNull()
    expect(diff.newGuests).toBeNull()
    expect(diff.newFlags).toBeNull()
  })
})
