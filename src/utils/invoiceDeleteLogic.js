/**
 * Safe invoice deletion logic.
 *
 * Business rules:
 *  - robocza/anulowana WITHOUT ruchy_magazynowe  → can delete (positions first, then invoice)
 *  - ANY invoice WITH ruchy_magazynowe            → must rollback inventory first, then delete
 *    (cofnijDoRoboczej deletes movements and reverts stock before setting status=robocza)
 *
 * Deliberately NOT adding ON DELETE CASCADE on ruchy_magazynowe.faktura_id — that would
 * silently destroy warehouse history. We guard at the application layer instead.
 */

/**
 * Count ruchy_magazynowe for a given faktura.
 * Returns { count: number, error: string|null }
 */
export async function countInvoiceMovements(fakturaId, supabaseClient) {
  const { count, error } = await supabaseClient
    .from('ruchy_magazynowe')
    .select('id', { count: 'exact', head: true })
    .eq('faktura_id', fakturaId)

  if (error) return { count: 0, error: error.message }
  return { count: count ?? 0, error: null }
}

/**
 * Checks whether a faktura can be safely deleted (no warehouse movements linked to it).
 * Returns { canDelete: true } or { canDelete: false, reason: string }
 */
export async function checkInvoiceDeletable(fakturaId, supabaseClient) {
  const { count, error } = await countInvoiceMovements(fakturaId, supabaseClient)

  if (error) {
    return { canDelete: false, reason: 'Błąd sprawdzania ruchów magazynowych. Spróbuj ponownie.' }
  }

  if (count > 0) {
    return {
      canDelete: false,
      reason:
        'Nie można usunąć tej faktury, ponieważ wygenerowała ruchy magazynowe. ' +
        'Najpierw cofnij fakturę, aby odwrócić stany magazynowe, a dopiero potem usuń.',
    }
  }

  return { canDelete: true }
}

/**
 * Deletes an invoice and its positions in the correct order:
 *  1. Verify no warehouse movements exist (FK guard).
 *  2. Delete pozycje_faktury (child rows first, avoids FK violation on faktury delete).
 *  3. Delete faktura.
 *
 * Returns { success: true } or { success: false, error: string }
 */
export async function safeDeleteInvoice(fakturaId, supabaseClient) {
  // Guard: block delete when warehouse movements exist
  const check = await checkInvoiceDeletable(fakturaId, supabaseClient)
  if (!check.canDelete) {
    return { success: false, error: check.reason }
  }

  // Delete child rows first to avoid FK errors on the faktury row
  const { error: pozError } = await supabaseClient
    .from('pozycje_faktury')
    .delete()
    .eq('faktura_id', fakturaId)

  if (pozError) {
    return { success: false, error: `Błąd usuwania pozycji faktury: ${pozError.message}` }
  }

  // Delete the invoice itself
  const { error } = await supabaseClient
    .from('faktury')
    .delete()
    .eq('id', fakturaId)

  if (error) {
    // FK violation = movements appeared between our check and the delete (race condition)
    if (error.code === '23503') {
      return {
        success: false,
        error:
          'Nie można usunąć faktury — ma powiązane ruchy magazynowe. ' +
          'Cofnij fakturę przed usunięciem.',
      }
    }
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Rolls back an invoice's inventory impact and then deletes it in one atomic flow.
 *
 * Steps:
 *  1. Call cofnijFn (cofnijDoRoboczej) → reverts stock quantities and deletes ruchy_magazynowe.
 *  2. Verify no movements remain (double-check before delete).
 *  3. Call safeDeleteInvoice → deletes pozycje_faktury then faktury.
 *
 * @param {string} fakturaId
 * @param {object} supabaseClient
 * @param {Function} cofnijFn  - async (fakturaId) => { success, error? }
 *                               Inject cofnijDoRoboczej from magazyn.js here.
 * @returns {{ success: boolean, rolledBack: boolean, error?: string }}
 *   rolledBack=false → cofnij failed, nothing changed
 *   rolledBack=true  → cofnij succeeded; if success=false, invoice is now 'robocza' without movements
 */
export async function deleteInvoiceWithInventoryRollback(fakturaId, supabaseClient, cofnijFn) {
  // Step 1: Roll back inventory (reverts quantities and deletes ruchy_magazynowe)
  const cofnijResult = await cofnijFn(fakturaId)
  if (!cofnijResult.success) {
    return {
      success: false,
      rolledBack: false,
      error:
        'Nie udało się cofnąć ruchów magazynowych. Faktura nie została usunięta.' +
        (cofnijResult.error ? ` (${cofnijResult.error})` : ''),
    }
  }

  // Step 2: Verify movements are gone (safeguard against partial rollback)
  const { count } = await countInvoiceMovements(fakturaId, supabaseClient)
  if (count > 0) {
    return {
      success: false,
      rolledBack: true,
      error:
        'Faktura została cofnięta, ale nadal ma powiązane ruchy magazynowe. ' +
        'Odśwież stronę i spróbuj usunąć ręcznie.',
    }
  }

  // Step 3: Safe delete — no movements remain, positions then invoice
  const deleteResult = await safeDeleteInvoice(fakturaId, supabaseClient)
  if (!deleteResult.success) {
    return {
      success: false,
      rolledBack: true,
      error:
        'Faktura została cofnięta do roboczej, ale nie udało się jej usunąć. ' +
        'Spróbuj usunąć ponownie.' +
        (deleteResult.error ? ` (${deleteResult.error})` : ''),
    }
  }

  return { success: true, rolledBack: true }
}
