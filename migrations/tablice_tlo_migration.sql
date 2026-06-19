-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Migracja: tło boardu (gradient/zdjęcie) — dodaje tlo_typ do tablice
-- Projekt: magzic
-- Data: 2026-06-19
-- =============================================================================

ALTER TABLE public.tablice ADD COLUMN IF NOT EXISTS tlo_typ text NOT NULL DEFAULT 'solid';

ALTER TABLE public.tablice DROP CONSTRAINT IF EXISTS tablice_tlo_typ_check;
ALTER TABLE public.tablice ADD CONSTRAINT tablice_tlo_typ_check
  CHECK (tlo_typ IN ('solid', 'gradient', 'zdjecie'));

-- =============================================================================
-- ROLLBACK (run manually if migration needs to be reverted)
-- =============================================================================
-- ALTER TABLE public.tablice DROP CONSTRAINT IF EXISTS tablice_tlo_typ_check;
-- ALTER TABLE public.tablice DROP COLUMN IF EXISTS tlo_typ;
-- =============================================================================
