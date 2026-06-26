-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Migracja: historia aktywności kart/tablic — aktywnosc_kart (PB5)
-- Projekt: magzic
-- Data: 2026-06-26
-- Opis: Log zdarzeń (kto/co/kiedy) per karta i per tablica — oś czasu w
--       CardDetailModal (sekcja "Aktywność") i panel "Aktywność" w BoardMenu.
--       Wstawiane z klienta (insert-only, brak update/delete z UI poza RLS).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.aktywnosc_kart (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  karta_id      uuid REFERENCES public.karty(id) ON DELETE CASCADE,
  tablica_id    uuid NOT NULL REFERENCES public.tablice(id) ON DELETE CASCADE,
  uzytkownik_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nazwa   text,
  typ           text NOT NULL CHECK (typ IN (
                  'utworzono', 'przeniesiono', 'edycja', 'komentarz', 'zdjecie',
                  'etykieta', 'termin', 'zakonczona', 'archiwum', 'import_kwhotel'
                )),
  opis          text NOT NULL,
  dane          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aktywnosc_kart_karta_idx
  ON public.aktywnosc_kart (karta_id, created_at DESC);
CREATE INDEX IF NOT EXISTS aktywnosc_kart_tablica_idx
  ON public.aktywnosc_kart (tablica_id, created_at DESC);

ALTER TABLE public.aktywnosc_kart ENABLE ROW LEVEL SECURITY;

CREATE POLICY aktywnosc_kart_select ON public.aktywnosc_kart FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY aktywnosc_kart_insert ON public.aktywnosc_kart FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY aktywnosc_kart_delete ON public.aktywnosc_kart FOR DELETE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

-- =============================================================================
-- ROLLBACK (run manually if migration needs to be reverted)
-- =============================================================================
-- DROP TABLE IF EXISTS public.aktywnosc_kart CASCADE;
-- =============================================================================
