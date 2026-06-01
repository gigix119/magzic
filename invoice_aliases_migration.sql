-- ============================================================
-- invoice_aliases_migration.sql
-- Self-learning invoice product alias system
-- Idempotent — safe to run multiple times
-- Uruchom w: Supabase Dashboard → SQL Editor
-- ============================================================

-- === Table ===

CREATE TABLE IF NOT EXISTS public.invoice_aliases (
  id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid         NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_name            text         NOT NULL,
  invoice_name_normalized text         NOT NULL,
  product_id              uuid         NOT NULL,
  usage_count             integer      NOT NULL DEFAULT 1,
  created_at              timestamptz  NOT NULL DEFAULT now(),
  updated_at              timestamptz  NOT NULL DEFAULT now(),
  last_used_at            timestamptz  NOT NULL DEFAULT now(),
  created_by              uuid,

  CONSTRAINT invoice_aliases_workspace_name_unique
    UNIQUE (workspace_id, invoice_name_normalized)
);

-- === Indexes ===

CREATE INDEX IF NOT EXISTS invoice_aliases_workspace_id_idx
  ON public.invoice_aliases (workspace_id);

CREATE INDEX IF NOT EXISTS invoice_aliases_name_normalized_idx
  ON public.invoice_aliases (workspace_id, invoice_name_normalized);

CREATE INDEX IF NOT EXISTS invoice_aliases_product_id_idx
  ON public.invoice_aliases (product_id);

CREATE INDEX IF NOT EXISTS invoice_aliases_usage_count_idx
  ON public.invoice_aliases (workspace_id, usage_count DESC);

CREATE INDEX IF NOT EXISTS invoice_aliases_last_used_idx
  ON public.invoice_aliases (workspace_id, last_used_at DESC);

-- === RLS ===

ALTER TABLE public.invoice_aliases ENABLE ROW LEVEL SECURITY;

-- Users can only access aliases belonging to workspaces they own.
-- Follows the same pattern as towary, faktury, etc. (saas_migration.sql).

DROP POLICY IF EXISTS "invoice_aliases_workspace" ON public.invoice_aliases;
CREATE POLICY "invoice_aliases_workspace" ON public.invoice_aliases
  FOR ALL USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_user_id = auth.uid()
    )
  );

-- === Atomic upsert function ===
-- SECURITY DEFINER so it can do the SELECT + INSERT/UPDATE atomically.
-- Access is guarded explicitly: caller must own the target workspace.

CREATE OR REPLACE FUNCTION public.upsert_invoice_alias(
  p_workspace_id            uuid,
  p_invoice_name            text,
  p_invoice_name_normalized text,
  p_product_id              uuid,
  p_created_by              uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_id          uuid;
  v_usage_count integer;
BEGIN
  -- Guard: caller must own this workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'invoice_alias_access_denied';
  END IF;

  -- Try existing row first
  SELECT id, usage_count
  INTO   v_id, v_usage_count
  FROM   public.invoice_aliases
  WHERE  workspace_id            = p_workspace_id
    AND  invoice_name_normalized = p_invoice_name_normalized;

  IF v_id IS NOT NULL THEN
    UPDATE public.invoice_aliases
    SET    product_id   = p_product_id,
           usage_count  = v_usage_count + 1,
           updated_at   = now(),
           last_used_at = now()
    WHERE  id = v_id;

    RETURN jsonb_build_object(
      'id', v_id,
      'usage_count', v_usage_count + 1,
      'is_new', false
    );
  END IF;

  INSERT INTO public.invoice_aliases
    (workspace_id, invoice_name, invoice_name_normalized, product_id, usage_count, created_by)
  VALUES
    (p_workspace_id, p_invoice_name, p_invoice_name_normalized, p_product_id, 1, p_created_by)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'usage_count', 1, 'is_new', true);

EXCEPTION WHEN unique_violation THEN
  -- Race condition: a concurrent request inserted the row first; pick it up and update.
  SELECT id, usage_count
  INTO   v_id, v_usage_count
  FROM   public.invoice_aliases
  WHERE  workspace_id            = p_workspace_id
    AND  invoice_name_normalized = p_invoice_name_normalized;

  IF v_id IS NOT NULL THEN
    UPDATE public.invoice_aliases
    SET    product_id   = p_product_id,
           usage_count  = v_usage_count + 1,
           updated_at   = now(),
           last_used_at = now()
    WHERE  id = v_id;
  END IF;

  RETURN jsonb_build_object(
    'id',          v_id,
    'usage_count', COALESCE(v_usage_count, 0) + 1,
    'is_new',      false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_invoice_alias TO authenticated;

-- ============================================================
-- Verification query (run after migration):
--   SELECT count(*) FROM public.invoice_aliases;
--   SELECT pg_get_policydef(oid) FROM pg_policy WHERE polrelid = 'public.invoice_aliases'::regclass;
-- ============================================================
