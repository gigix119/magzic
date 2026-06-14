# Live Schema Snapshot Kit

**Purpose:** Capture the REAL schema, RLS policies, functions, triggers and
constraints from staging and production Supabase projects, then compare them
against what the repo migration files declare and what the app code references.

**What you do — step by step:**

1. Open Supabase Dashboard → **SQL Editor** for your **STAGING** project.
2. Run each `0N_*.sql` script in order (01 → 07). Each one is a pure SELECT — no writes.
3. Copy the full output (all rows, CSV or table) and paste it into the matching
   `results/STAGING_0N_*.txt` file.
4. Repeat steps 1–3 for your **PRODUCTION** project, pasting into `results/PROD_0N_*.txt`.
5. Fill in the **Live** column in `drift_comparison.md`.

**Scripts (run in order):**

| Script | Queries | Result files |
|--------|---------|--------------|
| `01_tables.sql` | All public tables + RLS enabled flag | `STAGING_01_tables.txt` / `PROD_01_tables.txt` |
| `02_columns.sql` | All columns (name, type, nullable, default) | `STAGING_02_columns.txt` / `PROD_02_columns.txt` |
| `03_rls_policies.sql` | All RLS policies (table, cmd, USING, WITH CHECK, roles) | `STAGING_03_rls_policies.txt` / `PROD_03_rls_policies.txt` |
| `04_functions.sql` | Functions (security definer/invoker, search_path, lang) | `STAGING_04_functions.txt` / `PROD_04_functions.txt` |
| `05_constraints.sql` | PKs, FKs, UNIQUE constraints + involved columns | `STAGING_05_constraints.txt` / `PROD_05_constraints.txt` |
| `06_triggers.sql` | Triggers on public + auth schema | `STAGING_06_triggers.txt` / `PROD_06_triggers.txt` |
| `07_indexes.sql` | All indexes on public schema | `STAGING_07_indexes.txt` / `PROD_07_indexes.txt` |

**After you paste results:** open `drift_comparison.md` and fill in the
**Live (staging)** and **Live (prod)** columns. Items marked `?` are unknowns
that need verification.

**Safety:** every script is SELECT-only. No changes will be made to your database.
