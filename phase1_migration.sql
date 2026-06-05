-- Phase 1 Migration: Business profile onboarding + user consents
-- Run in Supabase Dashboard → SQL Editor
-- Safe: idempotent, uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS

-- 1. Extend workspaces with business profile fields
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS company_name               text         null;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS nip                        text         null;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS business_category          text         not null default 'general';
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS business_subcategory       text         null;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS business_profile_completed boolean      not null default false;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS onboarding_completed_at    timestamptz  null;

-- 2. Create user_consents table (if not exists)
CREATE TABLE IF NOT EXISTS public.user_consents (
  id                     uuid        primary key default uuid_generate_v4(),
  user_id                uuid        references auth.users(id) on delete cascade unique not null,
  terms_version          text        not null default 'v1',
  privacy_policy_version text        not null default 'v1',
  accepted_terms_at      timestamptz null,
  accepted_privacy_at    timestamptz null,
  marketing_consent      boolean     not null default false,
  cookies_consent        boolean     not null default false,
  created_at             timestamptz not null default now()
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_consents_select" ON public.user_consents;
DROP POLICY IF EXISTS "user_consents_insert" ON public.user_consents;
DROP POLICY IF EXISTS "user_consents_update" ON public.user_consents;

CREATE POLICY "user_consents_select" ON public.user_consents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_consents_insert" ON public.user_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_consents_update" ON public.user_consents
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON public.user_consents (user_id);
