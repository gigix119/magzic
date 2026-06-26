-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Migracja: zdjęcia karty z aparatu (PB4 — killer feature dla sprzątaczek w terenie)
-- Projekt: magzic
-- Data: 2026-06-26
-- Opis: Ogólna galeria zdjęć karty (typ 'aparat'/'galeria'), niezależna od
--       istniejących kolumn `karty.foto_przed` / `karty.foto_po` (PB3 — te
--       zostają bez zmian, osobna para "przed/po"). Plik fizyczny w Supabase
--       Storage, bucket `karty-zdjecia` (już używany przez CardPhotos.jsx —
--       NIE twórz drugiego bucketu).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.karta_zdjecia (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  karta_id      uuid NOT NULL REFERENCES public.karty(id) ON DELETE CASCADE,
  tablica_id    uuid NOT NULL REFERENCES public.tablice(id) ON DELETE CASCADE,
  url           text NOT NULL,
  storage_path  text,
  typ           text NOT NULL DEFAULT 'aparat' CHECK (typ IN ('aparat', 'galeria')),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS karta_zdjecia_karta_idx ON public.karta_zdjecia (karta_id, created_at DESC);
CREATE INDEX IF NOT EXISTS karta_zdjecia_tablica_idx ON public.karta_zdjecia (tablica_id);

ALTER TABLE public.karta_zdjecia ENABLE ROW LEVEL SECURITY;

CREATE POLICY karta_zdjecia_select ON public.karta_zdjecia FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY karta_zdjecia_insert ON public.karta_zdjecia FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY karta_zdjecia_delete ON public.karta_zdjecia FOR DELETE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

-- =============================================================================
-- ROLLBACK (run manually if migration needs to be reverted)
-- =============================================================================
-- DROP TABLE IF EXISTS public.karta_zdjecia CASCADE;
-- =============================================================================
