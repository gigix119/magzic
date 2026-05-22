-- price_alerts_migration.sql
-- Wklej całą zawartość w Supabase SQL Editor i kliknij "Run"

CREATE TABLE IF NOT EXISTS alerty_cenowe_faktury (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  towar_id        uuid        REFERENCES towary(id)       ON DELETE CASCADE,
  faktura_id      uuid        REFERENCES faktury(id)      ON DELETE CASCADE,
  kontrahent_id   uuid        REFERENCES kontrahenci(id)  ON DELETE SET NULL,
  typ             text        NOT NULL,
  severity        text        NOT NULL,
  title           text        NOT NULL,
  description     text        NOT NULL,
  cena_aktualna   numeric,
  cena_referencyjna numeric,
  roznica_procent numeric,
  przeczytany     boolean     DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acf_przeczytany ON alerty_cenowe_faktury(przeczytany);
CREATE INDEX IF NOT EXISTS idx_acf_towar       ON alerty_cenowe_faktury(towar_id);
CREATE INDEX IF NOT EXISTS idx_acf_faktura     ON alerty_cenowe_faktury(faktura_id);
CREATE INDEX IF NOT EXISTS idx_acf_created     ON alerty_cenowe_faktury(created_at DESC);

ALTER TABLE alerty_cenowe_faktury ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all" ON alerty_cenowe_faktury;
CREATE POLICY "allow all" ON alerty_cenowe_faktury
  FOR ALL USING (true) WITH CHECK (true);
