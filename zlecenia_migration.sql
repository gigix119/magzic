-- Zlecenia (orders/tasks) module migration

CREATE TABLE IF NOT EXISTS public.zlecenia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  nazwa text NOT NULL,
  opis text NULL,
  data_realizacji date NULL,
  status text NOT NULL DEFAULT 'nowe',
  priorytet text NOT NULL DEFAULT 'normalny',
  kontrahent_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zlecenia_pozycje (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zlecenie_id uuid NOT NULL REFERENCES public.zlecenia(id) ON DELETE CASCADE,
  towar_id uuid NULL,
  nazwa_pozycji text NOT NULL,
  ilosc numeric NOT NULL DEFAULT 1,
  jednostka text NULL,
  notatka text NULL,
  wydano boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zlecenia_workspace ON public.zlecenia(workspace_id);
CREATE INDEX IF NOT EXISTS idx_zlecenia_status ON public.zlecenia(status);
CREATE INDEX IF NOT EXISTS idx_zlecenia_data ON public.zlecenia(data_realizacji);
CREATE INDEX IF NOT EXISTS idx_zlecenia_pozycje_zlecenie ON public.zlecenia_pozycje(zlecenie_id);

ALTER TABLE public.zlecenia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zlecenia_pozycje ENABLE ROW LEVEL SECURITY;

CREATE POLICY zlecenia_select ON public.zlecenia FOR SELECT USING (
  workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
);
CREATE POLICY zlecenia_insert ON public.zlecenia FOR INSERT WITH CHECK (
  workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
);
CREATE POLICY zlecenia_update ON public.zlecenia FOR UPDATE USING (
  workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
);
CREATE POLICY zlecenia_delete ON public.zlecenia FOR DELETE USING (
  workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
);

CREATE POLICY pozycje_select ON public.zlecenia_pozycje FOR SELECT USING (
  zlecenie_id IN (SELECT id FROM public.zlecenia WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
);
CREATE POLICY pozycje_insert ON public.zlecenia_pozycje FOR INSERT WITH CHECK (
  zlecenie_id IN (SELECT id FROM public.zlecenia WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
);
CREATE POLICY pozycje_update ON public.zlecenia_pozycje FOR UPDATE USING (
  zlecenie_id IN (SELECT id FROM public.zlecenia WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
);
CREATE POLICY pozycje_delete ON public.zlecenia_pozycje FOR DELETE USING (
  zlecenie_id IN (SELECT id FROM public.zlecenia WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
);
