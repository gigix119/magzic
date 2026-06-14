import { supabase } from '../supabase'
import { refreshInventory } from './events'

/**
 * Atomic, idempotent stock transfer via the transfer_stock Postgres RPC (P11).
 *
 * The RPC owns atomicity — both movements (out + in) are inserted in one
 * transaction: all-or-nothing.  Balance rows are locked in canonical UUID order
 * to prevent deadlocks between concurrent transfers on the same warehouse pair.
 * Non-negative rejection on the source is enforced at the DB layer unless the
 * workspace has settings->>'allow_negative_stock' = 'true'.
 *
 * @param {object} params
 * @param {string}  params.towarId
 * @param {string}  params.magazynZrodlowyId   — source warehouse
 * @param {string}  params.magazynDocelowyId   — destination warehouse (must differ from source)
 * @param {number}  params.ilosc               — must be > 0
 * @param {string}  [params.powod]
 * @param {string}  [params.workspaceId]
 * @param {string}  [params.idempotencyKey]
 * @returns {{ success: boolean, idempotent?: boolean,
 *             srcNewBalance?: number, dstNewBalance?: number,
 *             error?: string, available?: number }}
 */
export async function transferStock({
  towarId,
  magazynZrodlowyId,
  magazynDocelowyId,
  ilosc,
  powod = null,
  workspaceId = null,
  idempotencyKey = null,
}) {
  const { data, error } = await supabase.rpc('transfer_stock', {
    p_towar_id:            towarId,
    p_magazyn_zrodlowy_id: magazynZrodlowyId,
    p_magazyn_docelowy_id: magazynDocelowyId,
    p_ilosc:               ilosc,
    p_powod:               powod,
    p_workspace_id:        workspaceId,
    p_idempotency_key:     idempotencyKey,
  })

  if (error) return { success: false, error: error.message }

  if (!data?.success) {
    return {
      success:   false,
      error:     data?.error     ?? 'unknown error',
      available: data?.available ?? undefined,
    }
  }

  refreshInventory()
  return {
    success:       true,
    idempotent:    data.idempotent       ?? false,
    srcNewBalance: data.src_new_balance  ?? null,
    dstNewBalance: data.dst_new_balance  ?? null,
  }
}
