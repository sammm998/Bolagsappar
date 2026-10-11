# Tester mot databasen

## rls.test.mjs (`pnpm test:rls`)

Kör alla migrationer och `seed.sql` i en tom Postgres och kontrollerar spärrarna mellan konton som olika användare.
Kräver bara Postgres (`DATABASE_URL`, standard `postgresql://postgres:postgres@localhost:5432/postgres`). Körs i CI.

## e2e.mjs

Går igenom hela systemet som riktiga användare mot en riktig Supabase-stack: inloggning med e-postlänk,
Taxi Malmö som huvudkund, inbjudan av en åkare, godkännande och publicering, rättelse med orsak, förarlistan,
Åkarkassan med signering med pennan, support, adminportalen och en ny direktkund vars ägare loggar in via inbjudan.

Kräver ett tomt projekt där `setup.sql` är inläst, Edge Functions igång och att mejlen sparas som filer
(till exempel en lokal SMTP-mottagare som GoTrue skickar till). Använd aldrig ett projekt med riktiga kunder.

```bash
SUPABASE_URL=http://localhost:8000 \
SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/<databas> \
MAIL_DIR=/sökväg/till/mejlen APP_URL=http://localhost:8000/app \
node --test supabase/tests/e2e.mjs
```

Alla adresser i testet slutar på `@exempel.example`.
