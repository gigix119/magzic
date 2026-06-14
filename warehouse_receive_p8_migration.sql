-- ============================================================
-- P8: Atomic idempotent receive — warehouse_receive_p8_migration.sql
--
-- Idempotent (safe to run multiple times on staging before production).
-- RUN ON STAGING FIRST, verify, then run on PRODUCTION.
--
-- UP:
--   1. Add idempotency_key TEXT column (nullable) to ruchy_magazynowe.
--   2. Partial unique index on (workspace_id, idempotency_key)
--      WHERE idempotency_key IS NOT NULL — existing NULL rows are not affected.
--   3. CREATE OR REPLACE FUNCTION receive_stock — the atomic, tenant-safe RPC.
--
-- DOWN (lossless as long as no rows have a non-NULL idempotency_key):
--   DROP FUNCTION IF EXISTS public.receive_stock;
--   DROP INDEX  IF EXISTS public.idx_ruchy_idempotency_key;
--   -- Column DROP: only safe if all idempotency_key values are still NULL.
--   -- If real data exists in the column, do a forward-fix instead of DROP.
--   -- ALTER TABLE public.ruchy_magazynowe DROP COLUMN IF EXISTS idempotency_key;
--
-- POST-MIGRATION VERIFICATION (run on staging after UP):
--   -- 1. Confirm column exists
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'ruchy_magazynowe' AND column_name = 'idempotency_key';
--
--   -- 2. Confirm unique index exists
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'ruchy_magazynowe' AND indexname = 'idx_ruchy_idempotency_key';
--
--   -- 3. Confirm function exists
--   SELECT proname, prosecdef FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'receive_stock';
--
--   -- 4. Balance reconciliation — no new drift
--   -- (Run docs/db-snapshot/08_inventory_reconciliation.sql and compare to pre-P8 baseline)
-- ============================================================


-- ── 1. idempotency_key column ──────────────────────────────────────────────────

ALTER TABLE public.ruchy_magazynowe
  ADD COLUMN IF NOT EXISTS idempotency_key text;


-- ── 2. Partial unique index ────────────────────────────────────────────────────
-- Scoped to workspace so the same external key from two tenants never conflicts.
-- Partial (WHERE NOT NULL) so all existing NULL rows remain unrestricted.

CREATE UNIQUE INDEX IF NOT EXISTS idx_ruchy_idempotency_key
  ON public.ruchy_magazynowe (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;


-- ── 3. receive_stock RPC ───────────────────────────────────────────────────────
-- SECURITY DEFINER: bypasses RLS so the function controls its own isolation.
-- search_path = public: prevents search-path injection.
-- Caller isolation: the function checks auth.uid() owns p_workspace_id,
--   and that p_towar_id / p_magazyn_id both belong to that workspace.
-- Atomicity: the balance row is locked FOR UPDATE before the movement is
--   inserted, then the balance is recomputed from ALL non-reversed movements.

CREATE OR REPLACE FUNCTION public.receive_stock(
  p_towar_id        uuid,
  p_magazyn_id      uuid,
  p_ilosc           numeric,
  p_powod           text    DEFAULT NULL,
  p_faktura_id      uuid    DEFAULT NULL,
  p_workspace_id    uuid    DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_id  uuid;
  v_new_balance numeric;
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

  -- ── Workspace ownership ───────────────────────────────────────────────────
  -- auth.uid() is the calling user; the workspace must be owned by them.
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id
      AND owner_user_id = auth.uid()
  ) THEN
    RETURN '{"success":false,"error":"workspace not owned by caller"}'::jsonb;
  END IF;

  -- ── Cross-workspace product guard ─────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.towary
    WHERE id = p_towar_id
      AND workspace_id = p_workspace_id
  ) THEN
    RETURN '{"success":false,"error":"product does not belong to workspace"}'::jsonb;
  END IF;

  -- ── Cross-workspace warehouse guard ───────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.magazyny
    WHERE id = p_magazyn_id
      AND workspace_id = p_workspace_id
  ) THEN
    RETURN '{"success":false,"error":"warehouse does not belong to workspace"}'::jsonb;
  END IF;

  -- ── Idempotency check ─────────────────────────────────────────────────────
  -- If the same key was already used in this workspace, return a no-op success.
  -- The unique index (workspace_id, idempotency_key) WHERE NOT NULL enforces
  -- this at the DB level; the explicit check here returns a clean JSON response
  -- instead of a constraint-violation error.
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
  -- ON CONFLICT DO NOTHING: if two concurrent transactions race here, one
  -- inserts and one does nothing — both then proceed to FOR UPDATE, where the
  -- second waits until the first releases its lock and recomputes correctly.
  INSERT INTO public.stany_magazynowe
    (towar_id, magazyn_id, ilosc, workspace_id, updated_at)
  VALUES
    (p_towar_id, p_magazyn_id, 0, p_workspace_id, now())
  ON CONFLICT (towar_id, magazyn_id) DO NOTHING;

  -- ── Lock balance row ──────────────────────────────────────────────────────
  SELECT id INTO v_balance_id
  FROM public.stany_magazynowe
  WHERE towar_id   = p_towar_id
    AND magazyn_id = p_magazyn_id
  FOR UPDATE;

  -- ── Append movement ───────────────────────────────────────────────────────
  INSERT INTO public.ruchy_magazynowe
    (towar_id, magazyn_docelowy_id, ilosc, typ,
     powod, faktura_id, workspace_id, idempotency_key)
  VALUES
    (p_towar_id, p_magazyn_id, p_ilosc, 'purchase',
     p_powod, p_faktura_id, p_workspace_id, p_idempotency_key);

  -- ── Recompute balance from all non-reversed movements ─────────────────────
  -- Sign convention mirrors inventoryReconciliation.js / computeReconciliation:
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
  INTO v_new_balance
  FROM public.ruchy_magazynowe
  WHERE towar_id    = p_towar_id
    AND workspace_id = p_workspace_id
    AND reversed_at IS NULL
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
-- SECURITY DEFINER means the function runs as owner (postgres/supabase_admin),
-- not as the caller.  The GRANT only controls who can invoke it — not what it
-- can read/write (which is controlled by the workspace isolation checks above).
GRANT EXECUTE ON FUNCTION public.receive_stock(uuid, uuid, numeric, text, uuid, uuid, text)
  TO authenticated;
