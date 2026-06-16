-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Rozszerzenie tabeli lokale o pola lokalizacji i dodatkowe metadane
-- Uruchom ręcznie w panelu Supabase → SQL Editor

ALTER TABLE public.lokale ADD COLUMN IF NOT EXISTS lokalizacja text;
ALTER TABLE public.lokale ADD COLUMN IF NOT EXISTS lokalizacja_kod text;
ALTER TABLE public.lokale ADD COLUMN IF NOT EXISTS metraz int;
ALTER TABLE public.lokale ADD COLUMN IF NOT EXISTS zwierzeta_ok boolean DEFAULT false;
ALTER TABLE public.lokale ADD COLUMN IF NOT EXISTS parking boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_lokale_lokalizacja ON public.lokale(workspace_id, lokalizacja_kod);

-- ROLLBACK (jeśli potrzeba cofnąć):
-- ALTER TABLE public.lokale DROP COLUMN IF EXISTS lokalizacja;
-- ALTER TABLE public.lokale DROP COLUMN IF EXISTS lokalizacja_kod;
-- ALTER TABLE public.lokale DROP COLUMN IF EXISTS metraz;
-- ALTER TABLE public.lokale DROP COLUMN IF EXISTS zwierzeta_ok;
-- ALTER TABLE public.lokale DROP COLUMN IF EXISTS parking;
-- DROP INDEX IF EXISTS idx_lokale_lokalizacja;
