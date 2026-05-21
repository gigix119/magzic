# Tworzenie konta administratora

## 1. Uruchom migrację bazy danych

W Supabase Dashboard → **SQL Editor** → wklej i uruchom zawartość pliku `profiles_migration.sql`.

## 2. Zarejestruj konto przez aplikację

Otwórz `/register` i utwórz konto na docelowy adres e-mail administratora. Po rejestracji potwierdź adres klikając link w e-mailu.

## 3. Nadaj rolę admina

W Supabase Dashboard → **SQL Editor** uruchom:

```sql
update public.profiles
set role = 'admin'
where email = 'twoj@email.pl';
```

Zamień `twoj@email.pl` na adres e-mail zarejestrowanego konta.

## 4. Weryfikacja

```sql
select id, email, role, created_at
from public.profiles
where role = 'admin';
```

Powinien pojawić się wiersz z `role = 'admin'`.

---

## Zmienne środowiskowe

Aplikacja wymaga pliku `.env` w katalogu `magzic/` (przy `package.json`):

```env
VITE_SUPABASE_URL=https://<twoj-projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=<klucz-anon-z-supabase-dashboard>
```

Wartości znajdziesz w Supabase Dashboard → **Settings → API**.

> Nie używaj `service_role` key w aplikacji frontendowej.

---

## Uruchomienie lokalne

```bash
cd magzic
npm install
npm run dev
```

Aplikacja dostępna pod `http://localhost:5173`.

## Build produkcyjny

```bash
cd magzic
npm run build
# pliki produkcyjne w katalogu magzic/dist/
```
