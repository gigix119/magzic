-- ============================================================
-- MAGZIC — Live Schema Snapshot: 03_rls_policies.sql
-- PURPOSE: List all Row Level Security policies in the public schema.
--          Shows policy name, command (ALL/SELECT/INSERT/UPDATE/DELETE),
--          USING clause, WITH CHECK clause, and which roles it applies to.
-- SAFE: SELECT only — no changes to the database.
-- RUN ON: STAGING first, then PRODUCTION.
-- PASTE OUTPUT INTO: results/STAGING_03_rls_policies.txt / results/PROD_03_rls_policies.txt
-- ============================================================

SELECT
  p.schemaname,
  p.tablename,
  p.policyname,
  p.permissive,                                        -- PERMISSIVE or RESTRICTIVE
  p.roles,                                             -- e.g. {authenticated}, {public}
  p.cmd,                                               -- ALL / SELECT / INSERT / UPDATE / DELETE
  p.qual                    AS using_clause,           -- USING expression
  p.with_check              AS with_check_clause       -- WITH CHECK expression
FROM pg_policies p
WHERE p.schemaname = 'public'
ORDER BY p.tablename, p.policyname;
