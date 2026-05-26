-- ============================================================
-- MAGZIC Invoice Model Migration v1
-- Uruchom w: Supabase Dashboard → SQL Editor → New query
-- Bezpieczne: idempotentne, nie kasuje danych
-- Wymagane: backend_migration.sql musi być uruchomiony wcześniej
--           (dostarcza is_owner() i profiles.role)
-- ============================================================

-- === 1. invoice_model_runs ===
-- Historia uruchomień treningu modelu (grid search)

CREATE TABLE IF NOT EXISTS public.invoice_model_runs (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version              text,
  extractor_version          text,
  status                     text        NOT NULL DEFAULT 'pending'
                                         CHECK (status IN ('pending','running','completed','failed')),
  epochs                     integer,
  batch_size                 integer,
  learning_rate              numeric,
  training_examples_count    integer,
  validation_examples_count  integer,
  final_loss                 numeric,
  final_accuracy             numeric,
  metrics                    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  started_by                 uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at                 timestamptz NOT NULL DEFAULT now(),
  finished_at                timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_model_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_manage_model_runs" ON public.invoice_model_runs;
CREATE POLICY "owner_manage_model_runs" ON public.invoice_model_runs
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- === 2. invoice_extraction_logs ===
-- Logi każdej ekstrakcji faktury (per-user, widoczne dla ownera globalnie)

CREATE TABLE IF NOT EXISTS public.invoice_extraction_logs (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  invoice_id           uuid,
  file_name            text,
  supplier_name        text,
  supplier_nip         text,
  extractor_version    text,
  model_version        text,
  extraction_status    text        NOT NULL DEFAULT 'pending'
                                   CHECK (extraction_status IN ('pending','success','partial','failed','review_needed')),
  confidence_total     numeric,
  confidence_by_field  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  extracted_data       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  processing_time_ms   integer,
  error_message        text,
  metadata             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_extraction_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_extraction_logs_user_id    ON public.invoice_extraction_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_created_at ON public.invoice_extraction_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_status     ON public.invoice_extraction_logs (extraction_status);

-- User może tworzyć własne logi
DROP POLICY IF EXISTS "user_insert_own_extraction_logs" ON public.invoice_extraction_logs;
CREATE POLICY "user_insert_own_extraction_logs" ON public.invoice_extraction_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User widzi tylko własne logi
DROP POLICY IF EXISTS "user_read_own_extraction_logs" ON public.invoice_extraction_logs;
CREATE POLICY "user_read_own_extraction_logs" ON public.invoice_extraction_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Owner widzi wszystkie
DROP POLICY IF EXISTS "owner_read_all_extraction_logs" ON public.invoice_extraction_logs;
CREATE POLICY "owner_read_all_extraction_logs" ON public.invoice_extraction_logs
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- === 3. invoice_user_corrections ===
-- Korekty wprowadzone przez użytkowników (dane uczące dla modelu)

CREATE TABLE IF NOT EXISTS public.invoice_user_corrections (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  invoice_id         uuid,
  extraction_log_id  uuid        REFERENCES public.invoice_extraction_logs(id) ON DELETE SET NULL,
  field_key          text,
  original_value     text,
  corrected_value    text,
  original_data      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  corrected_data     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  correction_status  text        NOT NULL DEFAULT 'pending'
                                 CHECK (correction_status IN ('pending','approved','rejected','used_for_training')),
  used_for_training  boolean     NOT NULL DEFAULT false,
  reviewed_by        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_user_corrections ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_corrections_user_id    ON public.invoice_user_corrections (user_id);
CREATE INDEX IF NOT EXISTS idx_corrections_status     ON public.invoice_user_corrections (correction_status);
CREATE INDEX IF NOT EXISTS idx_corrections_created_at ON public.invoice_user_corrections (created_at DESC);

-- User może tworzyć własne korekty
DROP POLICY IF EXISTS "user_insert_own_corrections" ON public.invoice_user_corrections;
CREATE POLICY "user_insert_own_corrections" ON public.invoice_user_corrections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User widzi tylko własne korekty
DROP POLICY IF EXISTS "user_read_own_corrections" ON public.invoice_user_corrections;
CREATE POLICY "user_read_own_corrections" ON public.invoice_user_corrections
  FOR SELECT USING (auth.uid() = user_id);

-- Owner zarządza wszystkimi
DROP POLICY IF EXISTS "owner_manage_corrections" ON public.invoice_user_corrections;
CREATE POLICY "owner_manage_corrections" ON public.invoice_user_corrections
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- === 4. invoice_model_review_queue ===
-- Kolejka przypadków do ręcznego przeglądu przez ownera

CREATE TABLE IF NOT EXISTS public.invoice_model_review_queue (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_log_id  uuid        REFERENCES public.invoice_extraction_logs(id) ON DELETE CASCADE,
  user_correction_id uuid        REFERENCES public.invoice_user_corrections(id) ON DELETE SET NULL,
  reason             text        NOT NULL,
  priority           text        NOT NULL DEFAULT 'normal'
                                 CHECK (priority IN ('low','normal','high','critical')),
  status             text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','in_review','resolved','dismissed')),
  assigned_to        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_model_review_queue ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_review_queue_status   ON public.invoice_model_review_queue (status);
CREATE INDEX IF NOT EXISTS idx_review_queue_priority ON public.invoice_model_review_queue (priority);

-- Tylko owner zarządza kolejką
DROP POLICY IF EXISTS "owner_manage_review_queue" ON public.invoice_model_review_queue;
CREATE POLICY "owner_manage_review_queue" ON public.invoice_model_review_queue
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- === 5. invoice_model_settings ===
-- Ustawienia modelu przechowywane w Supabase (synchronizacja localStorage → DB)

CREATE TABLE IF NOT EXISTS public.invoice_model_settings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text        UNIQUE NOT NULL,
  value       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_model_settings ENABLE ROW LEVEL SECURITY;

-- Tylko owner może czytać i zarządzać ustawieniami modelu
DROP POLICY IF EXISTS "owner_manage_model_settings" ON public.invoice_model_settings;
CREATE POLICY "owner_manage_model_settings" ON public.invoice_model_settings
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Zwykły user NIE ma żadnego dostępu do ustawień modelu
-- (brak policy dla SELECT/INSERT/UPDATE dla zwykłych userów = brak dostępu)

-- === 6. Seed: domyślne klucze ustawień modelu ===

INSERT INTO public.invoice_model_settings (key, value)
VALUES
  ('model_mode',    '"shadow"'::jsonb),
  ('model_version', '"0.1.0"'::jsonb),
  ('extractor_version', '"2.0"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- GOTOWE
-- Uruchom po: backend_migration.sql (wymagana funkcja is_owner())
-- ============================================================
