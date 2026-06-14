-- ============================================================
-- MAGZIC — Live Schema Snapshot: 06_triggers.sql
-- PURPOSE: List all triggers on public schema tables AND on auth.users
--          (auth triggers are critical for workspace/profile auto-creation).
-- SAFE: SELECT only — no changes to the database.
-- RUN ON: STAGING first, then PRODUCTION.
-- PASTE OUTPUT INTO: results/STAGING_06_triggers.txt / results/PROD_06_triggers.txt
-- ============================================================

-- Part 1: triggers on public schema tables
SELECT
  'public'                                             AS schema_name,
  trigger_name,
  event_manipulation,
  event_object_schema,
  event_object_table,
  action_timing,
  action_orientation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name, event_manipulation

UNION ALL

-- Part 2: triggers on auth.users (Supabase auth hooks for workspace creation)
SELECT
  'auth'                                               AS schema_name,
  trigger_name,
  event_manipulation,
  event_object_schema,
  event_object_table,
  action_timing,
  action_orientation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table  = 'users'
ORDER BY schema_name, event_object_table, trigger_name;
