-- ============================================================
-- MAGZIC — dane testowe
-- Uruchom PO migracji. Używa nazw zamiast UUID.
-- ============================================================

-- Stany magazynowe — Magazyn Główny
INSERT INTO stany_magazynowe (towar_id, magazyn_id, ilosc)
SELECT t.id, m.id, 30 FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%CLIN%szyb%' AND m.nazwa ILIKE '%Główny%'
ON CONFLICT (towar_id, magazyn_id) DO UPDATE SET ilosc = EXCLUDED.ilosc;

INSERT INTO stany_magazynowe (towar_id, magazyn_id, ilosc)
SELECT t.id, m.id, 120 FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%papier toaletowy%' AND m.nazwa ILIKE '%Główny%'
ON CONFLICT (towar_id, magazyn_id) DO UPDATE SET ilosc = EXCLUDED.ilosc;

INSERT INTO stany_magazynowe (towar_id, magazyn_id, ilosc)
SELECT t.id, m.id, 80 FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%worki%śmieci%' AND m.nazwa ILIKE '%Główny%'
ON CONFLICT (towar_id, magazyn_id) DO UPDATE SET ilosc = EXCLUDED.ilosc;

INSERT INTO stany_magazynowe (towar_id, magazyn_id, ilosc)
SELECT t.id, m.id, 20 FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%płyn%podłóg%' AND m.nazwa ILIKE '%Główny%'
ON CONFLICT (towar_id, magazyn_id) DO UPDATE SET ilosc = EXCLUDED.ilosc;

INSERT INTO stany_magazynowe (towar_id, magazyn_id, ilosc)
SELECT t.id, m.id, 25 FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%płyn%WC%' AND m.nazwa ILIKE '%Główny%'
ON CONFLICT (towar_id, magazyn_id) DO UPDATE SET ilosc = EXCLUDED.ilosc;

-- Stany magazynowe — Magazyn Sprzątanie
INSERT INTO stany_magazynowe (towar_id, magazyn_id, ilosc)
SELECT t.id, m.id, 8 FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%CLIN%szyb%' AND m.nazwa ILIKE '%Sprzątanie%'
ON CONFLICT (towar_id, magazyn_id) DO UPDATE SET ilosc = EXCLUDED.ilosc;

INSERT INTO stany_magazynowe (towar_id, magazyn_id, ilosc)
SELECT t.id, m.id, 30 FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%papier toaletowy%' AND m.nazwa ILIKE '%Sprzątanie%'
ON CONFLICT (towar_id, magazyn_id) DO UPDATE SET ilosc = EXCLUDED.ilosc;

INSERT INTO stany_magazynowe (towar_id, magazyn_id, ilosc)
SELECT t.id, m.id, 12 FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%ręcznik%' AND m.nazwa ILIKE '%Sprzątanie%'
ON CONFLICT (towar_id, magazyn_id) DO UPDATE SET ilosc = EXCLUDED.ilosc;

INSERT INTO stany_magazynowe (towar_id, magazyn_id, ilosc)
SELECT t.id, m.id, 20 FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%rękawic%' AND m.nazwa ILIKE '%Sprzątanie%'
ON CONFLICT (towar_id, magazyn_id) DO UPDATE SET ilosc = EXCLUDED.ilosc;

INSERT INTO stany_magazynowe (towar_id, magazyn_id, ilosc)
SELECT t.id, m.id, 15 FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%worki%śmieci%' AND m.nazwa ILIKE '%Sprzątanie%'
ON CONFLICT (towar_id, magazyn_id) DO UPDATE SET ilosc = EXCLUDED.ilosc;

-- Stany magazynowe — Magazyn Techniczny
INSERT INTO stany_magazynowe (towar_id, magazyn_id, ilosc)
SELECT t.id, m.id, 12 FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%żarówka%E27%' AND m.nazwa ILIKE '%Techniczn%'
ON CONFLICT (towar_id, magazyn_id) DO UPDATE SET ilosc = EXCLUDED.ilosc;

INSERT INTO stany_magazynowe (towar_id, magazyn_id, ilosc)
SELECT t.id, m.id, 6 FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%żarówka%G9%' AND m.nazwa ILIKE '%Techniczn%'
ON CONFLICT (towar_id, magazyn_id) DO UPDATE SET ilosc = EXCLUDED.ilosc;

-- Przykładowe ruchy historyczne (ostatnie 30 dni)
INSERT INTO ruchy_magazynowe (towar_id, magazyn_docelowy_id, ilosc, typ, powod, created_at)
SELECT t.id, m.id, 50, 'purchase', 'Dostawa FV/2025/001', now() - interval '25 days'
FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%papier toaletowy%' AND m.nazwa ILIKE '%Główny%';

INSERT INTO ruchy_magazynowe (towar_id, magazyn_zrodlowy_id, ilosc, typ, powod, created_at)
SELECT t.id, m.id, 10, 'issue', 'sprzątanie', now() - interval '20 days'
FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%papier toaletowy%' AND m.nazwa ILIKE '%Główny%';

INSERT INTO ruchy_magazynowe (towar_id, magazyn_zrodlowy_id, ilosc, typ, powod, created_at)
SELECT t.id, m.id, 5, 'issue', 'sprzątanie', now() - interval '14 days'
FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%CLIN%szyb%' AND m.nazwa ILIKE '%Główny%';

INSERT INTO ruchy_magazynowe (towar_id, magazyn_zrodlowy_id, magazyn_docelowy_id, ilosc, typ, powod, created_at)
SELECT t.id, mz.id, md.id, 8, 'transfer', 'Uzupełnienie Sprzątania', now() - interval '7 days'
FROM towary t, magazyny mz, magazyny md
WHERE t.nazwa ILIKE '%CLIN%szyb%'
  AND mz.nazwa ILIKE '%Główny%'
  AND md.nazwa ILIKE '%Sprzątanie%';

INSERT INTO ruchy_magazynowe (towar_id, magazyn_zrodlowy_id, ilosc, typ, powod, created_at)
SELECT t.id, m.id, 3, 'issue', 'sprzątanie', now() - interval '3 days'
FROM towary t, magazyny m
WHERE t.nazwa ILIKE '%CLIN%szyb%' AND m.nazwa ILIKE '%Sprzątanie%';
