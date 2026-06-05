-- custom_category_migration.sql
-- Run in Supabase SQL Editor
-- Adds custom business category fields to workspaces table

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS custom_category_name        text null,
  ADD COLUMN IF NOT EXISTS custom_category_description text null,
  ADD COLUMN IF NOT EXISTS custom_category_base_type   text null;
