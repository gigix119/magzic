# Backup → Restore → Verify Drill

**Purpose:** Confirm that a production Supabase backup can actually be restored
to the staging project before we run any data-touching migrations (Prompt 6.5+).
A backup you have never restored is untested — this drill makes it real.

Run this procedure **once** before any migration that modifies critical data.
Record the result in the verification log at the bottom of this file.

---

## Prerequisites

- Prompt 3 (staging setup) complete — `magzic-staging` project exists and all
  migrations have been run (see `docs/staging.md`).
- You have Owner or Admin access to both the production and staging Supabase
  projects.
- You have the Supabase CLI installed locally (optional — the Dashboard path
  works without it).

---

## Step 1 — Take a production backup

Supabase runs **daily automatic backups** on Pro plans. You do not need to
trigger one manually; the most recent nightly backup is sufficient for the drill.

**Dashboard path (Pro/Team plan):**

1. Open the **production** Supabase project.
2. Go to **Database → Backups**.
3. Identify the most recent backup (today's or yesterday's nightly snapshot).
4. Click **Download** → save the `.sql.gz` file locally.
   Keep the filename — it contains the backup timestamp.

**CLI path (alternative):**

```powershell
# Install Supabase CLI if not already present
npm install -g supabase

# Link to your production project (get the ref from Settings → General)
supabase link --project-ref <PROD_REF>

# Pull the latest backup to ./backup/
supabase db dump --file ./backup/prod_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql
```

> **Security:** the dump file contains all data — treat it as sensitive.
> Do NOT commit it to git. Store it in a location outside the repo
> (e.g. `%USERPROFILE%\Downloads\magzic-backup\`).

---

## Step 2 — Restore to staging

### Option A — Supabase Dashboard (Point-in-time restore)

This option is only available if both production and staging are on the **same
Supabase organization** and the feature is enabled on your plan.

1. Open the **staging** project dashboard.
2. Go to **Database → Backups**.
3. Click **Restore from backup** → select the production snapshot you
   downloaded in Step 1.

> Skip to Step 3 after the restore completes (~5–10 minutes).

### Option B — psql restore from dump (recommended for free/Pro)

1. Decompress the backup:

```powershell
# Windows PowerShell (requires 7-Zip or gzip for Windows)
# Decompress with 7-Zip:
& "C:\Program Files\7-Zip\7z.exe" e .\prod_backup.sql.gz -o.\backup\

# Or with WSL/Git Bash:
# gzip -d prod_backup.sql.gz
```

2. Get the staging database connection string from:
   **Staging project → Settings → Database → Connection string** (URI format).
   It looks like:
   ```
   postgresql://postgres:<PASSWORD>@db.<STAGING_REF>.supabase.co:5432/postgres
   ```

3. Restore (this REPLACES staging data):

```powershell
# WARNING: this drops and recreates staging data — staging only, never production
$STAGING_DB = "postgresql://postgres:<PASSWORD>@db.<STAGING_REF>.supabase.co:5432/postgres"
psql $STAGING_DB -f .\backup\prod_backup.sql
```

   Expected output: a stream of `CREATE TABLE`, `COPY N`, `ALTER TABLE`, etc.
   lines. Errors on `CREATE EXTENSION` and similar lines are normal (extensions
   already exist on Supabase).

4. Common warnings (safe to ignore):
   - `ERROR: role "supabase_admin" already exists`
   - `ERROR: extension "uuid-ossp" already exists`
   - `ERROR: schema "extensions" already exists`

---

## Step 3 — Run the row-count verification script

After the restore completes, run the verification query against **both**
production and staging and compare the numbers.

The script is at **`scripts/verify-restore.sql`** in this repo.

### On production (read-only):

1. Open the **production** Supabase project.
2. Go to **SQL Editor**.
3. Paste the contents of `scripts/verify-restore.sql`.
4. Click **Run**.
5. Copy the result table — it shows row counts for all critical tables.

### On staging:

1. Open the **staging** Supabase project.
2. Go to **SQL Editor**.
3. Paste the same script.
4. Click **Run**.
5. Compare both result tables.

**Pass criterion:** every row in the staging result table has the same
`row_count` as the corresponding production row (±0, since this is a full
restore).

> **Note:** if you restored a nightly backup taken at 02:00 and production had
> activity since then, counts will differ by those new rows. That is expected
> and acceptable — the drill proves restore works, not that it's live-synced.

---

## Step 4 — Record the result

Fill in the log below after each successful drill:

| Date | Backup timestamp | Prod counts match staging? | Notes |
|------|-----------------|--------------------------|-------|
| _YYYY-MM-DD_ | _e.g. 2026-06-14 02:00 UTC_ | ✅ / ❌ | _e.g. 3 rows diff (new activity since backup)_ |

---

## Rollback / cleanup

This is a drill against staging only — there is no rollback needed for
production. If staging is in a bad state after a failed restore:

1. Go to **Staging project → Settings → General → Danger Zone**.
2. Click **Reset database** (drops all data and extensions, keeps project).
3. Re-run all migrations from `docs/staging.md`, then the seed from
   `seed/staging_seed.sql`.

---

## Security checklist

- [ ] Backup file stored outside the git repo.
- [ ] Connection string for production **not** pasted into any file.
- [ ] Staging connection string **not** committed (covered by `.env.*` gitignore).
- [ ] No `service_role` key printed or logged anywhere.

---

## Related files

| File | Purpose |
|------|---------|
| `docs/staging.md` | Staging project setup (Prompt 3) |
| `scripts/verify-restore.sql` | Row-count verification query |
| `seed/staging_seed.sql` | Staging seed (reset after drill if needed) |
