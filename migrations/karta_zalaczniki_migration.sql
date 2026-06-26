-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Migracja: załączniki karty (PB3 — CardDetail)
-- Projekt: magzic
-- Data: 2026-06-26
-- Opis: Lista plików dołączonych do karty. Plik fizyczny w Supabase Storage,
--       bucket `karty-zalaczniki` — utwórz ręcznie w Supabase Dashboard → Storage
--       (Public: true, żeby getPublicUrl działał tak samo jak dla innych
--       bucketów w aplikacji — patrz `faktury-pliki` / `przygotowania-zdjecia`).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.karta_zalaczniki (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  karta_id      uuid NOT NULL REFERENCES public.karty(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  nazwa         text NOT NULL,
  storage_path  text NOT NULL,
  rozmiar       bigint,
  typ           text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS karta_zalaczniki_karta_idx ON public.karta_zalaczniki (karta_id);

ALTER TABLE public.karta_zalaczniki ENABLE ROW LEVEL SECURITY;

CREATE POLICY karta_zalaczniki_select ON public.karta_zalaczniki FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY karta_zalaczniki_insert ON public.karta_zalaczniki FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY karta_zalaczniki_delete ON public.karta_zalaczniki FOR DELETE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

-- =============================================================================
-- ROLLBACK (run manually if migration needs to be reverted)
-- =============================================================================
-- DROP TABLE IF EXISTS public.karta_zalaczniki CASCADE;
-- =============================================================================
