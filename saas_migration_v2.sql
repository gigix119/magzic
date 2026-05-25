-- ============================================================
-- MAGZIC SaaS Migration v2 — pakiety, alerty workspace isolation
-- Uruchom w Supabase Dashboard → SQL Editor
-- Uruchom PO saas_migration.sql i assign_admin_workspace.sql
-- BEZPIECZNE: nie usuwa danych, idempotentne
-- ============================================================

-- 1. workspace_id dla pakiety_sprzatania
ALTER TABLE public.pakiety_sprzatania
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 2. workspace_id dla elementy_pakietu
ALTER TABLE public.elementy_pakietu
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 3. workspace_id dla alerty_cenowe
ALTER TABLE public.alerty_cenowe
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 4. workspace_id dla alerty_cenowe_faktury (tabela opcjonalna)
DO $$ BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'alerty_cenowe_faktury'
  ) THEN
    ALTER TABLE public.alerty_cenowe_faktury
      ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. RLS — pakiety_sprzatania
ALTER TABLE public.pakiety_sprzatania ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.pakiety_sprzatania;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.pakiety_sprzatania;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pakiety_sprzatania;
DROP POLICY IF EXISTS "pakiety_workspace" ON public.pakiety_sprzatania;
CREATE POLICY "pakiety_workspace" ON public.pakiety_sprzatania
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  );

-- 6. RLS — elementy_pakietu
ALTER TABLE public.elementy_pakietu ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.elementy_pakietu;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.elementy_pakietu;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.elementy_pakietu;
DROP POLICY IF EXISTS "elementy_pakietu_workspace" ON public.elementy_pakietu;
CREATE POLICY "elementy_pakietu_workspace" ON public.elementy_pakietu
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  );

-- 7. RLS — alerty_cenowe
ALTER TABLE public.alerty_cenowe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.alerty_cenowe;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.alerty_cenowe;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.alerty_cenowe;
DROP POLICY IF EXISTS "alerty_cenowe_workspace" ON public.alerty_cenowe;
CREATE POLICY "alerty_cenowe_workspace" ON public.alerty_cenowe
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  );

-- 8. RLS — alerty_cenowe_faktury (opcjonalna)
DO $$ BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'alerty_cenowe_faktury'
  ) THEN
    EXECUTE 'ALTER TABLE public.alerty_cenowe_faktury ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "allow all" ON public.alerty_cenowe_faktury';
    EXECUTE 'DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.alerty_cenowe_faktury';
    EXECUTE 'DROP POLICY IF EXISTS "Enable read access for all users" ON public.alerty_cenowe_faktury';
    EXECUTE 'DROP POLICY IF EXISTS "alerty_cenowe_faktury_workspace" ON public.alerty_cenowe_faktury';
    EXECUTE $p$
      CREATE POLICY "alerty_cenowe_faktury_workspace" ON public.alerty_cenowe_faktury
        FOR ALL USING (
          workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
        )
        WITH CHECK (
          workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
        )
    $p$;
  END IF;
END $$;

-- ============================================================
-- Po uruchomieniu tego skryptu uruchom assign_admin_workspace_v2.sql
-- (backfill danych admina dla nowych tabel)
-- ============================================================
