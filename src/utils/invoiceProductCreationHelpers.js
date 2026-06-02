/**
 * Pure helpers for invoice → product creation flow.
 *
 * Extracted from Faktury.jsx so the logic can be unit-tested without
 * mounting the full React tree or needing a real Supabase connection.
 */

/**
 * Resolve the workspace id from context.
 * Returns the workspaceId string if available, null otherwise.
 * This is the single source-of-truth for workspace resolution in the
 * invoice product-creation flow.
 */
export function resolveActiveWorkspaceId({ workspaceId } = {}) {
  return (workspaceId && typeof workspaceId === 'string') ? workspaceId : null
}

/**
 * Build the insert payload for towary from a product creation form
 * and a workspace id.
 *
 * Throws if workspaceId is missing so callers are forced to guard.
 */
export function buildTowarInsertPayload({ form, workspaceId }) {
  if (!workspaceId) {
    throw new Error('buildTowarInsertPayload: workspaceId is required')
  }
  const nazwa = (form?.nazwa || '').trim()
  if (!nazwa) {
    throw new Error('buildTowarInsertPayload: nazwa is required')
  }
  return {
    nazwa,
    jednostka: form?.jednostka || 'szt',
    typ:       form?.typ       || 'towar',
    kategoria_id: form?.kategoria_id || null,
    aktywny:   true,
    workspace_id: workspaceId,
  }
}

/**
 * Merge a newly-created towary record onto an extracted invoice item.
 * This sets all product-related fields so the invoice save flow treats
 * the position as having a confirmed manual product match.
 */
export function applyCreatedProductToExtractedItem(item, created) {
  return {
    ...item,
    matchedProductId:        created.id,
    matchedProductNazwa:     created.nazwa,
    matchedProductJednostka: created.jednostka,
    matchScore:              1.0,
    matchingSource:          'manual_created_from_invoice',
  }
}
