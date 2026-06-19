-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Migracja: typ tablicy "robocza" (pusta, bez predefiniowanych list)
-- Projekt: magzic
-- Data: 2026-06-19
-- =============================================================================

ALTER TABLE public.tablice DROP CONSTRAINT IF EXISTS tablice_typ_check;
ALTER TABLE public.tablice ADD CONSTRAINT tablice_typ_check
  CHECK (typ IN ('lokale', 'serwis', 'ogolna', 'robocza'));

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

  IF p_typ NOT IN ('lokale', 'serwis', 'ogolna', 'robocza') THEN
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
  ELSIF p_typ = 'ogolna' THEN
    INSERT INTO public.listy (workspace_id, tablica_id, nazwa, pozycja) VALUES
      (p_workspace_id, v_tablica_id, 'Do zrobienia', 1000),
      (p_workspace_id, v_tablica_id, 'W trakcie',    2000),
      (p_workspace_id, v_tablica_id, 'Zrobione',     3000);
  END IF;
  -- p_typ = 'robocza' → brak seedowanych list, tablica zostaje pusta

  RETURN v_tablica_id;
END;
$$;

-- =============================================================================
-- ROLLBACK (run manually if migration needs to be reverted)
-- =============================================================================
-- ALTER TABLE public.tablice DROP CONSTRAINT IF EXISTS tablice_typ_check;
-- ALTER TABLE public.tablice ADD CONSTRAINT tablice_typ_check CHECK (typ IN ('lokale','serwis','ogolna'));
-- (i przywrócić poprzednią wersję utworz_tablice_z_szablonu z tablice_migration.sql)
-- =============================================================================
