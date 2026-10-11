# Bolagsappar

Appar för företag som fastnat i Excel och mejl. Byggt enligt *Bolagsappar, bygg- och designspecifikation v3*, med Taxi Malmö som första huvudkund och apparna från zip-filen (`legacy/`) som grund.

| Yta | Var | Teknik |
| --- | --- | --- |
| Hemsidan bolagsappar.se | `apps/web` | Astro, statisk, innehåll i Markdown |
| Plattformen app.bolagsappar.se (huvudkunder, åkare, direktkunder, `/admin`) | `apps/platform` | React 19, Vite, TanStack Router och Query |
| Mobilappen (iOS och Android) | `apps/mobile` | Expo SDK 57 |
| Motorerna (all beräkning) | `packages/core` | Ren JS, Vitest, jämförelsetester mot `legacy/` |
| Designsystemet | `packages/ui` | `tokens.css`, `components.css`, React-komponenter |
| Guiderna | `packages/guides` | Välkomstguide, Kom igång och hjälp per vy, per modul och variant |
| Modulerna | `packages/modules` | `defineModule`: manifest per app |
| API | `packages/api` | Supabase-klient, och en lokal backend med samma regler för demo och utveckling |
| Databas | `supabase/` | Migrationer med RLS, Edge Functions, seed och RLS-tester |
| Zip-filens appar, orörda | `legacy/` | Referens för jämförelsetesterna |

## Kom igång

```bash
pnpm install
pnpm dev            # plattformen på http://localhost:5173 i demoläge
pnpm dev:web        # hemsidan på http://localhost:4321
cd apps/mobile && pnpm web   # mobilappen i webbläsaren (eller pnpm start för Expo Go)
```

Utan Supabase-nycklar körs plattformen och mobilappen mot den lokala backenden med påhittad data. Logga in med en av demorollerna:

| Roll | Visar |
| --- | --- |
| Sara Exempel, Taxi Malmö, ekonomi | Huvudkundens portal: Avräkningens fyra steg (oktober pågår, Bambora och kontoutdrag saknas), Åkare, Appar till åkare, Förarlista |
| Ahmed Exempel, Åkeri Norra AB | Åkarens portal: Min avräkning, Åkarkassan, Mina förare, appbutiken. Även ekonomi på Taxi Malmö (kontoväljaren) |
| Förare A1 | Lönespecar och ett anställningsavtal som väntar på signatur med pennan |
| Fia Exempel, Folieringsfirman | Direktkund med Verkstad och Skadeflöde |
| Jens Exempel, Jetpack | Logistik (exempel): uppdragsfil, underleverantörer, godkänn och publicera |
| Ulla Exempel, Budfirma Exempel AB | Underleverantör till Jetpack: Min avräkning |
| Bo Admin | Adminportalen `/admin` |

All data i repot är påhittad: regnummer börjar på Q, personnummer slutar på 0000, försäkringsbolag och personer heter Exempel.

## Tester

```bash
pnpm test           # motorer (jämförelse mot legacy), API, guider, moduler
pnpm lint           # ESLint och kontroll att inga tankstreck finns i texterna
pnpm typecheck
pnpm test:rls       # RLS mot en riktig Postgres (DATABASE_URL, standard postgres:postgres@localhost:5432)
pnpm build
```

CI (`.github/workflows/ci.yml`) kör allt detta, med Postgres som tjänst, och kontrollerar att `supabase/seed.sql` är uppdaterad (`node scripts/gen-seed-sql.mjs`).

## Supabase

1. Skapa ett projekt i EU-region. Kör migrationerna i `supabase/migrations` och sedan `supabase/seed.sql` (bara för demo).
2. Auth: e-post med inloggningslänk. Lägg till `https://app.bolagsappar.se/**` och `bolagsappar://` som redirect.
3. Edge Functions i `supabase/functions` (`invite`, `publish`, `ai`). Hemligheter:
   - `APP_URL` (t.ex. `https://app.bolagsappar.se`)
   - `RESEND_API_KEY` och `MAIL_FROM` för mejl. Utan nyckel loggas mejlen bara.
   - `ANTHROPIC_API_KEY` för Skadeflödets utkast. Utan nyckel visar appen utkast utan AI. `AI_MODEL` och `AI_PER_TIMME` är valfria.
4. Miljövariabler: `apps/platform/.env.example`, `apps/web/.env.example`, `apps/mobile/.env.example`.

## Driftsättning (Railway eller annan Docker-värd)

- **En tjänst (standard):** `Dockerfile` i roten. Railway hittar den själv. Hemsidan ligger på `/` och plattformen på `/app` (inloggning på `/app/logga-in`, sedan portalen med alla appar). Sätt `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `PUBLIC_SUPABASE_URL` och `PUBLIC_SUPABASE_ANON_KEY` som variabler (de används när sidorna byggs). Utan dem körs demoläget.
- **Två tjänster med egna domäner:** hemsidan med `RAILWAY_DOCKERFILE_PATH=deploy/web.Dockerfile` (bolagsappar.se) och plattformen med `RAILWAY_DOCKERFILE_PATH=deploy/platform.Dockerfile` (app.bolagsappar.se).
- Edge Functions: sätt `APP_URL` till plattformens adress, till exempel `https://bolagsappar.se/app`.
- Railpack (Railways automatiska byggare) räcker inte för ett pnpm-monorepo utan startkommando, därför Dockerfile.

## Beslut

- **Ingen BankID.** Inloggning sker med en länk till e-posten. Avtal och aktivering av appar signeras med pennan: man ritar sin underskrift (med musen eller fingret). Avtalstexten låses med en SHA-256-kontrollsumma, och signaturen sparas som PNG med namn och tid. I mobilen blir dragen en PNG i `packages/core/signatur.js` eftersom det inte finns någon canvas. Kolumnen `users.bankid_subject` finns kvar men används inte.
- **Taxi Malmö är huvudkund.** 24 påhittade åkerier, månaderna april till september publicerade, oktober pågår.
- **Åkarkassan och Tripkassan är en motor** med konfiguration (`createEngine('akarkassan' | 'tripkassan')`).
- **Skärmarna räknar inte.** Allt går via `packages/core`, och jämförelsetesterna visar att resultaten är desamma som i `legacy/`.
- **Skattesatser ligger i konfiguration med giltighetsdatum** (`packages/core/src/config/skatter.js` och tabellen `tax_rates`).
- **En publicerad månad ändras aldrig.** En rättelse blir en ny version med orsak (databasens trigger `shares_lock`).
- **AI bara på servern** och bara som utkast som en människa granskar.
- Den enda ändringen i `legacy/`: två förnamn i en text om nystartsjobb i akarkassan är ersatta med "berörda förare" (öppen fråga 10).

## Öppna frågor till ägaren (sidan 50)

| Nr | Fråga | Läget |
| --- | --- | --- |
| 01 | Priser | **Tillfälliga priser** i `packages/modules/src/priser.js` (ändra bara där): Avräkning för huvudkund 4 900 kr per månad plus 149 kr per ansluten åkare, Förarlista 990 kr, Åkarkassan 495 kr per åkare, Verkstad 1 490 kr, Skadeflöde 990 kr (direkt) eller 395 kr (åkare), Körjournal 195 kr. Allt exkl. moms. Hemsidan visar "från 1 490". Månadsintäkt och fakturering i adminportalen räknas från listan. |
| 02 | Filhjälpen | **Ifylld** i `packages/core/src/filetypes/catalog.js`, byggd på zip-filens appar (rubriker, felmeddelanden och parsrar). Menynamnen i portalerna är markerade `kontrollera: true` och stäms av första gången någon hämtar filen. |
| 03 | Jetpack | **Exempel på strukturen**: logistikvariant av Avräkning (`packages/core/src/logistik`), uppdragsfil i CSV, provision 12 %, 15 kr per uppdrag, 495 kr per fordon och månad, orden uppdrag och underleverantör. Fyra påhittade underleverantörer, augusti publicerad och september inläst. Logga in som Jens (Jetpack) eller Ulla (underleverantör). Byts mot Jetpacks riktiga fil och avgifter när de finns. |
| 04 | Avtal om att koden förs över från Taxi Malmö AB till Bolagsappar | Väntar |
| 05 | BankID | Ersatt med e-postlänk och penna enligt ägarens beslut |
| 06 | Arkivering av originalfiler | Av som standard, filerna läses i webbläsaren |
| 07 | Vem får godkänna och publicera | **Ägare, admin och ekonomi** enligt specens rolltabell (sidan 5). Varje konto kan begränsa det under Inställningar, Användare, Godkänna och publicera. Ägaren får alltid, läs och förare aldrig. Spärren finns i databasen (`app.kan_godkanna`), i den lokala backenden och i `packages/core/src/behorighet.js`. |
| 08 | Tripkassans flikar Bokföring och Bank i Åkarkassan | Ingår |
| 09 | Hur mejl från skadereglerare kommer in i Skadeflöde | Vidarebefordran till en skadeadress, mejlen ligger som dokument |
| 10 | Personuppgifter i koden | Åtgärdat i `legacy/apps/akarkassan` |
| 11 | Logga | **Loggan ur specifikationen** (sidan 1), uttagen ur PDF:ens vektorer: `packages/ui/src/brand/` (ljus, mörk, symbol). Används i plattformen, på hemsidan, i mobilappen, som favicon och som app-ikon. |
| 12 | Domäner | `bolagsappar.se` (hemsidan), `app.bolagsappar.se` (plattformen). `taxiavrakning.se` går till `/taxi` och `akaravrakning.se` till `/akeri`, `www` till utan `www` (i `deploy/Caddyfile.static`). Peka alla hemsidans domäner mot hemsidans tjänst. |

## Läget per fas

| Fas | Innehåll | Status |
| --- | --- | --- |
| 0 Grund | Monorepo, `legacy/`, tokens och komponenter, CI | Klar |
| 1 Motorer | Avräkning, Åkarkassan och Tripkassan som en motor, Verkstad, filigenkänning, jämförelsetester | Klar |
| 2 Kärnan | Supabase med RLS, konton och roller, kontoväljare, skalet, guidesystemet, dokument-API som shimmen | Klar, RLS-testerna går mot riktig Postgres |
| 3 Avräkning | Fyra steg, publicering, Min avräkning, notiser och mejl | Klar |
| 4 Nätverk | Bjud in åkare, Appar till åkare, appbutik, Förarlista och Mina förare | Klar. Debiteringen visar `[PRIS]` tills betalleverantör är vald |
| 5 Åkarkassan | Automatiska underlag, lön, bro och Sturup, personal med signering med pennan | Klar |
| 6 Mobil | Hem, appar, ladda upp, lönespec, signering, aktivera | Byggd och provad i webbläsaren. TestFlight och Google Play kräver ägarens konton |
| 7 Hemsida | Start, branscher, så jobbar vi, kundcase, pris, boka, säkerhet, integritet | Byggd. Lighthouse är inte uppmätt i den här miljön |
| 8 Övrigt | Admin, Verkstad, Skadeflöde, Jetpack-konfiguration | Byggda. Jetpack är ett exempel tills deras riktiga fil finns. Den nattliga synken av förarlistan från TaxiCaller är inte byggd än |
