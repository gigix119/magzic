# Deploy magzic na Cloudflare Pages

## 1. GitHub

```bash
git init
git add .
git commit -m "magzic v1 - initial deploy"
git branch -M main
git remote add origin https://github.com/TWOJ_LOGIN/magzic.git
git push -u origin main
```

## 2. Cloudflare Pages

1. dash.cloudflare.com → Workers & Pages → Create
2. Pages → Connect to Git → wybierz repo `magzic`
3. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: **20**
4. Environment variables (dodaj wszystkie z sekcji 5)
5. Save and Deploy

## 3. Domena magzic.com

1. Cloudflare Pages → twój projekt → Custom domains
2. Add custom domain → wpisz: `magzic.com`
3. Cloudflare automatycznie skonfiguruje DNS (bo domena jest już na Cloudflare)
4. Poczekaj 2–5 minut na propagację

## 4. Supabase — dodaj domenę do allowed origins

1. supabase.com → projekt magzic → Settings → API
2. W sekcji "URL Configuration" dodaj:
   - Site URL: `https://magzic.com`
   - Redirect URLs: `https://magzic.com/**`

## 5. Zmienne środowiskowe (wpisz na Cloudflare Pages → Settings → Environment variables)

| Zmienna | Gdzie znaleźć |
|---|---|
| `VITE_SUPABASE_URL` | supabase.com → projekt → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | supabase.com → projekt → Settings → API → anon public |
| `VITE_ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |

Ustaw dla środowisk: **Production** i **Preview**.

## 6. Uwagi

- `public/_redirects` zapewnia SPA routing (wszystkie ścieżki serwują `index.html`)
- Supabase anon key jest kluczem publicznym — bezpieczny po stronie klienta
- Anthropic API key jest używany bezpośrednio z przeglądarki (header `anthropic-dangerous-direct-browser-access`)
  — ogranicz użycie kluczy w Anthropic Console do domeny magzic.com
