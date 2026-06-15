-- ============================================================
-- NIE URUCHAMIAĆ NA PRODUKCJI AUTOMATYCZNIE.
-- Zastosować ręcznie w Supabase SQL Editor po przeglądzie.
-- Reviewed by: <reviewer> on <date>
-- ============================================================
-- Sync Foundation Migration
-- Creates tables for external reservation sync without touching
-- any existing application tables or flows.
-- ============================================================

-- ── UP ──────────────────────────────────────────────────────

-- 1. integrations — configured external sources
CREATE TABLE IF NOT EXISTS integrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source        text NOT NULL,                -- e.g. 'pms_x', 'booking'
  name          text NOT NULL,                -- human-readable
  secret_ref    text NOT NULL,                -- reference to secret manager key (not the secret itself)
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, source)
);

ENABLE ROW LEVEL SECURITY ON integrations;

CREATE POLICY "integrations_owner_all" ON integrations
  FOR ALL USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_integrations_workspace ON integrations (workspace_id);


-- 2. apartment_external_map — external_apartment_id → internal ref (nullable until apartments V2)
CREATE TABLE IF NOT EXISTS apartment_external_map (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  integration_id         uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  external_apartment_id  text NOT NULL,
  apartment_label        text,               -- label from external system (informational)
  internal_ref           uuid,               -- nullable until apartments table exists
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, integration_id, external_apartment_id)
);

ENABLE ROW LEVEL SECURITY ON apartment_external_map;

CREATE POLICY "apartment_external_map_owner_all" ON apartment_external_map
  FOR ALL USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_apt_ext_map_workspace ON apartment_external_map (workspace_id);
CREATE INDEX IF NOT EXISTS idx_apt_ext_map_external   ON apartment_external_map (workspace_id, external_apartment_id);


-- 3. reservations_external — normalized inbound reservations
CREATE TABLE IF NOT EXISTS reservations_external (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  integration_id           uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  external_reservation_id  text NOT NULL,
  external_apartment_id    text NOT NULL,
  checkout_at              timestamptz,
  next_checkin_at          timestamptz,
  guests_count             integer NOT NULL DEFAULT 1 CHECK (guests_count >= 0),
  flags                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes                    text,
  status                   text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'cancelled', 'completed')),
  raw                      jsonb,             -- original payload for audit/debugging
  received_at              timestamptz NOT NULL DEFAULT now(),
  occurred_at              timestamptz,       -- from payload, for ordering
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, integration_id, external_reservation_id)
);

ENABLE ROW LEVEL SECURITY ON reservations_external;

CREATE POLICY "reservations_external_owner_all" ON reservations_external
  FOR ALL USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_res_ext_workspace          ON reservations_external (workspace_id);
CREATE INDEX IF NOT EXISTS idx_res_ext_apartment          ON reservations_external (workspace_id, external_apartment_id);
CREATE INDEX IF NOT EXISTS idx_res_ext_next_checkin       ON reservations_external (workspace_id, next_checkin_at);


-- 4. webhook_events — event log with idempotency key
CREATE TABLE IF NOT EXISTS webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_id     text NOT NULL,               -- UNIQUE idempotency key from external system
  event_type   text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status       text NOT NULL DEFAULT 'received'
                 CHECK (status IN ('received', 'processed', 'failed', 'skipped')),
  error        text,                        -- error message if status = 'failed'

  UNIQUE (event_id)                         -- global idempotency across all workspaces
);

ENABLE ROW LEVEL SECURITY ON webhook_events;

CREATE POLICY "webhook_events_owner_select" ON webhook_events
  FOR SELECT USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_user_id = auth.uid()
    )
  );

-- INSERT is done by the webhook receiver with a service-role-equivalent scoped key,
-- not by the end user — so only SELECT is exposed via RLS.

CREATE INDEX IF NOT EXISTS idx_webhook_events_workspace   ON webhook_events (workspace_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id    ON webhook_events (event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status      ON webhook_events (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON webhook_events (workspace_id, received_at DESC);


-- ── ROLLBACK / FORWARD-FIX ──────────────────────────────────
-- Run these in reverse order to undo the UP section.

-- DROP INDEX IF EXISTS idx_webhook_events_received_at;
-- DROP INDEX IF EXISTS idx_webhook_events_status;
-- DROP INDEX IF EXISTS idx_webhook_events_event_id;
-- DROP INDEX IF EXISTS idx_webhook_events_workspace;
-- DROP TABLE IF EXISTS webhook_events;

-- DROP INDEX IF EXISTS idx_res_ext_next_checkin;
-- DROP INDEX IF EXISTS idx_res_ext_apartment;
-- DROP INDEX IF EXISTS idx_res_ext_workspace;
-- DROP TABLE IF EXISTS reservations_external;

-- DROP INDEX IF EXISTS idx_apt_ext_map_external;
-- DROP INDEX IF EXISTS idx_apt_ext_map_workspace;
-- DROP TABLE IF EXISTS apartment_external_map;

-- DROP INDEX IF EXISTS idx_integrations_workspace;
-- DROP TABLE IF EXISTS integrations;
