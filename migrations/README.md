# Migrations

## Struktura

```
migrations/
  README.md          ← ten plik
  _deprecated/       ← NIGDY nie uruchamiać tych plików
```

Pliki migracji "aktywne" (do ręcznego wykonania w Supabase SQL Editor)
znajdują się w **rocie repozytorium** (`/*.sql`). Są to m.in.:

| Plik | Zawartość |
|------|-----------|
| `saas_migration.sql` / `saas_migration_v2.sql` | Schemat SaaS, workspace, RLS bazowy |
| `backend_migration.sql` | Panel admina, rola owner |
| `profiles_migration.sql` | Tabela profiles |
| `model_migration.sql` | Tabela models |
| `sku_migration.sql` | Kolumna SKU na towary |
| `rawname_migration.sql` | Kolumna raw_name na pozycje_faktury |
| `invoice_aliases_migration.sql` | Aliasy produktów |
| `invoice_parser_fix_migration.sql` | Poprawki parsera faktur |
| `jednostka_migration.sql` | Kolumna jednostka |
| `custom_category_migration.sql` | Własne kategorie |
| `phase1_migration.sql` | Onboarding faza 1 |
| `settings_migration.sql` | Ustawienia użytkownika |
| `zlecenia_migration.sql` | Moduł zleceń |
| `assign_admin_workspace.sql` | Helper: przypisanie admina |
| `supabase_seed.sql` | Dane seed (dev/staging) |

---

## _deprecated/ — NIE URUCHAMIAĆ

Katalog `_deprecated/` zawiera **stare migracje z luką bezpieczeństwa**.
Każdy z tych plików tworzy politykę RLS `USING (true) WITH CHECK (true)`,
która **usuwa izolację między tenantami** — każdy zalogowany użytkownik
widzi dane wszystkich innych.

**Zasada: nigdy nie uruchamiaj niczego z katalogu `_deprecated/`.**

Pliki są zachowane wyłącznie dla historii git.

| Plik | Problem |
|------|---------|
| `invoice_fix_migration.sql` | `USING(true)` na `ruchy_magazynowe`, `stany_magazynowe` |
| `warehouse_fix_migration.sql` | `USING(true)` na `stany_magazynowe`, `ruchy_magazynowe` |
| `supabase_migration.sql` | `USING(true)` na `ruchy_magazynowe` |
| `price_alerts_migration.sql` | `USING(true)` na `alerty_cenowe_faktury` |

Poprawne polityki RLS (per-tenant, per-workspace) zostały wdrożone
w ramach **Promptów 17-18**. Szczegóły: `docs/db-snapshot/03_rls_policies.sql`.
