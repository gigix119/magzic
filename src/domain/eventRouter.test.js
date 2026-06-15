import { describe, it, expect } from 'vitest'
import { routeSyncEvent } from './eventRouter.js'

const BASE_RESERVATION = {
  external_reservation_id: 'RES-001',
  external_apartment_id: 'APT-3B',
  apartment_label: 'Apartament 3B',
  checkout_at: '2026-06-15T10:00:00Z',
  next_checkin_at: '2026-06-15T15:00:00Z',
  guests_count: 3,
  flags: { pet: false, child: true },
  notes: null,
}

function makeEvent(event_type, reservationOverrides = {}) {
  return {
    event_id: 'evt_test_001',
    event_type,
    occurred_at: '2026-06-15T10:05:00Z',
    source: 'pms_test',
    payload: { reservation: { ...BASE_RESERVATION, ...reservationOverrides } },
  }
}

describe('routeSyncEvent', () => {
  it('routes stay.checkout to createPreparation', () => {
    const result = routeSyncEvent(makeEvent('stay.checkout'))
    expect(result.command).toBe('createPreparation')
  })

  it('normalizes stay.checkout payload with correct deadline from next_checkin_at', () => {
    const result = routeSyncEvent(makeEvent('stay.checkout'))
    expect(result.normalizedPayload.next_checkin_at).toBe('2026-06-15T15:00:00Z')
    expect(result.normalizedPayload.guests_count).toBe(3)
    expect(result.normalizedPayload.flags).toEqual({ pet: false, child: true })
  })

  it('routes stay.checkin to alertIfNotReady', () => {
    const result = routeSyncEvent(makeEvent('stay.checkin'))
    expect(result.command).toBe('alertIfNotReady')
  })

  it('routes reservation.created to upsertReservation', () => {
    const result = routeSyncEvent(makeEvent('reservation.created'))
    expect(result.command).toBe('upsertReservation')
  })

  it('routes reservation.updated to updateReservation', () => {
    const result = routeSyncEvent(makeEvent('reservation.updated'))
    expect(result.command).toBe('updateReservation')
  })

  it('routes reservation.cancelled to cancelPreparation', () => {
    const result = routeSyncEvent(makeEvent('reservation.cancelled'))
    expect(result.command).toBe('cancelPreparation')
  })

  it('throws on unknown event_type', () => {
    expect(() => routeSyncEvent(makeEvent('booking.unknown'))).toThrow('Unknown event_type')
  })

  it('throws when payload.reservation is missing', () => {
    const event = { event_id: 'e', event_type: 'stay.checkout', occurred_at: '', source: '', payload: {} }
    expect(() => routeSyncEvent(event)).toThrow('Missing payload.reservation')
  })

  it('throws when event_type is missing', () => {
    expect(() => routeSyncEvent({})).toThrow('Missing event_type')
  })

  it('coerces guests_count to number', () => {
    const result = routeSyncEvent(makeEvent('stay.checkout', { guests_count: '4' }))
    expect(result.normalizedPayload.guests_count).toBe(4)
  })

  it('defaults guests_count to 1 when not provided', () => {
    const result = routeSyncEvent(makeEvent('stay.checkout', { guests_count: undefined }))
    expect(result.normalizedPayload.guests_count).toBe(1)
  })
})
