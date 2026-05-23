-- sku_migration.sql
-- Adds SKU column to towary table and supporting index.
-- Safe to run multiple times (idempotent).

-- Step 1: Add SKU column
ALTER TABLE towary ADD COLUMN IF NOT EXISTS sku text;

-- Step 2: Index for fast SKU-exact lookups (only indexes rows that have a SKU)
CREATE INDEX IF NOT EXISTS idx_towary_sku ON towary(sku) WHERE sku IS NOT NULL;

-- Step 3: Diagnostics
SELECT
  COUNT(*)                            FILTER (WHERE sku IS NOT NULL) AS z_sku,
  COUNT(*)                            FILTER (WHERE sku IS NULL)     AS bez_sku,
  COUNT(*)                                                           AS razem
FROM towary;
