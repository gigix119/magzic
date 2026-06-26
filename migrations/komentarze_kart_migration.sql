-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Migracja: komentarze / aktywność na karcie (PB3 — CardDetail)
-- Projekt: magzic
-- Data: 2026-06-26
-- Opis: Prosta tabela komentarzy per karta. `autor_nazwa` jest zdenormalizowany
--       (snapshot wyświetlanej nazwy w momencie zapisu) — unika joina do profiles
--       przy każdym renderze osi czasu. `workspace_id` zdenormalizowany jak w
--       innych tabelach powiązanych z kartami (wzorzec z checklist_items).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.komentarze_kart (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  karta_id      uuid NOT NULL REFERENCES public.karty(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  autor_id      uuid NOT NULL,
  autor_nazwa   text,
  tresc         text NOT NULL CHECK (char_length(tresc) >= 1),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS komentarze_kart_karta_idx ON public.komentarze_kart (karta_id, created_at DESC);

ALTER TABLE public.komentarze_kart ENABLE ROW LEVEL SECURITY;

CREATE POLICY komentarze_kart_select ON public.komentarze_kart FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY komentarze_kart_insert ON public.komentarze_kart FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY komentarze_kart_update ON public.komentarze_kart FOR UPDATE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY komentarze_kart_delete ON public.komentarze_kart FOR DELETE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

-- =============================================================================
-- ROLLBACK (run manually if migration needs to be reverted)
-- =============================================================================
-- DROP TABLE IF EXISTS public.komentarze_kart CASCADE;
-- =============================================================================
