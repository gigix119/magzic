-- Dodaje kolumnę settings JSONB do workspaces
-- Przechowuje wszystkie ustawienia per workspace w jednym polu
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;
