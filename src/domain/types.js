/**
 * @typedef {Object} ReservationSyncInput
 * Raw, normalized reservation payload from any external source.
 * @property {string} external_reservation_id
 * @property {string} external_apartment_id
 * @property {string} apartment_label - Human-readable apartment name from external source
 * @property {string} checkout_at - ISO 8601 UTC
 * @property {string} next_checkin_at - ISO 8601 UTC; becomes preparation deadline
 * @property {number} guests_count
 * @property {ReservationFlags} flags
 * @property {string|null} notes
 * @property {string} occurred_at - ISO 8601 UTC; event timestamp for ordering
 * @property {string} source - Source system identifier (e.g. "pms_x")
 */

/**
 * @typedef {Object} ReservationFlags
 * @property {boolean} [pet]
 * @property {boolean} [child]
 * @property {boolean} [extra_bed]
 * @property {boolean} [late_checkout]
 */

/**
 * @typedef {Object} PreparationDraft
 * Describes a preparation to be created, without writing it.
 * @property {string} external_reservation_id
 * @property {string} external_apartment_id
 * @property {string} apartment_label
 * @property {string} deadline - ISO 8601; derived from next_checkin_at
 * @property {number} guests_count
 * @property {ReservationFlags} flags
 * @property {string|null} notes
 * @property {'nowe'} status - Always 'nowe' on draft
 * @property {DemandLine[]} demand - Pre-computed demand lines (may be empty if no package)
 */

/**
 * @typedef {Object} DemandLine
 * A single product demand line with explainable quantity.
 * @property {string} product_id - Internal towar ID
 * @property {string} product_name
 * @property {number} quantity - Computed quantity
 * @property {string} reason - Human-readable explanation, e.g. "2 bazowe + 2 (gości)"
 */

/**
 * @typedef {Object} SyncEvent
 * Validated, parsed inbound webhook event.
 * @property {string} event_id
 * @property {string} event_type
 * @property {string} occurred_at
 * @property {string} source
 * @property {object} payload
 */

/**
 * @typedef {Object} ReservationDiff
 * Result of diffReservationUpdate.
 * @property {boolean} deadlineChanged
 * @property {boolean} guestsChanged
 * @property {boolean} flagsChanged
 * @property {string|null} newDeadline
 * @property {number|null} newGuests
 * @property {ReservationFlags|null} newFlags
 */
