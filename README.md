# magzic — System zarządzania magazynem AI

System magazynowy dla blueapart.pl zbudowany w React + Vite + Supabase.

## Uruchomienie lokalne

1. Sklonuj repo
2. Skopiuj `.env.example` do `.env` i wypełnij wartości
3. `npm install`
4. `npm run dev`

## Zmienne środowiskowe

Zobacz `.env.example`

## Supabase

Po pierwszym uruchomieniu wklej w Supabase SQL Editor:
- `price_alerts_migration.sql`

## Deploy

Projekt jest wdrożony na Cloudflare Pages.
Połączony z GitHub — każdy push na `main` automatycznie deployuje.

## Konto admina

Utwórz w Supabase Dashboard:  
Authentication → Users → Add user  
Email: administrator@blueapart.pl
