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
  'repair.created',
  'repair.status_changed',
])

/**
 * Routes a SyncEvent to the appropriate command descriptor.
 *
 * @param {import('./types').SyncEvent} event
 * @returns {{ command: string, normalizedPayload: object }}
 * @throws {Error} if event_type is unknown
 */
export function routeSyncEvent(event) {
  if (!event?.event_type) throw new Error('Missing event_type')
  if (!ALLOWED_EVENT_TYPES.has(event.event_type)) {
    throw new Error(`Unknown event_type: ${event.event_type}`)
  }

  switch (event.event_type) {
    case 'stay.checkout':
    case 'stay.checkin':
    case 'reservation.created':
    case 'reservation.updated':
    case 'reservation.cancelled': {
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
        case 'stay.checkout':      return { command: 'createPreparation',  normalizedPayload: normalized }
        case 'stay.checkin':       return { command: 'alertIfNotReady',    normalizedPayload: normalized }
        case 'reservation.created':return { command: 'upsertReservation',  normalizedPayload: normalized }
        case 'reservation.updated':return { command: 'updateReservation',  normalizedPayload: normalized }
        case 'reservation.cancelled': return { command: 'cancelPreparation', normalizedPayload: normalized }
      }
      break
    }
    case 'repair.created': {
      const repair = event.payload?.repair
      if (!repair) throw new Error('Missing payload.repair')
      return {
        command: 'createRepair',
        normalizedPayload: {
          tytul: String(repair.tytul ?? ''),
          lokal: repair.lokal ?? null,
          priorytet: repair.priorytet ?? 'normalny',
          opis: repair.opis ?? null,
          occurred_at: String(event.occurred_at ?? ''),
          source: String(event.source ?? ''),
        },
      }
    }
    case 'repair.status_changed': {
      const repair = event.payload?.repair
      if (!repair) throw new Error('Missing payload.repair')
      return {
        command: 'updateRepairStatus',
        normalizedPayload: {
          repair_id: String(repair.repair_id ?? ''),
          from_status: String(repair.from_status ?? ''),
          to_status: String(repair.to_status ?? ''),
          notatka_technika: repair.notatka_technika ?? null,
          occurred_at: String(event.occurred_at ?? ''),
          source: String(event.source ?? ''),
        },
      }
    }
    default:
      throw new Error(`Unhandled event_type: ${event.event_type}`)
  }
}
