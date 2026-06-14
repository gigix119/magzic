-- ============================================================
-- P11: Atomic idempotent transfer — warehouse_transfer_p11_migration.sql
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
--   1. CREATE OR REPLACE FUNCTION transfer_stock — atomic, tenant-safe RPC.
--      Creates exactly two movements in one transaction (all-or-nothing):
--        - movement OUT: typ='transfer', magazyn_zrodlowy_id=source, docelowy=NULL
--        - movement IN:  typ='transfer', magazyn_docelowy_id=destination, zrodlowy=NULL
--      Key properties:
--        - Source and destination must belong to the same workspace.
--        - Source and destination must differ.
--        - Balance rows are locked in canonical UUID order (min first) to
--          prevent deadlocks between concurrent transfers on the same pair.
--        - Non-negative guard on source: rejects if src balance < p_ilosc
--          unless workspaces.settings->>'allow_negative_stock' = 'true'.
--        - Idempotency key stored on the source movement; presence of that row
--          proves both movements were committed (atomicity guarantee).
--        - No p_faktura_id (transfers are not invoice-driven).
--
-- DOWN:
--   DROP FUNCTION IF EXISTS public.transfer_stock;
--
-- POST-MIGRATION VERIFICATION (run on staging after UP):
--   -- 1. Confirm function exists and is SECURITY DEFINER
--   SELECT proname, prosecdef FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'transfer_stock';
--
--   -- 2. Smoke test (replace UUIDs with real staging values where src has stock):
--   SELECT public.transfer_stock(
--     '<towar-uuid>',
--     '<magazyn-src-uuid>',
--     '<magazyn-dst-uuid>',
--     1,
--     'p11 smoke test',
--     '<workspace-uuid>'
--   );
--
--   -- 3. Verify exactly two movements were created:
--   SELECT id, typ, magazyn_zrodlowy_id, magazyn_docelowy_id, ilosc, idempotency_key
--   FROM ruchy_magazynowe
--   WHERE powod = 'p11 smoke test'
--   ORDER BY created_at DESC LIMIT 2;
--   -- Expected: one row with zrodlowy=src, docelowy=NULL
--   --           one row with zrodlowy=NULL, docelowy=dst
--
--   -- 4. Verify src balance decreased and dst balance increased:
--   SELECT magazyn_id, ilosc FROM stany_magazynowe
--   WHERE towar_id = '<towar-uuid>'
--     AND magazyn_id IN ('<magazyn-src-uuid>', '<magazyn-dst-uuid>');
--
--   -- 5. Balance reconciliation — no new drift
--   -- (Run docs/db-snapshot/08_inventory_reconciliation.sql and compare to
--   --  pre-P11 baseline)
-- ============================================================


-- ── transfer_stock RPC ─────────────────────────────────────────────────────────
-- SECURITY DEFINER: bypasses RLS so the function controls its own isolation.
-- search_path = public: prevents search-path injection.
-- Caller isolation: auth.uid() ownership check on workspace; product and
--   both warehouses checked against workspace.
-- Atomicity: all-or-nothing within a single PL/pgSQL execution (= one transaction).
--   Both movements are inserted before either balance is updated; if either
--   insert fails the whole transaction rolls back.
-- Deadlock prevention: balance rows locked in canonical UUID order (min first).
--   Concurrent transfers on the same (towar, warehouse-pair) in opposite
--   directions both attempt to acquire the lower-UUID lock first — one wins,
--   the other waits, no circular wait is possible.
-- Non-negative guard (source only): serialized by FOR UPDATE lock so the
--   balance read and the movement insert are not racy.
-- Sign convention (mirrors inventoryReconciliation.js / computeReconciliation):
--   transfer source movement on magazyn_zrodlowy_id → -ilosc on source balance
--   transfer dest   movement on magazyn_docelowy_id → +ilosc on dest balance

CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_towar_id            uuid,
  p_magazyn_zrodlowy_id uuid,   -- source warehouse
  p_magazyn_docelowy_id uuid,   -- destination warehouse
  p_ilosc               numeric,
  p_powod               text    DEFAULT NULL,
  p_workspace_id        uuid    DEFAULT NULL,
  p_idempotency_key     text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src_balance_id      uuid;
  v_dst_balance_id      uuid;
  v_src_current_balance numeric;
  v_src_new_balance     numeric;
  v_dst_new_balance     numeric;
  v_allow_negative      boolean;
BEGIN

  -- ── Input validation ──────────────────────────────────────────────────────
  IF p_towar_id IS NULL
    THEN RETURN '{"success":false,"error":"towar_id is required"}'::jsonb;
  END IF;
  IF p_magazyn_zrodlowy_id IS NULL
    THEN RETURN '{"success":false,"error":"magazyn_zrodlowy_id is required"}'::jsonb;
  END IF;
  IF p_magazyn_docelowy_id IS NULL
    THEN RETURN '{"success":false,"error":"magazyn_docelowy_id is required"}'::jsonb;
  END IF;
  IF p_workspace_id IS NULL
    THEN RETURN '{"success":false,"error":"workspace_id is required"}'::jsonb;
  END IF;
  IF p_ilosc IS NULL OR p_ilosc <= 0
    THEN RETURN '{"success":false,"error":"ilosc must be greater than 0"}'::jsonb;
  END IF;
  IF p_magazyn_zrodlowy_id = p_magazyn_docelowy_id
    THEN RETURN '{"success":false,"error":"source and destination warehouse must differ"}'::jsonb;
  END IF;

  -- ── Workspace ownership + settings ────────────────────────────────────────
  -- Read allow_negative_stock in the same scan that checks ownership.
  -- COALESCE handles missing key and NULL.
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
    WHERE id           = p_towar_id
      AND workspace_id = p_workspace_id
  ) THEN
    RETURN '{"success":false,"error":"product does not belong to workspace"}'::jsonb;
  END IF;

  -- ── Cross-workspace source warehouse guard ────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.magazyny
    WHERE id           = p_magazyn_zrodlowy_id
      AND workspace_id = p_workspace_id
  ) THEN
    RETURN '{"success":false,"error":"source warehouse does not belong to workspace"}'::jsonb;
  END IF;

  -- ── Cross-workspace destination warehouse guard ───────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.magazyny
    WHERE id           = p_magazyn_docelowy_id
      AND workspace_id = p_workspace_id
  ) THEN
    RETURN '{"success":false,"error":"destination warehouse does not belong to workspace"}'::jsonb;
  END IF;

  -- ── Idempotency check ─────────────────────────────────────────────────────
  -- Key is stored on the source movement only.  If the source movement row
  -- already exists, both movements were committed (atomicity guarantee).
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

  -- ── Ensure both balance rows exist (so FOR UPDATE can lock them) ──────────
  -- ON CONFLICT DO NOTHING: concurrent races produce one winner that inserts,
  -- others skip; both then proceed to FOR UPDATE where the second waits.
  INSERT INTO public.stany_magazynowe
    (towar_id, magazyn_id, ilosc, workspace_id, updated_at)
  VALUES
    (p_towar_id, p_magazyn_zrodlowy_id, 0, p_workspace_id, now())
  ON CONFLICT (towar_id, magazyn_id) DO NOTHING;

  INSERT INTO public.stany_magazynowe
    (towar_id, magazyn_id, ilosc, workspace_id, updated_at)
  VALUES
    (p_towar_id, p_magazyn_docelowy_id, 0, p_workspace_id, now())
  ON CONFLICT (towar_id, magazyn_id) DO NOTHING;

  -- ── Lock both balance rows in canonical UUID order (deadlock prevention) ──
  -- Always acquire the lower UUID lock first.  Any concurrent transfer on the
  -- same (towar, warehouse-pair) in either direction takes the same first lock,
  -- eliminating the circular-wait condition that would cause a deadlock.
  IF p_magazyn_zrodlowy_id < p_magazyn_docelowy_id THEN
    -- source UUID is lower: lock source first, destination second
    SELECT id, ilosc
    INTO   v_src_balance_id, v_src_current_balance
    FROM   public.stany_magazynowe
    WHERE  towar_id   = p_towar_id
      AND  magazyn_id = p_magazyn_zrodlowy_id
    FOR UPDATE;

    SELECT id
    INTO   v_dst_balance_id
    FROM   public.stany_magazynowe
    WHERE  towar_id   = p_towar_id
      AND  magazyn_id = p_magazyn_docelowy_id
    FOR UPDATE;
  ELSE
    -- destination UUID is lower: lock destination first, source second
    SELECT id
    INTO   v_dst_balance_id
    FROM   public.stany_magazynowe
    WHERE  towar_id   = p_towar_id
      AND  magazyn_id = p_magazyn_docelowy_id
    FOR UPDATE;

    SELECT id, ilosc
    INTO   v_src_balance_id, v_src_current_balance
    FROM   public.stany_magazynowe
    WHERE  towar_id   = p_towar_id
      AND  magazyn_id = p_magazyn_zrodlowy_id
    FOR UPDATE;
  END IF;

  -- ── Non-negative guard (source only) ─────────────────────────────────────
  -- Evaluated after the FOR UPDATE lock so the read is serialized against all
  -- concurrent writers.  Destination is always an inbound, so no guard needed.
  -- Bypassed when workspace explicitly allows negative stock.
  IF NOT v_allow_negative AND COALESCE(v_src_current_balance, 0) < p_ilosc THEN
    RETURN jsonb_build_object(
      'success',   false,
      'error',     'insufficient stock for transfer',
      'available', COALESCE(v_src_current_balance, 0)
    );
  END IF;

  -- ── Insert movement OUT (source) ──────────────────────────────────────────
  -- typ='transfer', magazyn_zrodlowy_id=source, magazyn_docelowy_id=NULL.
  -- Idempotency key on this row: its presence proves both rows were committed.
  INSERT INTO public.ruchy_magazynowe
    (towar_id, magazyn_zrodlowy_id, magazyn_docelowy_id, ilosc, typ,
     powod, workspace_id, idempotency_key)
  VALUES
    (p_towar_id, p_magazyn_zrodlowy_id, NULL, p_ilosc, 'transfer',
     p_powod, p_workspace_id, p_idempotency_key);

  -- ── Insert movement IN (destination) ─────────────────────────────────────
  -- typ='transfer', magazyn_docelowy_id=destination, magazyn_zrodlowy_id=NULL.
  -- Destination movement gets NULL idempotency_key: the partial unique index
  -- only applies WHERE NOT NULL, so this never conflicts.
  INSERT INTO public.ruchy_magazynowe
    (towar_id, magazyn_zrodlowy_id, magazyn_docelowy_id, ilosc, typ,
     powod, workspace_id, idempotency_key)
  VALUES
    (p_towar_id, NULL, p_magazyn_docelowy_id, p_ilosc, 'transfer',
     p_powod, p_workspace_id, NULL);

  -- ── Recompute source balance ───────────────────────────────────────────────
  -- Sign convention (same as P8/P9/P10 and inventoryReconciliation.js):
  --   INBOUND  (purchase, invoice_purchase, correction_plus, initial_stock)
  --            on magazyn_docelowy_id → +qty
  --   correction_minus on magazyn_docelowy_id                             → -qty
  --   issue    on magazyn_zrodlowy_id                                     → -qty
  --   transfer on magazyn_zrodlowy_id (= source movement)                → -qty
  --   transfer on magazyn_docelowy_id (= dest movement arriving here)    → +qty
  SELECT COALESCE(SUM(
    CASE
      WHEN typ IN ('purchase','invoice_purchase','correction_plus','initial_stock')
           AND magazyn_docelowy_id = p_magazyn_zrodlowy_id THEN  ilosc
      WHEN typ = 'correction_minus'
           AND magazyn_docelowy_id = p_magazyn_zrodlowy_id THEN -ilosc
      WHEN typ = 'issue'
           AND magazyn_zrodlowy_id = p_magazyn_zrodlowy_id THEN -ilosc
      WHEN typ = 'transfer'
           AND magazyn_zrodlowy_id = p_magazyn_zrodlowy_id THEN -ilosc
      WHEN typ = 'transfer'
           AND magazyn_docelowy_id = p_magazyn_zrodlowy_id THEN  ilosc
      ELSE 0
    END
  ), 0)
  INTO  v_src_new_balance
  FROM  public.ruchy_magazynowe
  WHERE towar_id     = p_towar_id
    AND workspace_id = p_workspace_id
    AND reversed_at  IS NULL
    AND (magazyn_docelowy_id = p_magazyn_zrodlowy_id
      OR magazyn_zrodlowy_id = p_magazyn_zrodlowy_id);

  UPDATE public.stany_magazynowe
  SET    ilosc      = v_src_new_balance,
         updated_at = now()
  WHERE  id = v_src_balance_id;

  -- ── Recompute destination balance ─────────────────────────────────────────
  SELECT COALESCE(SUM(
    CASE
      WHEN typ IN ('purchase','invoice_purchase','correction_plus','initial_stock')
           AND magazyn_docelowy_id = p_magazyn_docelowy_id THEN  ilosc
      WHEN typ = 'correction_minus'
           AND magazyn_docelowy_id = p_magazyn_docelowy_id THEN -ilosc
      WHEN typ = 'issue'
           AND magazyn_zrodlowy_id = p_magazyn_docelowy_id THEN -ilosc
      WHEN typ = 'transfer'
           AND magazyn_zrodlowy_id = p_magazyn_docelowy_id THEN -ilosc
      WHEN typ = 'transfer'
           AND magazyn_docelowy_id = p_magazyn_docelowy_id THEN  ilosc
      ELSE 0
    END
  ), 0)
  INTO  v_dst_new_balance
  FROM  public.ruchy_magazynowe
  WHERE towar_id     = p_towar_id
    AND workspace_id = p_workspace_id
    AND reversed_at  IS NULL
    AND (magazyn_docelowy_id = p_magazyn_docelowy_id
      OR magazyn_zrodlowy_id = p_magazyn_docelowy_id);

  UPDATE public.stany_magazynowe
  SET    ilosc      = v_dst_new_balance,
         updated_at = now()
  WHERE  id = v_dst_balance_id;

  RETURN jsonb_build_object(
    'success',         true,
    'idempotent',      false,
    'src_new_balance', v_src_new_balance,
    'dst_new_balance', v_dst_new_balance
  );

END;
$$;


-- ── Grant execute to authenticated users ───────────────────────────────────────
-- SECURITY DEFINER means the function runs as the DB owner, not as the caller.
-- The GRANT controls who can invoke it; workspace isolation is enforced inside.
GRANT EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text, uuid, text)
  TO authenticated;
