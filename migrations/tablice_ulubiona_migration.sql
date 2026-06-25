-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Migracja: ulubione tablice (gwiazdka) — siatka tablic wg designu Figma
-- Projekt: magzic
-- Data: 2026-06-26
-- =============================================================================

ALTER TABLE public.tablice ADD COLUMN IF NOT EXISTS ulubiona boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tablice_ulubiona
  ON public.tablice (workspace_id, ulubiona) WHERE ulubiona = true;

-- =============================================================================
-- ROLLBACK (run manually if migration needs to be reverted)
-- =============================================================================
-- DROP INDEX IF EXISTS idx_tablice_ulubiona;
-- ALTER TABLE public.tablice DROP COLUMN IF EXISTS ulubiona;
-- =============================================================================
