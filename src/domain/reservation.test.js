import { describe, it, expect } from 'vitest'
import { canTransitionReservation, shouldAutoCreatePreparation } from './commands'

describe('canTransitionReservation', () => {
  it('wstepna → potwierdzona', () => {
    expect(canTransitionReservation('wstepna', 'potwierdzona')).toBe(true)
  })

  it('wstepna → anulowana', () => {
    expect(canTransitionReservation('wstepna', 'anulowana')).toBe(true)
  })

  it('potwierdzona → zameldowana', () => {
    expect(canTransitionReservation('potwierdzona', 'zameldowana')).toBe(true)
  })

  it('potwierdzona → anulowana', () => {
    expect(canTransitionReservation('potwierdzona', 'anulowana')).toBe(true)
  })

  it('zameldowana → wymeldowana', () => {
    expect(canTransitionReservation('zameldowana', 'wymeldowana')).toBe(true)
  })

  it('anulowana → wstepna (reaktywacja)', () => {
    expect(canTransitionReservation('anulowana', 'wstepna')).toBe(true)
  })

  it('wymeldowana → cokolwiek (terminal)', () => {
    expect(canTransitionReservation('wymeldowana', 'potwierdzona')).toBe(false)
    expect(canTransitionReservation('wymeldowana', 'zameldowana')).toBe(false)
  })

  it('potwierdzona → wymeldowana (skipping step)', () => {
    expect(canTransitionReservation('potwierdzona', 'wymeldowana')).toBe(false)
  })

  it('unknown status → false', () => {
    expect(canTransitionReservation('unknown', 'potwierdzona')).toBe(false)
  })
})

describe('shouldAutoCreatePreparation', () => {
  it('true dla potwierdzonej z lokal_id i bez przygotowania', () => {
    expect(shouldAutoCreatePreparation({
      status: 'potwierdzona',
      lokal_id: 'uuid-123',
      przygotowanie_id: null,
    })).toBe(true)
  })

  it('false gdy przygotowanie już istnieje', () => {
    expect(shouldAutoCreatePreparation({
      status: 'potwierdzona',
      lokal_id: 'uuid-123',
      przygotowanie_id: 'prep-456',
    })).toBe(false)
  })

  it('false dla statusu anulowana', () => {
    expect(shouldAutoCreatePreparation({
      status: 'anulowana',
      lokal_id: 'uuid-123',
      przygotowanie_id: null,
    })).toBe(false)
  })

  it('false gdy brak lokal_id', () => {
    expect(shouldAutoCreatePreparation({
      status: 'potwierdzona',
      lokal_id: null,
      przygotowanie_id: null,
    })).toBe(false)
  })

  it('false dla statusu wstepna', () => {
    expect(shouldAutoCreatePreparation({
      status: 'wstepna',
      lokal_id: 'uuid-123',
      przygotowanie_id: null,
    })).toBe(false)
  })
})
