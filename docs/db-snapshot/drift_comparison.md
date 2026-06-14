# Schema Drift Comparison

**How to fill this in:**
- Run all 7 SQL scripts on staging and production, paste results into `results/`.
- For each row, mark the **Live (staging)** and **Live (prod)** columns:
  - `YES` — object exists as expected
  - `NO` — missing
  - `DIFF` — exists but differs (add a note)
  - `EXTRA` — exists in live but not in repo migrations
  - `?` — not yet checked

Legend for Repo column:
- `DECLARED` — has a `CREATE TABLE` / `CREATE POLICY` / `CREATE FUNCTION` in a migration file
- `ALTER ONLY` — migration only adds columns; original CREATE is not in tracked migrations (pre-migration table)
- `INFERRED` — referenced by ALTER TABLE or FK but no CREATE TABLE found in any migration file

---

## Section 1 — Tables

| Table | Repo (migrations) | Live (staging) | Live (prod) | Notes |
|-------|-------------------|----------------|-------------|-------|
| `admin_audit_logs` | DECLARED (backend_migration.sql) | ? | ? | |
| `alerty_cenowe` | INFERRED — ALTER in saas_migration_v2; no CREATE found | ? | ? | ⚠️ Original CREATE missing from migrations |
| `alerty_cenowe_faktury` | DECLARED (price_alerts_migration.sql) | ? | ? | |
| `app_error_logs` | DECLARED (backend_migration.sql) | ? | ? | |
| `app_events` | DECLARED (backend_migration.sql) | ? | ? | |
| `elementy_pakietu` | INFERRED — ALTER in saas_migration_v2; no CREATE found | ? | ? | ⚠️ Original CREATE missing from migrations |
| `faktury` | INFERRED — ALTER in supabase_migration.sql; no CREATE found | ? | ? | ⚠️ Original CREATE missing from migrations |
| `invoice_aliases` | DECLARED (invoice_aliases_migration.sql) | ? | ? | |
| `invoice_extraction_logs` | DECLARED (model_migration.sql) | ? | ? | |
| `invoice_model_review_queue` | DECLARED (model_migration.sql) | ? | ? | |
| `invoice_model_runs` | DECLARED (model_migration.sql) | ? | ? | |
| `invoice_model_settings` | DECLARED (model_migration.sql) | ? | ? | |
| `invoice_user_corrections` | DECLARED (model_migration.sql) | ? | ? | |
| `kategorie` | INFERRED — ALTER in saas_migration.sql; no CREATE found | ? | ? | ⚠️ Original CREATE missing from migrations |
| `kontrahenci` | INFERRED — ALTER in saas_migration.sql; no CREATE found | ? | ? | ⚠️ Original CREATE missing from migrations |
| `magazyny` | INFERRED — referenced in supabase_migration.sql; no CREATE found | ? | ? | ⚠️ Original CREATE missing from migrations |
| `pakiety_sprzatania` | INFERRED — ALTER in saas_migration_v2; no CREATE found | ? | ? | ⚠️ Original CREATE missing from migrations |
| `pozycje_faktury` | INFERRED — ALTER in supabase_migration.sql; no CREATE found | ? | ? | ⚠️ Original CREATE missing from migrations |
| `profiles` | DECLARED (profiles_migration.sql) | ? | ? | |
| `ruchy_magazynowe` | DECLARED (supabase_migration.sql) | ? | ? | |
| `stany_magazynowe` | INFERRED — referenced via UNIQUE constraint; no CREATE found | ? | ? | ⚠️ Original CREATE missing from migrations |
| `towary` | INFERRED — ALTER in warehouse_fix_migration.sql; no CREATE found | ? | ? | ⚠️ Original CREATE missing from migrations |
| `user_consents` | DECLARED (phase1_migration.sql) | ? | ? | |
| `user_permissions` | DECLARED (backend_migration.sql) | ? | ? | |
| `workspaces` | DECLARED (saas_migration.sql) | ? | ? | |
| `zlecenia` | DECLARED (zlecenia_migration.sql) | ? | ? | |
| `zlecenia_pozycje` | DECLARED (zlecenia_migration.sql) | ? | ? | |

---

## Section 2 — Key Columns (highest drift risk)

Run script 02 and check these specific columns exist with the right type.

### `faktury`

| Column | Repo type / default | Live (staging) | Live (prod) | Notes |
|--------|--------------------|----|----|----|
| `id` | uuid PK | ? | ? | |
| `workspace_id` | uuid FK→workspaces | ? | ? | added in saas_migration.sql |
| `status` | text DEFAULT 'robocza' | ? | ? | added in supabase_migration.sql |
| `magazyn_id` | uuid FK→magazyny | ? | ? | added in supabase_migration.sql |
| `wartosc_netto` | numeric DEFAULT 0 | ? | ? | added in supabase_migration.sql |
| `price_mode` | text CHECK IN (net,gross,mixed,unknown) DEFAULT 'unknown' | ? | ? | added in invoice_parser_fix_migration.sql |
| `total_net` | numeric(12,2) | ? | ? | added in invoice_parser_fix_migration.sql |
| `total_vat` | numeric(12,2) | ? | ? | added in invoice_parser_fix_migration.sql |
| `total_gross` | numeric(12,2) | ? | ? | added in invoice_parser_fix_migration.sql |
| `amount_due` | numeric(12,2) | ? | ? | added in invoice_parser_fix_migration.sql |
| `detected_columns` | text[] | ? | ? | added in invoice_parser_fix_migration.sql |
| `parser_warnings` | text[] | ? | ? | added in invoice_parser_fix_migration.sql |
| `math_valid` | boolean | ? | ? | added in invoice_parser_fix_migration.sql |

### `pozycje_faktury`

| Column | Repo type / default | Live (staging) | Live (prod) | Notes |
|--------|--------------------|----|----|----|
| `workspace_id` | uuid FK→workspaces | ? | ? | added in saas_migration.sql |
| `vat_procent` | numeric DEFAULT 23 | ? | ? | added in supabase_migration.sql |
| `magazyn_id` | uuid FK→magazyny | ? | ? | added in invoice_fix_migration.sql |
| `raw_name` | text | ? | ? | added in rawname_migration.sql |
| `jednostka` | text | ? | ? | added in jednostka_migration.sql |
| `unit_price_gross` | numeric(12,2) | ? | ? | added in invoice_parser_fix_migration.sql |
| `line_total_net` | numeric(12,2) | ? | ? | added in invoice_parser_fix_migration.sql |
| `line_total_gross` | numeric(12,2) | ? | ? | added in invoice_parser_fix_migration.sql |
| `vat_amount` | numeric(12,2) | ? | ? | added in invoice_parser_fix_migration.sql |
| `original_price_type` | text CHECK IN (net,gross,unknown) DEFAULT 'unknown' | ? | ? | added in invoice_parser_fix_migration.sql |
| `is_service` | boolean DEFAULT false | ? | ? | added in invoice_parser_fix_migration.sql |
| `parser_confidence` | numeric(5,2) | ? | ? | added in invoice_parser_fix_migration.sql |
| `parser_warnings` | text[] | ? | ? | added in invoice_parser_fix_migration.sql |

### `towary`

| Column | Repo type / default | Live (staging) | Live (prod) | Notes |
|--------|--------------------|----|----|----|
| `workspace_id` | uuid FK→workspaces | ? | ? | added in saas_migration.sql |
| `sku` | text | ? | ? | added in sku_migration.sql |
| `archived_at` | timestamptz | ? | ? | added in warehouse_fix_migration.sql |
| `archive_reason` | text | ? | ? | added in warehouse_fix_migration.sql |

### `workspaces`

| Column | Repo type / default | Live (staging) | Live (prod) | Notes |
|--------|--------------------|----|----|----|
| `company_name` | text null | ? | ? | added in phase1_migration.sql |
| `nip` | text null | ? | ? | added in phase1_migration.sql |
| `business_category` | text NOT NULL DEFAULT 'general' | ? | ? | added in phase1_migration.sql |
| `business_subcategory` | text null | ? | ? | added in phase1_migration.sql |
| `business_profile_completed` | boolean NOT NULL DEFAULT false | ? | ? | added in phase1_migration.sql |
| `onboarding_completed_at` | timestamptz null | ? | ? | added in phase1_migration.sql |
| `settings` | jsonb NOT NULL DEFAULT '{}' | ? | ? | added in settings_migration.sql |
| `custom_category_name` | text null | ? | ? | added in custom_category_migration.sql |
| `custom_category_description` | text null | ? | ? | added in custom_category_migration.sql |
| `custom_category_base_type` | text null | ? | ? | added in custom_category_migration.sql |

### `profiles`

| Column | Repo type / default | Live (staging) | Live (prod) | Notes |
|--------|--------------------|----|----|----|
| `role` | text CHECK IN (owner,admin,user) NOT NULL DEFAULT 'user' | ? | ? | constraint extended in backend_migration.sql |
| `status` | text CHECK IN (active,blocked,pending) NOT NULL DEFAULT 'active' | ? | ? | added in backend_migration.sql |
| `first_name` | text | ? | ? | added in saas_migration.sql |
| `last_name` | text | ? | ? | added in saas_migration.sql |
| `display_name` | text | ? | ? | added in backend_migration.sql |
| `last_login_at` | timestamptz | ? | ? | added in backend_migration.sql |
| `last_seen_at` | timestamptz | ? | ? | added in backend_migration.sql |
| `updated_at` | timestamptz NOT NULL DEFAULT now() | ? | ? | added in backend_migration.sql |

### `stany_magazynowe`

| Column | Repo type / default | Live (staging) | Live (prod) | Notes |
|--------|--------------------|----|----|----|
| `workspace_id` | uuid FK→workspaces | ? | ? | added in saas_migration.sql |
| `updated_at` | timestamptz DEFAULT now() | ? | ? | added in invoice_fix_migration.sql |

### `ruchy_magazynowe`

| Column | Repo type / default | Live (staging) | Live (prod) | Notes |
|--------|--------------------|----|----|----|
| `workspace_id` | uuid FK→workspaces | ? | ? | added in saas_migration.sql |
| `faktura_id` | uuid FK→faktury | ? | ? | added in invoice_fix_migration.sql |

---

## Section 3 — RLS Policies

Run script 03 and verify these policies exist. ⚠️ = security-critical.

| Table | Expected policy name | cmd | Pattern | Live (staging) | Live (prod) | Notes |
|-------|---------------------|-----|---------|----------------|-------------|-------|
| `workspaces` | `workspace_owner` | ALL | `auth.uid() = owner_user_id` | ? | ? | ⚠️ Tenant root |
| `towary` | `towary_workspace` | ALL | `workspace_id IN (workspaces WHERE owner=auth.uid())` | ? | ? | ⚠️ |
| `magazyny` | `magazyny_workspace` | ALL | workspace_id subquery | ? | ? | ⚠️ |
| `kontrahenci` | `kontrahenci_workspace` | ALL | workspace_id subquery | ? | ? | ⚠️ |
| `faktury` | `faktury_workspace` | ALL | workspace_id subquery | ? | ? | ⚠️ |
| `pozycje_faktury` | `pozycje_faktury_workspace` | ALL | workspace_id subquery | ? | ? | ⚠️ |
| `stany_magazynowe` | `allow all` OR `stany_magazynowe_workspace` | ALL | `true` OR workspace_id subquery | ? | ? | ⚠️ Permissive "allow all" may exist from invoice_fix_migration; newer migrations add workspace policy |
| `ruchy_magazynowe` | `allow all` OR `ruchy_magazynowe_workspace` | ALL | `true` OR workspace_id subquery | ? | ? | ⚠️ Same risk as stany_magazynowe |
| `kategorie` | `kategorie_workspace` | ALL | workspace_id subquery | ? | ? | ⚠️ |
| `pakiety_sprzatania` | `pakiety_workspace` | ALL | workspace_id subquery | ? | ? | ⚠️ |
| `elementy_pakietu` | `elementy_pakietu_workspace` | ALL | workspace_id subquery | ? | ? | ⚠️ |
| `alerty_cenowe` | `alerty_cenowe_workspace` | ALL | workspace_id subquery | ? | ? | ⚠️ |
| `alerty_cenowe_faktury` | `allow all` | ALL | `true` | ? | ? | ⚠️ Deliberately permissive — confirm intentional |
| `profiles` | `profiles_own` or `user_read_own_profile` + `owner_read_all_profiles` | SELECT/UPDATE/ALL | `auth.uid() = id` + is_owner() | ? | ? | Multiple overlapping policies expected |
| `user_permissions` | `user_read_own_permissions` + `owner_manage_permissions` | SELECT + ALL | `auth.uid() = user_id` + is_owner() | ? | ? | |
| `app_events` | `user_insert_own_events` + `owner_read_all_events` | INSERT + SELECT | auth.uid() / is_owner() | ? | ? | |
| `admin_audit_logs` | `owner_manage_audit_logs` | ALL | is_owner() | ? | ? | |
| `app_error_logs` | `user_insert_error_logs` + `owner_read_error_logs` | INSERT + SELECT | auth.uid() IS NOT NULL / is_owner() | ? | ? | |
| `invoice_aliases` | `invoice_aliases_workspace` | ALL | workspace_id subquery | ? | ? | |
| `user_consents` | `user_consents_select` + `user_consents_insert` + `user_consents_update` | SELECT/INSERT/UPDATE | `auth.uid() = user_id` | ? | ? | |
| `zlecenia` | `zlecenia_select` + `zlecenia_insert` + `zlecenia_update` + `zlecenia_delete` | SELECT/INSERT/UPDATE/DELETE | workspace_id subquery | ? | ? | |
| `zlecenia_pozycje` | `pozycje_select` + `pozycje_insert` + `pozycje_update` + `pozycje_delete` | SELECT/INSERT/UPDATE/DELETE | via zlecenie_id subquery | ? | ? | |
| `invoice_model_runs` | `owner_manage_model_runs` | ALL | is_owner() | ? | ? | |
| `invoice_extraction_logs` | `user_insert_own_extraction_logs` + `user_read_own_extraction_logs` + `owner_read_all_extraction_logs` | INSERT/SELECT/ALL | auth.uid() / is_owner() | ? | ? | |
| `invoice_user_corrections` | `user_insert_own_corrections` + `user_read_own_corrections` + `owner_manage_corrections` | INSERT/SELECT/ALL | auth.uid() / is_owner() | ? | ? | |
| `invoice_model_review_queue` | `owner_manage_review_queue` | ALL | is_owner() | ? | ? | |
| `invoice_model_settings` | `owner_manage_model_settings` | ALL | is_owner() | ? | ? | |

---

## Section 4 — Functions & Triggers

Run scripts 04 and 06 and verify these exist.

| Object | Type | Repo declared in | Security | search_path | Live (staging) | Live (prod) | Notes |
|--------|------|-----------------|----------|-------------|----------------|-------------|-------|
| `handle_new_user()` | trigger fn | profiles_migration.sql | DEFINER | `public` | ? | ? | Original; may be superseded by handle_new_user_workspace |
| `handle_new_user_workspace()` | trigger fn | saas_migration.sql, backend_migration.sql | DEFINER | `public` | ? | ? | ⚠️ Rewritten twice; verify latest version is deployed |
| `guard_profile_sensitive_fields()` | trigger fn | backend_migration.sql | DEFINER | `public` | ? | ? | Protects role/status from self-edit |
| `is_owner()` | SQL fn | backend_migration.sql | DEFINER | `public` | ? | ? | ⚠️ Used by all backend RLS policies — critical |
| `bootstrap_admin_owner()` | plpgsql fn | backend_migration.sql | DEFINER | `public` | ? | ? | One-time bootstrap; can be dropped after use |
| `upsert_invoice_alias()` | plpgsql fn | invoice_aliases_migration.sql | DEFINER | `public` | ? | ? | Race-safe upsert |
| Trigger `on_auth_user_created` | AFTER INSERT on auth.users | profiles_migration.sql | — | — | ? | ? | May be replaced by on_auth_user_created_workspace |
| Trigger `on_auth_user_created_workspace` | AFTER INSERT on auth.users | saas_migration.sql / backend_migration.sql | — | — | ? | ? | ⚠️ Must be present; creates workspace + profile |
| Trigger `guard_profile_sensitive_fields` | BEFORE UPDATE on profiles | backend_migration.sql | — | — | ? | ? | |

---

## Section 5 — Key Constraints

Run script 05 and verify these exist.

| Table | Constraint name | Type | Details | Live (staging) | Live (prod) | Notes |
|-------|----------------|------|---------|----------------|-------------|-------|
| `stany_magazynowe` | `stany_magazynowe_towar_id_magazyn_id_key` | UNIQUE | (towar_id, magazyn_id) | ? | ? | Required for upsert ON CONFLICT |
| `invoice_aliases` | `invoice_aliases_workspace_name_unique` | UNIQUE | (workspace_id, invoice_name_normalized) | ? | ? | Required for upsert atomicity |
| `profiles` | `profiles_role_check` | CHECK | role IN ('owner','admin','user') | ? | ? | Extended in backend_migration.sql |
| `profiles` | `profiles_status_check` | CHECK | status IN ('active','blocked','pending') | ? | ? | Added in backend_migration.sql |
| `user_permissions` | unique on (user_id, module_key) | UNIQUE | — | ? | ? | |
| `invoice_model_settings` | unique on `key` | UNIQUE | — | ? | ? | |
| `user_consents` | unique on `user_id` | UNIQUE | — | ? | ? | |
| `faktury` | check on `price_mode` | CHECK | price_mode IN ('net','gross','mixed','unknown') | ? | ? | Added in invoice_parser_fix_migration.sql |
| `pozycje_faktury` | check on `original_price_type` | CHECK | original_price_type IN ('net','gross','unknown') | ? | ? | Added in invoice_parser_fix_migration.sql |

---

## Section 6 — Tables only in code (not in any migration)

If the live snapshot reveals tables here, they were created outside tracked migrations.

| Detected in code | Found in migrations | Live (staging) | Live (prod) | Risk |
|-----------------|--------------------|----|----|----|
| `towary` | No CREATE found — INFERRED | ? | ? | Need to document original schema |
| `magazyny` | No CREATE found — INFERRED | ? | ? | Need to document original schema |
| `kontrahenci` | No CREATE found — INFERRED | ? | ? | Need to document original schema |
| `faktury` | No CREATE found — INFERRED | ? | ? | Need to document original schema |
| `pozycje_faktury` | No CREATE found — INFERRED | ? | ? | Need to document original schema |
| `stany_magazynowe` | No CREATE found — INFERRED | ? | ? | Need to document original schema |
| `kategorie` | No CREATE found — INFERRED | ? | ? | Need to document original schema |
| `pakiety_sprzatania` | No CREATE found — INFERRED | ? | ? | Need to document original schema |
| `elementy_pakietu` | No CREATE found — INFERRED | ? | ? | Need to document original schema |
| `alerty_cenowe` | No CREATE found — INFERRED | ? | ? | Need to document original schema |

---

## Section 7 — Findings Summary

Fill in after running all scripts. Use this to prioritize what to fix.

| Finding | Severity | Action needed |
|---------|----------|---------------|
| _(fill in after running scripts)_ | | |

### Known risk: permissive "allow all" policies

The following tables may have lingering `"allow all" FOR ALL USING (true)` policies
from early migrations (before saas_migration.sql tightened them):

- `ruchy_magazynowe` — invoice_fix_migration.sql and warehouse_fix_migration.sql re-add `"allow all"`
- `stany_magazynowe` — invoice_fix_migration.sql and warehouse_fix_migration.sql re-add `"allow all"`
- `alerty_cenowe_faktury` — price_alerts_migration.sql sets `"allow all"`

For ruchy_magazynowe and stany_magazynowe: saas_migration.sql sets workspace-scoped
policies BUT the later fix migrations then DROP them and re-add `"allow all"`.
**This is a data isolation risk.** Check script 03 output carefully for these tables.
