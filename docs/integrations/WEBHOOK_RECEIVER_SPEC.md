# Webhook Receiver — Technical Specification

> **Status:** Specification. No production deployment. No secrets in this file.

---

## 1. Recommended Transport

| Option | Recommended for | Notes |
|---|---|---|
| **Cloudflare Worker** | Primary receiver | Consistent with Cloudflare Pages deploy; low latency; no cold start |
| **Supabase Edge Function** | Fallback / auth-sensitive actions | Use when `auth.uid()` context or direct RPC is needed |

The Worker receives the webhook, verifies the signature, writes the raw event to `webhook_events`, then calls the Supabase RPC / REST API to persist results. It does **not** run long background work — it queues and returns 2xx within 5 s.

---

## 2. Request Flow

```
External System
      │  POST /webhook/sync
      │  Headers: X-Magzic-Signature, Content-Type: application/json
      ▼
┌─────────────────────────────────────────────┐
│ Cloudflare Worker: webhook-receiver          │
│                                             │
│ 1. Read raw body (text)                     │
│ 2. Verify HMAC-SHA256 signature             │
│    → 401 if invalid                         │
│ 3. Parse JSON, extract event_id + event_type│
│ 4. Check webhook_events for event_id        │
│    → 202 "already processed" if exists      │
│ 5. INSERT webhook_events (status=received)  │
│ 6. routeSyncEvent(event) → { command, data }│
│ 7. Execute command via Supabase REST/RPC    │
│ 8. UPDATE webhook_events (status=processed) │
│ 9. Return 200 OK                            │
└─────────────────────────────────────────────┘
      │
      ▼
  Supabase (reservations_external, zlecenia, …)
```

---

## 3. Security

| Concern | Implementation |
|---|---|
| **Signature** | `X-Magzic-Signature: sha256=<hex>` header. HMAC-SHA256 of the **raw body bytes** (not parsed JSON). |
| **Secret storage** | Secret stored in Cloudflare Worker environment variable (not in repo). `integrations.secret_ref` holds only the reference name. |
| **workspace_id isolation** | Every DB write includes `workspace_id` derived from the `integrations` row matched by `source`. Never trust `workspace_id` from the payload. |
| **No service-role in client** | Worker uses a scoped Supabase API key with only INSERT/UPDATE on `webhook_events` and the specific tables needed. Never passes the Supabase service role key to client-side code. |
| **Input validation** | Worker validates `event_type` is in the allowed set before calling `routeSyncEvent`. Unexpected types are logged and return 400. |

---

## 4. Retry & Backoff

The external system must implement exponential backoff on non-2xx responses. The receiver:
- Returns **200** when processing succeeded.
- Returns **202** when `event_id` was already seen (idempotent re-delivery).
- Returns **400** for invalid payload shape or unknown `event_type`.
- Returns **401** for bad signature.
- Returns **500** only for unexpected errors — external system should retry with backoff (1 s → 2 s → 4 s → 8 s → give up after 5 attempts).

---

## 5. Worker Interface (pseudo-code, no real deploy)

```js
// src/worker/webhook-receiver.js (Cloudflare Worker, NOT deployed)

import { routeSyncEvent } from '../domain/eventRouter.js'

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

    const rawBody = await request.text()
    const signature = request.headers.get('X-Magzic-Signature') ?? ''

    // 1. Verify HMAC
    const secret = env.WEBHOOK_SECRET  // per-integration secret from CF env
    const expected = 'sha256=' + (await hmacSha256Hex(secret, rawBody))
    if (!timingSafeEqual(expected, signature)) {
      return new Response('Unauthorized', { status: 401 })
    }

    // 2. Parse
    let event
    try { event = JSON.parse(rawBody) } catch {
      return new Response('Bad Request', { status: 400 })
    }

    const ALLOWED_TYPES = [
      'reservation.created', 'reservation.updated', 'reservation.cancelled',
      'stay.checkout', 'stay.checkin',
    ]
    if (!ALLOWED_TYPES.includes(event.event_type)) {
      return new Response('Unknown event_type', { status: 400 })
    }

    // 3. Idempotency check + write raw event
    const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
    const { error: insertErr } = await db.from('webhook_events').insert({
      event_id: event.event_id,
      event_type: event.event_type,
      payload: event.payload,
      received_at: new Date().toISOString(),
      status: 'received',
      workspace_id: env.WORKSPACE_ID,  // resolved from integrations table by source
    })
    if (insertErr?.code === '23505') {
      // unique violation → already processed
      return new Response('Already processed', { status: 202 })
    }
    if (insertErr) return new Response('DB error', { status: 500 })

    // 4. Route and execute
    try {
      const { command, normalizedPayload } = routeSyncEvent(event)
      await executeCommand(command, normalizedPayload, db, env)

      await db.from('webhook_events')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('event_id', event.event_id)

      return new Response('OK', { status: 200 })
    } catch (err) {
      await db.from('webhook_events')
        .update({ status: 'failed' })
        .eq('event_id', event.event_id)
      console.error('Webhook processing error:', err)
      return new Response('Internal error', { status: 500 })
    }
  }
}
```

> **Note:** `createSupabaseClient`, `hmacSha256Hex`, `timingSafeEqual`, and `executeCommand` are not included here. They will be implemented when the Worker is deployed. This pseudo-code documents the intended structure only.

---

## 6. Event Ordering Guarantee

The receiver writes events with `received_at` timestamp. Processing must compare `occurred_at` from the payload before applying state changes. Example: if a `reservation.updated` arrives before its `reservation.created` (out-of-order delivery), the handler should upsert the reservation row using `occurred_at` as the conflict resolution key — the latest `occurred_at` wins.
