-- ============================================================
-- Magzic — Invoice Fix Migration
-- Wklej całość do Supabase SQL Editor i wykonaj jednorazowo.
-- ============================================================

-- 1. Kolumny w faktury
ALTER TABLE faktury
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'robocza';
ALTER TABLE faktury
  ADD COLUMN IF NOT EXISTS wartosc_netto numeric DEFAULT 0;
ALTER TABLE faktury
  ADD COLUMN IF NOT EXISTS magazyn_id uuid REFERENCES magazyny(id);

-- Ustaw status 'robocza' dla starych faktur bez statusu
UPDATE faktury SET status = 'robocza' WHERE status IS NULL;

-- 2. Kolumna magazyn_id w pozycje_faktury (per-pozycja magazyn)
ALTER TABLE pozycje_faktury
  ADD COLUMN IF NOT EXISTS magazyn_id uuid REFERENCES magazyny(id);

-- 3. Kolumna faktura_id w ruchy_magazynowe
ALTER TABLE ruchy_magazynowe
  ADD COLUMN IF NOT EXISTS faktura_id uuid REFERENCES faktury(id);

-- 4. Unique constraint w stany_magazynowe (wymagany dla UPSERT)
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
END
$$;

-- 5. RLS dla ruchy_magazynowe
ALTER TABLE ruchy_magazynowe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON ruchy_magazynowe;
CREATE POLICY "allow all" ON ruchy_magazynowe
  FOR ALL USING (true) WITH CHECK (true);

-- 6. RLS dla stany_magazynowe (upewnij się że działa)
ALTER TABLE stany_magazynowe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON stany_magazynowe;
CREATE POLICY "allow all" ON stany_magazynowe
  FOR ALL USING (true) WITH CHECK (true);

-- 7. Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_stany_magazyn
  ON stany_magazynowe(magazyn_id);
CREATE INDEX IF NOT EXISTS idx_stany_towar
  ON stany_magazynowe(towar_id);
CREATE INDEX IF NOT EXISTS idx_pozycje_faktura
  ON pozycje_faktury(faktura_id);
CREATE INDEX IF NOT EXISTS idx_ruchy_faktura
  ON ruchy_magazynowe(faktura_id);

-- 8. Kolumna updated_at w stany_magazynowe (opcjonalna)
ALTER TABLE stany_magazynowe
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 9. Diagnostyka — sprawdź aktualny stan
SELECT 'stany_magazynowe' AS tabela, COUNT(*) AS rekordow FROM stany_magazynowe
UNION ALL
SELECT 'pozycje_faktury', COUNT(*) FROM pozycje_faktury
UNION ALL
SELECT 'faktury', COUNT(*) FROM faktury
UNION ALL
SELECT 'ruchy_magazynowe', COUNT(*) FROM ruchy_magazynowe;

-- 10. Podejrzane pozycje (towar_id = NULL) — przed naprawą
SELECT id, faktura_id, ilosc, cena_netto
FROM pozycje_faktury
WHERE towar_id IS NULL;
