-- ============================================================
-- MAGZIC — Przypisz dane admina do jego workspace
-- Uruchom PO saas_migration.sql
-- ZMIEŃ 'TWOJ@EMAIL.PL' na swój adres e-mail admina!
-- ============================================================

DO $$ DECLARE
  admin_user_id uuid;
  admin_ws_id   uuid;
BEGIN
  -- Znajdź admina
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'TWOJ@EMAIL.PL' LIMIT 1;
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika o podanym adresie e-mail. Zmień TWOJ@EMAIL.PL na właściwy adres.';
  END IF;

  -- Znajdź lub utwórz workspace admina
  SELECT id INTO admin_ws_id FROM public.workspaces WHERE owner_user_id = admin_user_id LIMIT 1;
  IF admin_ws_id IS NULL THEN
    INSERT INTO public.workspaces (owner_user_id, name)
    VALUES (admin_user_id, 'Magazyn Główny')
    RETURNING id INTO admin_ws_id;
    RAISE NOTICE 'Utworzono nowy workspace: %', admin_ws_id;
  ELSE
    RAISE NOTICE 'Znaleziono istniejący workspace: %', admin_ws_id;
  END IF;

  -- Przypisz dane admina do jego workspace
  UPDATE public.towary          SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.magazyny         SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.kontrahenci      SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.faktury          SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.pozycje_faktury  SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.stany_magazynowe SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.ruchy_magazynowe SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.kategorie        SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;

  RAISE NOTICE 'Dane admina przypisane do workspace: %', admin_ws_id;
END $$;
