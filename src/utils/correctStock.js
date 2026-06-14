import { supabase } from '../supabase'
import { refreshInventory } from './events'

/**
 * Atomic, idempotent stock correction via the correct_stock Postgres RPC (P10).
 *
 * The RPC owns atomicity (FOR UPDATE lock → append movement → recompute).
 * Non-negative rejection for correction_minus is enforced at the DB layer
 * unless the workspace has settings->>'allow_negative_stock' = 'true'.
 *
 * @param {object} params
 * @param {string}  params.towarId
 * @param {string}  params.magazynId
 * @param {number}  params.ilosc           — must be > 0
 * @param {string}  params.typ             — 'correction_plus' or 'correction_minus'
 * @param {string}  params.powod           — mandatory reason for the correction
 * @param {string}  [params.workspaceId]
 * @param {string}  [params.idempotencyKey]
 * @returns {{ success: boolean, idempotent?: boolean, newBalance?: number,
 *             error?: string, available?: number }}
 */
export async function correctStock({
  towarId,
  magazynId,
  ilosc,
  typ,
  powod,
  workspaceId = null,
  idempotencyKey = null,
}) {
  if (!powod || !powod.trim()) {
    return { success: false, error: 'reason is required' }
  }

  const { data, error } = await supabase.rpc('correct_stock', {
    p_towar_id:        towarId,
    p_magazyn_id:      magazynId,
    p_ilosc:           ilosc,
    p_typ:             typ,
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
