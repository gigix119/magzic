# Inventory Mutation Audit — Invariant Specification

**Date:** 2026-06-14  
**Scope:** Read-only analysis. No code was changed.  
**Live schema results:** NOT available (db-snapshot queries exist but results were never pasted).  
All DB-layer claims below are therefore INFERRED from migrations unless marked VERIFIED-REPO.

---

## 1. How balances are produced today

### Storage model

Two tables carry the inventory state (VERIFIED-REPO — `migrations/_deprecated/supabase_migration.sql`):

| Table | Role |
|---|---|
| `stany_magazynowe` | Current stock level per `(towar_id, magazyn_id)` pair. One row = one balance. |
| `ruchy_magazynowe` | Append-style movement log. One row per event (purchase, issue, transfer, correction, invoice). |

The unique constraint `stany_magazynowe_towar_id_magazyn_id_key (towar_id, magazyn_id)` is added by
migration and is required by the `ON CONFLICT` upserts in the application
(`migrations/_deprecated/supabase_migration.sql` lines 39–49). VERIFIED-REPO.

### Balance update strategy

**Balances are written directly, not derived from movements.** Every mutation path
reads the current `stany_magazynowe.ilosc`, computes the new value in application
code, and writes it back. The movement record is inserted afterwards as an audit
entry. There is no database trigger that recomputes a balance from the movement
log. VERIFIED-REPO — `src/utils/magazyn.js`.

Because of this, balances **cannot be reliably reconstructed** from movements alone:
- `cofnijDoRoboczej` **deletes** movement rows (`ruchy_magazynowe.delete().eq('faktura_id', ...)`,
  line 337 of `magazyn.js`) before reverting the balance. After reversal, no movement
  records remain for that invoice.
- `deleteDraftInvoiceWithOrphanMovements` (`invoiceDeleteLogic.js` lines 171–207)
  deletes orphaned movements without reverting stock at all (design decision:
  "goods in warehouse, invoice gone"). This leaves a balance increase with no
  corresponding movement.
- Initial stock is loaded via direct SQL inserts / seed scripts without any
  `ruchy_magazynowe` rows.

### All mutation paths (VERIFIED-REPO — `src/utils/magazyn.js`)

| Function | Trigger | Balance delta | Movement type | Negative-stock guard |
|---|---|---|---|---|
| `dodajStan` | Manual receive (UI) | `+ilosc` | `purchase` | None needed (always adds) |
| `wydajStan` | Manual issue (UI), `wykonajPakiet` | `-ilosc` | `issue` | ✓ aborts if `current.ilosc < ilosc` |
| `transferujStan` | Manual transfer (UI) | source `-ilosc`, dest `+ilosc` | `transfer` | ✓ source check; dest always increases |
| `korektaStan` | Manual correction (UI) | set to `nowaIlosc` directly | `correction_plus` or `correction_minus` | ✓ rejects `nowaIlosc < 0` |
| `zatwierdźFakturę` | Invoice approval (Faktury.jsx) | `+ilosc` per position | `invoice_purchase` | ✗ no guard (purchase always adds) |
| `cofnijDoRoboczej` | Revert to draft (Faktury.jsx, invoiceDeleteLogic) | `-ilosc` per position, clamped to 0 | **none — deletes originals** | ✓ `Math.max(0, ...)` |
| `deleteDraftInvoiceWithOrphanMovements` | Cleanup failed approval (invoiceDeleteLogic) | **no balance change** | **orphan rows deleted** | N/A |
| `wykonajPakiet` | Cleaning kit execution | `-ilosc` per element (via `wydajStan`) | `issue` | ✓ (via `wydajStan`) |

`zatwierdźFakturę` filters eligible positions: must have `towar_id`, a warehouse
(`poz.magazyn_id || faktura.magazyn_id`), `cena_netto > 0`, and `ilosc > 0`.
Lines without `towar_id` are collected in `pozycjePoziome` and silently skipped
(no movement, no balance change). VERIFIED-REPO lines 231–237.

### `ruchy_magazynowe` append-only status

**NOT append-only in practice.** Two paths delete rows:
1. `cofnijDoRoboczej` — deletes all movements for the reversed invoice.
2. `deleteDraftInvoiceWithOrphanMovements` — deletes movements for a draft invoice.

All other paths only INSERT. No UPDATE path on `ruchy_magazynowe` was found.
VERIFIED-REPO.

---

## 2. Invariant status

### INV-01 — Every balance change originates from a movement

**CURRENT STATUS: VIOLATED**

Evidence:
- `cofnijDoRoboczej` (lines 315–337) decrements `stany_magazynowe` then deletes
  the movement rows. After the operation: balance changed, zero movement records remain.
- `deleteDraftInvoiceWithOrphanMovements` (lines 190–195) deletes movement rows
  without reverting the balance. Balance persists; movement deleted.
- Manual paths (`dodajStan`, `wydajStan`, etc.) do write a movement record every
  time, so this invariant holds for those paths.

Testable: compare `SUM(ruchy_magazynowe.ilosc) grouped by towar_id` against
`stany_magazynowe.ilosc` — divergence confirms violation.

---

### INV-02 — An approved invoice cannot be approved twice

**CURRENT STATUS: HOLDS (app layer only) / UNVERIFIED at DB layer**

Evidence:
- `zatwierdźFakturę` (line 225): `if (faktura.status === 'zatwierdzona') return { success: false, error: 'Faktura już zatwierdzona' }`.
- This is an application-level guard, not a database constraint.
- No DB trigger or `CHECK` enforcing this was found in the migration files.
  A concurrent double-submit (two simultaneous approval requests) that both read
  `status = 'robocza'` before either writes `'zatwierdzona'` could bypass this
  check. INFERRED risk.
- No unique constraint on `(faktura_id, status)` transition was found. INFERRED.

Testable: concurrent API calls with the same `fakturaId`; verify `stany_magazynowe`
is incremented only once.

---

### INV-03 — Same idempotency key does not create a second operation

**CURRENT STATUS: VIOLATED (no idempotency keys exist)**

Evidence:
- No `idempotency_key` column found in any table schema. VERIFIED-REPO (all
  migration files searched).
- No idempotency check in any mutation function. VERIFIED-REPO — `magazyn.js`.
- A network timeout followed by a UI retry will re-submit the operation.
- Partial-success scenario for `zatwierdźFakturę`: stock is updated + movements
  inserted, but the final `faktury` status update fails → invoice stays `'robocza'`
  with orphaned movements. A user retry re-runs the whole function and doubles the
  stock and movements. `deleteDraftInvoiceWithOrphanMovements` is the manual
  cleanup for this case, but it does NOT revert the already-incremented stock.

---

### INV-04 — Transfer is all-or-nothing

**CURRENT STATUS: VIOLATED**

Evidence (VERIFIED-REPO — `magazyn.js` lines 93–138):
```
1. UPDATE stany_magazynowe (source)  — decrements source
2. UPDATE/INSERT stany_magazynowe (dest) — increments dest
3. INSERT ruchy_magazynowe
```
These are three sequential Supabase JS calls with no database transaction wrapping
them. If step 2 fails (`e2`), the function returns `{ success: false, error }` but
step 1 has already committed. Source stock is decremented; destination is unchanged.
No rollback, no compensation, no retry logic.

Testable: mock a failing step-2 response and verify source balance is decremented
without a corresponding destination increment.

---

### INV-05 — Reversal never deletes history; it creates a compensating movement

**CURRENT STATUS: VIOLATED (intentional design choice)**

Evidence (VERIFIED-REPO — `magazyn.js` line 337):
```js
await supabase.from('ruchy_magazynowe').delete().eq('faktura_id', fakturaId)
```
`cofnijDoRoboczej` erases the original movement records; no compensating entry is
inserted. This is the only reversal path for approved invoices.

`deleteDraftInvoiceWithOrphanMovements` also deletes movement rows (lines 190–195)
and inserts nothing in their place.

The comment in `invoiceDeleteLogic.js` (lines 1–11) acknowledges this: "Deliberately
NOT adding ON DELETE CASCADE … We guard at the application layer instead." The
delete-of-movements is an explicit design decision, not a bug.

---

### INV-06 — Balance is not negative unless workspace explicitly allows negative stock

**CURRENT STATUS: HOLDS (application layer) / UNVERIFIED at DB layer**

Evidence:
- `wydajStan` (line 69): aborts if `current.ilosc < ilosc`. VERIFIED-REPO.
- `transferujStan` (line 100): same guard on source warehouse. VERIFIED-REPO.
- `korektaStan` (line 143): rejects `nowaIlosc < 0`. VERIFIED-REPO.
- `cofnijDoRoboczej` (line 327): `Math.max(0, ...)` clamps result. VERIFIED-REPO.
- No "allow negative stock" setting exists in the schema or application. VERIFIED-REPO.
- The `stany_magazynowe` schema defines `ilosc numeric NOT NULL` with **no
  `CHECK (ilosc >= 0)` constraint**. INFERRED (live schema not available to confirm).
- Race condition between read and write in all manual paths (read `current.ilosc`,
  check, then write) means a concurrent pair of issues could both pass the guard
  and together drive balance negative. INFERRED risk.

---

### INV-07 — Workspace A cannot reference workspace B product/warehouse

**CURRENT STATUS: HOLDS (RLS layer) / PARTIALLY UNVERIFIED at application layer**

Evidence:
- All six business tables (`stany_magazynowe`, `ruchy_magazynowe`, `towary`,
  `magazyny`, `faktury`, `pozycje_faktury`) have RLS policies of the form:
  `workspace_id IN (SELECT id FROM workspaces WHERE owner_user_id = auth.uid())`.
  VERIFIED-REPO — `saas_migration.sql` lines 60–150.
- RLS prevents a user from reading or writing rows in another workspace via the
  Supabase JS client.
- However, within `zatwierdźFakturę` the application does not explicitly validate
  that `poz.towar_id` belongs to the same workspace as the `faktura`. It relies on
  RLS to have already filtered the positions returned by the JOIN. INFERRED as safe
  under normal Supabase flow.
- No FK constraint ties `ruchy_magazynowe.towar_id` workspace to
  `ruchy_magazynowe.workspace_id`. Cross-workspace consistency is enforced only by
  RLS, not by database FK. INFERRED.

---

### INV-08 — A service line creates no movement

**CURRENT STATUS: HOLDS**

Evidence (VERIFIED-REPO — `magazyn.js` lines 231–237):
```js
const pozycjeTowary = pozycje.filter(p =>
  p.towar_id &&
  (p.magazyn_id || faktura.magazyn_id) &&
  Number(p.cena_netto) > 0 &&
  Number(p.ilosc) > 0
)
```
Any position lacking `towar_id` is excluded from both the balance update and the
movement insert. Service lines are assumed to have no `towar_id`. VERIFIED-REPO.

---

### INV-09 — A line without a product creates no movement

**CURRENT STATUS: HOLDS**

Evidence: same filter as INV-08 (`p.towar_id &&`). VERIFIED-REPO.

---

### INV-10 — Sum of compensating movements on reversal equals the original

**CURRENT STATUS: N/A — structurally cannot be assessed**

There are no compensating movements. `cofnijDoRoboczej` deletes the originals
(see INV-05). The invariant as stated presupposes a compensating-entry architecture
that does not exist. If an ADR adopts that architecture in future, this invariant
becomes testable via: `SUM(ruchy WHERE typ='reversal') == -SUM(ruchy WHERE typ='invoice_purchase' AND faktura_id=X)`.

---

### INV-11 — Retry after timeout does not double a receipt

**CURRENT STATUS: VIOLATED**

Evidence:
- No idempotency mechanism exists (see INV-03).
- Partial-failure scenario in `zatwierdźFakturę`:
  stock written, movements inserted, but `faktury.status` update fails (line 292).
  Invoice remains `'robocza'`. Retry calls the full function again and increments
  stock a second time.
- `deleteDraftInvoiceWithOrphanMovements` is the documented recovery path but it
  deletes orphaned movements without rolling back the already-committed stock
  increment (line 164 of `invoiceDeleteLogic.js`: "the inventory counts remain
  (goods in warehouse, faktura gone)"). So even the cleanup leaves a phantom
  stock increase if the goods were never actually received.

---

## 3. Summary table

| # | Invariant | Status | Enforced at |
|---|---|---|---|
| INV-01 | Every balance change originates from a movement | **VIOLATED** | — |
| INV-02 | Approved invoice cannot be approved twice | HOLDS / race risk | App only |
| INV-03 | Same idempotency key → no duplicate | **VIOLATED** | — |
| INV-04 | Transfer is all-or-nothing | **VIOLATED** | — |
| INV-05 | Reversal creates compensating movement, no delete | **VIOLATED** | — |
| INV-06 | Balance ≥ 0 unless workspace allows negative | HOLDS / no DB check | App only |
| INV-07 | No cross-workspace references | HOLDS | RLS |
| INV-08 | Service line → no movement | HOLDS | App |
| INV-09 | Line without product → no movement | HOLDS | App |
| INV-10 | Sum of compensating = original | N/A (arch missing) | — |
| INV-11 | Retry after timeout → no double receipt | **VIOLATED** | — |

**VIOLATED (5):** INV-01, INV-03, INV-04, INV-05, INV-11  
**HOLDS (5):** INV-02 (app only), INV-06 (app only), INV-07 (RLS), INV-08, INV-09  
**N/A (1):** INV-10

---

## 4. What would need to be true to make balances reconstructable

For balances to be derivable solely from `ruchy_magazynowe`:

1. Reversal must INSERT a compensating row (e.g. `typ = 'reversal'`) instead of deleting originals.
2. An initial-balance movement (e.g. `typ = 'initial_stock'`) must be inserted for every seed row.
3. `deleteDraftInvoiceWithOrphanMovements` must either revert stock AND delete movements, or keep movements and mark them voided.
4. A DB trigger must recompute `stany_magazynowe.ilosc` from `ruchy_magazynowe` on each insert/delete (or the app must do it consistently).

None of these are present today.

---

## 5. Notes on testability

| Invariant | How to test |
|---|---|
| INV-02 (double-approve race) | Concurrent integration test: two requests to approve same faktura_id simultaneously; assert stock incremented exactly once. |
| INV-04 (transfer atomicity) | Unit test: inject error on dest-warehouse write; assert source balance is unchanged. Currently no such test exists. |
| INV-06 (negative balance) | DB-level: add `CHECK (ilosc >= 0)` to `stany_magazynowe` and run full test suite. Race condition requires load test. |
| INV-11 (double receipt) | Integration: simulate status-update failure mid-approval; retry; assert `ruchy_magazynowe` count and balance incremented only once. |
| INV-01 (movements = balance) | Reconciliation query: `SELECT towar_id, magazyn_id, SUM(CASE WHEN typ IN ('purchase','invoice_purchase','correction_plus','transfer') THEN ilosc ELSE -ilosc END)` vs `stany_magazynowe.ilosc` — divergence is the bug. Only reliable before any cofnij/correction has occurred. |

The existing test suite (`src/utils/invoiceDeleteLogic.test.js`, 40+ unit tests)
covers only the deletion/rollback orchestration layer and uses a mocked Supabase
client. It does not exercise `magazyn.js` mutation paths or the database.
