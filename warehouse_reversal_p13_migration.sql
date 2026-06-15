-- ============================================================
-- P13: Atomic idempotent invoice reversal — warehouse_reversal_p13_migration.sql
--
-- Idempotent (safe to run multiple times on staging before production).
-- RUN ON STAGING FIRST, verify, then run on PRODUCTION.
--
-- PRECONDITIONS:
--   P8  (warehouse_receive_p8_migration.sql)   — idempotency_key column + idx
--   P12 (warehouse_approval_p12_migration.sql) — approve_invoice_stock + invoice_purchase movements
--
-- UP:
--   1. Add reversal_of_id uuid (nullable FK → ruchy_magazynowe.id) to ruchy_magazynowe.
--   2. CREATE OR REPLACE FUNCTION reverse_invoice_stock(p_faktura_id uuid) → jsonb
--
--   Key properties:
--     - Locks the invoice row FOR UPDATE before any work — prevents concurrent
--       double-reversal attempts.
--     - Idempotency guard: if status is already 'robocza', returns
--       {success:false, error:"Faktura już jest robocza"} without any DB writes.
--     - Requires status = 'zatwierdzona' — cannot reverse a draft.
--     - For each invoice_purchase movement (reversed_at IS NULL, faktura_id matches):
--         a. Locks the balance row FOR UPDATE.
--         b. Sets reversed_at = NOW() on the original movement (logical void — excluded
--            from balance formula in all RPCs via AND reversed_at IS NULL).
--         c. Inserts a compensating movement with identical qty and same type,
--            referencing the original via reversal_of_id, and sets reversed_at = NOW()
--            on the compensating row immediately (audit trail; does not affect balance).
--            idempotency_key = 'rev::' || faktura_id || '::' || original_ruch_id ensures
--            no double-insert even on unexpected retry.
--         d. Recomputes balance from all non-reversed movements (the formula that
--            excludes both original and compensating gives the pre-approval balance).
--         e. Writes the recomputed balance to stany_magazynowe.
--     - Sets invoice status back to 'robocza'.
--     - Returns on success:
--         {"success":true, "cofniete": N}   (N = number of compensating movements created)
--     - Returns on failure:
--         {"success":false, "error":"…"}
--
--   History invariants:
--     - Row count in ruchy_magazynowe never decreases (originals preserved).
--     - SUM(compensating.ilosc) = SUM(original invoice_purchase.ilosc) for the faktura.
--     - Reconciliation drift = 0 after reversal on staging data.
--
-- DOWN (lossless if no reversal data exists):
--   DROP FUNCTION IF EXISTS public.reverse_invoice_stock(uuid);
--   -- Column DROP only safe if all reversal_of_id values are still NULL.
--   -- If real data exists, use a forward-fix instead of DROP.
--   -- ALTER TABLE public.ruchy_magazynowe DROP COLUMN IF EXISTS reversal_of_id;
--
-- POST-MIGRATION VERIFICATION (run on staging after UP):
--   -- 1. Confirm column exists
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'ruchy_magazynowe' AND column_name = 'reversal_of_id';
--
--   -- 2. Confirm function exists
--   SELECT proname, prosecdef FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'reverse_invoice_stock';
--
--   -- 3. Smoke test — reverse a real zatwierdzona faktura on staging:
--   SELECT public.reverse_invoice_stock('<faktura-uuid-here>');
--
--   -- 4. Double-reverse guard (same faktura id — must return already-robocza):
--   SELECT public.reverse_invoice_stock('<faktura-uuid-here>');
--
--   -- 5. Verify originals marked, compensating rows created (row count increased):
--   SELECT id, typ, ilosc, reversed_at, reversal_of_id
--   FROM public.ruchy_magazynowe
--   WHERE faktura_id = '<faktura-uuid-here>'
--   ORDER BY created_at;
--
--   -- 6. Verify compensating sum == original sum:
--   SELECT
--     SUM(CASE WHEN reversal_of_id IS NULL THEN ilosc ELSE 0 END) AS original_sum,
--     SUM(CASE WHEN reversal_of_id IS NOT NULL THEN ilosc ELSE 0 END) AS compensating_sum
--   FROM public.ruchy_magazynowe
--   WHERE faktura_id = '<faktura-uuid-here>';
--
--   -- 7. Balance reconciliation — no new drift
--   -- (Run docs/db-snapshot/08_inventory_reconciliation.sql and compare baseline)
-- ============================================================


-- ── 1. reversal_of_id column ───────────────────────────────────────────────────
-- Nullable FK to the original movement this row compensates.
-- NULL for all existing rows (no ON DELETE action — originals must not be deleted).

ALTER TABLE public.ruchy_magazynowe
  ADD COLUMN IF NOT EXISTS reversal_of_id uuid
  REFERENCES public.ruchy_magazynowe(id);


-- ── 2. reverse_invoice_stock RPC ───────────────────────────────────────────────
-- SECURITY DEFINER: bypasses RLS so the function controls its own isolation.
-- search_path = public: prevents search-path injection.
-- Atomicity: the invoice row is locked FOR UPDATE before any writes; all
--   reversed_at updates, compensating inserts, and balance recomputations share
--   the same implicit PG transaction — either all commit or all roll back.
-- History preservation: originals are soft-marked (reversed_at) and compensating
--   rows are appended — the row count in ruchy_magazynowe never decreases.
-- Idempotency: the invoice status guard (status = 'robocza' → early return) and
--   the unique idempotency_key on compensating movements (rev::faktura_id::ruch_id)
--   together make the function safe to retry after unexpected failures.

CREATE OR REPLACE FUNCTION public.reverse_invoice_stock(
  p_faktura_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_faktura       faktury%ROWTYPE;
  v_workspace_id  uuid;
  v_ruch          record;
  v_magazyn_id    uuid;
  v_bal_id        uuid;
  v_new_balance   numeric;
  v_cofniete      integer := 0;
BEGIN
  -- ── Load and lock the invoice ─────────────────────────────────────────────
  -- FOR UPDATE prevents a concurrent call from reading 'zatwierdzona' before
  -- this transaction has a chance to set it back to 'robocza'.
  SELECT * INTO v_faktura
  FROM   public.faktury
  WHERE  id = p_faktura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nie znaleziono faktury');
  END IF;

  v_workspace_id := v_faktura.workspace_id;

  -- ── Auth: caller must own the workspace ──────────────────────────────────
  IF v_workspace_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE  id            = v_workspace_id
      AND  owner_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'workspace not owned by caller');
  END IF;

  -- ── Idempotency guard ────────────────────────────────────────────────────
  -- Already reversed (back to robocza) → return clean error.
  -- The FOR UPDATE lock above means concurrent calls serialize here.
  IF v_faktura.status = 'robocza' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Faktura już jest robocza');
  END IF;

  -- ── Only approved invoices can be reversed ────────────────────────────────
  IF v_faktura.status <> 'zatwierdzona' THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Faktura nie jest zatwierdzona (status: ' || v_faktura.status || ')');
  END IF;

  -- ── Process each eligible original movement ───────────────────────────────
  -- Eligible = invoice_purchase movements for this faktura that are not yet reversed.
  -- Non-invoice_purchase rows (e.g., earlier manual movements) are not touched.
  FOR v_ruch IN
    SELECT id,
           towar_id,
           magazyn_docelowy_id,
           ilosc,
           idempotency_key
    FROM   public.ruchy_magazynowe
    WHERE  faktura_id    = p_faktura_id
      AND  workspace_id  = v_workspace_id
      AND  typ           = 'invoice_purchase'
      AND  reversed_at   IS NULL
  LOOP
    v_magazyn_id := v_ruch.magazyn_docelowy_id;

    -- Ensure balance row exists (upsert to 0 so FOR UPDATE can lock it)
    INSERT INTO public.stany_magazynowe
      (towar_id, magazyn_id, ilosc, workspace_id, updated_at)
    VALUES
      (v_ruch.towar_id, v_magazyn_id, 0, v_workspace_id, now())
    ON CONFLICT (towar_id, magazyn_id) DO NOTHING;

    -- Lock the balance row
    SELECT id INTO v_bal_id
    FROM   public.stany_magazynowe
    WHERE  towar_id   = v_ruch.towar_id
      AND  magazyn_id = v_magazyn_id
    FOR UPDATE;

    -- Soft-mark original as logically voided.
    -- After this UPDATE the original is excluded from all balance recomputations
    -- (every RPC queries AND reversed_at IS NULL).
    UPDATE public.ruchy_magazynowe
    SET    reversed_at = now()
    WHERE  id = v_ruch.id;

    -- Insert compensating movement as append-only audit record.
    -- reversed_at is set immediately so the compensating row never contributes
    -- to the running balance formula — its purpose is historical traceability.
    -- reversal_of_id links back to the original for auditing and the
    -- "compensating sum == original sum" reconciliation check.
    -- idempotency_key prevents duplicate inserts on unexpected retry.
    INSERT INTO public.ruchy_magazynowe
      (towar_id, magazyn_docelowy_id, ilosc, typ,
       powod, faktura_id, workspace_id,
       reversal_of_id, reversed_at, idempotency_key)
    VALUES
      (v_ruch.towar_id, v_magazyn_id, v_ruch.ilosc, 'invoice_purchase',
       'Cofnięcie faktury ' || COALESCE(v_faktura.numer, p_faktura_id::text),
       p_faktura_id, v_workspace_id,
       v_ruch.id, now(),
       'rev::' || p_faktura_id::text || '::' || v_ruch.id::text);

    -- Recompute balance from all non-reversed movements.
    -- Because we just set reversed_at on the original and the compensating
    -- also has reversed_at = NOW(), neither contributes here.
    -- The result equals the balance that existed before approve_invoice_stock ran.
    -- Sign convention mirrors receive_stock (P8) and inventoryReconciliation.js.
    SELECT COALESCE(SUM(
      CASE
        WHEN typ IN ('purchase','invoice_purchase','correction_plus','initial_stock')
             AND magazyn_docelowy_id = v_magazyn_id THEN  ilosc
        WHEN typ = 'correction_minus'
             AND magazyn_docelowy_id = v_magazyn_id THEN -ilosc
        WHEN typ = 'issue'
             AND magazyn_zrodlowy_id = v_magazyn_id THEN -ilosc
        WHEN typ = 'transfer'
             AND magazyn_zrodlowy_id = v_magazyn_id THEN -ilosc
        WHEN typ = 'transfer'
             AND magazyn_docelowy_id = v_magazyn_id THEN  ilosc
        ELSE 0
      END
    ), 0)
    INTO v_new_balance
    FROM  public.ruchy_magazynowe
    WHERE towar_id     = v_ruch.towar_id
      AND workspace_id  = v_workspace_id
      AND reversed_at   IS NULL
      AND (magazyn_docelowy_id = v_magazyn_id
        OR magazyn_zrodlowy_id = v_magazyn_id);

    -- Write restored balance
    UPDATE public.stany_magazynowe
    SET    ilosc      = v_new_balance,
           updated_at = now()
    WHERE  id = v_bal_id;

    v_cofniete := v_cofniete + 1;
  END LOOP;

  -- ── Restore invoice to draft ──────────────────────────────────────────────
  UPDATE public.faktury
  SET    status = 'robocza'
  WHERE  id = p_faktura_id;

  RETURN jsonb_build_object(
    'success',  true,
    'cofniete', v_cofniete
  );
END;
$$;


-- ── Grant execute to authenticated users ───────────────────────────────────────
-- SECURITY DEFINER means the function runs as owner (postgres / supabase_admin),
-- not as the caller. The GRANT only controls who can invoke it.
GRANT EXECUTE ON FUNCTION public.reverse_invoice_stock(uuid) TO authenticated;
