// Cross-operation idempotency and concurrency tests for the P8-P11 inventory RPC suite.
//
// PURPOSE:
//   Verify that the JS client layer correctly handles:
//     1. Double-submit: same idempotency key → second call returns idempotent:true, no
//        second movement is created.
//     2. Retry after transport failure: if the first RPC call timed out but the DB
//        committed, retrying with the same key is safe.
//     3. Cross-operation key scope: the idempotency key is workspace-scoped (NOT
//        operation-type-scoped).  Callers MUST use globally unique keys.
//     4. Parallel concurrent calls: Promise.all on independent calls each returns its
//        own response; refreshInventory fires once per success.
//     5. Balance invariant: computeReconciliation returns drift=0 for every
//        (towar, magazyn) pair after any combination of receive/issue/correction/transfer.
//
// DB-level guarantees (FOR UPDATE lock, canonical-UUID deadlock prevention, partial
// unique index) are verified on staging via live concurrent sessions.  These tests
// confirm the JS client propagates outcomes correctly.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({ supabase: { rpc: vi.fn() } }))
vi.mock('./events',    () => ({ refreshInventory: vi.fn() }))

import { supabase }              from '../supabase'
import { refreshInventory }      from './events'
import { issueStock }            from './issueStock'
import { correctStock }          from './correctStock'
import { transferStock }         from './transferStock'
import { computeReconciliation } from './inventoryReconciliation'

// ── Shared UUIDs ───────────────────────────────────────────────────────────────
const T  = '11111111-0000-0000-0000-000000000001'   // towar
const M1 = '22222222-0000-0000-0000-000000000002'   // warehouse 1 (lower UUID)
const M2 = '33333333-0000-0000-0000-000000000003'   // warehouse 2 (higher UUID)
const WS = '44444444-0000-0000-0000-000000000004'   // workspace

const ok  = (payload) => ({ data: payload,  error: null })
const err = (message) => ({ data: null,     error: { message } })

beforeEach(() => vi.clearAllMocks())

// ── Section 1: Double-submit prevention ───────────────────────────────────────
//
// Each operation must return idempotent:true on the second call with the same key,
// and must NOT include a new balance (proving no movement was inserted).

describe('idempotency — double-submit prevention: issue_stock', () => {
  const KEY = 'issue-double-submit-001'

  it('first call returns success with new_balance', async () => {
    supabase.rpc.mockResolvedValueOnce(ok({ success: true, idempotent: false, new_balance: 90 }))
    const r = await issueStock({ towarId: T, magazynId: M1, ilosc: 10, workspaceId: WS, idempotencyKey: KEY })
    expect(r.success).toBe(true)
    expect(r.idempotent).toBe(false)
    expect(r.newBalance).toBe(90)
  })

  it('second call with same key returns idempotent:true, no new_balance', async () => {
    supabase.rpc.mockResolvedValueOnce(ok({ success: true, idempotent: true }))
    const r = await issueStock({ towarId: T, magazynId: M1, ilosc: 10, workspaceId: WS, idempotencyKey: KEY })
    expect(r.success).toBe(true)
    expect(r.idempotent).toBe(true)
    expect(r.newBalance).toBeNull()
  })

  it('both calls fire refreshInventory — client does not suppress idempotent updates', async () => {
    supabase.rpc
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, new_balance: 90 }))
      .mockResolvedValueOnce(ok({ success: true, idempotent: true }))
    await issueStock({ towarId: T, magazynId: M1, ilosc: 10, workspaceId: WS, idempotencyKey: KEY })
    await issueStock({ towarId: T, magazynId: M1, ilosc: 10, workspaceId: WS, idempotencyKey: KEY })
    expect(refreshInventory).toHaveBeenCalledTimes(2)
    expect(supabase.rpc).toHaveBeenCalledTimes(2)
  })
})

describe('idempotency — double-submit prevention: correct_stock', () => {
  const KEY = 'correction-double-submit-001'

  it('first call returns success with new_balance', async () => {
    supabase.rpc.mockResolvedValueOnce(ok({ success: true, idempotent: false, new_balance: 55 }))
    const r = await correctStock({ towarId: T, magazynId: M1, ilosc: 5, typ: 'correction_plus', powod: 'audit Q2', workspaceId: WS, idempotencyKey: KEY })
    expect(r.success).toBe(true)
    expect(r.idempotent).toBe(false)
    expect(r.newBalance).toBe(55)
  })

  it('second call with same key returns idempotent:true, no new_balance', async () => {
    supabase.rpc.mockResolvedValueOnce(ok({ success: true, idempotent: true }))
    const r = await correctStock({ towarId: T, magazynId: M1, ilosc: 5, typ: 'correction_plus', powod: 'audit Q2', workspaceId: WS, idempotencyKey: KEY })
    expect(r.success).toBe(true)
    expect(r.idempotent).toBe(true)
    expect(r.newBalance).toBeNull()
  })

  it('correction_minus double-submit: second call is idempotent', async () => {
    supabase.rpc
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, new_balance: 47 }))
      .mockResolvedValueOnce(ok({ success: true, idempotent: true }))
    const r1 = await correctStock({ towarId: T, magazynId: M1, ilosc: 3, typ: 'correction_minus', powod: 'count deficit', workspaceId: WS, idempotencyKey: KEY })
    const r2 = await correctStock({ towarId: T, magazynId: M1, ilosc: 3, typ: 'correction_minus', powod: 'count deficit', workspaceId: WS, idempotencyKey: KEY })
    expect(r1.idempotent).toBe(false)
    expect(r2.idempotent).toBe(true)
    expect(r2.newBalance).toBeNull()
  })
})

describe('idempotency — double-submit prevention: transfer_stock', () => {
  const KEY = 'transfer-double-submit-001'

  it('first call returns success with both new balances', async () => {
    supabase.rpc.mockResolvedValueOnce(ok({ success: true, idempotent: false, src_new_balance: 40, dst_new_balance: 10 }))
    const r = await transferStock({ towarId: T, magazynZrodlowyId: M1, magazynDocelowyId: M2, ilosc: 10, workspaceId: WS, idempotencyKey: KEY })
    expect(r.success).toBe(true)
    expect(r.idempotent).toBe(false)
    expect(r.srcNewBalance).toBe(40)
    expect(r.dstNewBalance).toBe(10)
  })

  it('second call with same key returns idempotent:true, both balances null', async () => {
    supabase.rpc.mockResolvedValueOnce(ok({ success: true, idempotent: true }))
    const r = await transferStock({ towarId: T, magazynZrodlowyId: M1, magazynDocelowyId: M2, ilosc: 10, workspaceId: WS, idempotencyKey: KEY })
    expect(r.success).toBe(true)
    expect(r.idempotent).toBe(true)
    expect(r.srcNewBalance).toBeNull()
    expect(r.dstNewBalance).toBeNull()
  })
})

// ── Section 2: Retry after transport failure ────────────────────────────────────
//
// Scenario: the RPC call times out (network error returned to JS), but the DB
// transaction MAY have committed before the timeout.  Retrying with the same key is
// safe: if the DB committed, the retry returns idempotent:true; if not, it proceeds.

describe('idempotency — retry after transport failure', () => {
  it('issue: first call times out; retry with same key → idempotent:true (DB committed)', async () => {
    const KEY = 'issue-retry-timeout-001'
    supabase.rpc
      .mockResolvedValueOnce(err('network timeout'))
      .mockResolvedValueOnce(ok({ success: true, idempotent: true }))

    const r1 = await issueStock({ towarId: T, magazynId: M1, ilosc: 10, workspaceId: WS, idempotencyKey: KEY })
    const r2 = await issueStock({ towarId: T, magazynId: M1, ilosc: 10, workspaceId: WS, idempotencyKey: KEY })

    expect(r1.success).toBe(false)
    expect(r1.error).toBe('network timeout')
    expect(r2.success).toBe(true)
    expect(r2.idempotent).toBe(true)
    expect(refreshInventory).toHaveBeenCalledTimes(1)   // only the successful retry fires
  })

  it('issue: first call times out; retry with same key → not idempotent (DB did not commit)', async () => {
    const KEY = 'issue-retry-nocommit-001'
    supabase.rpc
      .mockResolvedValueOnce(err('network timeout'))
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, new_balance: 90 }))

    const r1 = await issueStock({ towarId: T, magazynId: M1, ilosc: 10, workspaceId: WS, idempotencyKey: KEY })
    const r2 = await issueStock({ towarId: T, magazynId: M1, ilosc: 10, workspaceId: WS, idempotencyKey: KEY })

    expect(r1.success).toBe(false)
    expect(r2.success).toBe(true)
    expect(r2.idempotent).toBe(false)
    expect(r2.newBalance).toBe(90)
  })

  it('transfer: retry returns idempotent:true if DB committed before transport failure', async () => {
    const KEY = 'transfer-retry-001'
    supabase.rpc
      .mockResolvedValueOnce(err('connection reset'))
      .mockResolvedValueOnce(ok({ success: true, idempotent: true }))

    const r1 = await transferStock({ towarId: T, magazynZrodlowyId: M1, magazynDocelowyId: M2, ilosc: 5, workspaceId: WS, idempotencyKey: KEY })
    const r2 = await transferStock({ towarId: T, magazynZrodlowyId: M1, magazynDocelowyId: M2, ilosc: 5, workspaceId: WS, idempotencyKey: KEY })

    expect(r1.success).toBe(false)
    expect(r2.success).toBe(true)
    expect(r2.idempotent).toBe(true)
    expect(r2.srcNewBalance).toBeNull()
    expect(r2.dstNewBalance).toBeNull()
  })

  it('correction: retry returns idempotent:true if DB committed before transport failure', async () => {
    const KEY = 'correction-retry-001'
    supabase.rpc
      .mockResolvedValueOnce(err('read timeout'))
      .mockResolvedValueOnce(ok({ success: true, idempotent: true }))

    const r1 = await correctStock({ towarId: T, magazynId: M1, ilosc: 5, typ: 'correction_plus', powod: 'recount', workspaceId: WS, idempotencyKey: KEY })
    const r2 = await correctStock({ towarId: T, magazynId: M1, ilosc: 5, typ: 'correction_plus', powod: 'recount', workspaceId: WS, idempotencyKey: KEY })

    expect(r1.success).toBe(false)
    expect(r2.success).toBe(true)
    expect(r2.idempotent).toBe(true)
  })
})

// ── Section 3: Cross-operation idempotency key scope ───────────────────────────
//
// The idempotency key is scoped to (workspace_id, key) — NOT to operation type.
// Using the same key for different operations within the same workspace will cause
// the second operation to return idempotent:true even though the operation types differ.
//
// CONTRACT FOR CALLERS: each key must be globally unique within a workspace.
// Recommended format: "<operation>-<external-ref>-<sequence>"
// Examples: "receive-po-2026-001-1", "issue-order-78-line-3", "transfer-reloc-May-7"

describe('idempotency — key is workspace-scoped, not operation-scoped', () => {
  it('key used for issue returns idempotent when same key presented for correction', async () => {
    const SHARED_KEY = 'shared-cross-op-key-001'
    supabase.rpc
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, new_balance: 90 }))
      .mockResolvedValueOnce(ok({ success: true, idempotent: true }))

    await issueStock({ towarId: T, magazynId: M1, ilosc: 10, workspaceId: WS, idempotencyKey: SHARED_KEY })
    const r = await correctStock({ towarId: T, magazynId: M1, ilosc: 5, typ: 'correction_plus', powod: 'test', workspaceId: WS, idempotencyKey: SHARED_KEY })

    expect(r.success).toBe(true)
    expect(r.idempotent).toBe(true)
  })

  it('key used for transfer returns idempotent when same key presented for issue', async () => {
    const SHARED_KEY = 'shared-cross-op-key-002'
    supabase.rpc
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, src_new_balance: 40, dst_new_balance: 10 }))
      .mockResolvedValueOnce(ok({ success: true, idempotent: true }))

    await transferStock({ towarId: T, magazynZrodlowyId: M1, magazynDocelowyId: M2, ilosc: 10, workspaceId: WS, idempotencyKey: SHARED_KEY })
    const r = await issueStock({ towarId: T, magazynId: M1, ilosc: 5, workspaceId: WS, idempotencyKey: SHARED_KEY })

    expect(r.success).toBe(true)
    expect(r.idempotent).toBe(true)
  })
})

// ── Section 4: Parallel concurrent calls ──────────────────────────────────────
//
// These tests simulate Promise.all calls that resolve concurrently from the JS side.
// DB-level serialization (FOR UPDATE lock) is verified on staging.
// Here we confirm each JS call receives its own independent response.

describe('concurrency — parallel calls on same product', () => {
  it('three parallel issues on same (towar, magazyn): each returns independent new_balance', async () => {
    supabase.rpc
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, new_balance: 90 }))
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, new_balance: 80 }))
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, new_balance: 70 }))

    const [r1, r2, r3] = await Promise.all([
      issueStock({ towarId: T, magazynId: M1, ilosc: 10, workspaceId: WS }),
      issueStock({ towarId: T, magazynId: M1, ilosc: 10, workspaceId: WS }),
      issueStock({ towarId: T, magazynId: M1, ilosc: 10, workspaceId: WS }),
    ])

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    expect(r3.success).toBe(true)
    expect(r1.newBalance).toBe(90)
    expect(r2.newBalance).toBe(80)
    expect(r3.newBalance).toBe(70)
    expect(refreshInventory).toHaveBeenCalledTimes(3)
  })

  it('two parallel transfers in opposite directions both succeed', async () => {
    supabase.rpc
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, src_new_balance: 40, dst_new_balance: 10 }))
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, src_new_balance: 5,  dst_new_balance: 45 }))

    const [fwd, rev] = await Promise.all([
      transferStock({ towarId: T, magazynZrodlowyId: M1, magazynDocelowyId: M2, ilosc: 10, workspaceId: WS }),
      transferStock({ towarId: T, magazynZrodlowyId: M2, magazynDocelowyId: M1, ilosc:  5, workspaceId: WS }),
    ])

    expect(fwd.success).toBe(true)
    expect(rev.success).toBe(true)
    expect(refreshInventory).toHaveBeenCalledTimes(2)
  })

  it('parallel issue + correction_plus + transfer: all three succeed independently', async () => {
    supabase.rpc
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, new_balance: 80 }))                          // issue
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, new_balance: 85 }))                          // correction_plus
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, src_new_balance: 70, dst_new_balance: 15 })) // transfer

    const [ri, rc, rt] = await Promise.all([
      issueStock({ towarId: T, magazynId: M1, ilosc: 20, workspaceId: WS }),
      correctStock({ towarId: T, magazynId: M1, ilosc: 5, typ: 'correction_plus', powod: 'recount', workspaceId: WS }),
      transferStock({ towarId: T, magazynZrodlowyId: M1, magazynDocelowyId: M2, ilosc: 15, workspaceId: WS }),
    ])

    expect(ri.success).toBe(true)
    expect(rc.success).toBe(true)
    expect(rt.success).toBe(true)
    expect(refreshInventory).toHaveBeenCalledTimes(3)
  })

  it('one failure in a parallel group does not prevent others from succeeding', async () => {
    supabase.rpc
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, new_balance: 90 }))
      .mockResolvedValueOnce(ok({ success: false, error: 'insufficient stock', available: 2 }))
      .mockResolvedValueOnce(ok({ success: true, idempotent: false, new_balance: 95 }))

    const [r1, r2, r3] = await Promise.all([
      issueStock({ towarId: T, magazynId: M1, ilosc: 10, workspaceId: WS }),
      issueStock({ towarId: T, magazynId: M1, ilosc: 99, workspaceId: WS }),
      issueStock({ towarId: T, magazynId: M1, ilosc:  5, workspaceId: WS }),
    ])

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(false)
    expect(r3.success).toBe(true)
    expect(refreshInventory).toHaveBeenCalledTimes(2)  // only the two successes
  })
})

// ── Section 5: Balance invariant (pure computation) ───────────────────────────
//
// computeReconciliation(stany, ruchy) must return drift=0 for every (towar, magazyn)
// pair after any combination of movement types.  "drift = expected - stored."
//
// The expected value is the sum of all non-reversed movements (filtered by the caller
// before passing to computeReconciliation).  The stored value comes from stany_magazynowe.
// When balance == sum(movements), drift == 0 — which is the invariant that P8-P11 RPCs
// maintain by recomputing the balance from ALL movements after every write.

describe('balance invariant — balance == sum(movements) across all operation types', () => {
  it('full sequence: purchase + issue + correction_plus + correction_minus → drift 0', () => {
    // 100 purchase → +100; 20 issue → -20; 5 correction_plus → +5; 3 correction_minus → -3
    // Net: 100 - 20 + 5 - 3 = 82
    const stany = [{ towar_id: T, magazyn_id: M1, ilosc: 82, workspace_id: WS }]
    const ruchy = [
      { typ: 'purchase',          towar_id: T, ilosc: 100, workspace_id: WS, magazyn_docelowy_id: M1, magazyn_zrodlowy_id: null },
      { typ: 'issue',             towar_id: T, ilosc:  20, workspace_id: WS, magazyn_docelowy_id: null, magazyn_zrodlowy_id: M1 },
      { typ: 'correction_plus',   towar_id: T, ilosc:   5, workspace_id: WS, magazyn_docelowy_id: M1, magazyn_zrodlowy_id: null },
      { typ: 'correction_minus',  towar_id: T, ilosc:   3, workspace_id: WS, magazyn_docelowy_id: M1, magazyn_zrodlowy_id: null },
    ]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.expected).toBe(82)
    expect(row.drift).toBe(0)
  })

  it('purchase → transfer M1→M2 → issue from M2 → correction_minus M1: all drift 0', () => {
    // 100 purchase M1; 30 transfer M1→M2; 10 issue from M2; 5 correction_minus M1
    // M1: 100 - 30 - 5 = 65; M2: 30 - 10 = 20
    const stany = [
      { towar_id: T, magazyn_id: M1, ilosc: 65, workspace_id: WS },
      { towar_id: T, magazyn_id: M2, ilosc: 20, workspace_id: WS },
    ]
    const ruchy = [
      { typ: 'purchase',         towar_id: T, ilosc: 100, workspace_id: WS, magazyn_docelowy_id: M1, magazyn_zrodlowy_id: null },
      { typ: 'transfer',         towar_id: T, ilosc:  30, workspace_id: WS, magazyn_zrodlowy_id: M1, magazyn_docelowy_id: null },
      { typ: 'transfer',         towar_id: T, ilosc:  30, workspace_id: WS, magazyn_zrodlowy_id: null, magazyn_docelowy_id: M2 },
      { typ: 'issue',            towar_id: T, ilosc:  10, workspace_id: WS, magazyn_docelowy_id: null, magazyn_zrodlowy_id: M2 },
      { typ: 'correction_minus', towar_id: T, ilosc:   5, workspace_id: WS, magazyn_docelowy_id: M1, magazyn_zrodlowy_id: null },
    ]
    const rows = computeReconciliation(stany, ruchy)
    const r1 = rows.find(r => r.magazyn_id === M1)
    const r2 = rows.find(r => r.magazyn_id === M2)
    expect(r1.expected).toBe(65)
    expect(r1.drift).toBe(0)
    expect(r2.expected).toBe(20)
    expect(r2.drift).toBe(0)
  })

  it('multiple concurrent-style operations: balance remains reconciled', () => {
    // Simulates DB outcome after concurrent writes:
    // 3× issue of 10 each (DB serialized via FOR UPDATE) from 100 initial stock
    // 100 - 10 - 10 - 10 = 70
    const stany = [{ towar_id: T, magazyn_id: M1, ilosc: 70, workspace_id: WS }]
    const ruchy = [
      { typ: 'purchase', towar_id: T, ilosc: 100, workspace_id: WS, magazyn_docelowy_id: M1, magazyn_zrodlowy_id: null },
      { typ: 'issue',    towar_id: T, ilosc:  10, workspace_id: WS, magazyn_docelowy_id: null, magazyn_zrodlowy_id: M1 },
      { typ: 'issue',    towar_id: T, ilosc:  10, workspace_id: WS, magazyn_docelowy_id: null, magazyn_zrodlowy_id: M1 },
      { typ: 'issue',    towar_id: T, ilosc:  10, workspace_id: WS, magazyn_docelowy_id: null, magazyn_zrodlowy_id: M1 },
    ]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.expected).toBe(70)
    expect(row.drift).toBe(0)
  })

  it('drift is non-zero when stored balance does not match sum of movements', () => {
    // 100 purchase, 10 issue → expected 90, but stored says 95 → drift = -5
    const stany = [{ towar_id: T, magazyn_id: M1, ilosc: 95, workspace_id: WS }]
    const ruchy = [
      { typ: 'purchase', towar_id: T, ilosc: 100, workspace_id: WS, magazyn_docelowy_id: M1, magazyn_zrodlowy_id: null },
      { typ: 'issue',    towar_id: T, ilosc:  10, workspace_id: WS, magazyn_docelowy_id: null, magazyn_zrodlowy_id: M1 },
    ]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.expected).toBe(90)
    expect(row.drift).toBe(-5)  // positive drift = movements say MORE than stored
  })

  it('reversed movements excluded: only pass non-reversed to computeReconciliation', () => {
    // 100 purchase; 10 issue (later reversed); 5 issue (active)
    // After filtering out the reversed movement: stored = 95, expected = 95, drift = 0
    const stany = [{ towar_id: T, magazyn_id: M1, ilosc: 95, workspace_id: WS }]
    const nonReversedRuchy = [
      { typ: 'purchase', towar_id: T, ilosc: 100, workspace_id: WS, magazyn_docelowy_id: M1, magazyn_zrodlowy_id: null },
      { typ: 'issue',    towar_id: T, ilosc:   5, workspace_id: WS, magazyn_docelowy_id: null, magazyn_zrodlowy_id: M1 },
      // The reversed issue (reversed_at = '2026-01-01') is excluded by the caller before calling computeReconciliation
    ]
    const [row] = computeReconciliation(stany, nonReversedRuchy)
    expect(row.expected).toBe(95)
    expect(row.drift).toBe(0)
  })

  it('two warehouses: operations on M1 do not affect M2 balance', () => {
    // M1: 50 purchase, 15 issue → 35
    // M2: 20 purchase, 5 correction_plus → 25
    const stany = [
      { towar_id: T, magazyn_id: M1, ilosc: 35, workspace_id: WS },
      { towar_id: T, magazyn_id: M2, ilosc: 25, workspace_id: WS },
    ]
    const ruchy = [
      { typ: 'purchase',        towar_id: T, ilosc: 50, workspace_id: WS, magazyn_docelowy_id: M1, magazyn_zrodlowy_id: null },
      { typ: 'issue',           towar_id: T, ilosc: 15, workspace_id: WS, magazyn_docelowy_id: null, magazyn_zrodlowy_id: M1 },
      { typ: 'purchase',        towar_id: T, ilosc: 20, workspace_id: WS, magazyn_docelowy_id: M2, magazyn_zrodlowy_id: null },
      { typ: 'correction_plus', towar_id: T, ilosc:  5, workspace_id: WS, magazyn_docelowy_id: M2, magazyn_zrodlowy_id: null },
    ]
    const rows = computeReconciliation(stany, ruchy)
    const r1 = rows.find(r => r.magazyn_id === M1)
    const r2 = rows.find(r => r.magazyn_id === M2)
    expect(r1.expected).toBe(35)
    expect(r1.drift).toBe(0)
    expect(r2.expected).toBe(25)
    expect(r2.drift).toBe(0)
  })
})
