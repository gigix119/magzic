-- ============================================================
-- Magzic — Invoice Parser Fix Migration (2026-06-03)
-- Safe to run multiple times (IF NOT EXISTS / DEFAULT).
-- ============================================================

-- faktury — price mode and totals
ALTER TABLE faktury
  ADD COLUMN IF NOT EXISTS price_mode        TEXT  DEFAULT 'unknown'
    CHECK (price_mode IN ('net', 'gross', 'mixed', 'unknown')),
  ADD COLUMN IF NOT EXISTS total_net         NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total_vat         NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total_gross       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS amount_due        NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS detected_columns  TEXT[],
  ADD COLUMN IF NOT EXISTS parser_warnings   TEXT[],
  ADD COLUMN IF NOT EXISTS math_valid        BOOLEAN;

-- pozycje_faktury — brutto prices, vat amount, service flag, parser metadata
ALTER TABLE pozycje_faktury
  ADD COLUMN IF NOT EXISTS unit_price_gross    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS line_total_net      NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS line_total_gross    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS vat_amount          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS original_price_type TEXT  DEFAULT 'unknown'
    CHECK (original_price_type IN ('net', 'gross', 'unknown')),
  ADD COLUMN IF NOT EXISTS is_service          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS parser_confidence   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS parser_warnings     TEXT[];

-- Back-fill existing rows with safe defaults
UPDATE faktury SET price_mode = 'unknown' WHERE price_mode IS NULL;
UPDATE pozycje_faktury SET original_price_type = 'unknown' WHERE original_price_type IS NULL;
UPDATE pozycje_faktury SET is_service = false WHERE is_service IS NULL;
