-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Migracja: tabele lokale, rezerwacje, lokale_external_map
-- Projekt: magzic
-- Data: 2026-06-16
-- Opis: Tworzy tabele do zarządzania lokalami i rezerwacjami.
--        Fundament pod sync z KW HOTEL API.
-- Zastosować ręcznie w panelu Supabase (SQL Editor).
-- =============================================================================

-- ── LOKALE (apartamenty / pokoje) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lokale (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  nazwa              text NOT NULL CHECK (char_length(nazwa) >= 1),
  adres              text,
  typ                text DEFAULT 'apartament',
  pojemnosc          int DEFAULT 2,
  domyslny_pakiet_id uuid REFERENCES public.pakiety_sprzatania(id) ON DELETE SET NULL,
  notatki            text,
  aktywny            boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lokale_workspace ON public.lokale (workspace_id);

-- ── REZERWACJE ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rezerwacje (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lokal_id                uuid REFERENCES public.lokale(id) ON DELETE SET NULL,
  external_reservation_id text,
  external_source         text,

  gosc_nazwa              text,
  gosc_email              text,
  gosc_telefon            text,
  liczba_gosci            int DEFAULT 1,

  checkin_at              date NOT NULL,
  checkout_at             date NOT NULL,

  status                  text NOT NULL DEFAULT 'potwierdzona'
                            CHECK (status IN ('wstepna','potwierdzona','zameldowana','wymeldowana','anulowana')),

  notatki                 text,
  flagi                   jsonb DEFAULT '{}',

  przygotowanie_id        uuid,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rezerwacje_workspace  ON public.rezerwacje (workspace_id);
CREATE INDEX IF NOT EXISTS idx_rezerwacje_lokal      ON public.rezerwacje (lokal_id);
CREATE INDEX IF NOT EXISTS idx_rezerwacje_checkin    ON public.rezerwacje (workspace_id, checkin_at);
CREATE INDEX IF NOT EXISTS idx_rezerwacje_external   ON public.rezerwacje (workspace_id, external_reservation_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rezerwacje_external_unique
  ON public.rezerwacje (workspace_id, external_source, external_reservation_id)
  WHERE external_reservation_id IS NOT NULL;

-- ── MAPOWANIE LOKALI ZEWNĘTRZNYCH ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lokale_external_map (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lokal_id           uuid NOT NULL REFERENCES public.lokale(id) ON DELETE CASCADE,
  external_source    text NOT NULL,
  external_room_id   text NOT NULL,
  external_room_name text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, external_source, external_room_id)
);

-- ── UPDATED_AT TRIGGERS ───────────────────────────────────────────────────────
-- set_updated_at() już istnieje z migracji naprawy — nie tworzymy ponownie.
-- Jeśli naprawy_migration.sql nie został uruchomiony, odkomentuj blok poniżej:
--
-- CREATE OR REPLACE FUNCTION public.set_updated_at()
-- RETURNS TRIGGER LANGUAGE plpgsql AS $$
-- BEGIN NEW.updated_at = now(); RETURN NEW; END;
-- $$;

DROP TRIGGER IF EXISTS lokale_set_updated_at ON public.lokale;
CREATE TRIGGER lokale_set_updated_at
  BEFORE UPDATE ON public.lokale
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS rezerwacje_set_updated_at ON public.rezerwacje;
CREATE TRIGGER rezerwacje_set_updated_at
  BEFORE UPDATE ON public.rezerwacje
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS (wzorzec owner_user_id) ───────────────────────────────────────────────

ALTER TABLE public.lokale ENABLE ROW LEVEL SECURITY;
CREATE POLICY lokale_select ON public.lokale FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY lokale_insert ON public.lokale FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY lokale_update ON public.lokale FOR UPDATE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY lokale_delete ON public.lokale FOR DELETE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

ALTER TABLE public.rezerwacje ENABLE ROW LEVEL SECURITY;
CREATE POLICY rezerwacje_select ON public.rezerwacje FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY rezerwacje_insert ON public.rezerwacje FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY rezerwacje_update ON public.rezerwacje FOR UPDATE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY rezerwacje_delete ON public.rezerwacje FOR DELETE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

ALTER TABLE public.lokale_external_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY lokale_ext_select ON public.lokale_external_map FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY lokale_ext_insert ON public.lokale_external_map FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY lokale_ext_update ON public.lokale_external_map FOR UPDATE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));
CREATE POLICY lokale_ext_delete ON public.lokale_external_map FOR DELETE
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()));

-- =============================================================================
-- ROLLBACK (uruchomić ręcznie jeśli migracja musi być cofnięta)
-- =============================================================================
-- DROP TABLE IF EXISTS public.lokale_external_map CASCADE;
-- DROP TABLE IF EXISTS public.rezerwacje CASCADE;
-- DROP TABLE IF EXISTS public.lokale CASCADE;
-- =============================================================================
