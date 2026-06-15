# Sync Event Contract — Magzic ↔ External Reservation System

> **Status:** Specification (additive, non-breaking). No live code reads/writes these events yet.
> The domain layer in `src/domain/` implements pure mapping functions ready for future wiring.

---

## 1. Inbound Webhooks — External System → Magzic

### Supported event types

| Event type | Trigger | Magzic action |
|---|---|---|
| `reservation.created` | New reservation confirmed | Optionally pre-create preparation draft |
| `reservation.updated` | Dates / guests / flags changed | Update existing preparation draft via `diffReservationUpdate` |
| `reservation.cancelled` | Reservation cancelled | Mark linked preparation as `anulowane` |
| `stay.checkout` | **Apartment freed** (checkout complete) | **Create preparation** with deadline = `next_checkin_at` |
| `stay.checkin` | Incoming guest within warning window | Alert if preparation is not `gotowe` |

---

### Common envelope (all inbound events)

```json
{
  "event_id": "evt_01HZ9ABCDEF12345",
  "event_type": "stay.checkout",
  "occurred_at": "2026-06-15T10:30:00Z",
  "source": "pms_x",
  "signature": "sha256=<HMAC-SHA256 hex>",
  "payload": { /* event-specific, see below */ }
}
```

**Fields:**

| Field | Type | Description |
|---|---|---|
| `event_id` | `string` | Globally unique — used for idempotency check (`webhook_events.event_id UNIQUE`) |
| `event_type` | `string` | One of the types listed above |
| `occurred_at` | `ISO 8601` | Event timestamp in UTC |
| `source` | `string` | Identifier of the sending system (e.g. `booking`, `pms_x`, `own_app`) |
| `signature` | `string` | HMAC-SHA256 of the raw body, key per `integrations.secret_ref` |
| `payload` | `object` | Event-specific data (see schemas below) |

---

### `reservation` object (shared across reservation.* events)

```json
{
  "external_reservation_id": "RES-2026-08823",
  "external_apartment_id": "APT-3B",
  "apartment_label": "Apartament 3B – ul. Kwiatowa 5",
  "checkout_at": "2026-06-15T10:00:00Z",
  "next_checkin_at": "2026-06-15T15:00:00Z",
  "guests_count": 3,
  "flags": {
    "pet": false,
    "child": true,
    "extra_bed": false,
    "late_checkout": false
  },
  "notes": "Gość prosi o dodatkowe ręczniki."
}
```

---

### Full example: `stay.checkout`

```json
{
  "event_id": "evt_01HZ9CKOUT00001",
  "event_type": "stay.checkout",
  "occurred_at": "2026-06-15T10:05:00Z",
  "source": "pms_x",
  "signature": "sha256=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "payload": {
    "reservation": {
      "external_reservation_id": "RES-2026-08823",
      "external_apartment_id": "APT-3B",
      "apartment_label": "Apartament 3B – ul. Kwiatowa 5",
      "checkout_at": "2026-06-15T10:00:00Z",
      "next_checkin_at": "2026-06-15T15:00:00Z",
      "guests_count": 3,
      "flags": { "pet": false, "child": true, "extra_bed": false },
      "notes": "Gość prosi o dodatkowe ręczniki."
    }
  }
}
```

---

### Event → Magzic action mapping

| Event | Steps | Available now | Needs future entity |
|---|---|---|---|
| `stay.checkout` | 1. Resolve `external_apartment_id` → internal apartment ref via `apartment_external_map` | ✅ (`apartment_external_map` table in migration) | Apartment entity (V2) |
| | 2. Build `PreparationDraft` from reservation (deadline, guests, flags) | ✅ (`buildPreparationFromReservation` in domain) | — |
| | 3. Recalculate demand from package rules | 🟡 Stub in `recalculateDemand` | Package V2 + rules |
| | 4. Write `zlecenia` row with `data_realizacji = next_checkin_at` | 🟡 Ready when Worker wired | — |
| `stay.checkin` | Alert if linked preparation is not `gotowe` | 🟡 Needs preparation ↔ reservation link | — |
| `reservation.updated` | `diffReservationUpdate` to detect deadline/guest/flag changes → update preparation | ✅ domain function ready | — |
| `reservation.cancelled` | Set preparation `status = 'anulowane'` | 🟡 Needs link | — |

---

## 2. Outbound Webhooks — Magzic → External System

### Event types

| Event type | When fired | Payload summary |
|---|---|---|
| `preparation.created` | Preparation (zlecenie) created from reservation | `preparation_id`, `external_reservation_id`, `apartment_id`, `deadline` |
| `preparation.ready` | Preparation reaches status `gotowe` (Readiness Gate) | Same as above + `completed_at` |
| `preparation.shortage` | Items missing at package execution time | `preparation_id`, `shortages: [{product, needed, available}]` |

### Example: `preparation.ready`

```json
{
  "event_id": "evt_01HZ9READY00001",
  "event_type": "preparation.ready",
  "occurred_at": "2026-06-15T14:45:00Z",
  "source": "magzic",
  "payload": {
    "preparation_id": "abc-123",
    "external_reservation_id": "RES-2026-08823",
    "external_apartment_id": "APT-3B",
    "deadline": "2026-06-15T15:00:00Z",
    "completed_at": "2026-06-15T14:45:00Z"
  }
}
```

---

## 3. Idempotency, Ordering, Retry & Signature

| Concern | Rule |
|---|---|
| **Idempotency** | `webhook_events.event_id` is UNIQUE. Re-delivery of the same `event_id` is a no-op (202 returned, `processed_at` not updated). |
| **Ordering** | Events from the same source may arrive out of order. Each handler must be idempotent and compare `occurred_at` before applying state changes. |
| **Retry** | The receiver returns 2xx immediately after writing the raw event. Processing happens async. If processing fails, the event stays in `status = 'failed'` for retry without re-receiving. |
| **Signature** | HMAC-SHA256 of the raw request body. Key is per-integration (`integrations.secret_ref` → secret manager). Reject with 401 if signature invalid. |
| **Timeout** | Receiver must respond within 5 s. |

---

## 4. Deployment Map — How to Activate Later

**Dependency order (do not skip steps):**

1. **Apartment entity (V2)** — create `apartments` table with internal IDs; populate `apartment_external_map`.
2. **Package V2 + demand rules** — extend `pakiety_sprzatania` with guest-count rules so `recalculateDemand` can compute real demand lines.
3. **Wire `src/domain/` to the Worker** — import `routeSyncEvent` + `buildPreparationFromReservation` + `recalculateDemand` into the Cloudflare Worker / Edge Function. At this point no existing flow is affected.
4. **Apply `migrations/sync_foundation_migration.sql`** manually in Supabase SQL editor (review the ROLLBACK section first).
5. **Configure integration** — add a row to `integrations` with the source name and the secret ref.
6. **Deploy Worker** — point external system's webhook URL at the Worker endpoint. Verify with a test `stay.checkout` payload.
7. **E2E test** — send a synthetic event and confirm a `zlecenia` row is created with the correct `data_realizacji`.
