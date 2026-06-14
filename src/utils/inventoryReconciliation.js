// Inventory reconciliation: compare stored balances against sum of movements.
//
// Movement sign convention (mirrors magazyn.js insertRuch usage):
//   purchase, invoice_purchase, correction_plus → +ilosc on magazyn_docelowy_id
//   correction_minus                            → -ilosc on magazyn_docelowy_id (stored as abs value)
//   issue                                       → -ilosc on magazyn_zrodlowy_id
//   transfer                                    → -ilosc on zrodlowy, +ilosc on docelowy

const INBOUND_TYPES = new Set(['purchase', 'invoice_purchase', 'correction_plus'])

/**
 * Pure reconciliation computation — no I/O.
 *
 * @param {object[]} stany   - rows from stany_magazynowe
 * @param {object[]} ruchy   - rows from ruchy_magazynowe
 * @returns {object[]} one row per stany entry:
 *   { towar_id, magazyn_id, workspace_id, stored, expected, drift }
 *   drift = expected - stored (positive → movements say more than stored)
 */
export function computeReconciliation(stany, ruchy) {
  // Accumulate expected balance per (towar, magazyn, workspace) key
  const expectedMap = {}

  function bump(towarId, magazynId, wsId, delta) {
    const k = `${towarId}:${magazynId}:${wsId ?? ''}`
    expectedMap[k] = (expectedMap[k] ?? 0) + delta
  }

  for (const r of ruchy) {
    const ws    = r.workspace_id ?? null
    const qty   = Number(r.ilosc)
    const dst   = r.magazyn_docelowy_id ?? null
    const src   = r.magazyn_zrodlowy_id ?? null

    if (INBOUND_TYPES.has(r.typ)) {
      if (dst) bump(r.towar_id, dst, ws, +qty)
    } else if (r.typ === 'correction_minus') {
      if (dst) bump(r.towar_id, dst, ws, -qty)
    } else if (r.typ === 'issue') {
      if (src) bump(r.towar_id, src, ws, -qty)
    } else if (r.typ === 'transfer') {
      if (src) bump(r.towar_id, src, ws, -qty)
      if (dst) bump(r.towar_id, dst, ws, +qty)
    }
    // Unknown types are silently ignored — future types won't corrupt old reconciliation
  }

  return stany.map(s => {
    const ws       = s.workspace_id ?? null
    const k        = `${s.towar_id}:${s.magazyn_id}:${ws ?? ''}`
    const expected = expectedMap[k] ?? 0
    const stored   = Number(s.ilosc)
    return {
      towar_id:    s.towar_id,
      magazyn_id:  s.magazyn_id,
      workspace_id: ws,
      stored,
      expected,
      drift: expected - stored,
    }
  })
}

/**
 * Fetch data from Supabase and run reconciliation for one workspace.
 * READ-ONLY — no writes.
 *
 * @param {object} supabase   - Supabase client
 * @param {string} workspaceId
 * @returns {{ rows, mismatches, error }}
 *   rows       - all checked entries
 *   mismatches - subset where |drift| > 0.001
 *   error      - string or null
 */
export async function fetchAndReconcile(supabase, workspaceId) {
  const [stanyRes, ruchyRes] = await Promise.all([
    supabase
      .from('stany_magazynowe')
      .select('towar_id, magazyn_id, ilosc, workspace_id')
      .eq('workspace_id', workspaceId),
    supabase
      .from('ruchy_magazynowe')
      .select('towar_id, magazyn_zrodlowy_id, magazyn_docelowy_id, ilosc, typ, workspace_id')
      .eq('workspace_id', workspaceId),
  ])

  if (stanyRes.error) return { rows: [], mismatches: [], error: stanyRes.error.message }
  if (ruchyRes.error) return { rows: [], mismatches: [], error: ruchyRes.error.message }

  const rows       = computeReconciliation(stanyRes.data ?? [], ruchyRes.data ?? [])
  const mismatches = rows.filter(r => Math.abs(r.drift) > 0.001)
  return { rows, mismatches, error: null }
}
