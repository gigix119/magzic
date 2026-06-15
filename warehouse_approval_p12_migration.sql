-- ============================================================
-- P12: Atomic idempotent invoice approval — warehouse_approval_p12_migration.sql
--
-- Idempotent (safe to run multiple times on staging before production).
-- RUN ON STAGING FIRST, verify, then run on PRODUCTION.
--
-- PRECONDITION: P8 migration (warehouse_receive_p8_migration.sql) must already
--   be applied. P8 owns the idempotency_key column on ruchy_magazynowe and the
--   partial unique index idx_ruchy_idempotency_key used here.
--
-- UP:
--   CREATE OR REPLACE FUNCTION approve_invoice_stock(p_faktura_id uuid) → jsonb
--
--   Key properties:
--     - Locks the invoice row FOR UPDATE before any work — prevents concurrent
--       double-approval attempts.
--     - Idempotency guard: if status is already 'zatwierdzona', returns
--       {success:false, error:"Faktura już zatwierdzona"} without any DB writes.
--     - Processes every eligible position in a SINGLE PG transaction:
--         eligible = towar_id IS NOT NULL
--                    AND cena_netto > 0 (cena_netto=0 → silent skip, not counted)
--                    AND ilosc > 0
--                    AND effective_warehouse IS NOT NULL
--       Position-level magazyn_id overrides invoice-level magazyn_id.
--       Positions without any warehouse → pominiete (not counted as eligible).
--       Positions with towar_id=null → pominiete.
--     - Each movement INSERT uses idempotency_key = faktura_id::poz_id.
--       If a duplicate key is encountered (e.g., unexpected retry after partial
--       commit), the INSERT raises a unique-constraint error and the entire
--       transaction rolls back — preventing partial state.
--     - Balance recomputed from all non-reversed movements after each movement
--       INSERT (same formula as receive_stock from P8).
--     - Invoice updated to status='zatwierdzona' and wartosc_netto recomputed
--       from ALL pozycje_faktury rows (including service / zero-price lines).
--     - Returns on success:
--         {"success":true,
--          "zaktualizowane":[{"towar":"…","ilosc":N,"nowaIlosc":M}, …],
--          "pominiete":N}
--     - Returns on failure:
--         {"success":false,"error":"…"}
--
-- DOWN (lossless — no data destroyed):
--   DROP FUNCTION IF EXISTS public.approve_invoice_stock(uuid);
--
-- POST-MIGRATION VERIFICATION (run on staging after UP):
--   -- 1. Confirm function exists
--   SELECT proname, prosecdef FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'approve_invoice_stock';
--
--   -- 2. Smoke test (replace with a real robocza faktura id from staging):
--   SELECT public.approve_invoice_stock('<faktura-uuid-here>');
--
--   -- 3. Double-approve guard (same faktura id — must return already-approved):
--   SELECT public.approve_invoice_stock('<faktura-uuid-here>');
--
--   -- 4. Balance reconciliation — no new drift
--   -- (Run docs/db-snapshot/08_inventory_reconciliation.sql and compare baseline)
-- ============================================================


-- ── approve_invoice_stock ──────────────────────────────────────────────────────
-- SECURITY DEFINER: bypasses RLS so the function controls its own isolation.
-- search_path = public: prevents search-path injection.
-- Atomicity: the invoice row is locked FOR UPDATE before any writes; all
--   movement inserts and the status update share the same implicit PG transaction.
-- Idempotency key per movement: faktura_id::poz_id ensures that a duplicate
--   INSERT raises a unique-constraint error, rolling back the whole transaction.

CREATE OR REPLACE FUNCTION public.approve_invoice_stock(
  p_faktura_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_faktura      faktury%ROWTYPE;
  v_workspace_id uuid;
  v_poz          record;
  v_magazyn_id   uuid;
  v_bal_id       uuid;
  v_new_balance  numeric;
  v_pominiete    integer := 0;
  v_updated      jsonb   := '[]'::jsonb;
BEGIN
  -- ── Load and lock the invoice ─────────────────────────────────────────────
  -- FOR UPDATE prevents a concurrent call from reading 'robocza' before this
  -- transaction has a chance to set 'zatwierdzona'.
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
    WHERE  id             = v_workspace_id
      AND  owner_user_id  = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'workspace not owned by caller');
  END IF;

  -- ── Idempotency guard ────────────────────────────────────────────────────
  -- Return a clean error (not a DB exception) if already approved.
  -- The FOR UPDATE lock above means concurrent calls serialize here.
  IF v_faktura.status = 'zatwierdzona' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Faktura już zatwierdzona');
  END IF;

  -- ── Require at least one position ────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.pozycje_faktury WHERE faktura_id = p_faktura_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Faktura nie ma pozycji');
  END IF;

  -- ── Process each position ─────────────────────────────────────────────────
  FOR v_poz IN
    SELECT p.id,
           p.towar_id,
           p.magazyn_id,
           p.ilosc,
           p.cena_netto,
           t.nazwa AS towar_nazwa
    FROM   public.pozycje_faktury p
    LEFT JOIN public.towary t ON t.id = p.towar_id
    WHERE  p.faktura_id = p_faktura_id
  LOOP
    -- Pominięte: no product, or no warehouse at any level
    IF v_poz.towar_id IS NULL
       OR (v_poz.magazyn_id IS NULL AND v_faktura.magazyn_id IS NULL)
    THEN
      v_pominiete := v_pominiete + 1;
      CONTINUE;
    END IF;

    -- Silent skip (cena_netto=0 or ilosc<=0): not counted in pominiete.
    -- Preserves existing characterization behavior for these edge cases.
    CONTINUE WHEN COALESCE(v_poz.cena_netto, 0) = 0;
    CONTINUE WHEN COALESCE(v_poz.ilosc, 0)      <= 0;

    -- Resolve effective warehouse: position-level overrides invoice-level
    v_magazyn_id := COALESCE(v_poz.magazyn_id, v_faktura.magazyn_id);

    -- Ensure a balance row exists (upsert to 0 so FOR UPDATE can lock it)
    INSERT INTO public.stany_magazynowe
      (towar_id, magazyn_id, ilosc, workspace_id, updated_at)
    VALUES
      (v_poz.towar_id, v_magazyn_id, 0, v_workspace_id, now())
    ON CONFLICT (towar_id, magazyn_id) DO NOTHING;

    -- Lock the balance row
    SELECT id INTO v_bal_id
    FROM   public.stany_magazynowe
    WHERE  towar_id   = v_poz.towar_id
      AND  magazyn_id = v_magazyn_id
    FOR UPDATE;

    -- Insert movement with per-position idempotency key.
    -- On duplicate (unexpected retry after partial commit): unique-constraint
    -- error rolls back the entire transaction — no partial state possible.
    INSERT INTO public.ruchy_magazynowe
      (towar_id, magazyn_docelowy_id, ilosc, typ,
       powod, faktura_id, workspace_id, idempotency_key)
    VALUES
      (v_poz.towar_id, v_magazyn_id, v_poz.ilosc, 'invoice_purchase',
       'Faktura ' || COALESCE(v_faktura.numer, p_faktura_id::text),
       p_faktura_id, v_workspace_id,
       p_faktura_id::text || '::' || v_poz.id::text);

    -- Recompute balance from all non-reversed movements.
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
    WHERE towar_id     = v_poz.towar_id
      AND workspace_id  = v_workspace_id
      AND reversed_at   IS NULL
      AND (magazyn_docelowy_id = v_magazyn_id
        OR magazyn_zrodlowy_id = v_magazyn_id);

    -- Write updated balance
    UPDATE public.stany_magazynowe
    SET    ilosc      = v_new_balance,
           updated_at = now()
    WHERE  id = v_bal_id;

    -- Accumulate result item for the response
    v_updated := v_updated || jsonb_build_array(
      jsonb_build_object(
        'towar',     COALESCE(v_poz.towar_nazwa, v_poz.towar_id::text),
        'ilosc',     v_poz.ilosc,
        'nowaIlosc', v_new_balance
      )
    );
  END LOOP;

  -- ── Mark invoice approved ─────────────────────────────────────────────────
  -- wartosc_netto is computed from ALL positions (including service / zero-price)
  -- matching the existing JS behavior captured by the characterization tests.
  UPDATE public.faktury
  SET    status        = 'zatwierdzona',
         wartosc_netto = (
           SELECT COALESCE(SUM(ilosc * cena_netto), 0)
           FROM   public.pozycje_faktury
           WHERE  faktura_id = p_faktura_id
         )
  WHERE  id = p_faktura_id;

  RETURN jsonb_build_object(
    'success',        true,
    'zaktualizowane', v_updated,
    'pominiete',      v_pominiete
  );
END;
$$;


-- ── Grant execute to authenticated users ───────────────────────────────────────
-- SECURITY DEFINER means the function runs as owner (postgres / supabase_admin),
-- not as the caller. The GRANT only controls who can invoke it.
GRANT EXECUTE ON FUNCTION public.approve_invoice_stock(uuid) TO authenticated;
