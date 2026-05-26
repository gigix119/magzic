-- ============================================================
-- MAGZIC Backend/Admin Migration v1
-- Uruchom w: Supabase Dashboard → SQL Editor → New query
-- Bezpieczne: idempotentne, nie kasuje danych
-- ============================================================

-- === 0. Rozszerzenie tabeli profiles ===

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name  text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at  timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at    timestamptz NOT NULL DEFAULT now();

-- Kolumna status (bezpieczna dla istniejących wierszy – domyślnie 'active')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;
END;
$$;

-- Rozszerzenie constraint role o 'owner'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'user'));

-- Constraint na status
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'blocked', 'pending'));

-- === 1. Tabela user_permissions ===

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_key  text        NOT NULL,
  can_view    boolean     NOT NULL DEFAULT false,
  can_create  boolean     NOT NULL DEFAULT false,
  can_edit    boolean     NOT NULL DEFAULT false,
  can_delete  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_key)
);
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- === 2. Tabela app_events ===

CREATE TABLE IF NOT EXISTS public.app_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type  text        NOT NULL,
  module_key  text,
  action      text        NOT NULL,
  entity_type text,
  entity_id   text,
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

-- === 3. Tabela admin_audit_logs ===

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  action         text        NOT NULL,
  metadata       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- === 4. Tabela app_error_logs ===

CREATE TABLE IF NOT EXISTS public.app_error_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  error_type text        NOT NULL,
  message    text        NOT NULL,
  module_key text,
  action     text,
  metadata   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

-- === 5. Funkcja pomocnicza is_owner() ===
-- SECURITY DEFINER: omija RLS, zapobiega circular reference na tabeli profiles

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'owner'
  );
$$;

-- === 6. Trigger: ochrona role/status przed zmianą przez non-owner ===

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Non-owner nie może zmieniać role ani status
  IF NOT public.is_owner() THEN
    NEW.role   := OLD.role;
    NEW.status := OLD.status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER guard_profile_sensitive_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.guard_profile_sensitive_fields();

-- === 7. RLS POLICIES ===

-- profiles: owner może czytać wszystkich użytkowników
DROP POLICY IF EXISTS "owner_read_all_profiles" ON public.profiles;
CREATE POLICY "owner_read_all_profiles" ON public.profiles
  FOR SELECT USING (public.is_owner());

-- profiles: owner może aktualizować wszystkich (role, status, itp.)
DROP POLICY IF EXISTS "owner_update_all_profiles" ON public.profiles;
CREATE POLICY "owner_update_all_profiles" ON public.profiles
  FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());

-- user_permissions: user widzi tylko swoje uprawnienia
DROP POLICY IF EXISTS "user_read_own_permissions" ON public.user_permissions;
CREATE POLICY "user_read_own_permissions" ON public.user_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- user_permissions: owner zarządza wszystkimi uprawnieniami
DROP POLICY IF EXISTS "owner_manage_permissions" ON public.user_permissions;
CREATE POLICY "owner_manage_permissions" ON public.user_permissions
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- app_events: zalogowany user może tworzyć własne eventy
DROP POLICY IF EXISTS "user_insert_own_events" ON public.app_events;
CREATE POLICY "user_insert_own_events" ON public.app_events
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- app_events: owner czyta wszystkie eventy
DROP POLICY IF EXISTS "owner_read_all_events" ON public.app_events;
CREATE POLICY "owner_read_all_events" ON public.app_events
  FOR SELECT USING (public.is_owner());

-- admin_audit_logs: tylko owner tworzy i czyta
DROP POLICY IF EXISTS "owner_manage_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "owner_manage_audit_logs" ON public.admin_audit_logs
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- app_error_logs: zalogowany user może tworzyć wpisy błędów
DROP POLICY IF EXISTS "user_insert_error_logs" ON public.app_error_logs;
CREATE POLICY "user_insert_error_logs" ON public.app_error_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- app_error_logs: owner czyta wszystkie błędy
DROP POLICY IF EXISTS "owner_read_error_logs" ON public.app_error_logs;
CREATE POLICY "owner_read_error_logs" ON public.app_error_logs
  FOR SELECT USING (public.is_owner());

-- === 8. Bootstrap administrator@blueapart.pl jako owner ===

CREATE OR REPLACE FUNCTION public.bootstrap_admin_owner()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  admin_uid uuid;
BEGIN
  SELECT id INTO admin_uid FROM auth.users
  WHERE email = 'administrator@blueapart.pl' LIMIT 1;

  IF admin_uid IS NULL THEN
    RETURN 'administrator@blueapart.pl nie istnieje jeszcze w auth.users – uruchom po pierwszym zalogowaniu';
  END IF;

  UPDATE public.profiles
  SET role = 'owner', status = 'active', updated_at = now()
  WHERE id = admin_uid;

  INSERT INTO public.user_permissions (user_id, module_key, can_view, can_create, can_edit, can_delete)
  VALUES
    (admin_uid, 'dashboard',   true, true, true, true),
    (admin_uid, 'invoices',    true, true, true, true),
    (admin_uid, 'inventory',   true, true, true, true),
    (admin_uid, 'contractors', true, true, true, true),
    (admin_uid, 'reports',     true, true, true, true),
    (admin_uid, 'settings',    true, true, true, true),
    (admin_uid, 'backend',     true, true, true, true)
  ON CONFLICT (user_id, module_key) DO UPDATE
    SET can_view = true, can_create = true, can_edit = true, can_delete = true,
        updated_at = now();

  RETURN 'OK: administrator@blueapart.pl nadano rolę owner (uid: ' || admin_uid::text || ')';
END;
$$;

SELECT public.bootstrap_admin_owner();

-- === 9. Zaktualizowany trigger dla nowych użytkowników ===
-- Automatycznie nadaje rolę owner dla administrator@blueapart.pl

CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_workspace_id uuid;
BEGIN
  INSERT INTO public.workspaces (owner_user_id, name)
  VALUES (NEW.id, 'Mój magazyn') RETURNING id INTO new_workspace_id;

  INSERT INTO public.profiles (id, email, first_name, last_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    CASE WHEN NEW.email = 'administrator@blueapart.pl' THEN 'owner' ELSE 'user' END,
    'active'
  )
  ON CONFLICT (id) DO UPDATE
    SET first_name = EXCLUDED.first_name,
        last_name  = EXCLUDED.last_name,
        email      = EXCLUDED.email,
        role = CASE
          WHEN EXCLUDED.email = 'administrator@blueapart.pl' THEN 'owner'
          ELSE profiles.role
        END,
        status     = EXCLUDED.status,
        updated_at = now();

  -- Pełne uprawnienia dla administratora
  IF NEW.email = 'administrator@blueapart.pl' THEN
    INSERT INTO public.user_permissions (user_id, module_key, can_view, can_create, can_edit, can_delete)
    VALUES
      (NEW.id, 'dashboard',   true, true, true, true),
      (NEW.id, 'invoices',    true, true, true, true),
      (NEW.id, 'inventory',   true, true, true, true),
      (NEW.id, 'contractors', true, true, true, true),
      (NEW.id, 'reports',     true, true, true, true),
      (NEW.id, 'settings',    true, true, true, true),
      (NEW.id, 'backend',     true, true, true, true)
    ON CONFLICT (user_id, module_key) DO UPDATE
      SET can_view = true, can_create = true, can_edit = true, can_delete = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_workspace ON auth.users;
CREATE TRIGGER on_auth_user_created_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_workspace();

-- ============================================================
-- GOTOWE! Sprawdź wynik SELECT bootstrap_admin_owner() powyżej.
-- Jeśli zwrócił "nie istnieje" – uruchom tę migrację ponownie
-- po pierwszym zalogowaniu administrator@blueapart.pl.
-- ============================================================
