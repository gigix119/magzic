# Staging / Local DB Setup

## Approach chosen: separate Supabase staging project

**Why not local Supabase CLI?**  
The project has no `supabase/` directory — the CLI has never been initialised here.
All migrations are plain SQL files run via the Supabase Dashboard SQL Editor,
so a free staging Supabase project is the fastest path that stays consistent with
the existing workflow. No Docker required.  
If you ever want to switch to `supabase start`, run `supabase init` first, copy
all migrations into `supabase/migrations/`, and follow the
[Supabase CLI docs](https://supabase.com/docs/guides/cli/local-development).

---

## Step 1 – Create a free staging project

1. Log in to [supabase.com](https://supabase.com).
2. Click **New project** → give it a name like `magzic-staging`.
3. Choose any region, set a database password (save it somewhere).
4. Wait ~2 minutes for the project to spin up.

---

## Step 2 – Run all migrations in order

Open **SQL Editor** (left sidebar) in your new staging project and run the
following files **in this exact order** — paste each file's content and click
**Run**:

| # | File | Notes |
|---|------|-------|
| 1 | `profiles_migration.sql` | Creates `profiles` table + auth trigger |
| 2 | `supabase_migration.sql` | Creates `ruchy_magazynowe`, adds columns to `faktury`, etc. |
| 3 | `saas_migration.sql` | Creates `workspaces`, adds `workspace_id` to all tables, sets RLS |
| 4 | `saas_migration_v2.sql` | Adds `workspace_id` to `pakiety_sprzatania`, `alerty_cenowe` |
| 5 | `invoice_fix_migration.sql` | Cleans up `stany_magazynowe`, adds missing `faktury` columns |
| 6 | `invoice_aliases_migration.sql` | Self-learning alias table |
| 7 | `rawname_migration.sql` | Adds `raw_name` to `pozycje_faktury` |
| 8 | `jednostka_migration.sql` | Adds `jednostka` to `pozycje_faktury` |
| 9 | `sku_migration.sql` | Adds `sku` to `towary` |
| 10 | `invoice_parser_fix_migration.sql` | Price-mode columns for `faktury` + `pozycje_faktury` |
| 11 | `phase1_migration.sql` | Business profile fields on `workspaces`, `user_consents` table |
| 12 | `backend_migration.sql` | Admin panel tables (`is_owner()` function) |
| 13 | `model_migration.sql` | Invoice model tables (requires `backend_migration.sql`) |
| 14 | `settings_migration.sql` | `settings` JSONB column on `workspaces` |
| 15 | `zlecenia_migration.sql` | Orders/tasks module |
| 16 | `custom_category_migration.sql` | Custom category fields on `workspaces` |
| 17 | `price_alerts_migration.sql` | `alerty_cenowe_faktury` table |
| 18 | `warehouse_fix_migration.sql` | Any warehouse-related fixes |

> **Tip:** if a file fails, read the error — most are idempotent (`IF NOT EXISTS`)
> so re-running is safe. The most common issue is running them out of order.

---

## Step 3 – Create two test users

In the staging project dashboard:

1. Go to **Authentication → Users**.
2. Click **Add user → Create new user** for each:

| Email | Password (choose any) |
|-------|----------------------|
| `test1@staging.magzic` | e.g. `StagingPass1!` |
| `test2@staging.magzic` | e.g. `StagingPass2!` |

Make sure **"Auto Confirm User"** is enabled (it is by default on new projects).

---

## Step 4 – Run the seed script

Open **SQL Editor** → paste the content of `seed/staging_seed.sql` → click **Run**.

You should see `NOTICE` messages at the bottom:
```
Seed complete.
  Workspace Alpha (uid1=...): ...
  Workspace Beta  (uid2=...): ...
  ...
```

If you see an error about a user not found, re-check Step 3.

---

## Step 5 – Configure your local env

```bash
cp env.staging.example .env.staging
```

> **Note:** `env.staging.example` is the committed template (safe to share — no
> real secrets). `.env.staging` is created locally and is covered by the
> `.env.*` gitignore rule — it will never be committed.

Fill in the two values from your staging project → **Settings → API**:
- `VITE_SUPABASE_URL` — the Project URL
- `VITE_SUPABASE_ANON_KEY` — the `anon` public key

Then start the dev server pointed at staging:

```bash
# PowerShell
$env:VITE_SUPABASE_URL="https://<ref>.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="<anon-key>"
npm run dev
```

Or keep a `.env.staging` file and load it with a tool like
[`dotenv-cli`](https://github.com/entropitor/dotenv-cli):

```bash
npx dotenv-cli -e .env.staging -- npm run dev
```

---

## Step 6 – Point existing tests at staging (optional)

The test suite (`npm test`) is purely in-memory — it does **not** hit any database.
No env var changes are needed to run tests.

If you add integration tests in the future that do call Supabase, pass the
staging URL/key via environment:

```bash
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm test
```

---

## Verification checklist

After completing the steps above, verify:

- [ ] Log in as `test1@staging.magzic` → workspace **Magazyn Testowy Alpha** appears.
- [ ] Towary page shows 3 products (Płyn, Papier, Worki).
- [ ] Magazyny page shows 2 warehouses (Główny, Pomocniczy).
- [ ] Kontrahenci shows 2 contractors.
- [ ] Faktury shows 2 invoices: `FV-STAGING-001` (robocza) and `FV-STAGING-002` (zatwierdzona).
- [ ] Log out, log in as `test2@staging.magzic` → separate workspace **Magazyn Testowy Beta** with its own data only (tenant isolation).

---

## Resetting seed data

Re-running `seed/staging_seed.sql` is safe — it uses `ON CONFLICT DO NOTHING`
and idempotent guards. It will not duplicate records.

To start from a clean slate, use **Supabase Dashboard → Database → Tables** to
truncate individual tables, or delete and recreate the staging project entirely.

---

## Seed data summary

| Entity | Workspace Alpha | Workspace Beta |
|--------|----------------|----------------|
| Warehouses | Główny + Pomocniczy | Beta |
| Products | 3 | 1 |
| Contractors | 2 | 1 |
| Inventory levels | 5 entries | 0 (empty) |
| Draft invoice | FV-STAGING-001 (2 lines) | FV-STAGING-BETA-001 (1 line) |
| Approved invoice | FV-STAGING-002 (2 lines) | – |
