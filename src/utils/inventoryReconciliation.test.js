import { describe, it, expect } from 'vitest'
import { computeReconciliation } from './inventoryReconciliation'

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
