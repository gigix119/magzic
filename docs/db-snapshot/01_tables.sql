-- ============================================================
-- MAGZIC — Live Schema Snapshot: 01_tables.sql
-- PURPOSE: List all tables in the public schema with RLS status.
-- SAFE: SELECT only — no changes to the database.
-- RUN ON: STAGING first, then PRODUCTION.
-- PASTE OUTPUT INTO: results/STAGING_01_tables.txt / results/PROD_01_tables.txt
-- ============================================================

SELECT
  t.schemaname                                         AS schema_name,
  t.tablename                                          AS table_name,
  t.tableowner                                         AS table_owner,
  t.rowsecurity                                        AS rls_enabled,
  COALESCE(s.n_live_tup, 0)                            AS approx_row_count
FROM pg_tables t
LEFT JOIN pg_stat_user_tables s
  ON s.schemaname = t.schemaname
  AND s.relname   = t.tablename
WHERE t.schemaname = 'public'
ORDER BY t.tablename;
