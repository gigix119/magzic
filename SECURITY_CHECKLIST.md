# Security Checklist — Magzic

## Public repository requirements

- [x] No `.env` files committed
- [x] No Supabase service role key committed
- [x] No private user data in source code
- [x] No production data in source code or SQL migrations
- [x] No passwords in code
- [x] No API tokens in code
- [x] No real invoices committed
- [x] No confidential company data in current files
- [x] No database dumps
- [x] No build artifacts / node_modules
- [x] Screenshots reviewed — problematic ones removed
- [ ] Desktop app screenshots still show test account email in sidebar — see Manual Actions

---

## Checked areas

| Area | Result |
|---|---|
| `.env` files | Not tracked — `.gitignore` covers `.env.*` |
| `.env.example` | Present, all values empty |
| Hardcoded secrets in `src/` | Fixed — see Findings |
| Hardcoded credentials | None found |
| User / personal data in source | None found |
| Screenshots | 3 removed — see Removed section |
| Supabase anon key | Was hardcoded as fallback — fixed |
| Supabase service role key | Not present anywhere |
| AI API keys (Anthropic, OpenAI) | Not in frontend code; handled server-side only |
| Cloudflare tokens | Not committed |
| SQL migration files | Reviewed — contain only schema and test/demo data |
| `supabase_seed.sql` | Contains generic test data (cleaning supplies, bulbs) — safe |
| RLS policies | Reviewed — workspace-scoped policies in `saas_migration.sql` and `saas_migration_v2.sql` |
| Admin backend access | `OwnerRoute` component + `isOwner()` check — role enforcement in frontend |
| Console logs | Reviewed — no token/session/JWT leaks |
| Git history | Reviewed — see History Findings |
| `DEPLOY.md` | Fixed incorrect `VITE_ANTHROPIC_API_KEY` reference |
| `wrangler.jsonc` | Clean — no tokens |
| `ADMIN_SETUP.md` | Clean — no real emails |

---

## Findings

### Finding 1 — Hardcoded Supabase URL and anon key in `src/supabase.js` [FIXED]

**Severity:** Medium (anon key is designed to be public in Supabase, but hardcoding is bad practice)

**Was:** Supabase project URL and anon key hardcoded as fallback values.

**Fixed:** Removed both fallback values. App now throws a clear error if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are not set.

**Note:** The Supabase anon key is technically a public key — it is sent with every browser request and is safe to expose if RLS is properly configured. It is NOT a service role key. However, hardcoding it removes the ability to rotate it without a code change.

### Finding 2 — `administrator@blueapart.pl` in Git history [MANUAL ACTION REQUIRED]

**Severity:** Medium

**Found in:** Multiple older commits, specifically visible in commits before `8984dbd` and `fdc1b39`.

This email was used as a test admin account email during development. It was removed from all current files in commits `8984dbd` and `fdc1b39`, but it remains in Git history.

**Current files:** Clean — `backend_migration.sql` uses `your-admin@example.com` placeholder.

**Action required:** See Manual Actions section.

### Finding 3 — Supabase anon key in Git history [LOW — anon key only]

**Severity:** Low

The Supabase anon key and project URL were committed in commit `248ed7d` and remain in Git history. The anon key has role `anon` (not `service_role`) and is designed to be exposed in browser code. If RLS policies are correctly applied, this key cannot access data it should not access.

**Recommended action:** Consider rotating the anon key in Supabase Dashboard as a precaution after cleaning history. Note: rotating the anon key requires updating `VITE_SUPABASE_ANON_KEY` in all environments.

### Finding 4 — `VITE_ANTHROPIC_API_KEY` in `DEPLOY.md` [FIXED]

**Severity:** Low (documentation only, no real key present)

`DEPLOY.md` incorrectly documented `VITE_ANTHROPIC_API_KEY` as a required variable. The actual implementation uses `VITE_INVOICE_AI_ENDPOINT` (a URL pointing to a server-side endpoint), never an API key in the frontend.

**Fixed:** Updated `DEPLOY.md` to document the correct variable.

### Finding 5 — Screenshot: `mobile/10_mobile_settings.jpeg` [REMOVED]

**Severity:** High

Screenshot showed a real person's name (**Tomek Hincke**) and email (**wojnowski-kordian@wp.pl**) from a test account profile settings screen.

**Action:** Removed from `assets/` and `README.md`.

### Finding 6 — Screenshots: `backend/01_admin_backend_overview.png`, `backend/02_invoice_model_training_panel.png` [REMOVED]

**Severity:** High

Backend overview screenshot prominently displayed multiple test account email addresses:
- `kordian.wojnowski@...`
- `falker69@op.pl`
- `administrator@blueapar...`
- `wojnowski.kordian@...`

**Action:** Both screenshots removed from `assets/` and `README.md`. The backend section in README now describes the feature in text.

### Finding 7 — Desktop app screenshots: test account email in sidebar [FLAGGED — manual action]

**Severity:** Low–Medium

All desktop application screenshots (`app/` and `invoice-parser/`) show the text `administrator@blueapart.pl` in the bottom-left corner of the navigation sidebar. The text is small but technically visible.

Screenshots cannot be cropped in this environment. The content of the screenshots (products, invoices, prices) is test/demo data.

**Action required:** Re-capture all desktop screenshots using a demo account (`demo@example.com` or similar) before making the repository fully public. See Manual Actions.

### Finding 8 — `mobile/07_mobile_contractors.jpeg`: NIP number visible [BORDERLINE — kept]

**Severity:** Low

Screenshot shows NIP `5250007422` for a contractor named "Global Test Supplier Ltd Magzic Demo Workspace". The contractor name is explicitly labeled as test/demo. The NIP is a valid Polish company NIP (publicly accessible data), associated here with a clearly fictitious test contractor name.

**Decision:** Kept in repository. The contractor entry is clearly synthetic test data. Recommended to replace with a fully fictional NIP (e.g., `0000000000`) if re-capturing.

### Finding 9 — Early RLS migrations with `USING (true)` [DOCUMENTED]

**Severity:** Low in isolation (overridden by later migrations)

Files `supabase_migration.sql`, `invoice_fix_migration.sql`, `warehouse_fix_migration.sql`, `price_alerts_migration.sql` contain `USING (true) WITH CHECK (true)` policies.

These are **early/draft migrations** that were superseded by `saas_migration.sql` and `saas_migration_v2.sql`, which apply proper workspace-scoped RLS (`workspace_id IN (SELECT id FROM workspaces WHERE owner_user_id = auth.uid())`).

**Action required:** Verify in the Supabase Dashboard that the current production policies match the final migrations, not the early permissive ones.

### False positives

- `src/utils/invoiceProductCreationHelpers.test.js` — references to `service_role` are assertions that it should NOT be present
- `src/context/AuthContext.jsx` — `password` field is a standard Supabase auth parameter, not a hardcoded credential
- `src/pages/Login.jsx`, `Register.jsx`, `ResetPassword.jsx` — standard auth form fields
- `kontakt@magzic.com` in `Ustawienia.jsx` — public support email, intentional
- `src/utils/readInvoiceAI.js` — comment confirms old Anthropic key pattern was removed
- Console logs in `src/utils/invoiceExtractor.js`, `invoiceLearning.js` etc. — log error messages and supplier names, not credentials or user data

---

## Removed or sanitized

| File | Reason | Action |
|---|---|---|
| `assets/screenshots/magzic/backend/01_admin_backend_overview.png` | Multiple real test account emails visible | Removed from repo and README |
| `assets/screenshots/magzic/backend/02_invoice_model_training_panel.png` | Test account email visible | Removed from repo and README |
| `assets/screenshots/magzic/mobile/10_mobile_settings.jpeg` | Real name (Tomek Hincke) and email visible | Removed from repo and README |
| `src/supabase.js` | Hardcoded Supabase URL and anon key as fallbacks | Removed hardcoded values; env var only |
| `DEPLOY.md` | Incorrect `VITE_ANTHROPIC_API_KEY` reference | Updated to `VITE_INVOICE_AI_ENDPOINT` |
| `.gitignore` | Missing coverage for certs, secrets dirs, DB dumps, `.env.*` | Added comprehensive entries |
| `.env.example` | Missing `VITE_INVOICE_AI_ENDPOINT` | Added with explanation |

---

## Manual actions required

### ACTION 1 — IMPORTANT: Rotate Supabase anon key (recommended)

The Supabase project URL (`qdagvdehtoyeuqxdbsss.supabase.co`) and anon key were committed in Git history (commit `248ed7d`). While the anon key is technically a public key designed for browser use, it is best practice to rotate it after it has appeared in a public repository.

**Steps:**
1. Go to Supabase Dashboard → Settings → API
2. Regenerate the anon key
3. Update `VITE_SUPABASE_ANON_KEY` in Cloudflare Pages environment variables
4. Update your local `.env` file

### ACTION 2 — IMPORTANT: Clean Git history (if full public exposure is a concern)

The email `administrator@blueapart.pl` appears in multiple commits before `8984dbd`. If you want to fully clean this from history:

```bash
# Install git-filter-repo first (pip install git-filter-repo)
git filter-repo --replace-text <(echo "administrator@blueapart.pl==>admin@example.com")
git push --force
```

**Warning:** This rewrites Git history. All collaborators would need to re-clone. Only do this if you consider the email sensitive enough to justify history rewrite.

### ACTION 3 — Re-capture desktop screenshots with a demo account

All desktop app screenshots show a test account email (`administrator@blueapart.pl`) in the navigation sidebar. To make the repository fully clean:

1. Create a demo Supabase account: `demo@magzic.com` or `demo@example.com`
2. Add test/demo data to the workspace
3. Re-capture all screenshots from `assets/screenshots/magzic/app/` and `assets/screenshots/magzic/invoice-parser/`
4. Replace the files in the repo

### ACTION 4 — Verify Supabase RLS in production Dashboard

The repository contains multiple migration files with different RLS policies. Confirm in the Supabase Dashboard (Authentication → Policies) that:
- All business tables (`towary`, `magazyny`, `faktury`, `kontrahenci`, `stany_magazynowe`, `ruchy_magazynowe`, etc.) use workspace-scoped policies, not the early `USING (true)` policies
- The `profiles` table uses `auth.uid() = id` policy
- The `workspaces` table uses `auth.uid() = owner_user_id` policy

### ACTION 5 — Set environment variables in Cloudflare Pages

After rotating the anon key (Action 1), update:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Optionally: `VITE_INVOICE_AI_ENDPOINT` (if using server-side AI parsing)

---

## Safe public repo rules

- Never commit `.env` — use `.env.example` with empty values only
- Never commit service role keys — they bypass all RLS
- Never commit real invoices, customer data or database dumps
- Never hardcode fallback API keys or URLs — use env vars with a clear error if missing
- Review every screenshot before publishing — check for emails, NIPs, names in any corner
- Rotate any key that was ever committed to a public repository
- Verify RLS policies in the Supabase Dashboard after running migrations
