-- ============================================================
-- MAGZIC — Inventory Reconciliation Query
-- PURPOSE: Detect drift between stany_magazynowe (stored balance)
--          and the sum of movements in ruchy_magazynowe.
-- SAFE: SELECT only — no changes to the database.
-- RUN ON: STAGING first, then PRODUCTION.
--
-- Sign convention (mirrors inventoryReconciliation.js / receive_stock RPC):
--   purchase / invoice_purchase / correction_plus / initial_stock
--                                                 → +ilosc on magazyn_docelowy_id
--   correction_minus                              → -ilosc on magazyn_docelowy_id
--   issue                                         → -ilosc on magazyn_zrodlowy_id
--   transfer                                      → -ilosc on zrodlowy, +ilosc on docelowy
--
-- To scope to ONE workspace, replace the WHERE comment lines below.
-- ============================================================

WITH movements AS (
  SELECT
    workspace_id,
    towar_id,
    CASE
      WHEN typ IN ('purchase', 'invoice_purchase', 'correction_plus', 'initial_stock')
        THEN magazyn_docelowy_id
      WHEN typ = 'correction_minus'
        THEN magazyn_docelowy_id
      WHEN typ = 'issue'
        THEN magazyn_zrodlowy_id
      WHEN typ = 'transfer'
        THEN magazyn_zrodlowy_id   -- source side
      ELSE NULL
    END                           AS magazyn_id,
    CASE
      WHEN typ IN ('purchase', 'invoice_purchase', 'correction_plus', 'initial_stock')
        THEN  ilosc
      WHEN typ = 'correction_minus'
        THEN -ilosc
      WHEN typ = 'issue'
        THEN -ilosc
      WHEN typ = 'transfer'
        THEN -ilosc               -- leaving source
      ELSE 0
    END                           AS delta
  FROM ruchy_magazynowe
  -- WHERE workspace_id = '<your-workspace-uuid>'

  UNION ALL

  -- Transfer destination side
  SELECT
    workspace_id,
    towar_id,
    magazyn_docelowy_id           AS magazyn_id,
    ilosc                         AS delta
  FROM ruchy_magazynowe
  WHERE typ = 'transfer'
    AND magazyn_docelowy_id IS NOT NULL
  -- AND workspace_id = '<your-workspace-uuid>'
),

movement_totals AS (
  SELECT
    workspace_id,
    towar_id,
    magazyn_id,
    SUM(delta)                    AS expected_qty
  FROM movements
  WHERE magazyn_id IS NOT NULL
  GROUP BY workspace_id, towar_id, magazyn_id
)

SELECT
  sm.workspace_id,
  w.name                          AS workspace_name,
  t.nazwa                         AS product_name,
  m.nazwa                         AS warehouse_name,
  sm.ilosc                        AS stored_qty,
  COALESCE(mt.expected_qty, 0)    AS expected_qty,
  COALESCE(mt.expected_qty, 0)
    - sm.ilosc                    AS drift,          -- positive = movements say more
  sm.towar_id,
  sm.magazyn_id
FROM stany_magazynowe sm
LEFT JOIN movement_totals mt
  ON  mt.workspace_id = sm.workspace_id
  AND mt.towar_id     = sm.towar_id
  AND mt.magazyn_id   = sm.magazyn_id
LEFT JOIN workspaces w  ON w.id = sm.workspace_id
LEFT JOIN towary     t  ON t.id = sm.towar_id
LEFT JOIN magazyny   m  ON m.id = sm.magazyn_id
-- WHERE sm.workspace_id = '<your-workspace-uuid>'
--   AND ABS(COALESCE(mt.expected_qty, 0) - sm.ilosc) > 0   -- mismatches only
ORDER BY ABS(COALESCE(mt.expected_qty, 0) - sm.ilosc) DESC, sm.workspace_id, t.nazwa;
