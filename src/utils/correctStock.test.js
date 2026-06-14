import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({ supabase: { rpc: vi.fn() } }))
vi.mock('./events',    () => ({ refreshInventory: vi.fn() }))

import { correctStock }      from './correctStock'
import { supabase }          from '../supabase'
import { refreshInventory }  from './events'
import { computeReconciliation } from './inventoryReconciliation'

// ── Fixtures ───────────────────────────────────────────────────────────────────

const TOWAR_ID     = '11111111-0000-0000-0000-000000000001'
const MAGAZYN_ID   = '22222222-0000-0000-0000-000000000002'
const WORKSPACE_ID = '33333333-0000-0000-0000-000000000003'
const IDEM_KEY     = 'correction-2026-06-14-001'

const BASE_PLUS = {
  towarId:     TOWAR_ID,
  magazynId:   MAGAZYN_ID,
  ilosc:       5,
  typ:         'correction_plus',
  powod:       'inventory count surplus',
  workspaceId: WORKSPACE_ID,
}

const BASE_MINUS = {
  towarId:     TOWAR_ID,
  magazynId:   MAGAZYN_ID,
  ilosc:       3,
  typ:         'correction_minus',
  powod:       'inventory count deficit',
  workspaceId: WORKSPACE_ID,
}

function rpcOk(payload)  { return { data: payload, error: null } }
function rpcErr(message) { return { data: null, error: { message } } }

beforeEach(() => vi.clearAllMocks())

// ── correction_plus success ────────────────────────────────────────────────────

describe('correctStock — correction_plus success', () => {
  it('returns success with new balance and calls refreshInventory', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: 55 }))

    const result = await correctStock(BASE_PLUS)

    expect(result).toEqual({ success: true, idempotent: false, newBalance: 55 })
    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })

  it('passes all parameters including typ and powod to supabase.rpc', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: 55 }))

    await correctStock({
      towarId:        TOWAR_ID,
      magazynId:      MAGAZYN_ID,
      ilosc:          5,
      typ:            'correction_plus',
      powod:          'inventory count surplus',
      workspaceId:    WORKSPACE_ID,
      idempotencyKey: IDEM_KEY,
    })

    expect(supabase.rpc).toHaveBeenCalledWith('correct_stock', {
      p_towar_id:        TOWAR_ID,
      p_magazyn_id:      MAGAZYN_ID,
      p_ilosc:           5,
      p_typ:             'correction_plus',
      p_powod:           'inventory count surplus',
      p_workspace_id:    WORKSPACE_ID,
      p_idempotency_key: IDEM_KEY,
    })
  })
})

// ── correction_minus success ───────────────────────────────────────────────────

describe('correctStock — correction_minus success', () => {
  it('returns success with new balance and calls refreshInventory', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: 42 }))

    const result = await correctStock(BASE_MINUS)

    expect(result).toEqual({ success: true, idempotent: false, newBalance: 42 })
    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })

  it('passes correction_minus typ and reason to RPC', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: 42 }))

    await correctStock(BASE_MINUS)

    expect(supabase.rpc).toHaveBeenCalledWith('correct_stock', expect.objectContaining({
      p_typ:   'correction_minus',
      p_powod: 'inventory count deficit',
    }))
  })
})

// ── Mandatory reason validation ────────────────────────────────────────────────

describe('correctStock — mandatory reason (client-side guard)', () => {
  it('returns failure without calling RPC when powod is missing', async () => {
    const { powod: _, ...withoutPowod } = BASE_PLUS

    const result = await correctStock(withoutPowod)

    expect(result).toEqual({ success: false, error: 'reason is required' })
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('returns failure without calling RPC when powod is empty string', async () => {
    const result = await correctStock({ ...BASE_PLUS, powod: '' })

    expect(result).toEqual({ success: false, error: 'reason is required' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns failure without calling RPC when powod is whitespace only', async () => {
    const result = await correctStock({ ...BASE_PLUS, powod: '   ' })

    expect(result).toEqual({ success: false, error: 'reason is required' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('powod is forwarded to RPC as p_powod when valid', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: 10 }))

    await correctStock({ ...BASE_PLUS, powod: 'audit 2026-Q2' })

    expect(supabase.rpc).toHaveBeenCalledWith('correct_stock', expect.objectContaining({
      p_powod: 'audit 2026-Q2',
    }))
  })
})

// ── Idempotency ────────────────────────────────────────────────────────────────

describe('correctStock — idempotency', () => {
  it('returns success with idempotent:true when key already seen', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: true }))

    const result = await correctStock({ ...BASE_PLUS, idempotencyKey: IDEM_KEY })

    expect(result.success).toBe(true)
    expect(result.idempotent).toBe(true)
    expect(result.newBalance).toBeNull()
  })

  it('calls refreshInventory on idempotent response', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: true }))

    await correctStock({ ...BASE_PLUS, idempotencyKey: IDEM_KEY })

    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })

  it('idempotency key is forwarded to RPC as p_idempotency_key', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: 10 }))

    await correctStock({ ...BASE_PLUS, idempotencyKey: IDEM_KEY })

    expect(supabase.rpc).toHaveBeenCalledWith('correct_stock', expect.objectContaining({
      p_idempotency_key: IDEM_KEY,
    }))
  })

  it('idempotency key defaults to null when omitted', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: 10 }))

    await correctStock(BASE_PLUS)

    expect(supabase.rpc).toHaveBeenCalledWith('correct_stock', expect.objectContaining({
      p_idempotency_key: null,
    }))
  })

  it('does NOT create a second movement — RPC returns without new_balance', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: true }))

    const result = await correctStock({ ...BASE_PLUS, idempotencyKey: IDEM_KEY })

    expect(result.newBalance).toBeNull()
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })
})

// ── Non-negative guard (correction_minus only) ─────────────────────────────────

describe('correctStock — non-negative guard', () => {
  it('returns failure with available when stock is insufficient for correction_minus', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success:   false,
      error:     'insufficient stock for correction',
      available: 2,
    }))

    const result = await correctStock({ ...BASE_MINUS, ilosc: 10 })

    expect(result.success).toBe(false)
    expect(result.error).toBe('insufficient stock for correction')
    expect(result.available).toBe(2)
  })

  it('does NOT call refreshInventory on insufficient-stock rejection', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: false, error: 'insufficient stock for correction', available: 0,
    }))

    await correctStock({ ...BASE_MINUS, ilosc: 99 })

    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('succeeds when workspace allows negative stock (RPC makes the decision)', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: -2 }))

    const result = await correctStock({ ...BASE_MINUS, ilosc: 10 })

    expect(result.success).toBe(true)
    expect(result.newBalance).toBe(-2)
    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })

  it('correction_plus never triggers a non-negative guard', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: 55 }))

    const result = await correctStock(BASE_PLUS)

    expect(result.success).toBe(true)
    expect(result.newBalance).toBe(55)
  })
})

// ── Cross-workspace rejection ──────────────────────────────────────────────────

describe('correctStock — cross-workspace rejection', () => {
  it('returns failure when product does not belong to workspace', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: false,
      error:   'product does not belong to workspace',
    }))

    const result = await correctStock(BASE_PLUS)

    expect(result.success).toBe(false)
    expect(result.error).toBe('product does not belong to workspace')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('returns failure when warehouse does not belong to workspace', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: false,
      error:   'warehouse does not belong to workspace',
    }))

    const result = await correctStock(BASE_PLUS)

    expect(result.success).toBe(false)
    expect(result.error).toBe('warehouse does not belong to workspace')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('returns failure when workspace is not owned by caller', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: false,
      error:   'workspace not owned by caller',
    }))

    const result = await correctStock(BASE_PLUS)

    expect(result.success).toBe(false)
    expect(result.error).toBe('workspace not owned by caller')
    expect(refreshInventory).not.toHaveBeenCalled()
  })
})

// ── Supabase transport error ───────────────────────────────────────────────────

describe('correctStock — Supabase error propagation', () => {
  it('returns failure when supabase.rpc itself throws a transport error', async () => {
    supabase.rpc.mockResolvedValue(rpcErr('Connection error'))

    const result = await correctStock(BASE_PLUS)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection error')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('returns unknown error when RPC data has no error field', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: false }))

    const result = await correctStock(BASE_PLUS)

    expect(result.success).toBe(false)
    expect(result.error).toBe('unknown error')
  })
})

// ── Balance invariant (pure computation) ──────────────────────────────────────
//
// These tests verify that the sign convention used by correct_stock matches
// inventoryReconciliation.js / computeReconciliation (and 08_inventory_reconciliation.sql).
// Both correction types use magazyn_docelowy_id:
//   correction_plus  → +ilosc
//   correction_minus → -ilosc (stored as absolute value)

describe('correctStock — balance invariant (computeReconciliation)', () => {
  it('correction_plus adds qty to expected balance — drift 0', () => {
    const stany = [{ towar_id: TOWAR_ID, magazyn_id: MAGAZYN_ID, ilosc: 55, workspace_id: WORKSPACE_ID }]
    const ruchy = [
      { typ: 'purchase',        towar_id: TOWAR_ID, ilosc: 50, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAGAZYN_ID, magazyn_zrodlowy_id: null },
      { typ: 'correction_plus', towar_id: TOWAR_ID, ilosc:  5, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAGAZYN_ID, magazyn_zrodlowy_id: null },
    ]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.expected).toBe(55)
    expect(row.drift).toBe(0)
  })

  it('correction_minus subtracts qty from expected balance — drift 0', () => {
    const stany = [{ towar_id: TOWAR_ID, magazyn_id: MAGAZYN_ID, ilosc: 47, workspace_id: WORKSPACE_ID }]
    const ruchy = [
      { typ: 'purchase',          towar_id: TOWAR_ID, ilosc: 50, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAGAZYN_ID, magazyn_zrodlowy_id: null },
      { typ: 'correction_minus',  towar_id: TOWAR_ID, ilosc:  3, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAGAZYN_ID, magazyn_zrodlowy_id: null },
    ]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.expected).toBe(47)
    expect(row.drift).toBe(0)
  })

  it('correction_plus + correction_minus combined → correct net balance — drift 0', () => {
    // 50 purchase + 10 correction_plus − 3 correction_minus = 57
    const stany = [{ towar_id: TOWAR_ID, magazyn_id: MAGAZYN_ID, ilosc: 57, workspace_id: WORKSPACE_ID }]
    const ruchy = [
      { typ: 'purchase',          towar_id: TOWAR_ID, ilosc: 50, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAGAZYN_ID, magazyn_zrodlowy_id: null },
      { typ: 'correction_plus',   towar_id: TOWAR_ID, ilosc: 10, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAGAZYN_ID, magazyn_zrodlowy_id: null },
      { typ: 'correction_minus',  towar_id: TOWAR_ID, ilosc:  3, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAGAZYN_ID, magazyn_zrodlowy_id: null },
    ]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.expected).toBe(57)
    expect(row.drift).toBe(0)
  })

  it('correction with issue and transfer — correct net balance across operations', () => {
    // 100 purchase + 5 correction_plus − 3 correction_minus − 10 issue − 15 transfer = 77
    const stany = [{ towar_id: TOWAR_ID, magazyn_id: MAGAZYN_ID, ilosc: 77, workspace_id: WORKSPACE_ID }]
    const ruchy = [
      { typ: 'purchase',          towar_id: TOWAR_ID, ilosc: 100, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAGAZYN_ID, magazyn_zrodlowy_id: null },
      { typ: 'correction_plus',   towar_id: TOWAR_ID, ilosc:   5, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAGAZYN_ID, magazyn_zrodlowy_id: null },
      { typ: 'correction_minus',  towar_id: TOWAR_ID, ilosc:   3, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: MAGAZYN_ID, magazyn_zrodlowy_id: null },
      { typ: 'issue',             towar_id: TOWAR_ID, ilosc:  10, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: null, magazyn_zrodlowy_id: MAGAZYN_ID },
      { typ: 'transfer',          towar_id: TOWAR_ID, ilosc:  15, workspace_id: WORKSPACE_ID,
        magazyn_docelowy_id: null, magazyn_zrodlowy_id: MAGAZYN_ID },
    ]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.expected).toBe(77)
    expect(row.drift).toBe(0)
  })
})

// ── Module isolation ───────────────────────────────────────────────────────────

describe('correctStock — module isolation', () => {
  it('correctStock uses supabase.rpc, not supabase.from', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: 10 }))

    await correctStock(BASE_PLUS)

    expect(supabase.rpc).toHaveBeenCalledWith('correct_stock', expect.any(Object))
    expect(supabase.from).toBeUndefined()
  })
})
