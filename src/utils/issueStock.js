import { supabase } from '../supabase'
import { refreshInventory } from './events'

/**
 * Atomic, idempotent stock issue via the issue_stock Postgres RPC (P9).
 *
 * The RPC owns atomicity (FOR UPDATE lock → append movement → recompute).
 * Negative-stock rejection is enforced at the DB layer unless the workspace
 * has settings->>'allow_negative_stock' = 'true'.
 *
 * @param {object} params
 * @param {string}  params.towarId
 * @param {string}  params.magazynId
 * @param {number}  params.ilosc         — must be > 0
 * @param {string}  [params.powod]
 * @param {string}  [params.workspaceId]
 * @param {string}  [params.idempotencyKey]
 * @returns {{ success: boolean, idempotent?: boolean, newBalance?: number,
 *             error?: string, available?: number }}
 */
export async function issueStock({
  towarId,
  magazynId,
  ilosc,
  powod = null,
  workspaceId = null,
  idempotencyKey = null,
}) {
  const { data, error } = await supabase.rpc('issue_stock', {
    p_towar_id:        towarId,
    p_magazyn_id:      magazynId,
    p_ilosc:           ilosc,
    p_powod:           powod,
    p_workspace_id:    workspaceId,
    p_idempotency_key: idempotencyKey,
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
    success:    true,
    idempotent: data.idempotent  ?? false,
    newBalance: data.new_balance ?? null,
  }
}
