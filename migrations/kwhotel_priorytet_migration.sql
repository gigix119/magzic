-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Uruchom ręcznie w panelu Supabase → SQL Editor

-- ─── zlecenia: typ priorytetu z importu KW Hotel ────────────────────────────
-- priorytet_typ: 'zmiana' | 'przyjazd' | 'wyjazd' (rozróżnienie niezależne od
--   istniejącego pola `priorytet`, które steruje kolorem/sortowaniem niski/normalny/pilny)
-- zrodlo_importu: 'kwhotel' | 'reczne' | 'rezerwacja'
ALTER TABLE public.zlecenia ADD COLUMN IF NOT EXISTS priorytet_typ text;
ALTER TABLE public.zlecenia ADD COLUMN IF NOT EXISTS zrodlo_importu text;
