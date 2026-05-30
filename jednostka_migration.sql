-- Migration: add jednostka column to pozycje_faktury
-- Run once in Supabase SQL Editor (safe to re-run: IF NOT EXISTS guard)
-- Purpose: store the unit of measure from the PDF/invoice line
--          (independent of towary.jednostka — the invoice may use a different unit)

ALTER TABLE public.pozycje_faktury
  ADD COLUMN IF NOT EXISTS jednostka text;

-- Reload PostgREST schema cache (Supabase)
NOTIFY pgrst, 'reload schema';
