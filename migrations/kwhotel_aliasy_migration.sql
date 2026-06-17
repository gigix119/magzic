-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Uruchom ręcznie w panelu Supabase → SQL Editor

-- ─── kwhotel_aliasy: zapamiętane dopasowania nazwa z raportu KW Hotel → lokal ──
-- Gdy użytkownik ręcznie dopasuje niedopasowaną nazwę (fuzzy top-3 lub dropdown),
-- zapisujemy alias, żeby przy następnym imporcie nie trzeba było dopasowywać ponownie.

CREATE TABLE IF NOT EXISTS public.kwhotel_aliasy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  nazwa_kw text NOT NULL,
  lokal_id uuid NOT NULL REFERENCES public.lokale(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, nazwa_kw)
);

CREATE INDEX IF NOT EXISTS idx_kwhotel_aliasy_workspace ON public.kwhotel_aliasy(workspace_id);

ALTER TABLE public.kwhotel_aliasy ENABLE ROW LEVEL SECURITY;

CREATE POLICY kwhotel_aliasy_select ON public.kwhotel_aliasy FOR SELECT USING (
  workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
);
CREATE POLICY kwhotel_aliasy_insert ON public.kwhotel_aliasy FOR INSERT WITH CHECK (
  workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
);
CREATE POLICY kwhotel_aliasy_update ON public.kwhotel_aliasy FOR UPDATE USING (
  workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
);
CREATE POLICY kwhotel_aliasy_delete ON public.kwhotel_aliasy FOR DELETE USING (
  workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
);

-- ROLLBACK (jeśli potrzeba cofnąć):
-- DROP TABLE IF EXISTS public.kwhotel_aliasy;
