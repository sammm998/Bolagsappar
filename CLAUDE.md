# CLAUDE.md

Instruktioner för Claude Code i det här repot. Läs `README.md` för strukturen. Svara ägaren på svenska, kort och tydligt.

## Regler som alltid gäller

- **Skärmarna räknar inte.** All beräkning ligger i `packages/core`. Ändra aldrig en beräkning utan att först ha ett test som låser nuvarande beteende, och visa diffen i resultat för ägaren.
- **Jämförelsetesterna mot `legacy/` ska alltid gå igenom** (`packages/core/test/*.compare.test.js`). `legacy/` ändras inte.
- **Bara påhittad data i repot.** Inga riktiga namn, personnummer, regnummer eller kundfiler. Regnummer börjar på Q, personnummer slutar på 0000.
- **Svenska i allt användaren ser.** Belopp i sv-SE, datum ÅÅÅÅ-MM-DD. Aldrig tankstreck (`pnpm lint` stoppar dem), använd komma, punkt eller parentes.
- **Platshållare står kvar** (`[PRIS]`, `[MRR]`, `[org.nr]` med flera) tills ägaren svarar på de öppna frågorna i README.
- **Ingen BankID.** Inloggning med e-postlänk. Signering med pennan (`SignaturePad` i `packages/ui`, `Signatur` i mobilen, `packages/core/signatur.js`).
- **Skattesatser i konfiguration med giltighetsdatum**, aldrig hårdkodade i en skärm.
- **Filer läses i webbläsaren** (pdf.js och SheetJS). Originalfilen lämnar inte datorn.
- **RLS är skyddet.** Ett konto läser aldrig ett annat kontos data, lön och personal syns aldrig uppåt, support kräver godkännande och loggas. Varje ny tabell får RLS och ett test i `supabase/tests/rls.test.mjs`. Den lokala backenden (`packages/api/src/local.js`) speglar samma regler.
- **AI bara på servern** (`supabase/functions/ai`). Utkast skickas aldrig automatiskt.

## Klart-krav för en skärm

Fungerar i 1280 och 375 punkters bredd, har tomt läge, laddning och felläge, har guideinnehåll (hjälp för vyn och filhjälp om det finns filer) och uppfyller WCAG 2.2 AA.

## En ny app (modul)

1. Motor i `packages/core/src/<modul>` med tester.
2. Manifest i `packages/modules/src/<modul>.js` med `defineModule` (varianter main, sub, direct).
3. Guider i `packages/guides/src/<modul>/<variant>.js`.
4. Skärmar i `apps/platform/src/routes/<modul>` och route i `router.tsx`. Menyn byggs från licenser och manifest.
5. Data som dokument (`documents`, samma gränssnitt som `claude-shim.js`), periodlås och delning via `periods` och `shares`.

## Kommandon

`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm test:rls`, `pnpm build`. Efter ändring i `packages/api/src/seed.js`: `node scripts/gen-seed-sql.mjs`. Ändras demodatan: höj nyckeln `lokal:vN` i `packages/api/src/index.js` så att webbläsarna laddar om den.
