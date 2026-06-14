-- ============================================================
-- MAGZIC — Live Schema Snapshot: 04_functions.sql
-- PURPOSE: List all user-defined functions in the public schema.
--          Shows language, security type (DEFINER vs INVOKER),
--          search_path config, arguments and return type.
-- SAFE: SELECT only — no changes to the database.
-- RUN ON: STAGING first, then PRODUCTION.
-- PASTE OUTPUT INTO: results/STAGING_04_functions.txt / results/PROD_04_functions.txt
-- ============================================================

SELECT
  n.nspname                                            AS schema_name,
  p.proname                                            AS function_name,
  pg_get_function_arguments(p.oid)                     AS arguments,
  pg_get_function_result(p.oid)                        AS return_type,
  l.lanname                                            AS language,
  CASE p.prosecdef
    WHEN true  THEN 'SECURITY DEFINER'
    ELSE            'SECURITY INVOKER'
  END                                                  AS security_type,
  p.proconfig                                          AS config_params,   -- includes search_path
  p.prokind                                            AS kind,            -- f=function, p=procedure, a=aggregate, w=window
  p.proisstrict                                        AS is_strict,
  p.provolatile                                        AS volatility       -- i=immutable, s=stable, v=volatile
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l  ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.prokind IN ('f', 'p')                          -- functions and procedures only
ORDER BY p.proname;
