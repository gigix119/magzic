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

/**
 * @typedef {Object} RepairDraft
 * Describes a repair to be created or updated, without writing it.
 * @property {string} tytul - Short title of the repair
 * @property {string|null} lokal - Apartment / room identifier
 * @property {'niski'|'normalny'|'pilne'} priorytet
 * @property {'zgloszone'|'w_realizacji'|'zakonczone'|'zweryfikowane'} status
 * @property {string|null} opis - Optional detailed description
 * @property {string|null} notatka_technika - Optional technician note
 * @property {string|null} data_zgloszenia - ISO 8601 date of report
 */

/**
 * @typedef {Object} RepairStatusTransition
 * Describes a valid status change for a repair.
 * @property {'zgloszone'|'w_realizacji'|'zakonczone'|'zweryfikowane'} from
 * @property {'zgloszone'|'w_realizacji'|'zakonczone'|'zweryfikowane'} to
 * @property {boolean} allowed
 */

/**
 * @typedef {Object} Lokal
 * @property {string} id
 * @property {string} workspace_id
 * @property {string} nazwa
 * @property {string|null} adres
 * @property {string} typ - apartament | pokoj | studio | dom
 * @property {number} pojemnosc
 * @property {string|null} domyslny_pakiet_id
 * @property {string|null} notatki
 * @property {boolean} aktywny
 */

/**
 * @typedef {Object} Rezerwacja
 * @property {string} id
 * @property {string} workspace_id
 * @property {string|null} lokal_id
 * @property {string|null} external_reservation_id
 * @property {string|null} external_source
 * @property {string|null} gosc_nazwa
 * @property {string|null} gosc_email
 * @property {string|null} gosc_telefon
 * @property {number} liczba_gosci
 * @property {string} checkin_at - ISO date
 * @property {string} checkout_at - ISO date
 * @property {'wstepna'|'potwierdzona'|'zameldowana'|'wymeldowana'|'anulowana'} status
 * @property {string|null} notatki
 * @property {Object} flagi
 * @property {string|null} przygotowanie_id
 */

/**
 * @typedef {Object} ReservationToPreparationResult
 * @property {boolean} created
 * @property {string} [reason] - 'already_exists' | 'no_lokal' | 'no_default_package' | 'insert_error'
 * @property {string} [przygotowanie_id]
 * @property {string} [nazwa]
 * @property {unknown} [error]
 */
