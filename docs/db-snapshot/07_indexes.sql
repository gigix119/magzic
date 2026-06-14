-- ============================================================
-- MAGZIC — Live Schema Snapshot: 07_indexes.sql
-- PURPOSE: List all indexes on public schema tables.
--          Includes unique indexes (which back UNIQUE constraints).
-- SAFE: SELECT only — no changes to the database.
-- RUN ON: STAGING first, then PRODUCTION.
-- PASTE OUTPUT INTO: results/STAGING_07_indexes.txt / results/PROD_07_indexes.txt
-- ============================================================

SELECT
  i.schemaname,
  i.tablename,
  i.indexname,
  ix.indisunique                                       AS is_unique,
  ix.indisprimary                                      AS is_primary,
  i.indexdef
FROM pg_indexes i
JOIN pg_class  c  ON c.relname   = i.indexname
JOIN pg_index  ix ON ix.indexrelid = c.oid
WHERE i.schemaname = 'public'
ORDER BY i.tablename, i.indexname;
