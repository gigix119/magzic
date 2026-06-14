-- ============================================================
-- Magzic – Backup Restore Verification
-- Purpose : compare row counts of critical tables between
--           production and a freshly restored staging copy.
--
-- Usage   : run this query TWICE:
--             1. in the production SQL Editor  → record counts
--             2. in the staging SQL Editor     → compare counts
--
-- READ-ONLY : no writes, no side-effects.
-- ============================================================

SELECT
    table_name,
    row_count
FROM (

    SELECT 'workspaces'        AS table_name, COUNT(*) AS row_count FROM public.workspaces
    UNION ALL
    SELECT 'towary',                          COUNT(*)              FROM public.towary
    UNION ALL
    SELECT 'kontrahenci',                     COUNT(*)              FROM public.kontrahenci
    UNION ALL
    SELECT 'faktury',                         COUNT(*)              FROM public.faktury
    UNION ALL
    SELECT 'pozycje_faktury',                 COUNT(*)              FROM public.pozycje_faktury
    UNION ALL
    SELECT 'stany_magazynowe',                COUNT(*)              FROM public.stany_magazynowe
    UNION ALL
    SELECT 'ruchy_magazynowe',                COUNT(*)              FROM public.ruchy_magazynowe

) counts
ORDER BY table_name;

-- ── How to interpret ──────────────────────────────────────────
-- Each row shows the live count in this database right now.
-- Run the same query on both production and staging after a
-- restore and compare results side by side.
--
-- PASS  : every table count matches between prod and staging
--         (or differs only by rows written to prod AFTER the
--          backup was taken — that is expected and acceptable).
--
-- FAIL  : staging count is 0 for tables that should have data,
--         or staging is missing tables entirely (restore failed).
-- ─────────────────────────────────────────────────────────────
