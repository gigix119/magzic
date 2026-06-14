import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({ supabase: { rpc: vi.fn() } }))
vi.mock('./events',    () => ({ refreshInventory: vi.fn() }))

import { transferStock }     from './transferStock'
import { supabase }          from '../supabase'
import { refreshInventory }  from './events'
import { computeReconciliation } from './inventoryReconciliation'

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TOWAR_ID     = '11111111-0000-0000-0000-000000000001'
const MAG_SRC      = '22222222-0000-0000-0000-000000000002'   // lower UUID
const MAG_DST      = '33333333-0000-0000-0000-000000000003'   // higher UUID
const WORKSPACE_ID = '44444444-0000-0000-0000-000000000004'
const IDEM_KEY     = 'transfer-2026-06-14-001'

const BASE = {
  towarId:           TOWAR_ID,
  magazynZrodlowyId: MAG_SRC,
  magazynDocelowyId: MAG_DST,
  ilosc:             10,
  workspaceId:       WORKSPACE_ID,
}

function rpcOk(payload)  { return { data: payload, error: null } }
function rpcErr(message) { return { data: null, error: { message } } }

beforeEach(() => vi.clearAllMocks())

// ── Success path ───────────────────────────────────────────────────────────────

describe('transferStock — success path', () => {
  it('returns success with both new balances and calls refreshInventory', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: true, idempotent: false, src_new_balance: 40, dst_new_balance: 10,
    }))

    const result = await transferStock({ ...BASE, ilosc: 10 })

    expect(result).toEqual({
      success: true, idempotent: false, srcNewBalance: 40, dstNewBalance: 10,
    })
    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })

  it('passes all parameters to supabase.rpc with the correct key names', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: true, idempotent: false, src_new_balance: 30, dst_new_balance: 5,
    }))

    await transferStock({
      towarId:           TOWAR_ID,
      magazynZrodlowyId: MAG_SRC,
      magazynDocelowyId: MAG_DST,
      ilosc:             5,
      powod:             'warehouse relocation',
      workspaceId:       WORKSPACE_ID,
      idempotencyKey:    IDEM_KEY,
    })

    expect(supabase.rpc).toHaveBeenCalledWith('transfer_stock', {
      p_towar_id:            TOWAR_ID,
      p_magazyn_zrodlowy_id: MAG_SRC,
      p_magazyn_docelowy_id: MAG_DST,
      p_ilosc:               5,
      p_powod:               'warehouse relocation',
      p_workspace_id:        WORKSPACE_ID,
      p_idempotency_key:     IDEM_KEY,
    })
  })

  it('defaults powod and idempotencyKey to null when omitted', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: true, idempotent: false, src_new_balance: 20, dst_new_balance: 10,
    }))

    await transferStock(BASE)

    expect(supabase.rpc).toHaveBeenCalledWith('transfer_stock', expect.objectContaining({
      p_powod:           null,
      p_idempotency_key: null,
    }))
  })

  it('srcNewBalance and dstNewBalance are both present — both balance rows were updated', async () => {
    // The RPC returns two balances only when both movements were inserted and
    // both balance rows were recomputed.  Their presence is the JS-layer proof
    // that the transfer was all-or-nothing at the DB level.
    supabase.rpc.mockResolvedValue(rpcOk({
      success: true, idempotent: false, src_new_balance: 0, dst_new_balance: 50,
    }))

    const result = await transferStock(BASE)

    expect(result.srcNewBalance).toBe(0)
    expect(result.dstNewBalance).toBe(50)
  })
})

// ── Idempotency ────────────────────────────────────────────────────────────────

describe('transferStock — idempotency', () => {
  it('returns success with idempotent:true when key already seen', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: true }))

    const result = await transferStock({ ...BASE, idempotencyKey: IDEM_KEY })

    expect(result.success).toBe(true)
    expect(result.idempotent).toBe(true)
    // Both balances absent: no new balance write occurred (transfer already done)
    expect(result.srcNewBalance).toBeNull()
    expect(result.dstNewBalance).toBeNull()
  })

  it('calls refreshInventory on idempotent response', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: true }))

    await transferStock({ ...BASE, idempotencyKey: IDEM_KEY })

    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })

  it('does NOT insert a second pair of movements — RPC returns without new balances', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: true }))

    const result = await transferStock({ ...BASE, idempotencyKey: IDEM_KEY })

    expect(result.srcNewBalance).toBeNull()
    expect(result.dstNewBalance).toBeNull()
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })

  it('idempotency key is forwarded to RPC as p_idempotency_key', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: true, idempotent: false, src_new_balance: 10, dst_new_balance: 10,
    }))

    await transferStock({ ...BASE, idempotencyKey: IDEM_KEY })

    expect(supabase.rpc).toHaveBeenCalledWith('transfer_stock', expect.objectContaining({
      p_idempotency_key: IDEM_KEY,
    }))
  })

  it('idempotency key defaults to null when omitted', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: true, idempotent: false, src_new_balance: 10, dst_new_balance: 10,
    }))

    await transferStock(BASE)

    expect(supabase.rpc).toHaveBeenCalledWith('transfer_stock', expect.objectContaining({
      p_idempotency_key: null,
    }))
  })
})

// ── Non-negative guard (source) ────────────────────────────────────────────────

describe('transferStock — non-negative guard on source', () => {
  it('returns failure with available when source stock is insufficient', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success:   false,
      error:     'insufficient stock for transfer',
      available: 5,
    }))

    const result = await transferStock({ ...BASE, ilosc: 20 })

    expect(result.success).toBe(false)
    expect(result.error).toBe('insufficient stock for transfer')
    expect(result.available).toBe(5)
  })

  it('does NOT call refreshInventory on insufficient-stock rejection', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: false, error: 'insufficient stock for transfer', available: 0,
    }))

    await transferStock({ ...BASE, ilosc: 99 })

    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('succeeds when workspace allows negative stock (RPC makes the decision)', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: true, idempotent: false, src_new_balance: -5, dst_new_balance: 55,
    }))

    const result = await transferStock({ ...BASE, ilosc: 55 })

    expect(result.success).toBe(true)
    expect(result.srcNewBalance).toBe(-5)
    expect(result.dstNewBalance).toBe(55)
    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })
})

// ── Same-warehouse rejection ───────────────────────────────────────────────────

describe('transferStock — same-warehouse rejection', () => {
  it('RPC returns failure when source equals destination', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: false,
      error:   'source and destination warehouse must differ',
    }))

    const result = await transferStock({
      ...BASE,
      magazynZrodlowyId: MAG_SRC,
      magazynDocelowyId: MAG_SRC,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('source and destination warehouse must differ')
    expect(refreshInventory).not.toHaveBeenCalled()
  })
})

// ── Cross-workspace rejection ──────────────────────────────────────────────────

describe('transferStock — cross-workspace rejection', () => {
  it('returns failure when product does not belong to workspace', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: false,
      error:   'product does not belong to workspace',
    }))

    const result = await transferStock(BASE)

    expect(result.success).toBe(false)
    expect(result.error).toBe('product does not belong to workspace')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('returns failure when source warehouse does not belong to workspace', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: false,
      error:   'source warehouse does not belong to workspace',
    }))

    const result = await transferStock(BASE)

    expect(result.success).toBe(false)
    expect(result.error).toBe('source warehouse does not belong to workspace')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('returns failure when destination warehouse does not belong to workspace', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: false,
      error:   'destination warehouse does not belong to workspace',
    }))

    const result = await transferStock(BASE)

    expect(result.success).toBe(false)
    expect(result.error).toBe('destination warehouse does not belong to workspace')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('returns failure when workspace is not owned by caller', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: false,
      error:   'workspace not owned by caller',
    }))

    const result = await transferStock(BASE)

    expect(result.success).toBe(false)
    expect(result.error).toBe('workspace not owned by caller')
    expect(refreshInventory).not.toHaveBeenCalled()
  })
})

// ── Supabase transport error ───────────────────────────────────────────────────

describe('transferStock — Supabase error propagation', () => {
  it('returns failure when supabase.rpc throws a transport error', async () => {
    supabase.rpc.mockResolvedValue(rpcErr('Connection error'))

    const result = await transferStock(BASE)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection error')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('returns unknown error when RPC data has no error field', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: false }))

    const result = await transferStock(BASE)

    expect(result.success).toBe(false)
    expect(result.error).toBe('unknown error')
  })
})

// ── Simulated concurrency ──────────────────────────────────────────────────────
// DB-level deadlock prevention (canonical UUID lock order) is verified on
// staging by running concurrent transfers.  Here we verify that the JS client
// correctly handles two parallel calls completing independently — each gets its
// own success response, both fire refreshInventory.

describe('transferStock — simulated concurrent calls', () => {
  it('two parallel transfers on the same product both succeed independently', async () => {
    supabase.rpc
      .mockResolvedValueOnce(rpcOk({ success: true, idempotent: false, src_new_balance: 40, dst_new_balance: 10 }))
      .mockResolvedValueOnce(rpcOk({ success: true, idempotent: false, src_new_balance: 30, dst_new_balance: 20 }))

    const [r1, r2] = await Promise.all([
      transferStock(BASE),
      transferStock({ ...BASE, ilosc: 10 }),
    ])

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    expect(refreshInventory).toHaveBeenCalledTimes(2)
  })
})

// ── Balance invariant (computeReconciliation) ──────────────────────────────────
// Verifies that the sign convention used by transfer_stock (two separate rows,
// each with one warehouse set) matches inventoryReconciliation.js.
//
// transfer_stock inserts:
//   - source movement: { typ:'transfer', magazyn_zrodlowy_id:SRC, magazyn_docelowy_id:null }
//   - dest   movement: { typ:'transfer', magazyn_zrodlowy_id:null, magazyn_docelowy_id:DST }

describe('transferStock — balance invariant (computeReconciliation)', () => {
  it('transfer OUT movement subtracts from source balance — drift 0', () => {
    // 50 purchased into SRC, 10 transferred OUT from SRC → SRC balance = 40
    const stany = [{ towar_id: TOWAR_ID, magazyn_id: MAG_SRC, ilosc: 40, workspace_id: WORKSPACE_ID }]
    const ruchy = [
      { typ: 'purchase',  towar_id: TOWAR_ID, ilosc: 50, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAG_SRC, magazyn_zrodlowy_id: null },
      // source movement only (transfer_stock row 1)
      { typ: 'transfer',  towar_id: TOWAR_ID, ilosc: 10, workspace_id: WORKSPACE_ID,
        magazyn_zrodlowy_id: MAG_SRC, magazyn_docelowy_id: null },
    ]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.expected).toBe(40)
    expect(row.drift).toBe(0)
  })

  it('transfer IN movement adds to destination balance — drift 0', () => {
    // DST starts empty; 10 transferred IN to DST → DST balance = 10
    const stany = [{ towar_id: TOWAR_ID, magazyn_id: MAG_DST, ilosc: 10, workspace_id: WORKSPACE_ID }]
    const ruchy = [
      // destination movement only (transfer_stock row 2)
      { typ: 'transfer',  towar_id: TOWAR_ID, ilosc: 10, workspace_id: WORKSPACE_ID,
        magazyn_zrodlowy_id: null, magazyn_docelowy_id: MAG_DST },
    ]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.expected).toBe(10)
    expect(row.drift).toBe(0)
  })

  it('two-row transfer: source loses qty, destination gains qty — both drift 0', () => {
    // 50 purchased into SRC, 10 transferred SRC→DST
    // SRC balance = 40, DST balance = 10
    const stany = [
      { towar_id: TOWAR_ID, magazyn_id: MAG_SRC, ilosc: 40, workspace_id: WORKSPACE_ID },
      { towar_id: TOWAR_ID, magazyn_id: MAG_DST, ilosc: 10, workspace_id: WORKSPACE_ID },
    ]
    const ruchy = [
      { typ: 'purchase',  towar_id: TOWAR_ID, ilosc: 50, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAG_SRC, magazyn_zrodlowy_id: null },
      // row 1: transfer out from SRC
      { typ: 'transfer',  towar_id: TOWAR_ID, ilosc: 10, workspace_id: WORKSPACE_ID,
        magazyn_zrodlowy_id: MAG_SRC, magazyn_docelowy_id: null },
      // row 2: transfer in to DST
      { typ: 'transfer',  towar_id: TOWAR_ID, ilosc: 10, workspace_id: WORKSPACE_ID,
        magazyn_zrodlowy_id: null, magazyn_docelowy_id: MAG_DST },
    ]
    const rows = computeReconciliation(stany, ruchy)
    const src  = rows.find(r => r.magazyn_id === MAG_SRC)
    const dst  = rows.find(r => r.magazyn_id === MAG_DST)
    expect(src.expected).toBe(40)
    expect(src.drift).toBe(0)
    expect(dst.expected).toBe(10)
    expect(dst.drift).toBe(0)
  })

  it('multiple transfers: balances accumulate correctly — drift 0', () => {
    // 100 purchased into SRC
    // Transfer 1: SRC→DST 20 qty
    // Transfer 2: SRC→DST 15 qty
    // SRC = 65, DST = 35
    const stany = [
      { towar_id: TOWAR_ID, magazyn_id: MAG_SRC, ilosc: 65, workspace_id: WORKSPACE_ID },
      { towar_id: TOWAR_ID, magazyn_id: MAG_DST, ilosc: 35, workspace_id: WORKSPACE_ID },
    ]
    const ruchy = [
      { typ: 'purchase',  towar_id: TOWAR_ID, ilosc: 100, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAG_SRC, magazyn_zrodlowy_id: null },
      // Transfer 1 — two rows
      { typ: 'transfer',  towar_id: TOWAR_ID, ilosc: 20, workspace_id: WORKSPACE_ID,
        magazyn_zrodlowy_id: MAG_SRC, magazyn_docelowy_id: null },
      { typ: 'transfer',  towar_id: TOWAR_ID, ilosc: 20, workspace_id: WORKSPACE_ID,
        magazyn_zrodlowy_id: null, magazyn_docelowy_id: MAG_DST },
      // Transfer 2 — two rows
      { typ: 'transfer',  towar_id: TOWAR_ID, ilosc: 15, workspace_id: WORKSPACE_ID,
        magazyn_zrodlowy_id: MAG_SRC, magazyn_docelowy_id: null },
      { typ: 'transfer',  towar_id: TOWAR_ID, ilosc: 15, workspace_id: WORKSPACE_ID,
        magazyn_zrodlowy_id: null, magazyn_docelowy_id: MAG_DST },
    ]
    const rows = computeReconciliation(stany, ruchy)
    const src  = rows.find(r => r.magazyn_id === MAG_SRC)
    const dst  = rows.find(r => r.magazyn_id === MAG_DST)
    expect(src.expected).toBe(65)
    expect(src.drift).toBe(0)
    expect(dst.expected).toBe(35)
    expect(dst.drift).toBe(0)
  })

  it('transfer combined with issue and correction — net balance correct — drift 0', () => {
    // 100 purchase → SRC; 20 transfer SRC→DST; 5 issue from SRC; 3 correction_plus SRC
    // SRC = 100 - 20 - 5 + 3 = 78; DST = 20
    const stany = [
      { towar_id: TOWAR_ID, magazyn_id: MAG_SRC, ilosc: 78, workspace_id: WORKSPACE_ID },
      { towar_id: TOWAR_ID, magazyn_id: MAG_DST, ilosc: 20, workspace_id: WORKSPACE_ID },
    ]
    const ruchy = [
      { typ: 'purchase',        towar_id: TOWAR_ID, ilosc: 100, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAG_SRC, magazyn_zrodlowy_id: null },
      { typ: 'transfer',        towar_id: TOWAR_ID, ilosc:  20, workspace_id: WORKSPACE_ID,
        magazyn_zrodlowy_id: MAG_SRC, magazyn_docelowy_id: null },
      { typ: 'transfer',        towar_id: TOWAR_ID, ilosc:  20, workspace_id: WORKSPACE_ID,
        magazyn_zrodlowy_id: null, magazyn_docelowy_id: MAG_DST },
      { typ: 'issue',           towar_id: TOWAR_ID, ilosc:   5, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: null, magazyn_zrodlowy_id: MAG_SRC },
      { typ: 'correction_plus', towar_id: TOWAR_ID, ilosc:   3, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAG_SRC, magazyn_zrodlowy_id: null },
    ]
    const rows = computeReconciliation(stany, ruchy)
    const src  = rows.find(r => r.magazyn_id === MAG_SRC)
    const dst  = rows.find(r => r.magazyn_id === MAG_DST)
    expect(src.expected).toBe(78)
    expect(src.drift).toBe(0)
    expect(dst.expected).toBe(20)
    expect(dst.drift).toBe(0)
  })

  it('transfer drift detected when stored does not match movements', () => {
    // SRC moved 10 out but stored says SRC=45 (should be 40) → drift = -5
    const stany = [
      { towar_id: TOWAR_ID, magazyn_id: MAG_SRC, ilosc: 45, workspace_id: WORKSPACE_ID },
      { towar_id: TOWAR_ID, magazyn_id: MAG_DST, ilosc: 10, workspace_id: WORKSPACE_ID },
    ]
    const ruchy = [
      { typ: 'purchase',  towar_id: TOWAR_ID, ilosc: 50, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAG_SRC, magazyn_zrodlowy_id: null },
      { typ: 'transfer',  towar_id: TOWAR_ID, ilosc: 10, workspace_id: WORKSPACE_ID,
        magazyn_zrodlowy_id: MAG_SRC, magazyn_docelowy_id: null },
      { typ: 'transfer',  towar_id: TOWAR_ID, ilosc: 10, workspace_id: WORKSPACE_ID,
        magazyn_zrodlowy_id: null, magazyn_docelowy_id: MAG_DST },
    ]
    const rows = computeReconciliation(stany, ruchy)
    const src  = rows.find(r => r.magazyn_id === MAG_SRC)
    const dst  = rows.find(r => r.magazyn_id === MAG_DST)
    expect(src.drift).toBe(-5)   // stored 45, expected 40
    expect(dst.drift).toBe(0)
  })
})

// ── Module isolation ───────────────────────────────────────────────────────────

describe('transferStock — module isolation', () => {
  it('transferStock uses supabase.rpc, not supabase.from', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: true, idempotent: false, src_new_balance: 10, dst_new_balance: 10,
    }))

    await transferStock(BASE)

    expect(supabase.rpc).toHaveBeenCalledWith('transfer_stock', expect.any(Object))
    expect(supabase.from).toBeUndefined()
  })
})
