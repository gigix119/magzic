-- ============================================================
-- P10: Atomic idempotent correction — warehouse_correction_p10_migration.sql
--
-- Idempotent (safe to run multiple times on staging before production).
-- RUN ON STAGING FIRST, verify, then run on PRODUCTION.
--
-- PRECONDITION: P8 migration (warehouse_receive_p8_migration.sql) must
--   already be applied. P8 owns the idempotency_key column on
--   ruchy_magazynowe and the partial unique index idx_ruchy_idempotency_key.
--   Running this file without P8 will fail with "column does not exist".
--
-- UP:
--   1. CREATE OR REPLACE FUNCTION correct_stock — atomic, tenant-safe RPC.
--      Mirrors receive_stock (P8) / issue_stock (P9) with these differences:
--        - p_typ accepts 'correction_plus' or 'correction_minus'.
--        - p_powod (reason) is MANDATORY — rejected if NULL or blank.
--        - Both types use magazyn_docelowy_id (destination warehouse),
--          matching the sign convention in inventoryReconciliation.js.
--        - Non-negative guard applies to correction_minus only: rejects if
--          stored balance < p_ilosc unless
--          workspaces.settings->>'allow_negative_stock' = 'true'.
--        - No p_faktura_id param (corrections are not invoice-driven).
--
-- DOWN:
--   DROP FUNCTION IF EXISTS public.correct_stock;
--
-- POST-MIGRATION VERIFICATION (run on staging after UP):
--   -- 1. Confirm function exists and is SECURITY DEFINER
--   SELECT proname, prosecdef FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'correct_stock';
--
--   -- 2. Smoke test correction_plus (replace UUIDs with real staging values):
--   SELECT public.correct_stock(
--     '<towar-uuid>',
--     '<magazyn-uuid>',
--     1,
--     'correction_plus',
--     'p10 smoke test plus',
--     '<workspace-uuid>'
--   );
--
--   -- 3. Smoke test correction_minus (only if balance >= 1):
--   SELECT public.correct_stock(
--     '<towar-uuid>',
--     '<magazyn-uuid>',
--     1,
--     'correction_minus',
--     'p10 smoke test minus',
--     '<workspace-uuid>'
--   );
--
--   -- 4. Verify reason stored:
--   SELECT powod, typ FROM ruchy_magazynowe
--   WHERE powod LIKE 'p10 smoke test%'
--   ORDER BY created_at DESC LIMIT 2;
--
--   -- 5. Balance reconciliation — no new drift
--   -- (Run docs/db-snapshot/08_inventory_reconciliation.sql and compare to
--   --  pre-P10 baseline)
-- ============================================================


-- ── correct_stock RPC ──────────────────────────────────────────────────────────
-- SECURITY DEFINER: bypasses RLS so the function controls its own isolation.
-- search_path = public: prevents search-path injection.
-- Caller isolation: auth.uid() ownership check on workspace; product and
--   warehouse membership checked against workspace.
-- Atomicity: balance row is locked FOR UPDATE before the movement is inserted,
--   then the balance is recomputed from ALL non-reversed movements.
-- Non-negative guard (correction_minus): serialized by FOR UPDATE lock — no
--   race between the balance read and the movement insert.
-- Sign convention (mirrors inventoryReconciliation.js):
--   correction_plus  on magazyn_docelowy_id → +ilosc
--   correction_minus on magazyn_docelowy_id → -ilosc (stored as abs value)

CREATE OR REPLACE FUNCTION public.correct_stock(
  p_towar_id        uuid,
  p_magazyn_id      uuid,
  p_ilosc           numeric,
  p_typ             text,       -- 'correction_plus' or 'correction_minus'
  p_powod           text,       -- mandatory: reason for the correction
  p_workspace_id    uuid    DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_id      uuid;
  v_current_balance numeric;
  v_new_balance     numeric;
  v_allow_negative  boolean;
BEGIN

  -- ── Input validation ──────────────────────────────────────────────────────
  IF p_towar_id IS NULL
    THEN RETURN '{"success":false,"error":"towar_id is required"}'::jsonb;
  END IF;
  IF p_magazyn_id IS NULL
    THEN RETURN '{"success":false,"error":"magazyn_id is required"}'::jsonb;
  END IF;
  IF p_workspace_id IS NULL
    THEN RETURN '{"success":false,"error":"workspace_id is required"}'::jsonb;
  END IF;
  IF p_ilosc IS NULL OR p_ilosc <= 0
    THEN RETURN '{"success":false,"error":"ilosc must be greater than 0"}'::jsonb;
  END IF;
  IF p_typ NOT IN ('correction_plus', 'correction_minus')
    THEN RETURN '{"success":false,"error":"typ must be correction_plus or correction_minus"}'::jsonb;
  END IF;
  -- Reason is mandatory for all corrections: provides an audit trail.
  IF p_powod IS NULL OR trim(p_powod) = ''
    THEN RETURN '{"success":false,"error":"reason is required for corrections"}'::jsonb;
  END IF;

  -- ── Workspace ownership + settings ────────────────────────────────────────
  -- Read allow_negative_stock in the same scan that checks ownership to
  -- avoid a separate round-trip.  COALESCE handles missing key and NULL.
  SELECT COALESCE((w.settings->>'allow_negative_stock')::boolean, false)
  INTO   v_allow_negative
  FROM   public.workspaces w
  WHERE  w.id = p_workspace_id
    AND  w.owner_user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN '{"success":false,"error":"workspace not owned by caller"}'::jsonb;
  END IF;

  -- ── Cross-workspace product guard ─────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.towary
    WHERE id          = p_towar_id
      AND workspace_id = p_workspace_id
  ) THEN
    RETURN '{"success":false,"error":"product does not belong to workspace"}'::jsonb;
  END IF;

  -- ── Cross-workspace warehouse guard ───────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.magazyny
    WHERE id          = p_magazyn_id
      AND workspace_id = p_workspace_id
  ) THEN
    RETURN '{"success":false,"error":"warehouse does not belong to workspace"}'::jsonb;
  END IF;

  -- ── Idempotency check ─────────────────────────────────────────────────────
  -- The partial unique index (workspace_id, idempotency_key) WHERE NOT NULL
  -- from P8 enforces uniqueness at the DB level.  This explicit check returns
  -- a clean JSON response instead of a constraint-violation error.
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.ruchy_magazynowe
      WHERE idempotency_key = p_idempotency_key
        AND workspace_id    = p_workspace_id
    ) THEN
      RETURN '{"success":true,"idempotent":true}'::jsonb;
    END IF;
  END IF;

  -- ── Ensure balance row exists (so FOR UPDATE can lock it) ─────────────────
  -- ON CONFLICT DO NOTHING: concurrent races produce one winner that inserts,
  -- others skip; both then proceed to FOR UPDATE where the second waits.
  INSERT INTO public.stany_magazynowe
    (towar_id, magazyn_id, ilosc, workspace_id, updated_at)
  VALUES
    (p_towar_id, p_magazyn_id, 0, p_workspace_id, now())
  ON CONFLICT (towar_id, magazyn_id) DO NOTHING;

  -- ── Lock balance row + read current stored balance ────────────────────────
  -- FOR UPDATE serializes concurrent corrections on the same (towar, magazyn).
  SELECT id, ilosc
  INTO   v_balance_id, v_current_balance
  FROM   public.stany_magazynowe
  WHERE  towar_id   = p_towar_id
    AND  magazyn_id = p_magazyn_id
  FOR UPDATE;

  -- ── Non-negative guard (correction_minus only) ────────────────────────────
  -- Evaluated after the lock so the read is serialized against all concurrent
  -- writers.  correction_plus always adds stock so no guard is needed for it.
  -- Bypassed when workspace explicitly allows negative stock.
  IF p_typ = 'correction_minus'
    AND NOT v_allow_negative
    AND COALESCE(v_current_balance, 0) < p_ilosc
  THEN
    RETURN jsonb_build_object(
      'success',   false,
      'error',     'insufficient stock for correction',
      'available', COALESCE(v_current_balance, 0)
    );
  END IF;

  -- ── Append movement ───────────────────────────────────────────────────────
  -- Both correction types use magazyn_docelowy_id (destination warehouse).
  -- Sign convention (inventoryReconciliation.js):
  --   correction_plus  on docelowy → +ilosc
  --   correction_minus on docelowy → -ilosc (qty stored as absolute value)
  INSERT INTO public.ruchy_magazynowe
    (towar_id, magazyn_docelowy_id, ilosc, typ,
     powod, workspace_id, idempotency_key)
  VALUES
    (p_towar_id, p_magazyn_id, p_ilosc, p_typ,
     p_powod, p_workspace_id, p_idempotency_key);

  -- ── Recompute balance from all non-reversed movements ─────────────────────
  -- Sign convention is identical to receive_stock, issue_stock, and
  -- inventoryReconciliation.js / computeReconciliation:
  --   INBOUND  (purchase, invoice_purchase, correction_plus, initial_stock)
  --            on magazyn_docelowy_id → +qty
  --   correction_minus on magazyn_docelowy_id                             → -qty
  --   issue    on magazyn_zrodlowy_id                                     → -qty
  --   transfer on magazyn_zrodlowy_id                                     → -qty
  --   transfer on magazyn_docelowy_id                                     → +qty
  SELECT COALESCE(SUM(
    CASE
      WHEN typ IN ('purchase','invoice_purchase','correction_plus','initial_stock')
           AND magazyn_docelowy_id = p_magazyn_id THEN  ilosc
      WHEN typ = 'correction_minus'
           AND magazyn_docelowy_id = p_magazyn_id THEN -ilosc
      WHEN typ = 'issue'
           AND magazyn_zrodlowy_id = p_magazyn_id THEN -ilosc
      WHEN typ = 'transfer'
           AND magazyn_zrodlowy_id = p_magazyn_id THEN -ilosc
      WHEN typ = 'transfer'
           AND magazyn_docelowy_id = p_magazyn_id THEN  ilosc
      ELSE 0
    END
  ), 0)
  INTO  v_new_balance
  FROM  public.ruchy_magazynowe
  WHERE towar_id     = p_towar_id
    AND workspace_id = p_workspace_id
    AND reversed_at  IS NULL
    AND (magazyn_docelowy_id = p_magazyn_id
      OR magazyn_zrodlowy_id = p_magazyn_id);

  -- ── Write computed balance ────────────────────────────────────────────────
  UPDATE public.stany_magazynowe
  SET    ilosc      = v_new_balance,
         updated_at = now()
  WHERE  id = v_balance_id;

  RETURN jsonb_build_object(
    'success',     true,
    'idempotent',  false,
    'new_balance', v_new_balance
  );

END;
$$;


-- ── Grant execute to authenticated users ───────────────────────────────────────
-- SECURITY DEFINER means the function runs as the DB owner, not as the caller.
-- The GRANT controls who can invoke it; workspace isolation is enforced inside.
GRANT EXECUTE ON FUNCTION public.correct_stock(uuid, uuid, numeric, text, text, uuid, text)
  TO authenticated;
