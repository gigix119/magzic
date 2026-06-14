# ADR-001 — Inventory Source of Truth

**Status:** PENDING APPROVAL  
**Date:** 2026-06-14  
**Authors:** (generated from Prompt 7b audit)  
**Depends on:** Prompt 5 (invariant audit), Prompt 6 (reconciliation), Prompt 6.5 (soft-mark)  
**Blocks:** Prompts 8–15 (warehouse operation rebuild)

---

## Context

The inventory subsystem maintains two tables:

| Table | Current role |
|-------|-------------|
| `stany_magazynowe` | One row per `(towar_id, magazyn_id)` — the stored balance |
| `ruchy_magazynowe` | Append-style movement log — one row per event |

**The invariant that must hold:**  
`stany_magazynowe.ilosc == SUM(non-reversed ruchy_magazynowe.delta)` for every `(towar_id, magazyn_id, workspace_id)`.

**Current status (VERIFIED-REPO — Prompt 5 audit):**

- Balances are written directly in application code; movements are inserted afterwards as audit entries. There is no DB trigger recomputing balances from movements.
- As a result the invariant is structurally violated by several code paths (INV-01, INV-03, INV-04, INV-05, INV-11).
- `cofnijDoRoboczej` previously deleted movement rows on reversal, destroying history. After Prompt 6.5 it now soft-marks rows with `reversed_at`, preserving them as logically voided. This is the first step toward an append-only movement log.
- Seed data (`staging_seed.sql`) inserts `stany_magazynowe` rows without any corresponding `ruchy_magazynowe` rows. The reconciliation guard test (`[BASELINE]`) confirms drift of 185 units across 5 rows for a fresh seed.
- `fetchAndReconcile()` (Prompt 6) filters `reversed_at IS NULL`, so soft-marked rows are already excluded from balance verification.

**Why decide now:**  
Prompts 8–15 will rebuild all warehouse mutation paths. The architecture chosen here determines what those prompts must produce. If we defer the decision, we risk P8–P15 implementing against a moving target.

---

## Decision Drivers

1. **No data loss** — must not destroy existing movement history or balances.
2. **No dual-history** — at any point in time there must be exactly one authoritative record for each balance.
3. **Reversibility** — the chosen option must be undoable if a later prompt reveals an unforeseen problem.
4. **Migration complexity** — the migration SQL must be auditable and safe to run against production.
5. **Reporting impact** — existing analytics queries reading from `ruchy_magazynowe` must not break.
6. **Least destructive** — given that P6.5 is already done, preference for options that build on the work already in the tree.

---

## Options

### Option A — Harden the existing movement table (no new table)

**What it means:**  
`ruchy_magazynowe` becomes the single append-only source of truth. `stany_magazynowe` becomes a cache derived from movements, updated by a DB trigger (or by each mutation function after moving to movement-first writes). No new table is introduced.

**Required changes:**

| Step | Description |
|------|-------------|
| A1 | Add `initial_stock` movement type. Insert one `ruchy_magazynowe` row per existing `stany_magazynowe` row (migration, reviewed manually). This makes the seed drift zero. |
| A2 | Replace all direct `stany_magazynowe.update(ilosc)` calls in `magazyn.js` with: (a) INSERT movement row, (b) recompute balance = `SELECT SUM(delta) FROM ruchy_magazynowe WHERE ... AND reversed_at IS NULL`. |
| A3 | Wrap steps A2(a)+A2(b) in a Postgres function (RPC) so they are atomic. |
| A4 | `cofnijDoRoboczej` already soft-marks (P6.5). After A3 the balance recompute replaces the manual decrement. |
| A5 | Add a `CHECK (ilosc >= 0)` on `stany_magazynowe` as a DB-level guard (optional but cheap). |

**Migration SQL (manual review required):**
```sql
-- A1: backfill initial_stock rows for existing balances
INSERT INTO ruchy_magazynowe
  (towar_id, magazyn_docelowy_id, ilosc, typ, workspace_id, created_at)
SELECT
  towar_id,
  magazyn_id,
  ilosc,
  'initial_stock',
  workspace_id,
  COALESCE(updated_at, now())
FROM stany_magazynowe
WHERE ilosc > 0
ON CONFLICT DO NOTHING;
```
Run on staging first; reconciliation query should return 0 drift afterwards.

**Pros:**
- No new tables → zero dual-history risk.
- Builds directly on the soft-mark already in the tree (P6.5).
- `computeReconciliation()` and `fetchAndReconcile()` from Prompt 6 remain the authoritative check and need no changes.
- Analytics queries on `ruchy_magazynowe` continue to work unchanged.
- Migration is a single INSERT (additive, safe, reversible by DELETE on `typ = 'initial_stock'`).

**Cons:**
- Every mutation path in `magazyn.js` must be rewritten (P8–P12 scope).
- Recomputing balance from movements on every mutation is slightly slower than a direct `ilosc + delta` write (negligible at current scale).
- Requires a Postgres RPC to guarantee atomicity (P8 scope).

**Data-loss risk:** LOW — migration is additive. Rollback = `DELETE FROM ruchy_magazynowe WHERE typ = 'initial_stock'`.  
**Dual-history risk:** NONE — single table is the source.  
**Migration complexity:** LOW (one INSERT, one RPC).  
**Reversibility:** HIGH (additive migration).

---

### Option B — Introduce a new ledger table

**What it means:**  
Create a new `inventory_ledger` table alongside `ruchy_magazynowe`. Migrate all existing movement rows to it. `ruchy_magazynowe` becomes read-only legacy; `inventory_ledger` becomes the source of truth.

**Required changes:**

| Step | Description |
|------|-------------|
| B1 | Create `inventory_ledger` with strict append-only constraints. |
| B2 | Migrate all rows from `ruchy_magazynowe` to `inventory_ledger`. |
| B3 | Rewrite all mutation paths to write to `inventory_ledger` instead. |
| B4 | Keep `ruchy_magazynowe` read-only for legacy reporting, or drop after verification. |

**Pros:**
- Clean schema from day one of the new design.

**Cons:**
- **Dual-history risk: HIGH.** During migration and verification, two tables contain movement data. Any query that only reads one table produces a wrong answer.
- Adds schema complexity (new table, new FK constraints, new RLS policies).
- Requires migrating all existing rows AND all code paths simultaneously — higher blast radius than Option A.
- If the migration fails mid-way, `inventory_ledger` has partial data and `ruchy_magazynowe` has stale data — no safe rollback point.
- `computeReconciliation()` would need to be updated to read from `inventory_ledger`.
- Nothing wrong with `ruchy_magazynowe` that A doesn't also fix — creating a new table solves no problem that A doesn't solve.

**Data-loss risk:** MEDIUM (migration failures can create partial state).  
**Dual-history risk:** HIGH (by design during transition).  
**Migration complexity:** HIGH.  
**Reversibility:** LOW (once code points to new table, rollback requires pointing back to old table).

**NOT RECOMMENDED.**

---

### Option C — Staged compatibility layer

**What it means:**  
Leave both tables unchanged. Introduce a view or RPC layer that provides balance reads with reconciliation assertions. Continue direct-write mutations temporarily. Plan to migrate mutation paths incrementally in P8–P15. Introduce Option A's ledger at the end of P15 once all paths are controlled.

**Required changes:**

| Step | Description |
|------|-------------|
| C1 | Create `inventory_balance_view` as `SELECT ... FROM ruchy_magazynowe GROUP BY ...` (read path only). |
| C2 | Mutations continue to write `stany_magazynowe` directly (no change). |
| C3 | Each P8–P15 prompt migrates one mutation path to movement-first, reducing direct writes incrementally. |
| C4 | At end of P15, all paths are movement-first → `stany_magazynowe` becomes a pure cache → fully consistent with Option A. |

**Pros:**
- Zero code change now.
- Each P8–P15 prompt touches only one path → minimal blast radius per prompt.

**Cons:**
- Defers the invariant violation. The guard test will continue to fail on real data until P15.
- Creates a view that diverges from the actual write path for the entire P8–P15 period.
- Requires discipline to ensure all P8–P15 prompts actually migrate their path — easy to miss one.
- "Ledger introduced later" language in this option effectively describes reaching Option A after P15, so it is Option A deferred.

**Data-loss risk:** NONE (no migration now).  
**Dual-history risk:** MEDIUM (view diverges from direct-write `stany_magazynowe` during transition).  
**Migration complexity:** VERY LOW now, MEDIUM across P8–P15.  
**Reversibility:** HIGH (nothing changes immediately).

---

## Comparison

| Criterion | Option A | Option B | Option C |
|-----------|----------|----------|----------|
| New tables | None | 1 new | None (view only) |
| Dual-history risk | None | High | Medium (transient) |
| Data-loss risk | Low | Medium | None |
| Migration complexity | Low | High | Very low (now), medium (P8–P15) |
| Reversibility | High | Low | High |
| Time to invariant satisfied | P8 (after backfill + first RPC) | P8 (after full migration) | P15 (end of series) |
| Builds on P6.5 soft-mark | Yes (directly) | Partially | Yes |
| Reporting impact | None | Queries must update | None |

---

## Recommendation: **Option A — Harden existing movement table**

**Justification:**

1. **Already on the path.** The soft-mark from P6.5 (`reversed_at`) already converts `ruchy_magazynowe` toward append-only. Option A is the direct continuation.

2. **Zero dual-history.** A single table remains the source. The reconciliation guard in `inventoryReconciliation.js` immediately starts passing on real data once the A1 backfill runs.

3. **Backfill is safe and reversible.** Adding `initial_stock` rows is additive SQL. If it causes unexpected behavior, `DELETE FROM ruchy_magazynowe WHERE typ = 'initial_stock'` restores the original state with zero side effects.

4. **Option B adds complexity for no gain.** Every benefit of B (clean schema, strict append-only, no `reversed_at` soft-marks) can be achieved within the existing table via Option A. A new table only adds migration risk.

5. **Option C just defers Option A.** Option C is described as "ledger introduced later if needed" — that later introduction is Option A. Deferring to P15 means the invariant guard test fails on real data for all 8 prompts in between.

6. **P8–P12 scope is already defined.** Each prompt will rebuild one mutation function. Option A's requirement (INSERT movement → recompute balance) maps cleanly to that structure. The Postgres RPC wrapper can be introduced in P8 and reused by P9–P12.

**What must be true before any P8 code is written:**

1. You have approved this ADR (Option A confirmed).
2. Migration SQL A1 (`initial_stock` backfill) has been reviewed.
3. You have optionally run the reconciliation query `08_inventory_reconciliation.sql` on the production read replica to know the real pre-P8 drift number.

---

## Manual Steps Required Before Implementation

### Step 1 — Run invariant guard on staging (read-only)

In the Supabase SQL Editor (staging project):
```sql
-- From docs/db-snapshot/08_inventory_reconciliation.sql
-- Filter to your workspace UUID for clarity
-- WHERE sm.workspace_id = '<alpha-workspace-uuid>'
```
Paste the result here so the baseline is recorded.

### Step 2 — Review backfill SQL

Review the A1 migration SQL above. When approved, run it on **staging first**:
```sql
-- In Supabase SQL Editor (staging only):
INSERT INTO ruchy_magazynowe
  (towar_id, magazyn_docelowy_id, ilosc, typ, workspace_id, created_at)
SELECT towar_id, magazyn_id, ilosc, 'initial_stock', workspace_id, COALESCE(updated_at, now())
FROM stany_magazynowe
WHERE ilosc > 0
ON CONFLICT DO NOTHING;
```
Then re-run the reconciliation query. Expected: all drift = 0.

### Step 3 — Approve this ADR

Mark Status as **APPROVED — Option A** and record the chosen option below.

---

## Decision Record

| Field | Value |
|-------|-------|
| Status | PENDING APPROVAL |
| Chosen option | _(fill in: A / B / C)_ |
| Approved by | _(name / date)_ |
| Notes | |

---

## Appendix — Key Invariants from Prompt 5

| # | Invariant | Current status |
|---|-----------|---------------|
| INV-01 | Every balance change originates from a movement | **VIOLATED** |
| INV-03 | Same idempotency key → no duplicate | **VIOLATED** |
| INV-04 | Transfer is all-or-nothing | **VIOLATED** |
| INV-05 | Reversal creates compensating movement, no delete | **VIOLATED** (P6.5 converted to soft-mark) |
| INV-11 | Retry after timeout → no double receipt | **VIOLATED** |

Option A resolves INV-01 and INV-05. INV-03, INV-04, INV-11 require atomic RPCs (P8–P12 scope).
