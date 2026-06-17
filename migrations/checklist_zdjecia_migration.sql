-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Uruchom ręcznie w panelu Supabase → SQL Editor

-- ─── checklist_items ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zlecenie_id   uuid NOT NULL REFERENCES public.zlecenia(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  label         text NOT NULL,
  checked       boolean NOT NULL DEFAULT false,
  sort_order    int DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_zlecenie ON public.checklist_items(zlecenie_id);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS checklist_select ON public.checklist_items;
DROP POLICY IF EXISTS checklist_insert ON public.checklist_items;
DROP POLICY IF EXISTS checklist_update ON public.checklist_items;
DROP POLICY IF EXISTS checklist_delete ON public.checklist_items;
CREATE POLICY checklist_select ON public.checklist_items FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY checklist_insert ON public.checklist_items FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY checklist_update ON public.checklist_items FOR UPDATE
  USING  (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY checklist_delete ON public.checklist_items FOR DELETE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

-- ─── preparation_photos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.preparation_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zlecenie_id   uuid NOT NULL REFERENCES public.zlecenia(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  label         text,
  uploaded_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_zlecenie ON public.preparation_photos(zlecenie_id);

ALTER TABLE public.preparation_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS photos_select ON public.preparation_photos;
DROP POLICY IF EXISTS photos_insert ON public.preparation_photos;
DROP POLICY IF EXISTS photos_update ON public.preparation_photos;
DROP POLICY IF EXISTS photos_delete ON public.preparation_photos;
CREATE POLICY photos_select ON public.preparation_photos FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY photos_insert ON public.preparation_photos FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY photos_update ON public.preparation_photos FOR UPDATE
  USING  (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY photos_delete ON public.preparation_photos FOR DELETE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

-- ─── Kolumny na zleceniu ─────────────────────────────────────────────────────
ALTER TABLE public.zlecenia ADD COLUMN IF NOT EXISTS required_photos    int     DEFAULT 0;
ALTER TABLE public.zlecenia ADD COLUMN IF NOT EXISTS readiness_confirmed boolean DEFAULT false;

-- ─── SUPABASE STORAGE ────────────────────────────────────────────────────────
-- Utwórz ręcznie w panelu Supabase → Storage → New bucket:
--   Nazwa:   przygotowania-zdjecia
--   Public:  false (prywatny — dostęp przez polisy RLS lub signed URL)
--   Polisa:  authenticated users mogą upload/download do swojego workspace_id/

-- ─── ROLLBACK ────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.preparation_photos CASCADE;
-- DROP TABLE IF EXISTS public.checklist_items CASCADE;
-- ALTER TABLE public.zlecenia DROP COLUMN IF EXISTS required_photos;
-- ALTER TABLE public.zlecenia DROP COLUMN IF EXISTS readiness_confirmed;
