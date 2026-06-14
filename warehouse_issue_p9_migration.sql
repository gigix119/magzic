-- ============================================================
-- P9: Atomic idempotent issue — warehouse_issue_p9_migration.sql
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
--   1. CREATE OR REPLACE FUNCTION issue_stock — atomic, tenant-safe RPC.
--      Mirrors receive_stock from P8 with these differences:
--        - Uses magazyn_zrodlowy_id (source), not magazyn_docelowy_id.
--        - Movement type is 'issue', not 'purchase'.
--        - Non-negative balance guard: rejects if stored balance < p_ilosc
--          unless workspaces.settings->>'allow_negative_stock' = 'true'.
--        - No p_faktura_id param (issue operations are not invoice-driven).
--
-- DOWN:
--   DROP FUNCTION IF EXISTS public.issue_stock;
--
-- POST-MIGRATION VERIFICATION (run on staging after UP):
--   -- 1. Confirm function exists and is SECURITY DEFINER
--   SELECT proname, prosecdef FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'issue_stock';
--
--   -- 2. Smoke test (replace UUIDs with real staging values):
--   SELECT public.issue_stock(
--     '<towar-uuid>',
--     '<magazyn-uuid>',
--     1,
--     'p9 smoke test',
--     '<workspace-uuid>'
--   );
--
--   -- 3. Balance reconciliation — no new drift
--   -- (Run docs/db-snapshot/08_inventory_reconciliation.sql and compare to
--   --  pre-P9 baseline)
-- ============================================================


-- ── issue_stock RPC ────────────────────────────────────────────────────────────
-- SECURITY DEFINER: bypasses RLS so the function controls its own isolation.
-- search_path = public: prevents search-path injection.
-- Caller isolation: auth.uid() ownership check on workspace; product and
--   warehouse membership checked against workspace.
-- Atomicity: balance row is locked FOR UPDATE before the movement is inserted,
--   then the balance is recomputed from ALL non-reversed movements.
-- Non-negative guard: serialized by FOR UPDATE lock — no race between the
--   balance read and the movement insert.

CREATE OR REPLACE FUNCTION public.issue_stock(
  p_towar_id        uuid,
  p_magazyn_id      uuid,
  p_ilosc           numeric,
  p_powod           text    DEFAULT NULL,
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
  -- An inserted 0-row is correct: no prior movements → stored balance is 0.
  INSERT INTO public.stany_magazynowe
    (towar_id, magazyn_id, ilosc, workspace_id, updated_at)
  VALUES
    (p_towar_id, p_magazyn_id, 0, p_workspace_id, now())
  ON CONFLICT (towar_id, magazyn_id) DO NOTHING;

  -- ── Lock balance row + read current stored balance ────────────────────────
  -- FOR UPDATE serializes concurrent issues on the same (towar, magazyn) pair.
  SELECT id, ilosc
  INTO   v_balance_id, v_current_balance
  FROM   public.stany_magazynowe
  WHERE  towar_id   = p_towar_id
    AND  magazyn_id = p_magazyn_id
  FOR UPDATE;

  -- ── Non-negative balance guard ────────────────────────────────────────────
  -- Evaluated after the lock, so the read is serialized against all concurrent
  -- writers.  Bypassed when workspace explicitly allows negative stock.
  IF NOT v_allow_negative AND COALESCE(v_current_balance, 0) < p_ilosc THEN
    RETURN jsonb_build_object(
      'success',   false,
      'error',     'insufficient stock',
      'available', COALESCE(v_current_balance, 0)
    );
  END IF;

  -- ── Append movement ───────────────────────────────────────────────────────
  -- Issue uses magazyn_zrodlowy_id (source warehouse), not docelowy.
  INSERT INTO public.ruchy_magazynowe
    (towar_id, magazyn_zrodlowy_id, ilosc, typ,
     powod, workspace_id, idempotency_key)
  VALUES
    (p_towar_id, p_magazyn_id, p_ilosc, 'issue',
     p_powod, p_workspace_id, p_idempotency_key);

  -- ── Recompute balance from all non-reversed movements ─────────────────────
  -- Sign convention is identical to receive_stock and inventoryReconciliation.js:
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
GRANT EXECUTE ON FUNCTION public.issue_stock(uuid, uuid, numeric, text, uuid, text)
  TO authenticated;
