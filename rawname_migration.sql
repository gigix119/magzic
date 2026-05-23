-- Migration: add raw_name column to pozycje_faktury
-- Run once in Supabase SQL Editor (safe to re-run: IF NOT EXISTS guard)
-- Purpose: store the original PDF-extracted name for display in draft lines
--          (towar.nazwa may differ after manual assignment)

ALTER TABLE pozycje_faktury
  ADD COLUMN IF NOT EXISTS raw_name text;

-- Optional: backfill raw_name from existing rows that already have a towar_id
-- (fills with towar.nazwa as best-effort; can be left NULL for old rows)
-- UPDATE pozycje_faktury pf
-- SET raw_name = t.nazwa
-- FROM towary t
-- WHERE pf.towar_id = t.id
--   AND pf.raw_name IS NULL;

-- Index for debugging / searching by original name (optional)
-- CREATE INDEX IF NOT EXISTS idx_pozycje_faktury_raw_name ON pozycje_faktury (raw_name);
