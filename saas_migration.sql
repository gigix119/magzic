-- ============================================================
-- MAGZIC SaaS Migration — multi-tenant workspace isolation
-- Uruchom w Supabase Dashboard → SQL Editor
-- BEZPIECZNE: nie usuwa tabel, nie kasuje danych, nie robi TRUNCATE
-- Idempotentne: można uruchomić wielokrotnie
-- ============================================================

-- 1. EXTENSION (jeśli nie ma)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL DEFAULT 'Mój magazyn',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_owner" ON public.workspaces;
DROP POLICY IF EXISTS "allow all" ON public.workspaces;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.workspaces;
CREATE POLICY "workspace_owner" ON public.workspaces
  FOR ALL USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- 3. ROZSZERZENIE TABELI profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name  text;

-- profiles: ogranicz dostęp — każdy widzi tylko swój profil
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.profiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own" ON public.profiles;
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. KOLUMNA workspace_id W TABELACH BIZNESOWYCH
ALTER TABLE public.towary             ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.magazyny            ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.kontrahenci         ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.faktury             ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.pozycje_faktury     ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.stany_magazynowe    ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.ruchy_magazynowe    ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.kategorie           ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 5. RLS DLA KAŻDEJ TABELI BIZNESOWEJ
-- Uwaga: DROP POLICY usuwa polisy po nazwie. Jeśli masz polisy o innych nazwach
-- (np. "Enable read access for all users"), usuń je ręcznie w Supabase Dashboard.

-- towary
ALTER TABLE public.towary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.towary;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.towary;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.towary;
DROP POLICY IF EXISTS "towary_workspace" ON public.towary;
CREATE POLICY "towary_workspace" ON public.towary
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  );

-- magazyny
ALTER TABLE public.magazyny ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.magazyny;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.magazyny;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.magazyny;
DROP POLICY IF EXISTS "magazyny_workspace" ON public.magazyny;
CREATE POLICY "magazyny_workspace" ON public.magazyny
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  );

-- kontrahenci
ALTER TABLE public.kontrahenci ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.kontrahenci;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.kontrahenci;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.kontrahenci;
DROP POLICY IF EXISTS "kontrahenci_workspace" ON public.kontrahenci;
CREATE POLICY "kontrahenci_workspace" ON public.kontrahenci
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  );

-- faktury
ALTER TABLE public.faktury ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.faktury;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.faktury;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.faktury;
DROP POLICY IF EXISTS "faktury_workspace" ON public.faktury;
CREATE POLICY "faktury_workspace" ON public.faktury
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  );

-- pozycje_faktury
ALTER TABLE public.pozycje_faktury ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.pozycje_faktury;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.pozycje_faktury;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pozycje_faktury;
DROP POLICY IF EXISTS "pozycje_faktury_workspace" ON public.pozycje_faktury;
CREATE POLICY "pozycje_faktury_workspace" ON public.pozycje_faktury
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  );

-- stany_magazynowe
ALTER TABLE public.stany_magazynowe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.stany_magazynowe;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.stany_magazynowe;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.stany_magazynowe;
DROP POLICY IF EXISTS "stany_magazynowe_workspace" ON public.stany_magazynowe;
CREATE POLICY "stany_magazynowe_workspace" ON public.stany_magazynowe
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  );

-- ruchy_magazynowe
ALTER TABLE public.ruchy_magazynowe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.ruchy_magazynowe;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.ruchy_magazynowe;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.ruchy_magazynowe;
DROP POLICY IF EXISTS "ruchy_magazynowe_workspace" ON public.ruchy_magazynowe;
CREATE POLICY "ruchy_magazynowe_workspace" ON public.ruchy_magazynowe
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  );

-- kategorie
ALTER TABLE public.kategorie ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON public.kategorie;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.kategorie;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.kategorie;
DROP POLICY IF EXISTS "kategorie_workspace" ON public.kategorie;
CREATE POLICY "kategorie_workspace" ON public.kategorie
  FOR ALL USING (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid())
  );

-- 6. TRIGGER: auto-create workspace + profile po rejestracji
CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_workspace_id uuid;
BEGIN
  INSERT INTO public.workspaces (owner_user_id, name)
  VALUES (NEW.id, 'Mój magazyn') RETURNING id INTO new_workspace_id;

  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  )
  ON CONFLICT (id) DO UPDATE
    SET first_name = EXCLUDED.first_name,
        last_name  = EXCLUDED.last_name,
        email      = EXCLUDED.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_workspace ON auth.users;
CREATE TRIGGER on_auth_user_created_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_workspace();

-- ============================================================
-- UWAGA po uruchomieniu:
-- 1. Sprawdź w Supabase Dashboard → Authentication → Triggers
--    czy nie masz starego triggera który tworzy workspace bez
--    tego skryptu — jeśli tak, usuń go.
-- 2. Sprawdź każdą tabelę w Table Editor → RLS policies,
--    że nie zostały stare permisywne polisy o innych nazwach.
-- 3. Uruchom assign_admin_workspace.sql (z Twoim e-mailem).
-- ============================================================
