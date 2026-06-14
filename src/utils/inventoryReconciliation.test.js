import { describe, it, expect } from 'vitest'
import { computeReconciliation, fetchAndReconcile } from './inventoryReconciliation'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WS1 = 'ws-alpha'
const WS2 = 'ws-beta'
const T1  = 'prod-1'
const T2  = 'prod-2'
const M1  = 'mag-main'
const M2  = 'mag-aux'

function stan(towar_id, magazyn_id, ilosc, workspace_id = WS1) {
  return { towar_id, magazyn_id, ilosc, workspace_id }
}

function ruch(typ, towar_id, ilosc, { dst = null, src = null, ws = WS1 } = {}) {
  return {
    typ,
    towar_id,
    ilosc,
    workspace_id:       ws,
    magazyn_docelowy_id: dst,
    magazyn_zrodlowy_id: src,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeReconciliation', () => {

  it('empty inputs → empty result', () => {
    expect(computeReconciliation([], [])).toHaveLength(0)
  })

  it('purchase matches stored → drift 0', () => {
    const stany = [stan(T1, M1, 45)]
    const ruchy = [ruch('purchase', T1, 45, { dst: M1 })]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.stored).toBe(45)
    expect(row.expected).toBe(45)
    expect(row.drift).toBe(0)
  })

  it('invoice_purchase matches stored → drift 0', () => {
    const stany = [stan(T1, M1, 10)]
    const ruchy = [ruch('invoice_purchase', T1, 10, { dst: M1 })]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.drift).toBe(0)
  })

  it('stored > movements → negative drift (stored inflated)', () => {
    const stany = [stan(T1, M1, 45)]
    const ruchy = [ruch('purchase', T1, 40, { dst: M1 })]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.drift).toBe(-5)
  })

  it('movements > stored → positive drift (movements inflated)', () => {
    const stany = [stan(T1, M1, 40)]
    const ruchy = [ruch('purchase', T1, 45, { dst: M1 })]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.drift).toBe(5)
  })

  it('no movements for a balance entry → expected 0, drift = -stored', () => {
    const stany = [stan(T1, M1, 30)]
    const [row] = computeReconciliation(stany, [])
    expect(row.expected).toBe(0)
    expect(row.drift).toBe(-30)
  })

  it('issue reduces expected balance', () => {
    const stany = [stan(T1, M1, 30)]
    const ruchy = [
      ruch('purchase', T1, 50, { dst: M1 }),
      ruch('issue',    T1, 20, { src: M1 }),
    ]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.expected).toBe(30)
    expect(row.drift).toBe(0)
  })

  it('correction_plus adds to expected', () => {
    const stany = [stan(T1, M1, 55)]
    const ruchy = [
      ruch('purchase',         T1, 50, { dst: M1 }),
      ruch('correction_plus',  T1,  5, { dst: M1 }),
    ]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.expected).toBe(55)
    expect(row.drift).toBe(0)
  })

  it('correction_minus subtracts from expected (stored as abs value on docelowy)', () => {
    const stany = [stan(T1, M1, 45)]
    const ruchy = [
      ruch('purchase',          T1, 50, { dst: M1 }),
      ruch('correction_minus',  T1,  5, { dst: M1 }),
    ]
    const [row] = computeReconciliation(stany, ruchy)
    expect(row.expected).toBe(45)
    expect(row.drift).toBe(0)
  })

  it('transfer: source loses qty, destination gains qty', () => {
    // 40 purchased into M1; 10 transferred M1→M2
    // Expected M1=30, M2=10
    const stany = [
      stan(T1, M1, 30),
      stan(T1, M2, 10),
    ]
    const ruchy = [
      ruch('purchase',  T1, 40, { dst: M1 }),
      ruch('transfer',  T1, 10, { src: M1, dst: M2 }),
    ]
    const rows = computeReconciliation(stany, ruchy)
    const r1 = rows.find(r => r.magazyn_id === M1)
    const r2 = rows.find(r => r.magazyn_id === M2)
    expect(r1.expected).toBe(30)
    expect(r2.expected).toBe(10)
    expect(r1.drift).toBe(0)
    expect(r2.drift).toBe(0)
  })

  it('transfer detects mismatch when stored does not match movements', () => {
    // Movements: 40 in M1, 10 transferred to M2 → expected M1=30, M2=10
    // But stany says M2=20 → drift on M2 = 10-20 = -10
    const stany = [
      stan(T1, M1, 30),
      stan(T1, M2, 20),
    ]
    const ruchy = [
      ruch('purchase',  T1, 40, { dst: M1 }),
      ruch('transfer',  T1, 10, { src: M1, dst: M2 }),
    ]
    const rows = computeReconciliation(stany, ruchy)
    const r2 = rows.find(r => r.magazyn_id === M2)
    expect(r2.drift).toBe(-10)
  })

  it('multiple products and warehouses are independent', () => {
    const stany = [
      stan(T1, M1, 10),
      stan(T2, M1, 20),
      stan(T1, M2,  5),
    ]
    const ruchy = [
      ruch('purchase', T1, 10, { dst: M1 }),
      ruch('purchase', T2, 20, { dst: M1 }),
      ruch('purchase', T1,  5, { dst: M2 }),
    ]
    const rows = computeReconciliation(stany, ruchy)
    expect(rows).toHaveLength(3)
    expect(rows.every(r => r.drift === 0)).toBe(true)
  })

  it('workspace isolation: ruchy from another workspace do not affect WS1 balance', () => {
    const stany = [stan(T1, M1, 45, WS1)]
    const ruchy = [
      ruch('purchase', T1, 45, { dst: M1, ws: WS1 }),
      ruch('purchase', T1, 99, { dst: M1, ws: WS2 }), // different workspace
    ]
    const [row] = computeReconciliation(stany, ruchy)
    // WS2 ruch maps to key T1:M1:WS2 — does not touch T1:M1:WS1
    expect(row.drift).toBe(0)
  })

  it('seed scenario: directly-seeded balance with no movements → full drift', () => {
    // Mirrors staging_seed.sql which inserts stany directly without any ruchy.
    // Every seeded row should report drift = -stored (expected=0, no movements exist).
    const seedStany = [
      stan(T1, M1, 45),
      stan(T2, M1, 80),
      stan(T1, M2, 12),
    ]
    const rows = computeReconciliation(seedStany, [])
    expect(rows).toHaveLength(3)
    expect(rows.every(r => r.expected === 0)).toBe(true)
    expect(rows.every(r => r.drift === -r.stored)).toBe(true)
  })

  it('seed scenario: balance seeded + approved invoice movements → drift 0', () => {
    // After zatwierdźFakturę runs (for fak2): prod1+4 and prod2+5 appear as invoice_purchase.
    // The stany row would then reflect those additions.
    const stany = [
      stan(T1, M1, 4),
      stan(T2, M1, 5),
    ]
    const ruchy = [
      ruch('invoice_purchase', T1, 4, { dst: M1 }),
      ruch('invoice_purchase', T2, 5, { dst: M1 }),
    ]
    const rows = computeReconciliation(stany, ruchy)
    expect(rows.every(r => r.drift === 0)).toBe(true)
  })

  it('unknown movement type is skipped without error', () => {
    const stany = [stan(T1, M1, 45)]
    const ruchy = [
      ruch('purchase',      T1, 45, { dst: M1 }),
      ruch('future_type',   T1, 10, { dst: M1 }), // unknown type
    ]
    const [row] = computeReconciliation(stany, ruchy)
    // unknown type is ignored → expected stays 45
    expect(row.expected).toBe(45)
    expect(row.drift).toBe(0)
  })

})

// ── fetchAndReconcile (mock Supabase) ──────────────────────────────────────────
//
// fetchAndReconcile(supabase, workspaceId) fetches from the DB and calls
// computeReconciliation.  It must filter reversed_at IS NULL so that
// soft-marked reversals (cofnijDoRoboczej) are excluded from expected balance.

function makeSupa({ stany, ruchy }) {
  return {
    from(table) {
      if (table === 'stany_magazynowe') {
        return {
          select: () => ({ eq: () => Promise.resolve({ data: stany, error: null }) }),
        }
      }
      if (table === 'ruchy_magazynowe') {
        // chain: .select().eq().is('reversed_at', null)
        return {
          select: () => ({
            eq: () => ({
              is: () => Promise.resolve({ data: ruchy, error: null }),
            }),
          }),
        }
      }
      return {}
    },
  }
}

describe('fetchAndReconcile', () => {

  it('returns no mismatches when movements fully account for stored balance', async () => {
    const stany = [{ towar_id: T1, magazyn_id: M1, ilosc: 45, workspace_id: WS1 }]
    const ruchy = [{
      towar_id: T1, magazyn_docelowy_id: M1, magazyn_zrodlowy_id: null,
      ilosc: 45, typ: 'purchase', workspace_id: WS1,
    }]
    const { rows, mismatches, error } = await fetchAndReconcile(makeSupa({ stany, ruchy }), WS1)
    expect(error).toBeNull()
    expect(rows).toHaveLength(1)
    expect(mismatches).toHaveLength(0)
  })

  it('returns mismatch when stored exceeds movements (stored inflated)', async () => {
    const stany = [{ towar_id: T1, magazyn_id: M1, ilosc: 50, workspace_id: WS1 }]
    const ruchy = [{
      towar_id: T1, magazyn_docelowy_id: M1, magazyn_zrodlowy_id: null,
      ilosc: 45, typ: 'purchase', workspace_id: WS1,
    }]
    const { mismatches } = await fetchAndReconcile(makeSupa({ stany, ruchy }), WS1)
    expect(mismatches).toHaveLength(1)
    expect(mismatches[0].drift).toBe(-5) // expected 45, stored 50
  })

  it('propagates Supabase error from stany_magazynowe', async () => {
    const errSupa = {
      from(table) {
        if (table === 'stany_magazynowe') {
          return { select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'DB error' } }) }) }
        }
        return { select: () => ({ eq: () => ({ is: () => Promise.resolve({ data: [], error: null }) }) }) }
      },
    }
    const { error } = await fetchAndReconcile(errSupa, WS1)
    expect(error).toBe('DB error')
  })

})

// ── Invariant guard ────────────────────────────────────────────────────────────
//
// THE CORE ASSERTION: for every (towar, magazyn, workspace) row in
// stany_magazynowe, drift must be 0 when the system is consistent.
//
// How to run this invariant against real staging data (read-only, no writes):
//
//   import { fetchAndReconcile } from './inventoryReconciliation'
//   import { createClient } from '@supabase/supabase-js'
//
//   const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
//   const { mismatches, error } = await fetchAndReconcile(supa, '<workspace-uuid>')
//   console.table(mismatches)   // non-empty → drift exists; inspect before P8-P15
//
// Alternatively run docs/db-snapshot/08_inventory_reconciliation.sql in the
// Supabase SQL Editor (staging first) for a workspace-scoped view.

describe('Invariant guard — balance === sum(non-reversed movements)', () => {

  it('[GUARD] clean workspace: all balances fully explained by movements → no drift', () => {
    const stany = [
      stan(T1, M1, 45),
      stan(T2, M1, 80),
      stan(T1, M2, 12),
      stan(T2, M2, 30),
    ]
    const ruchy = [
      ruch('purchase', T1, 45, { dst: M1 }),
      ruch('purchase', T2, 80, { dst: M1 }),
      ruch('purchase', T1, 12, { dst: M2 }),
      ruch('purchase', T2, 30, { dst: M2 }),
    ]
    const rows       = computeReconciliation(stany, ruchy)
    const mismatches = rows.filter(r => Math.abs(r.drift) > 0.001)
    expect(mismatches).toHaveLength(0) // ← the invariant assertion
  })

  it('[GUARD] multi-type scenario: purchases + issue + transfer + corrections → no drift', () => {
    // Mirrors the typical movement mix expected after P8-P15
    const stany = [
      stan(T1, M1, 30),  // 50 purchase − 10 issue − 10 transfer_out
      stan(T1, M2, 10),  // 10 transfer_in
      stan(T2, M1, 55),  // 50 purchase + 5 correction_plus
    ]
    const ruchy = [
      ruch('purchase',         T1, 50, { dst: M1 }),
      ruch('issue',            T1, 10, { src: M1 }),
      ruch('transfer',         T1, 10, { src: M1, dst: M2 }),
      ruch('purchase',         T2, 50, { dst: M1 }),
      ruch('correction_plus',  T2,  5, { dst: M1 }),
    ]
    const mismatches = computeReconciliation(stany, ruchy).filter(r => Math.abs(r.drift) > 0.001)
    expect(mismatches).toHaveLength(0) // ← the invariant assertion
  })

  it('[GUARD] correction_minus is correctly excluded from balance', () => {
    // 50 purchased, 3 written off via correction_minus → stored = 47
    const stany = [stan(T1, M1, 47)]
    const ruchy = [
      ruch('purchase',          T1, 50, { dst: M1 }),
      ruch('correction_minus',  T1,  3, { dst: M1 }),
    ]
    const mismatches = computeReconciliation(stany, ruchy).filter(r => Math.abs(r.drift) > 0.001)
    expect(mismatches).toHaveLength(0)
  })

  // ── Baseline: documents KNOWN drift from seed data ────────────────────────
  //
  // staging_seed.sql inserts stany_magazynowe rows directly (no matching ruchy).
  // After a plain seed run the invariant WILL fail.  This test documents the
  // exact baseline mismatch so it is visible before P8-P15.
  //
  // Baseline drift (staging_seed.sql Alpha workspace):
  //   prod1/mag-main: stored=45, expected=0, drift=-45
  //   prod2/mag-main: stored=80, expected=0, drift=-80
  //   prod3/mag-main: stored=18, expected=0, drift=-18
  //   prod1/mag-aux:  stored=12, expected=0, drift=-12
  //   prod2/mag-aux:  stored=30, expected=0, drift=-30
  //   Total abs drift: 185
  //
  // Root cause: non-atomic seed; stany written without corresponding ruchy.
  // Fix: seed ruchy to match stany, OR reset stany to 0 and re-enter via
  //      dodajStan / zatwierdźFakturę so ruchy are created atomically.

  it('[BASELINE] staging_seed: every seeded balance has drift = -stored (no movements)', () => {
    const seedStany = [
      stan('prod-1', 'mag-main', 45),
      stan('prod-2', 'mag-main', 80),
      stan('prod-3', 'mag-main', 18),
      stan('prod-1', 'mag-aux',  12),
      stan('prod-2', 'mag-aux',  30),
    ]
    const rows       = computeReconciliation(seedStany, []) // no movements in staging seed
    const mismatches = rows.filter(r => Math.abs(r.drift) > 0.001)

    // ALL rows drift — this is the pre-P8 baseline
    expect(mismatches).toHaveLength(5)
    expect(mismatches.every(r => r.drift === -r.stored)).toBe(true)
    expect(mismatches.every(r => r.expected === 0)).toBe(true)

    const totalAbsDrift = mismatches.reduce((s, r) => s + Math.abs(r.drift), 0)
    expect(totalAbsDrift).toBe(185) // 45+80+18+12+30
  })

})
