-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Migracja: reguły automatyzacji tablic (jak Trello Butler) — reguly_tablic
-- Projekt: magzic
-- Data: 2026-06-18
-- Opis: Reguła "gdy tytuł karty zawiera słowo kluczowe → przenieś do listy"
--       egzekwowana triggerem Postgres przy tworzeniu/zmianie tytułu karty.
--       Wymaga rozszerzenia unaccent (do porównań bez polskich diakrytyków).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── CREATE TABLE: reguly_tablic ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reguly_tablic (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tablica_id        uuid NOT NULL REFERENCES public.tablice(id) ON DELETE CASCADE,

  slowo_kluczowe    text NOT NULL CHECK (char_length(slowo_kluczowe) >= 1),
  akcja             text NOT NULL DEFAULT 'przenies_do_listy'
                       CHECK (akcja IN ('przenies_do_listy')),
  lista_docelowa_id uuid NOT NULL REFERENCES public.listy(id) ON DELETE CASCADE,
  aktywna           boolean NOT NULL DEFAULT true,
  pozycja           integer NOT NULL DEFAULT 0,

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reguly_tablic_tablica_idx
  ON public.reguly_tablic (tablica_id, aktywna, pozycja);

-- ── ROW LEVEL SECURITY (wzorzec identyczny jak tablice_migration.sql) ───────

ALTER TABLE public.reguly_tablic ENABLE ROW LEVEL SECURITY;

CREATE POLICY reguly_tablic_select ON public.reguly_tablic FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY reguly_tablic_insert ON public.reguly_tablic FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY reguly_tablic_update ON public.reguly_tablic FOR UPDATE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY reguly_tablic_delete ON public.reguly_tablic FOR DELETE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

-- ── TRIGGER: zastosuj_reguly_tablic — egzekucja reguł przy insert/zmianie tytułu ──
-- Pierwsza pasująca aktywna reguła (najniższa pozycja) wygrywa. Diakrytyki
-- ignorowane przez unaccent(lower(...)). Karta trafia na początek listy
-- docelowej (najmniejsza pozycja / 2).

CREATE OR REPLACE FUNCTION public.zastosuj_reguly_tablic()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_lista_id    uuid;
  v_min_pozycja numeric;
BEGIN
  SELECT r.lista_docelowa_id INTO v_lista_id
  FROM public.reguly_tablic r
  WHERE r.tablica_id = NEW.tablica_id
    AND r.aktywna
    AND r.akcja = 'przenies_do_listy'
    AND unaccent(lower(NEW.tytul)) LIKE '%' || unaccent(lower(r.slowo_kluczowe)) || '%'
  ORDER BY r.pozycja ASC
  LIMIT 1;

  IF v_lista_id IS NOT NULL AND v_lista_id IS DISTINCT FROM NEW.lista_id THEN
    SELECT MIN(pozycja) INTO v_min_pozycja
    FROM public.karty
    WHERE lista_id = v_lista_id AND archiwum = false;

    NEW.lista_id := v_lista_id;
    NEW.pozycja := CASE WHEN v_min_pozycja IS NULL THEN 1000 ELSE v_min_pozycja / 2 END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS karty_zastosuj_reguly ON public.karty;
CREATE TRIGGER karty_zastosuj_reguly
  BEFORE INSERT OR UPDATE OF tytul ON public.karty
  FOR EACH ROW EXECUTE FUNCTION public.zastosuj_reguly_tablic();

-- =============================================================================
-- ROLLBACK (run manually if migration needs to be reverted)
-- =============================================================================
-- DROP TRIGGER IF EXISTS karty_zastosuj_reguly ON public.karty;
-- DROP FUNCTION IF EXISTS public.zastosuj_reguly_tablic();
-- DROP TABLE IF EXISTS public.reguly_tablic CASCADE;
-- =============================================================================
