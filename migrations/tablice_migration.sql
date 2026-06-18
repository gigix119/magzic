-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Migracja: moduł Tablice (Kanban) — tablice / listy / karty
-- Projekt: magzic
-- Data: 2026-06-18
-- Opis: Fundament danych dla osobnego modułu /tablice (klon Trello) dla
--       lokali (sprzątanie/przygotowania) i serwisu technicznego.
--       Fractional indexing (pozycja numeric) dla reorderu list i kart
--       bez przeliczania całej kolekcji przy każdym drag&drop.
-- =============================================================================

-- ── CREATE TABLE: tablice (boards) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tablice (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  nazwa        text NOT NULL CHECK (char_length(nazwa) >= 1),
  opis         text,
  kolor_tla    text NOT NULL DEFAULT '#0079BF',
  ikona        text,
  typ          text NOT NULL DEFAULT 'ogolna'
                 CHECK (typ IN ('lokale', 'serwis', 'ogolna')),
  pozycja      integer NOT NULL DEFAULT 0,
  archiwum     boolean NOT NULL DEFAULT false,

  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── CREATE TABLE: listy (columns) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.listy (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tablica_id   uuid NOT NULL REFERENCES public.tablice(id) ON DELETE CASCADE,

  nazwa        text NOT NULL CHECK (char_length(nazwa) >= 1),
  kolor        text,
  pozycja      numeric NOT NULL DEFAULT 1000,   -- fractional indexing: nowa = (prev+next)/2
  archiwum     boolean NOT NULL DEFAULT false,
  limit_wip    integer,

  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── CREATE TABLE: karty (cards) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.karty (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lista_id     uuid NOT NULL REFERENCES public.listy(id) ON DELETE CASCADE,
  tablica_id   uuid NOT NULL REFERENCES public.tablice(id) ON DELETE CASCADE,  -- denormalizacja: szybkie query/RLS per-board

  tytul        text NOT NULL CHECK (char_length(tytul) >= 1),
  opis         text,
  pozycja      numeric NOT NULL DEFAULT 1000,
  etykiety     jsonb NOT NULL DEFAULT '[]'::jsonb,
  termin       timestamptz,
  zakonczona   boolean NOT NULL DEFAULT false,
  przypisani   jsonb NOT NULL DEFAULT '[]'::jsonb,
  lokal_id     uuid,                            -- luźny link do lokalu, FK dodamy gdy będzie auto-import KW Hotel
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
  archiwum     boolean NOT NULL DEFAULT false,

  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── INDEXES ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS tablice_workspace_pozycja_idx
  ON public.tablice (workspace_id, pozycja);

CREATE INDEX IF NOT EXISTS listy_workspace_id_idx
  ON public.listy (workspace_id);
CREATE INDEX IF NOT EXISTS listy_tablica_pozycja_idx
  ON public.listy (tablica_id, pozycja);

CREATE INDEX IF NOT EXISTS karty_workspace_id_idx
  ON public.karty (workspace_id);
CREATE INDEX IF NOT EXISTS karty_tablica_lista_pozycja_idx
  ON public.karty (tablica_id, lista_id, pozycja);

-- ── UPDATED_AT TRIGGERS (reuse public.set_updated_at() z naprawy_migration.sql) ──

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tablice_set_updated_at ON public.tablice;
CREATE TRIGGER tablice_set_updated_at
  BEFORE UPDATE ON public.tablice
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS karty_set_updated_at ON public.karty;
CREATE TRIGGER karty_set_updated_at
  BEFORE UPDATE ON public.karty
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
-- Wzorzec identyczny jak w naprawy_migration.sql / zlecenia_migration.sql:
-- workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
-- NIGDY USING(true) — patrz migrations/_deprecated/.

ALTER TABLE public.tablice ENABLE ROW LEVEL SECURITY;

CREATE POLICY tablice_select ON public.tablice FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY tablice_insert ON public.tablice FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY tablice_update ON public.tablice FOR UPDATE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY tablice_delete ON public.tablice FOR DELETE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

ALTER TABLE public.listy ENABLE ROW LEVEL SECURITY;

CREATE POLICY listy_select ON public.listy FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY listy_insert ON public.listy FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY listy_update ON public.listy FOR UPDATE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY listy_delete ON public.listy FOR DELETE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

ALTER TABLE public.karty ENABLE ROW LEVEL SECURITY;

CREATE POLICY karty_select ON public.karty FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY karty_insert ON public.karty FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY karty_update ON public.karty FOR UPDATE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY karty_delete ON public.karty FOR DELETE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

-- ── RPC: przenies_karte — reorder/move karty między listami (fractional indexing) ──

CREATE OR REPLACE FUNCTION public.przenies_karte(
  p_karta_id uuid,
  p_lista_id uuid,
  p_pozycja  numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_karta_workspace uuid;
  v_lista_workspace uuid;
  v_tablica_id      uuid;
BEGIN
  SELECT workspace_id INTO v_karta_workspace
  FROM public.karty WHERE id = p_karta_id;

  IF v_karta_workspace IS NULL THEN
    RAISE EXCEPTION 'karta_not_found';
  END IF;

  SELECT workspace_id, tablica_id INTO v_lista_workspace, v_tablica_id
  FROM public.listy WHERE id = p_lista_id;

  IF v_lista_workspace IS NULL THEN
    RAISE EXCEPTION 'lista_not_found';
  END IF;

  IF v_karta_workspace <> v_lista_workspace THEN
    RAISE EXCEPTION 'tablice_workspace_mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = v_karta_workspace AND owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'tablice_access_denied';
  END IF;

  UPDATE public.karty
  SET lista_id   = p_lista_id,
      tablica_id = v_tablica_id,
      pozycja    = p_pozycja,
      updated_at = now()
  WHERE id = p_karta_id;
END;
$$;

-- ── RPC: przenies_liste — reorder kolumn (fractional indexing) ─────────────────

CREATE OR REPLACE FUNCTION public.przenies_liste(
  p_lista_id uuid,
  p_pozycja  numeric
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id
  FROM public.listy WHERE id = p_lista_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'lista_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = v_workspace_id AND owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'tablice_access_denied';
  END IF;

  UPDATE public.listy
  SET pozycja = p_pozycja
  WHERE id = p_lista_id;
END;
$$;

-- ── RPC: utworz_tablice_z_szablonu — tablica + domyślne listy wg typu ──────────

CREATE OR REPLACE FUNCTION public.utworz_tablice_z_szablonu(
  p_workspace_id uuid,
  p_typ          text,
  p_nazwa        text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_tablica_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'tablice_access_denied';
  END IF;

  IF p_typ NOT IN ('lokale', 'serwis', 'ogolna') THEN
    RAISE EXCEPTION 'tablice_invalid_typ';
  END IF;

  INSERT INTO public.tablice (workspace_id, nazwa, typ, created_by)
  VALUES (p_workspace_id, p_nazwa, p_typ, auth.uid())
  RETURNING id INTO v_tablica_id;

  IF p_typ = 'lokale' THEN
    INSERT INTO public.listy (workspace_id, tablica_id, nazwa, pozycja) VALUES
      (p_workspace_id, v_tablica_id, 'Do przygotowania', 1000),
      (p_workspace_id, v_tablica_id, 'W trakcie',        2000),
      (p_workspace_id, v_tablica_id, 'Gotowe',           3000),
      (p_workspace_id, v_tablica_id, 'Wyjazd',           4000),
      (p_workspace_id, v_tablica_id, 'Przyjazd',         5000);
  ELSIF p_typ = 'serwis' THEN
    INSERT INTO public.listy (workspace_id, tablica_id, nazwa, pozycja) VALUES
      (p_workspace_id, v_tablica_id, 'Zgłoszone',             1000),
      (p_workspace_id, v_tablica_id, 'W realizacji',          2000),
      (p_workspace_id, v_tablica_id, 'Czeka na części',       3000),
      (p_workspace_id, v_tablica_id, 'Gotowe do weryfikacji', 4000),
      (p_workspace_id, v_tablica_id, 'Zrobione',              5000);
  ELSE
    INSERT INTO public.listy (workspace_id, tablica_id, nazwa, pozycja) VALUES
      (p_workspace_id, v_tablica_id, 'Do zrobienia', 1000),
      (p_workspace_id, v_tablica_id, 'W trakcie',    2000),
      (p_workspace_id, v_tablica_id, 'Zrobione',     3000);
  END IF;

  RETURN v_tablica_id;
END;
$$;

-- =============================================================================
-- ROLLBACK (run manually if migration needs to be reverted)
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.utworz_tablice_z_szablonu(uuid, text, text);
-- DROP FUNCTION IF EXISTS public.przenies_liste(uuid, numeric);
-- DROP FUNCTION IF EXISTS public.przenies_karte(uuid, uuid, numeric);
-- DROP TABLE IF EXISTS public.karty CASCADE;
-- DROP TABLE IF EXISTS public.listy CASCADE;
-- DROP TABLE IF EXISTS public.tablice CASCADE;
-- =============================================================================
