/**
 * Domain command layer — pure functions, no side effects, no React, no Supabase.
 * Each function returns a description of intent; the caller executes the write.
 *
 * @module domain/commands
 */

// ── Apartment resolution ──────────────────────────────────────────────────────

/**
 * Resolves an external apartment ID to an internal reference.
 *
 * @param {import('./types').ReservationSyncInput} input
 * @param {{ lookupApartment: (externalId: string) => Promise<{internal_ref: string|null}|null> }} ports
 * @returns {Promise<{external_apartment_id: string, internal_ref: string|null, apartment_label: string}>}
 */
export async function mapExternalApartment(input, { lookupApartment }) {
  const row = await lookupApartment(input.external_apartment_id)
  return {
    external_apartment_id: input.external_apartment_id,
    internal_ref: row?.internal_ref ?? null,
    apartment_label: input.apartment_label,
  }
}

// ── Preparation builder ────────────────────────────────────────────────────────

/**
 * Builds a PreparationDraft from a stay.checkout reservation payload.
 * Pure — does not write anything.
 *
 * @param {import('./types').ReservationSyncInput} reservation
 * @returns {import('./types').PreparationDraft}
 */
export function buildPreparationFromReservation(reservation) {
  return {
    external_reservation_id: reservation.external_reservation_id,
    external_apartment_id: reservation.external_apartment_id,
    apartment_label: reservation.apartment_label,
    deadline: reservation.next_checkin_at,
    guests_count: reservation.guests_count,
    flags: reservation.flags ?? {},
    notes: reservation.notes ?? null,
    status: 'nowe',
    demand: [], // populated by recalculateDemand once package rules exist
  }
}

// ── Demand calculation ────────────────────────────────────────────────────────

/**
 * Computes demand lines from a preparation draft and a package version.
 * Returns explainable quantities so the user can audit the calculation.
 *
 * TODO: integrate with real pakiety_sprzatania V2 rules once available.
 *
 * @param {import('./types').PreparationDraft} draft
 * @param {Array<{product_id: string, product_name: string, base_qty: number, per_guest_qty?: number, per_night_qty?: number}>} packageVersion
 * @param {{nights?: number}} rules - Extra context (number of nights, etc.)
 * @returns {import('./types').DemandLine[]}
 */
export function recalculateDemand(draft, packageVersion, rules = {}) {
  const nights = rules.nights ?? 1
  const guests = draft.guests_count ?? 1

  return packageVersion.map(item => {
    const base = item.base_qty ?? 0
    const perGuest = (item.per_guest_qty ?? 0) * guests
    const perNight = (item.per_night_qty ?? 0) * Math.ceil(nights)
    const quantity = base + perGuest + perNight

    const parts = []
    if (base > 0) parts.push(`${base} bazowe`)
    if (perGuest > 0) parts.push(`${perGuest} (${guests} gości × ${item.per_guest_qty})`)
    if (perNight > 0) parts.push(`${perNight} (${Math.ceil(nights)} nocy × ${item.per_night_qty})`)

    return {
      product_id: item.product_id,
      product_name: item.product_name,
      quantity,
      reason: parts.join(' + ') || '0',
    }
  })
}

// ── Reservation diff ──────────────────────────────────────────────────────────

/**
 * Computes what changed between two reservation versions.
 * Used for reservation.updated events.
 *
 * @param {import('./types').ReservationSyncInput} prev
 * @param {import('./types').ReservationSyncInput} next
 * @returns {import('./types').ReservationDiff}
 */
export function diffReservationUpdate(prev, next) {
  const deadlineChanged = prev.next_checkin_at !== next.next_checkin_at
  const guestsChanged = prev.guests_count !== next.guests_count
  const flagsChanged = JSON.stringify(prev.flags ?? {}) !== JSON.stringify(next.flags ?? {})

  return {
    deadlineChanged,
    guestsChanged,
    flagsChanged,
    newDeadline: deadlineChanged ? next.next_checkin_at : null,
    newGuests: guestsChanged ? next.guests_count : null,
    newFlags: flagsChanged ? (next.flags ?? {}) : null,
  }
}
