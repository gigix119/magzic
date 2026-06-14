-- ============================================================
-- MAGZIC — Live Schema Snapshot: 02_columns.sql
-- PURPOSE: List all columns in the public schema tables.
-- SAFE: SELECT only — no changes to the database.
-- RUN ON: STAGING first, then PRODUCTION.
-- PASTE OUTPUT INTO: results/STAGING_02_columns.txt / results/PROD_02_columns.txt
-- ============================================================

SELECT
  c.table_name,
  c.ordinal_position                                   AS col_order,
  c.column_name,
  c.data_type,
  c.udt_name,                                          -- e.g. "uuid", "_text" for TEXT[]
  c.character_maximum_length,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;
