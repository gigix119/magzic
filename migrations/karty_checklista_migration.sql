-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Migracja: checklisty w kartach — lista zadań per karta (P10)
-- Projekt: magzic
-- Data: 2026-06-19
-- Opis: Checklista jako JSONB w karty.checklista — jedno pole, bez nowej
--       tabeli (jedna osoba edytuje kartę naraz, brak potrzeby osobnych query).
--       Struktura elementu: { id: uuid, tekst: string, done: bool, pozycja: number }
-- =============================================================================

ALTER TABLE public.karty ADD COLUMN IF NOT EXISTS checklista jsonb NOT NULL DEFAULT '[]'::jsonb;

-- =============================================================================
-- ROLLBACK (run manually if migration needs to be reverted)
-- =============================================================================
-- ALTER TABLE public.karty DROP COLUMN IF EXISTS checklista;
-- =============================================================================
