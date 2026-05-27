/**
 * Pure helpers for contractor delete/deactivate logic.
 * No Supabase calls — fully testable.
 */

/**
 * Returns true when a Supabase error is a PostgreSQL foreign key violation (23503).
 * Used to distinguish "has linked invoices" from generic DB errors.
 */
export function isFkViolation(error) {
  if (!error) return false
  return (
    error.code === '23503' ||
    (typeof error.message === 'string' && error.message.includes('foreign key constraint'))
  )
}

/**
 * Determines the safe action for deleting a contractor.
 * Returns 'delete' when no invoices are linked, 'deactivate_only' otherwise.
 */
export function getContractorDeleteAction(invoiceCount) {
  return Number(invoiceCount) > 0 ? 'deactivate_only' : 'delete'
}

/**
 * Builds a { [contractorId]: count } map from an array of faktura records.
 * Only counts records that have a non-null kontrahent_id.
 */
export function buildFakturyCount(faktury) {
  const cnt = {}
  for (const fak of faktury || []) {
    if (fak.kontrahent_id) {
      cnt[fak.kontrahent_id] = (cnt[fak.kontrahent_id] || 0) + 1
    }
  }
  return cnt
}
