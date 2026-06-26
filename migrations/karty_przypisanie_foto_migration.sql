-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Migracja: przypisanie karty do usera + zdjęcia przed/po (PB3 — CardDetail)
-- Projekt: magzic
-- Data: 2026-06-26
-- Opis: `przypisany_do` — jednoznaczne przypisanie karty do jednego usera,
--       potrzebne do filtrowania widoku „Mój dzień" (kolumna `przypisani` jsonb
--       zostaje jako wolny tekst do wyświetlania awatarów, bez zmian).
--       `foto_przed` / `foto_po` — URL zdjęć ze Storage (bucket karty-zdjecia).
-- =============================================================================

ALTER TABLE public.karty ADD COLUMN IF NOT EXISTS przypisany_do uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.karty ADD COLUMN IF NOT EXISTS foto_przed text NULL;
ALTER TABLE public.karty ADD COLUMN IF NOT EXISTS foto_po text NULL;

CREATE INDEX IF NOT EXISTS karty_przypisany_do_idx ON public.karty (przypisany_do);

-- =============================================================================
-- ROLLBACK (run manually if migration needs to be reverted)
-- =============================================================================
-- DROP INDEX IF EXISTS karty_przypisany_do_idx;
-- ALTER TABLE public.karty DROP COLUMN IF EXISTS foto_po;
-- ALTER TABLE public.karty DROP COLUMN IF EXISTS foto_przed;
-- ALTER TABLE public.karty DROP COLUMN IF EXISTS przypisany_do;
-- =============================================================================
