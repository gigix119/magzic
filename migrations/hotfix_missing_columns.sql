-- =============================================================================
-- NIE URUCHAMIAĆ AUTOMATYCZNIE
-- Hotfix: brakujące kolumny blokujące operacje magazynowe
-- Projekt: magzic
-- Data: 2026-06-26
-- Opis:
--   1. ruchy_magazynowe.reversed_at — referowane przez P8/P9/P10/P11/P12/P13
--      (warehouse_*_migration.sql) i src/utils/inventoryReconciliation.js,
--      ale żadna migracja nigdy faktycznie nie tworzyła tej kolumny.
--      warehouse_reversal_p13_migration.sql dodaje tylko reversal_of_id i
--      zakłada, że reversed_at już istnieje → "column reversed_at does not exist".
--   2. workspaces.settings — czytane jako w.settings w warehouse_issue_p9,
--      warehouse_correction_p10, warehouse_transfer_p11 (allow_negative_stock)
--      oraz w src/utils/workspaceSettings.js. Migracja settings_migration.sql
--      istnieje w korzeniu repo, ale nie została uruchomiona na żywej bazie
--      → "column w.settings does not exist".
-- =============================================================================

ALTER TABLE public.ruchy_magazynowe
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversal_of_id UUID REFERENCES public.ruchy_magazynowe(id);

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- =============================================================================
-- ROLLBACK (run manually if migration needs to be reverted)
-- =============================================================================
-- ALTER TABLE public.ruchy_magazynowe DROP COLUMN IF EXISTS reversed_at;
-- ALTER TABLE public.ruchy_magazynowe DROP COLUMN IF EXISTS reversal_of_id;
-- ALTER TABLE public.workspaces DROP COLUMN IF EXISTS settings;
-- =============================================================================
