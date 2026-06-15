/**
 * Event router — maps inbound sync event type to a command name + normalized payload.
 * Pure function, no side effects.
 *
 * @module domain/eventRouter
 */

const ALLOWED_EVENT_TYPES = new Set([
  'reservation.created',
  'reservation.updated',
  'reservation.cancelled',
  'stay.checkout',
  'stay.checkin',
])

/**
 * Routes a SyncEvent to the appropriate command descriptor.
 *
 * @param {import('./types').SyncEvent} event
 * @returns {{ command: string, normalizedPayload: import('./types').ReservationSyncInput }}
 * @throws {Error} if event_type is unknown
 */
export function routeSyncEvent(event) {
  if (!event?.event_type) throw new Error('Missing event_type')
  if (!ALLOWED_EVENT_TYPES.has(event.event_type)) {
    throw new Error(`Unknown event_type: ${event.event_type}`)
  }

  const reservation = event.payload?.reservation
  if (!reservation) throw new Error('Missing payload.reservation')

  const normalized = {
    external_reservation_id: String(reservation.external_reservation_id ?? ''),
    external_apartment_id: String(reservation.external_apartment_id ?? ''),
    apartment_label: String(reservation.apartment_label ?? reservation.external_apartment_id ?? ''),
    checkout_at: String(reservation.checkout_at ?? ''),
    next_checkin_at: String(reservation.next_checkin_at ?? ''),
    guests_count: Number(reservation.guests_count ?? 1),
    flags: reservation.flags ?? {},
    notes: reservation.notes ?? null,
    occurred_at: String(event.occurred_at ?? ''),
    source: String(event.source ?? ''),
  }

  switch (event.event_type) {
    case 'stay.checkout':
      return { command: 'createPreparation', normalizedPayload: normalized }
    case 'stay.checkin':
      return { command: 'alertIfNotReady', normalizedPayload: normalized }
    case 'reservation.created':
      return { command: 'upsertReservation', normalizedPayload: normalized }
    case 'reservation.updated':
      return { command: 'updateReservation', normalizedPayload: normalized }
    case 'reservation.cancelled':
      return { command: 'cancelPreparation', normalizedPayload: normalized }
    default:
      throw new Error(`Unhandled event_type: ${event.event_type}`)
  }
}
