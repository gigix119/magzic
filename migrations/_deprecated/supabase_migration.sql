-- ============================================================
-- DEPRECATED (audyt 2026-06): zawiera USING(true) łamiące izolację tenantów.
-- NIE URUCHAMIAĆ. Zachowane wyłącznie dla historii. Poprawne polityki: patrz
-- Prompty 17-18 / migrations/.
-- ============================================================

-- ============================================================
-- MAGZIC — migracja bazy danych
-- Wklej w Supabase SQL Editor i uruchom jednorazowo
-- ============================================================

-- Tabela ruchów magazynowych
CREATE TABLE IF NOT EXISTS ruchy_magazynowe (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  towar_id uuid REFERENCES towary(id),
  magazyn_zrodlowy_id uuid REFERENCES magazyny(id),
  magazyn_docelowy_id uuid REFERENCES magazyny(id),
  ilosc numeric NOT NULL,
  typ text NOT NULL,   -- purchase | issue | transfer | correction_plus | correction_minus
  powod text,
  faktura_id uuid REFERENCES faktury(id),
  pakiet_id uuid REFERENCES pakiety_sprzatania(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ruchy_magazynowe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON ruchy_magazynowe FOR ALL USING (true) WITH CHECK (true);

-- Dodaj kolumny do faktury
ALTER TABLE faktury ADD COLUMN IF NOT EXISTS status text DEFAULT 'robocza';
ALTER TABLE faktury ADD COLUMN IF NOT EXISTS magazyn_id uuid REFERENCES magazyny(id);
ALTER TABLE faktury ADD COLUMN IF NOT EXISTS wartosc_netto numeric DEFAULT 0;

-- Dodaj VAT do pozycji faktury
ALTER TABLE pozycje_faktury ADD COLUMN IF NOT EXISTS vat_procent numeric DEFAULT 23;

-- Upewnij się że stany_magazynowe ma UNIQUE na (towar_id, magazyn_id)
-- (wymagane do ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stany_magazynowe_towar_id_magazyn_id_key'
  ) THEN
    ALTER TABLE stany_magazynowe
      ADD CONSTRAINT stany_magazynowe_towar_id_magazyn_id_key
      UNIQUE (towar_id, magazyn_id);
  END IF;
END$$;
