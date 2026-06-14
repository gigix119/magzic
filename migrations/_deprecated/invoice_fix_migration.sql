-- ============================================================
-- DEPRECATED (audyt 2026-06): zawiera USING(true) łamiące izolację tenantów.
-- NIE URUCHAMIAĆ. Zachowane wyłącznie dla historii. Poprawne polityki: patrz
-- Prompty 17-18 / migrations/.
-- ============================================================

-- ============================================================
-- Magzic — Invoice Fix Migration
-- Idempotentny — można wykonać wielokrotnie bez efektów ubocznych.
-- Wklej całość do Supabase SQL Editor i wykonaj.
-- ============================================================


-- ============================================================
-- 1. BRAKUJĄCE KOLUMNY
-- ============================================================

-- faktury
ALTER TABLE faktury
  ADD COLUMN IF NOT EXISTS status       text      DEFAULT 'robocza';
ALTER TABLE faktury
  ADD COLUMN IF NOT EXISTS wartosc_netto numeric   DEFAULT 0;
ALTER TABLE faktury
  ADD COLUMN IF NOT EXISTS magazyn_id   uuid      REFERENCES magazyny(id);

-- Ustaw domyślny status dla istniejących wierszy bez statusu
UPDATE faktury
SET status = 'robocza'
WHERE status IS NULL;

-- pozycje_faktury — per-pozycja magazyn (nadpisuje magazyn z nagłówka faktury)
ALTER TABLE pozycje_faktury
  ADD COLUMN IF NOT EXISTS magazyn_id uuid REFERENCES magazyny(id);

-- ruchy_magazynowe — powiązanie z fakturą
ALTER TABLE ruchy_magazynowe
  ADD COLUMN IF NOT EXISTS faktura_id uuid REFERENCES faktury(id);

-- stany_magazynowe — znacznik czasu ostatniej modyfikacji
ALTER TABLE stany_magazynowe
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();


-- ============================================================
-- 2. DEDUPLIKACJA stany_magazynowe
--    Scal wiersze o tym samym (towar_id, magazyn_id):
--      - wiersz z MIN(id) zostaje,
--      - jego ilosc = suma wszystkich duplikatów,
--      - pozostałe wiersze są usuwane.
--    Bezpieczne gdy nie ma duplikatów — nic nie zmienia.
-- ============================================================

WITH grupy AS (
  SELECT
    towar_id,
    magazyn_id,
    MIN(id)    AS keep_id,
    SUM(ilosc) AS suma_ilosc
  FROM stany_magazynowe
  GROUP BY towar_id, magazyn_id
  HAVING COUNT(*) > 1
)
UPDATE stany_magazynowe sm
SET
  ilosc      = g.suma_ilosc,
  updated_at = now()
FROM grupy g
WHERE sm.id = g.keep_id;

DELETE FROM stany_magazynowe
WHERE id NOT IN (
  SELECT MIN(id)
  FROM stany_magazynowe
  GROUP BY towar_id, magazyn_id
);


-- ============================================================
-- 3. UNIQUE CONSTRAINT na stany_magazynowe
--    Wymagany przez upsert z onConflict: 'towar_id,magazyn_id'.
--    Dodawany tylko jeśli jeszcze nie istnieje.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'stany_magazynowe_towar_id_magazyn_id_key'
  ) THEN
    ALTER TABLE stany_magazynowe
      ADD CONSTRAINT stany_magazynowe_towar_id_magazyn_id_key
      UNIQUE (towar_id, magazyn_id);
  END IF;
END
$$;


-- ============================================================
-- 4. RLS — ROW LEVEL SECURITY
-- ============================================================

-- ruchy_magazynowe
ALTER TABLE ruchy_magazynowe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON ruchy_magazynowe;
CREATE POLICY "allow all" ON ruchy_magazynowe
  FOR ALL USING (true) WITH CHECK (true);

-- stany_magazynowe
ALTER TABLE stany_magazynowe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON stany_magazynowe;
CREATE POLICY "allow all" ON stany_magazynowe
  FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 5. INDEKSY
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_stany_magazyn
  ON stany_magazynowe(magazyn_id);
CREATE INDEX IF NOT EXISTS idx_stany_towar
  ON stany_magazynowe(towar_id);
CREATE INDEX IF NOT EXISTS idx_pozycje_faktura
  ON pozycje_faktury(faktura_id);
CREATE INDEX IF NOT EXISTS idx_ruchy_faktura
  ON ruchy_magazynowe(faktura_id);


-- ============================================================
-- 6. DIAGNOSTYKA
-- ============================================================

-- 6a. Liczba rekordów w kluczowych tabelach
SELECT 'stany_magazynowe' AS tabela, COUNT(*) AS rekordow FROM stany_magazynowe
UNION ALL
SELECT 'pozycje_faktury',             COUNT(*)             FROM pozycje_faktury
UNION ALL
SELECT 'faktury',                     COUNT(*)             FROM faktury
UNION ALL
SELECT 'ruchy_magazynowe',            COUNT(*)             FROM ruchy_magazynowe;

-- 6b. Wykrywanie duplikatów — po migracji powinno zwrócić 0 wierszy
SELECT
  towar_id,
  magazyn_id,
  COUNT(*) AS duplikaty
FROM stany_magazynowe
GROUP BY towar_id, magazyn_id
HAVING COUNT(*) > 1
ORDER BY duplikaty DESC;

-- 6c. Stan per towar/magazyn (wszystkie niezerowe)
SELECT
  sm.id,
  t.nazwa        AS towar,
  t.jednostka,
  m.nazwa        AS magazyn,
  sm.ilosc,
  sm.updated_at
FROM stany_magazynowe sm
LEFT JOIN towary   t ON t.id = sm.towar_id
LEFT JOIN magazyny m ON m.id = sm.magazyn_id
WHERE sm.ilosc > 0
ORDER BY m.nazwa, t.nazwa;

-- 6d. Ostatnie 20 ruchów magazynowych
SELECT
  rm.created_at,
  rm.typ,
  t.nazwa            AS towar,
  mz.nazwa           AS z_magazynu,
  md.nazwa           AS do_magazynu,
  rm.ilosc,
  rm.powod,
  rm.faktura_id
FROM ruchy_magazynowe rm
LEFT JOIN towary   t  ON t.id  = rm.towar_id
LEFT JOIN magazyny mz ON mz.id = rm.magazyn_zrodlowy_id
LEFT JOIN magazyny md ON md.id = rm.magazyn_docelowy_id
ORDER BY rm.created_at DESC
LIMIT 20;

-- 6e. Pozycje faktury bez towaru (podejrzane — towar_id IS NULL)
SELECT
  pf.id,
  f.numer        AS faktura,
  pf.ilosc,
  pf.cena_netto,
  pf.magazyn_id
FROM pozycje_faktury pf
LEFT JOIN faktury f ON f.id = pf.faktura_id
WHERE pf.towar_id IS NULL;
