# Idempotency Key Contract — Inventory Operations

**Scope:** `receive_stock` (P8), `issue_stock` (P9), `correct_stock` (P10), `transfer_stock` (P11)  
**Date:** 2026-06-14

---

## What the idempotency key does

Each of the four atomic inventory RPCs accepts an optional `p_idempotency_key TEXT` parameter. When a non-NULL key is supplied:

1. The RPC checks whether any row in `ruchy_magazynowe` already has that key in the same workspace.
2. If found → returns `{ "success": true, "idempotent": true }` immediately, without inserting a new movement or updating any balance.
3. If not found → proceeds normally, inserts the movement with the key stored, updates the balance, and returns `{ "success": true, "idempotent": false, ... }`.

The DB enforces uniqueness via a **partial unique index** (P8):
```sql
CREATE UNIQUE INDEX idx_ruchy_idempotency_key
  ON public.ruchy_magazynowe (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

This index is the single, shared enforcement mechanism for all four operations.

---

## Key contract: callers must supply unique keys

### Scope
The key is scoped to **(workspace_id, idempotency_key)** — not to the operation type.  
**If two different operations share the same key within the same workspace, the second operation will silently return `idempotent: true` without executing.**

### Required uniqueness format

```
<operation>-<external-reference>-<sequence>
```

| Operation | Example key |
|---|---|
| receive | `receive-po-2026-Q2-001-line-3` |
| issue | `issue-dispatch-order-78-line-1` |
| correction_plus | `correction-plus-audit-2026-06-01-003` |
| correction_minus | `correction-minus-audit-2026-06-01-004` |
| transfer | `transfer-relocation-2026-05-warehouse-A-B` |

Keys from different tenants never conflict because the index includes `workspace_id`.

### When to omit the key
Omit the key (pass `null`) only for fire-and-forget operations where duplicate detection is not needed (e.g. manual one-off UI actions without a retry path). In that case the RPC acts as before, without idempotency protection.

---

## How the JS client layer exposes it

| JS function | RPC called | Idempotency key param |
|---|---|---|
| `dodajStan(towarId, magazynId, ilosc, powod, fakturaId, workspaceId, idempotencyKey)` | `receive_stock` | 7th argument (optional, default `null`) |
| `issueStock({ ..., idempotencyKey })` | `issue_stock` | named field (optional, default `null`) |
| `correctStock({ ..., idempotencyKey })` | `correct_stock` | named field (optional, default `null`) |
| `transferStock({ ..., idempotencyKey })` | `transfer_stock` | named field (optional, default `null`) |
| `wydajStan(towarId, magazynId, ilosc, powod, workspaceId)` | `issue_stock` via `issueStock` | not exposed (legacy façade — use `issueStock` for key support) |
| `transferujStan(towarId, src, dst, ilosc, powod, workspaceId)` | `transfer_stock` via `transferStock` | not exposed (legacy façade — use `transferStock` for key support) |

---

## Client-side response contract

Every successful call returns at minimum:

```js
{ success: true, idempotent: boolean }
```

| Field | Meaning |
|---|---|
| `success: true` | Operation applied (or was already applied). |
| `idempotent: false` | Movement was inserted; balance was recomputed and returned. |
| `idempotent: true` | Key already seen in this workspace; no movement inserted. `newBalance` / `srcNewBalance` / `dstNewBalance` are `null`. |

On failure:

```js
{ success: false, error: string, available?: number }
```

`available` is present when the operation was rejected by the non-negative guard, so the caller can display "available: N".

---

## Retry pattern

```js
const key = `issue-${orderId}-line-${lineNum}`

let result = await issueStock({ towarId, magazynId, ilosc, workspaceId, idempotencyKey: key })

if (!result.success && isTransportError(result.error)) {
  // Safe to retry: if the DB committed before the timeout, the retry returns
  // idempotent:true; if not, it proceeds normally.
  result = await issueStock({ towarId, magazynId, ilosc, workspaceId, idempotencyKey: key })
}
```

Both outcomes (`idempotent: true` and `idempotent: false`) are considered success — the desired state (stock moved) was achieved.

---

## What is NOT idempotent

| Operation | Status |
|---|---|
| `zatwierdźFakturę` (invoice approval) | **NOT idempotent** — no RPC yet; see next milestone |
| `cofnijDoRoboczej` (revert to draft) | **NOT idempotent** — marks movements reversed; safe to call once |
| `korektaStan` (legacy correction façade) | **NOT idempotent** — set-to-absolute-balance semantics; use `correctStock` for idempotency |

---

## DB-level concurrency guarantees

All four RPCs use `FOR UPDATE` on the relevant `stany_magazynowe` balance row(s) before inserting a movement. This serializes concurrent writes on the same `(towar_id, magazyn_id)` pair:

- **P8/P9/P10** (receive/issue/correction): single balance row locked.
- **P11** (transfer): two balance rows locked in **canonical UUID order** (lower UUID first) to prevent deadlocks between concurrent transfers on the same pair in opposite directions.

After the lock, the balance is **recomputed from the full movement log** rather than incremented in place, so balance = sum(non-reversed movements) is guaranteed at every commit boundary.

---

## Invariant status after P8-P11

| Invariant | Status after P8-P11 |
|---|---|
| INV-03: Same key → no duplicate | **FIXED** for receive/issue/correct/transfer |
| INV-04: Transfer is all-or-nothing | **FIXED** — both movements in one PL/pgSQL transaction |
| INV-06: Balance ≥ 0 (non-negative guard) | **FIXED** at DB layer (serialized by FOR UPDATE) |
| INV-11: Retry → no double receipt | **FIXED** for operations that supply an idempotency key |

Invoice approval (INV-02, INV-11 for `zatwierdźFakturę`) remains to be addressed in the next milestone.
