-- ============================================================
-- MAGZIC — Przypisz dane admina do jego workspace
-- Uruchom PO saas_migration.sql ORAZ saas_migration_v2.sql
-- ZMIEŃ 'TWOJ@EMAIL.PL' na swój adres e-mail admina!
-- Idempotentne: WHERE workspace_id IS NULL — bezpieczne przy ponownym uruchomieniu
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

  -- ── Tabele z saas_migration.sql ──────────────────────────────
  UPDATE public.towary          SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.magazyny         SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.kontrahenci      SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.faktury          SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.pozycje_faktury  SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.stany_magazynowe SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.ruchy_magazynowe SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.kategorie        SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;

  -- ── Tabele z saas_migration_v2.sql ───────────────────────────
  UPDATE public.pakiety_sprzatania SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.elementy_pakietu   SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
  UPDATE public.alerty_cenowe      SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;

  -- alerty_cenowe_faktury (opcjonalna tabela)
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'alerty_cenowe_faktury'
  ) THEN
    UPDATE public.alerty_cenowe_faktury SET workspace_id = admin_ws_id WHERE workspace_id IS NULL;
    RAISE NOTICE 'Backfill alerty_cenowe_faktury: done';
  END IF;

  RAISE NOTICE 'Wszystkie dane admina przypisane do workspace: %', admin_ws_id;
END $$;
