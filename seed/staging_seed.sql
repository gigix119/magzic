-- ============================================================
-- MAGZIC – Staging / Local seed data
-- Run in Supabase SQL Editor (staging project or local Supabase)
-- SAFE: does NOT touch production; targets only the project whose
--       dashboard you are logged into.
--
-- PRE-CONDITIONS (read docs/staging.md first):
--   1. All migrations have been run in order.
--   2. Two test users exist in Authentication:
--        test1@staging.magzic  (Workspace Alpha – primary tester)
--        test2@staging.magzic  (Workspace Beta  – isolation tester)
--   Use ANY passwords you like; record them for yourself.
--
-- IDEMPOTENT: safe to re-run; uses ON CONFLICT DO NOTHING.
-- ============================================================

DO $SEED$
DECLARE
  -- ── User IDs (resolved by email) ─────────────────────────────
  uid1   uuid;   -- test1@staging.magzic
  uid2   uuid;   -- test2@staging.magzic

  -- ── Workspace IDs ────────────────────────────────────────────
  ws1    uuid;
  ws2    uuid;

  -- ── Workspace Alpha objects ───────────────────────────────────
  cat1   uuid;
  mag1a  uuid;
  mag1b  uuid;
  kat1   uuid;
  kat2   uuid;
  prod1  uuid;
  prod2  uuid;
  prod3  uuid;
  fak1   uuid;   -- draft
  fak2   uuid;   -- approved

  -- ── Workspace Beta objects ────────────────────────────────────
  mag2a  uuid;
  prod4  uuid;
  fak3   uuid;   -- draft

  -- ── Shared contractor IDs ────────────────────────────────────
  kontr1 uuid;
  kontr2 uuid;
  kontr3 uuid;

BEGIN

  -- ── 1. RESOLVE USERS ─────────────────────────────────────────
  SELECT id INTO uid1 FROM auth.users WHERE email = 'test1@staging.magzic' LIMIT 1;
  SELECT id INTO uid2 FROM auth.users WHERE email = 'test2@staging.magzic' LIMIT 1;

  IF uid1 IS NULL THEN
    RAISE EXCEPTION
      E'User test1@staging.magzic not found.\n'
      'Create both test users in Authentication → Users before running this script.';
  END IF;
  IF uid2 IS NULL THEN
    RAISE EXCEPTION
      E'User test2@staging.magzic not found.\n'
      'Create both test users in Authentication → Users before running this script.';
  END IF;

  -- ── 2. PROFILES (trigger should create them; ensure they exist) ─
  INSERT INTO public.profiles (id, email, role)
  VALUES
    (uid1, 'test1@staging.magzic', 'user'),
    (uid2, 'test2@staging.magzic', 'user')
  ON CONFLICT (id) DO NOTHING;

  -- ── 3. USER CONSENTS ─────────────────────────────────────────
  INSERT INTO public.user_consents
    (user_id, terms_version, privacy_policy_version,
     accepted_terms_at, accepted_privacy_at, marketing_consent, cookies_consent)
  VALUES
    (uid1, 'v1', 'v1', now(), now(), false, true),
    (uid2, 'v1', 'v1', now(), now(), false, false)
  ON CONFLICT (user_id) DO NOTHING;

  -- ── 4. WORKSPACES ────────────────────────────────────────────
  -- Alpha
  SELECT id INTO ws1
  FROM public.workspaces
  WHERE owner_user_id = uid1 AND name = 'Magazyn Testowy Alpha'
  LIMIT 1;

  IF ws1 IS NULL THEN
    INSERT INTO public.workspaces
      (owner_user_id, name, company_name, nip,
       business_category, business_profile_completed, onboarding_completed_at,
       settings)
    VALUES
      (uid1, 'Magazyn Testowy Alpha', 'Testowa Firma Alpha Sp. z o.o.',
       '1234567890', 'cleaning', true, now(), '{}'::jsonb)
    RETURNING id INTO ws1;
    RAISE NOTICE 'Created workspace Alpha: %', ws1;
  ELSE
    RAISE NOTICE 'Workspace Alpha already exists: %', ws1;
  END IF;

  -- Beta
  SELECT id INTO ws2
  FROM public.workspaces
  WHERE owner_user_id = uid2 AND name = 'Magazyn Testowy Beta'
  LIMIT 1;

  IF ws2 IS NULL THEN
    INSERT INTO public.workspaces
      (owner_user_id, name, company_name, nip,
       business_category, business_profile_completed, onboarding_completed_at,
       settings)
    VALUES
      (uid2, 'Magazyn Testowy Beta', 'Beta Usługi Sp. z o.o.',
       '9876543210', 'general', true, now(), '{}'::jsonb)
    RETURNING id INTO ws2;
    RAISE NOTICE 'Created workspace Beta: %', ws2;
  ELSE
    RAISE NOTICE 'Workspace Beta already exists: %', ws2;
  END IF;

  -- ── 5. KATEGORIE (Alpha only) ─────────────────────────────────
  INSERT INTO public.kategorie (nazwa, workspace_id)
  VALUES ('Środki czyszczące', ws1)
  ON CONFLICT DO NOTHING
  RETURNING id INTO kat1;

  IF kat1 IS NULL THEN
    SELECT id INTO kat1 FROM public.kategorie
    WHERE nazwa = 'Środki czyszczące' AND workspace_id = ws1 LIMIT 1;
  END IF;

  INSERT INTO public.kategorie (nazwa, workspace_id)
  VALUES ('Papierowe', ws1)
  ON CONFLICT DO NOTHING
  RETURNING id INTO kat2;

  IF kat2 IS NULL THEN
    SELECT id INTO kat2 FROM public.kategorie
    WHERE nazwa = 'Papierowe' AND workspace_id = ws1 LIMIT 1;
  END IF;

  -- ── 6. MAGAZYNY ───────────────────────────────────────────────
  -- Alpha: two warehouses
  INSERT INTO public.magazyny (nazwa, workspace_id)
  VALUES ('Magazyn Główny', ws1)
  ON CONFLICT DO NOTHING
  RETURNING id INTO mag1a;

  IF mag1a IS NULL THEN
    SELECT id INTO mag1a FROM public.magazyny
    WHERE nazwa = 'Magazyn Główny' AND workspace_id = ws1 LIMIT 1;
  END IF;

  INSERT INTO public.magazyny (nazwa, workspace_id)
  VALUES ('Magazyn Pomocniczy', ws1)
  ON CONFLICT DO NOTHING
  RETURNING id INTO mag1b;

  IF mag1b IS NULL THEN
    SELECT id INTO mag1b FROM public.magazyny
    WHERE nazwa = 'Magazyn Pomocniczy' AND workspace_id = ws1 LIMIT 1;
  END IF;

  -- Beta: one warehouse
  INSERT INTO public.magazyny (nazwa, workspace_id)
  VALUES ('Magazyn Beta', ws2)
  ON CONFLICT DO NOTHING
  RETURNING id INTO mag2a;

  IF mag2a IS NULL THEN
    SELECT id INTO mag2a FROM public.magazyny
    WHERE nazwa = 'Magazyn Beta' AND workspace_id = ws2 LIMIT 1;
  END IF;

  -- ── 7. KONTRAHENCI ────────────────────────────────────────────
  -- Alpha: two contractors
  INSERT INTO public.kontrahenci (nazwa, nip, email, telefon, adres, aktywny, workspace_id)
  VALUES ('Dostawca Alfa Sp. z o.o.', '1111111111', 'alfa@example.com',
          '+48 100 200 300', 'ul. Testowa 1, 00-001 Warszawa', true, ws1)
  ON CONFLICT DO NOTHING
  RETURNING id INTO kontr1;

  IF kontr1 IS NULL THEN
    SELECT id INTO kontr1 FROM public.kontrahenci
    WHERE nip = '1111111111' AND workspace_id = ws1 LIMIT 1;
  END IF;

  INSERT INTO public.kontrahenci (nazwa, nip, email, aktywny, workspace_id)
  VALUES ('Hurt Chemiczny Beta', '2222222222', 'beta@example.com', true, ws1)
  ON CONFLICT DO NOTHING
  RETURNING id INTO kontr2;

  IF kontr2 IS NULL THEN
    SELECT id INTO kontr2 FROM public.kontrahenci
    WHERE nip = '2222222222' AND workspace_id = ws1 LIMIT 1;
  END IF;

  -- Beta: one contractor (different tenant, separate isolation)
  INSERT INTO public.kontrahenci (nazwa, nip, aktywny, workspace_id)
  VALUES ('Dostawca Beta Only', '3333333333', true, ws2)
  ON CONFLICT DO NOTHING
  RETURNING id INTO kontr3;

  IF kontr3 IS NULL THEN
    SELECT id INTO kontr3 FROM public.kontrahenci
    WHERE nip = '3333333333' AND workspace_id = ws2 LIMIT 1;
  END IF;

  -- ── 8. TOWARY (products) ──────────────────────────────────────
  -- Alpha: 3 products
  INSERT INTO public.towary
    (nazwa, typ, jednostka, kategoria_id, stan_minimalny, aktywny, workspace_id)
  VALUES
    ('Płyn do mycia podłóg 1L', 'srodek_czyszczacy', 'szt', kat1, 10, true, ws1)
  ON CONFLICT DO NOTHING
  RETURNING id INTO prod1;

  IF prod1 IS NULL THEN
    SELECT id INTO prod1 FROM public.towary
    WHERE nazwa = 'Płyn do mycia podłóg 1L' AND workspace_id = ws1 LIMIT 1;
  END IF;

  INSERT INTO public.towary
    (nazwa, typ, jednostka, kategoria_id, stan_minimalny, aktywny, workspace_id)
  VALUES
    ('Papier toaletowy 100szt', 'papier_toaletowy', 'opak', kat2, 20, true, ws1)
  ON CONFLICT DO NOTHING
  RETURNING id INTO prod2;

  IF prod2 IS NULL THEN
    SELECT id INTO prod2 FROM public.towary
    WHERE nazwa = 'Papier toaletowy 100szt' AND workspace_id = ws1 LIMIT 1;
  END IF;

  INSERT INTO public.towary
    (nazwa, typ, jednostka, stan_minimalny, aktywny, workspace_id)
  VALUES
    ('Worki na śmieci 60L', 'worki', 'opak', 5, true, ws1)
  ON CONFLICT DO NOTHING
  RETURNING id INTO prod3;

  IF prod3 IS NULL THEN
    SELECT id INTO prod3 FROM public.towary
    WHERE nazwa = 'Worki na śmieci 60L' AND workspace_id = ws1 LIMIT 1;
  END IF;

  -- Beta: 1 product
  INSERT INTO public.towary (nazwa, jednostka, aktywny, workspace_id)
  VALUES ('Ściereczki mikrofiber', 'szt', true, ws2)
  ON CONFLICT DO NOTHING
  RETURNING id INTO prod4;

  IF prod4 IS NULL THEN
    SELECT id INTO prod4 FROM public.towary
    WHERE nazwa = 'Ściereczki mikrofiber' AND workspace_id = ws2 LIMIT 1;
  END IF;

  -- ── 9. STANY MAGAZYNOWE (Alpha only) ─────────────────────────
  INSERT INTO public.stany_magazynowe (towar_id, magazyn_id, ilosc, workspace_id)
  VALUES
    (prod1, mag1a, 45, ws1),
    (prod2, mag1a, 80, ws1),
    (prod3, mag1a, 18, ws1),
    (prod1, mag1b, 12, ws1),
    (prod2, mag1b, 30, ws1)
  ON CONFLICT (towar_id, magazyn_id) DO UPDATE
    SET ilosc = EXCLUDED.ilosc,
        updated_at = now();

  -- ── 10. FAKTURY ───────────────────────────────────────────────
  -- Alpha fak1: DRAFT invoice (robocza)
  SELECT id INTO fak1 FROM public.faktury
  WHERE numer = 'FV-STAGING-001' AND workspace_id = ws1 LIMIT 1;

  IF fak1 IS NULL THEN
    INSERT INTO public.faktury
      (numer, kontrahent_id, data_zakupu, typ, magazyn_id,
       status, price_mode, wartosc_netto, total_net, total_vat, total_gross,
       notatki, workspace_id)
    VALUES
      ('FV-STAGING-001', kontr1, current_date - 7, 'zakup', mag1a,
       'robocza', 'net', 123.00, 123.00, 28.29, 151.29,
       'Robocza faktura testowa – staging', ws1)
    RETURNING id INTO fak1;
  END IF;

  -- Alpha fak2: APPROVED invoice (zatwierdzona)
  SELECT id INTO fak2 FROM public.faktury
  WHERE numer = 'FV-STAGING-002' AND workspace_id = ws1 LIMIT 1;

  IF fak2 IS NULL THEN
    INSERT INTO public.faktury
      (numer, kontrahent_id, data_zakupu, typ, magazyn_id,
       status, price_mode, wartosc_netto, total_net, total_vat, total_gross,
       notatki, workspace_id)
    VALUES
      ('FV-STAGING-002', kontr2, current_date - 14, 'zakup', mag1a,
       'zatwierdzona', 'net', 250.00, 250.00, 57.50, 307.50,
       'Zatwierdzona faktura testowa – staging', ws1)
    RETURNING id INTO fak2;
  END IF;

  -- Beta fak3: DRAFT invoice (different tenant)
  SELECT id INTO fak3 FROM public.faktury
  WHERE numer = 'FV-STAGING-BETA-001' AND workspace_id = ws2 LIMIT 1;

  IF fak3 IS NULL THEN
    INSERT INTO public.faktury
      (numer, kontrahent_id, data_zakupu, typ, magazyn_id,
       status, price_mode, wartosc_netto,
       notatki, workspace_id)
    VALUES
      ('FV-STAGING-BETA-001', kontr3, current_date - 3, 'zakup', mag2a,
       'robocza', 'net', 60.00,
       'Robocza faktura Beta – staging', ws2)
    RETURNING id INTO fak3;
  END IF;

  -- ── 11. POZYCJE FAKTURY ───────────────────────────────────────
  -- fak1 (draft Alpha) – 2 positions
  INSERT INTO public.pozycje_faktury
    (faktura_id, towar_id, ilosc, cena_netto, vat_procent,
     raw_name, jednostka, line_total_net, original_price_type, workspace_id)
  SELECT
    fak1, prod1, 3, 15.00, 23,
    'Płyn do mycia 1L (PDF)', 'szt', 45.00, 'net', ws1
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pozycje_faktury
    WHERE faktura_id = fak1 AND towar_id = prod1
  );

  INSERT INTO public.pozycje_faktury
    (faktura_id, towar_id, ilosc, cena_netto, vat_procent,
     raw_name, jednostka, line_total_net, original_price_type, workspace_id)
  SELECT
    fak1, prod3, 2, 39.00, 23,
    'Worki 60L (PDF)', 'opak', 78.00, 'net', ws1
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pozycje_faktury
    WHERE faktura_id = fak1 AND towar_id = prod3
  );

  -- fak2 (approved Alpha) – 2 positions
  INSERT INTO public.pozycje_faktury
    (faktura_id, towar_id, ilosc, cena_netto, vat_procent,
     raw_name, jednostka, line_total_net, original_price_type, workspace_id)
  SELECT
    fak2, prod2, 5, 30.00, 23,
    'Papier toal 100szt', 'opak', 150.00, 'net', ws1
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pozycje_faktury
    WHERE faktura_id = fak2 AND towar_id = prod2
  );

  INSERT INTO public.pozycje_faktury
    (faktura_id, towar_id, ilosc, cena_netto, vat_procent,
     raw_name, jednostka, line_total_net, original_price_type, workspace_id)
  SELECT
    fak2, prod1, 4, 25.00, 23,
    'Płyn podłogi 1L', 'szt', 100.00, 'net', ws1
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pozycje_faktury
    WHERE faktura_id = fak2 AND towar_id = prod1
  );

  -- fak3 (draft Beta) – 1 position
  INSERT INTO public.pozycje_faktury
    (faktura_id, towar_id, ilosc, cena_netto, vat_procent,
     raw_name, jednostka, line_total_net, original_price_type, workspace_id)
  SELECT
    fak3, prod4, 6, 10.00, 23,
    'Ściereczki mikro', 'szt', 60.00, 'net', ws2
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pozycje_faktury
    WHERE faktura_id = fak3 AND towar_id = prod4
  );

  -- ── 12. DONE ──────────────────────────────────────────────────
  RAISE NOTICE '======================================================';
  RAISE NOTICE 'Seed complete.';
  RAISE NOTICE '  Workspace Alpha (uid1=%): %', uid1, ws1;
  RAISE NOTICE '  Workspace Beta  (uid2=%): %', uid2, ws2;
  RAISE NOTICE '  Products Alpha: %, %, %', prod1, prod2, prod3;
  RAISE NOTICE '  Product  Beta:  %', prod4;
  RAISE NOTICE '  Invoices Alpha: draft=%, approved=%', fak1, fak2;
  RAISE NOTICE '  Invoice  Beta:  draft=%', fak3;
  RAISE NOTICE '======================================================';

END $SEED$;
