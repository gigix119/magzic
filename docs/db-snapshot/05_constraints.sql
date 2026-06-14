-- ============================================================
-- MAGZIC — Live Schema Snapshot: 05_constraints.sql
-- PURPOSE: List all table constraints (PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK)
--          with the columns they involve and foreign key targets.
-- SAFE: SELECT only — no changes to the database.
-- RUN ON: STAGING first, then PRODUCTION.
-- PASTE OUTPUT INTO: results/STAGING_05_constraints.txt / results/PROD_05_constraints.txt
-- ============================================================

SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  kcu.ordinal_position,
  ccu.table_name                                       AS foreign_table,
  ccu.column_name                                      AS foreign_column,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON  kcu.constraint_name = tc.constraint_name
  AND kcu.table_schema    = tc.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON  ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema    = tc.table_schema
  AND tc.constraint_type  = 'FOREIGN KEY'
LEFT JOIN information_schema.referential_constraints rc
  ON  rc.constraint_name        = tc.constraint_name
  AND rc.constraint_schema      = tc.table_schema
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;
