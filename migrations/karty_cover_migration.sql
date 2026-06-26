-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Migracja: okładka-foto karty (enriched KartaTablicy) — wnętrze tablicy (PB2)
-- Projekt: magzic
-- Data: 2026-06-26
-- =============================================================================

ALTER TABLE public.karty ADD COLUMN IF NOT EXISTS cover_url text NULL;

-- =============================================================================
-- ROLLBACK (run manually if migration needs to be reverted)
-- =============================================================================
-- ALTER TABLE public.karty DROP COLUMN IF EXISTS cover_url;
-- =============================================================================
