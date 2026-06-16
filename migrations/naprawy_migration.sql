-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Migracja: tabela naprawy (repairs module)
-- Projekt: magzic
-- Data: 2026-06-16
-- Opis: Tworzy tabelę naprawy ze statusem, priorytetem, RLS i indeksami.
-- =============================================================================

-- ── CREATE TABLE ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.naprawy (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  tytul            text NOT NULL CHECK (char_length(tytul) >= 1),
  lokal            text,                                 -- apt / room identifier
  opis             text,                                 -- detailed description
  notatka_technika text,                                 -- technician note

  status           text NOT NULL DEFAULT 'zgloszone'
                     CHECK (status IN ('zgloszone', 'w_realizacji', 'zakonczone', 'zweryfikowane')),
  priorytet        text NOT NULL DEFAULT 'normalny'
                     CHECK (priorytet IN ('niski', 'normalny', 'pilne')),

  data_zgloszenia  date NOT NULL DEFAULT CURRENT_DATE,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── INDEXES ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS naprawy_workspace_id_idx
  ON public.naprawy (workspace_id);

CREATE INDEX IF NOT EXISTS naprawy_status_idx
  ON public.naprawy (workspace_id, status);

CREATE INDEX IF NOT EXISTS naprawy_created_at_idx
  ON public.naprawy (workspace_id, created_at DESC);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS naprawy_set_updated_at ON public.naprawy;
CREATE TRIGGER naprawy_set_updated_at
  BEFORE UPDATE ON public.naprawy
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────

ALTER TABLE public.naprawy ENABLE ROW LEVEL SECURITY;

CREATE POLICY naprawy_select ON public.naprawy FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

CREATE POLICY naprawy_insert ON public.naprawy FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

CREATE POLICY naprawy_update ON public.naprawy FOR UPDATE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

CREATE POLICY naprawy_delete ON public.naprawy FOR DELETE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

-- =============================================================================
-- ROLLBACK (run manually if migration needs to be reverted)
-- =============================================================================
-- DROP TABLE IF EXISTS public.naprawy CASCADE;
-- DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
-- =============================================================================
