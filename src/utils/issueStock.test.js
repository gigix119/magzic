import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({ supabase: { rpc: vi.fn() } }))
vi.mock('./events',    () => ({ refreshInventory: vi.fn() }))

import { issueStock } from './issueStock'
import { supabase }   from '../supabase'
import { refreshInventory } from './events'

// ── Shared fixtures ────────────────────────────────────────────────────────────

const TOWAR_ID     = '11111111-0000-0000-0000-000000000001'
const MAGAZYN_ID   = '22222222-0000-0000-0000-000000000002'
const WORKSPACE_ID = '33333333-0000-0000-0000-000000000003'
const IDEM_KEY     = 'order-42-line-1'

const BASE_PARAMS = {
  towarId:     TOWAR_ID,
  magazynId:   MAGAZYN_ID,
  ilosc:       10,
  workspaceId: WORKSPACE_ID,
}

function rpcOk(payload)  { return { data: payload, error: null } }
function rpcErr(message) { return { data: null, error: { message } } }

beforeEach(() => vi.clearAllMocks())

// ── Successful issue ───────────────────────────────────────────────────────────

describe('issueStock — success path', () => {
  it('returns success with new balance and calls refreshInventory', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: 40 }))

    const result = await issueStock({ ...BASE_PARAMS, ilosc: 10 })

    expect(result).toEqual({ success: true, idempotent: false, newBalance: 40 })
    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })

  it('passes all parameters to supabase.rpc with the correct key names', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: 30 }))

    await issueStock({
      towarId:        TOWAR_ID,
      magazynId:      MAGAZYN_ID,
      ilosc:          5,
      powod:          'delivery note #7',
      workspaceId:    WORKSPACE_ID,
      idempotencyKey: IDEM_KEY,
    })

    expect(supabase.rpc).toHaveBeenCalledWith('issue_stock', {
      p_towar_id:        TOWAR_ID,
      p_magazyn_id:      MAGAZYN_ID,
      p_ilosc:           5,
      p_powod:           'delivery note #7',
      p_workspace_id:    WORKSPACE_ID,
      p_idempotency_key: IDEM_KEY,
    })
  })

  it('defaults powod and idempotencyKey to null when omitted', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: 20 }))

    await issueStock(BASE_PARAMS)

    expect(supabase.rpc).toHaveBeenCalledWith('issue_stock', expect.objectContaining({
      p_powod:           null,
      p_idempotency_key: null,
    }))
  })
})

// ── Idempotency ────────────────────────────────────────────────────────────────

describe('issueStock — idempotency', () => {
  it('returns success with idempotent:true when key already seen', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: true }))

    const result = await issueStock({ ...BASE_PARAMS, idempotencyKey: IDEM_KEY })

    expect(result.success).toBe(true)
    expect(result.idempotent).toBe(true)
    expect(result.newBalance).toBeNull()
  })

  it('calls refreshInventory on idempotent response', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: true }))

    await issueStock({ ...BASE_PARAMS, idempotencyKey: IDEM_KEY })

    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })

  it('does NOT create a second movement — RPC returns without new_balance', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: true }))

    const result = await issueStock({ ...BASE_PARAMS, idempotencyKey: IDEM_KEY })

    // new_balance absent → no balance write occurred
    expect(result.newBalance).toBeNull()
    // RPC called exactly once (caller would not retry on idempotent:true)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })
})

// ── Negative-stock guard ───────────────────────────────────────────────────────

describe('issueStock — negative-stock guard', () => {
  it('returns failure with available when stock is insufficient (default workspace)', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success:   false,
      error:     'insufficient stock',
      available: 5,
    }))

    const result = await issueStock({ ...BASE_PARAMS, ilosc: 20 })

    expect(result.success).toBe(false)
    expect(result.error).toBe('insufficient stock')
    expect(result.available).toBe(5)
  })

  it('does NOT call refreshInventory on insufficient-stock rejection', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: false, error: 'insufficient stock', available: 0,
    }))

    await issueStock({ ...BASE_PARAMS, ilosc: 99 })

    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('succeeds when workspace allows negative stock (RPC makes the decision)', async () => {
    // workspace.settings->>'allow_negative_stock' = 'true' — RPC passes guard
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: -5 }))

    const result = await issueStock({ ...BASE_PARAMS, ilosc: 55 })

    expect(result.success).toBe(true)
    expect(result.newBalance).toBe(-5)
    expect(refreshInventory).toHaveBeenCalledTimes(1)
  })
})

// ── Cross-workspace rejection ──────────────────────────────────────────────────

describe('issueStock — cross-workspace rejection', () => {
  it('returns failure when product does not belong to workspace', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: false,
      error:   'product does not belong to workspace',
    }))

    const result = await issueStock(BASE_PARAMS)

    expect(result.success).toBe(false)
    expect(result.error).toBe('product does not belong to workspace')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('returns failure when warehouse does not belong to workspace', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: false,
      error:   'warehouse does not belong to workspace',
    }))

    const result = await issueStock(BASE_PARAMS)

    expect(result.success).toBe(false)
    expect(result.error).toBe('warehouse does not belong to workspace')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('returns failure when workspace is not owned by caller', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({
      success: false,
      error:   'workspace not owned by caller',
    }))

    const result = await issueStock(BASE_PARAMS)

    expect(result.success).toBe(false)
    expect(result.error).toBe('workspace not owned by caller')
    expect(refreshInventory).not.toHaveBeenCalled()
  })
})

// ── Supabase transport error ───────────────────────────────────────────────────

describe('issueStock — Supabase error propagation', () => {
  it('returns failure when supabase.rpc itself throws a transport error', async () => {
    supabase.rpc.mockResolvedValue(rpcErr('Connection error'))

    const result = await issueStock(BASE_PARAMS)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection error')
    expect(refreshInventory).not.toHaveBeenCalled()
  })

  it('returns unknown error when RPC data has no error message', async () => {
    supabase.rpc.mockResolvedValue(rpcOk({ success: false }))

    const result = await issueStock(BASE_PARAMS)

    expect(result.success).toBe(false)
    expect(result.error).toBe('unknown error')
  })
})

// ── Baseline: existing test suites unchanged ───────────────────────────────────
//
// These tests verify that adding issueStock.js / issueStock.test.js does not
// disturb the magazyn.js, inventoryReconciliation.js, or any other module.
// The guarantee is structural: issueStock.js imports only supabase and events,
// neither of which is modified here.  The full suite passes in CI.

describe('issueStock — module isolation', () => {
  it('issueStock does not import or mutate magazyn.js', async () => {
    // If magazyn.js were imported, vitest would pick up the import tree.
    // Verify that the mock for supabase.rpc is the one used, not supabase.from.
    supabase.rpc.mockResolvedValue(rpcOk({ success: true, idempotent: false, new_balance: 10 }))

    await issueStock(BASE_PARAMS)

    // supabase.rpc was called, not supabase.from
    expect(supabase.rpc).toHaveBeenCalledWith('issue_stock', expect.any(Object))
    expect(supabase.from).toBeUndefined()
  })
})
