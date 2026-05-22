-- ============================================================
-- Magzic — Warehouse Fix Migration
-- Idempotentny — można wykonać wielokrotnie.
-- Wklej całość do Supabase SQL Editor i wykonaj.
-- ============================================================


-- ============================================================
-- 1. KOLUMNY ARCHIWIZACJI TOWARÓW
-- ============================================================

ALTER TABLE towary
  ADD COLUMN IF NOT EXISTS archived_at    timestamptz;
ALTER TABLE towary
  ADD COLUMN IF NOT EXISTS archive_reason text;

-- Indeks — filtry archived_at IS NULL są w każdym fetchData
CREATE INDEX IF NOT EXISTS idx_towary_archived
  ON towary(archived_at)
  WHERE archived_at IS NOT NULL;


-- ============================================================
-- 2. RLS — upewnij się że stany_magazynowe są dostępne
-- ============================================================

ALTER TABLE stany_magazynowe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON stany_magazynowe;
CREATE POLICY "allow all" ON stany_magazynowe
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruchy_magazynowe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON ruchy_magazynowe;
CREATE POLICY "allow all" ON ruchy_magazynowe
  FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 3. DIAGNOSTYKA — weryfikacja stanu danych
-- ============================================================

-- 3a. Stan per magazyn (ile rodzajów towarów i łączna ilość)
SELECT
  m.nazwa            AS magazyn,
  COUNT(DISTINCT sm.towar_id) FILTER (WHERE sm.ilosc > 0) AS rodzajow_towarow,
  COALESCE(SUM(sm.ilosc) FILTER (WHERE sm.ilosc > 0), 0) AS lacznie_sztuk
FROM magazyny m
LEFT JOIN stany_magazynowe sm ON sm.magazyn_id = m.id
GROUP BY m.id, m.nazwa
ORDER BY m.nazwa;

-- 3b. Towary z niezerowym stanem (czy cokolwiek jest w bazie)
SELECT
  t.nazwa        AS towar,
  t.jednostka,
  m.nazwa        AS magazyn,
  sm.ilosc,
  sm.updated_at
FROM stany_magazynowe sm
JOIN  towary   t ON t.id = sm.towar_id
JOIN  magazyny m ON m.id = sm.magazyn_id
WHERE sm.ilosc > 0
ORDER BY m.nazwa, t.nazwa;

-- 3c. Zarchiwizowane towary
SELECT id, nazwa, archived_at, archive_reason
FROM towary
WHERE archived_at IS NOT NULL
ORDER BY archived_at DESC;

-- 3d. Towary z najwyższą łączną ilością
SELECT
  t.nazwa,
  t.jednostka,
  SUM(sm.ilosc) AS lacznie
FROM towary t
JOIN stany_magazynowe sm ON sm.towar_id = t.id
WHERE sm.ilosc > 0
GROUP BY t.id, t.nazwa, t.jednostka
ORDER BY lacznie DESC
LIMIT 20;
