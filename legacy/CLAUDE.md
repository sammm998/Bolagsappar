# CLAUDE.md

Instruktioner till Claude Code för det här repot. Läs hela filen innan du ändrar något.

## Bakgrund

Repot innehåller affärsappar som byggts som enfils-artifacts på claude.ai för egna bolag (taxicentral, åkerier, foliering/skadeverkstad). Målet nu är att göra dem till säljbara SaaS-produkter: varje kundföretag får egen inloggning och egen data, och betalar per månad.

Ägare: VD för en taxicentral i Malmö, hög teknisk nivå. Svara på svenska, kort och tydligt.

## Struktur

```
apps/<app>/index.html   En app = en HTML-fil med inline CSS och JS (originalet från claude.ai)
shared/claude-shim.js   Lokal ersättning för claude.ai:s runtime (window.claude.use)
docs/*.md               Dokumentmallar med [platshållare]
referens/*.html         Statiska referenssidor
```

Externa bibliotek laddas från cdnjs: pdf.js 3.11.174, SheetJS (xlsx) 0.18.5, jsPDF 2.5.1, jspdf-autotable 3.8.2.

## Runtime-beroendet (det viktigaste att förstå)

Apparna anropar `await window.claude.use(name)`. På claude.ai ger det riktiga tjänster. Lokalt fångas anropen av `shared/claude-shim.js`.

| Capability | API som används | Används av |
|---|---|---|
| `db` | `db.doc(path).get/set/update/delete/onSnapshot`, `db.collection(path).get/doc(id)/onSnapshot`. Snapshot: `.exists`, `.data()`, `.docs[]`, `.id`. Data från `get` är fryst, appen klonar innan ändring. | avrakning, foliering, akarkassan, tripkassan, aktievarde |
| `downloads` | `dl.save({ filename, data })` där data är string, Uint8Array eller Blob | avrakning, foliering, akarkassan, tripkassan |
| `user` | `user.id()` | akarkassan, tripkassan, aktievarde |
| `sample` | AI-anrop: `sample(prompt, { onText })`, `sample.limits()`. Shimmen returnerar `null`, apparna faller tillbaka på exempelsvar. | skadeflode, aktievarde |

### Datamodell per app

- **avrakning**: `settings/params`, `settings/bilar`, `settings/bolag`, `settings/terminaler`, `settings/forskottMap`, samlingarna `months` och `utskick`.
- **foliering**: samlingarna `arenden`, `fordon`, `forsakring`, `kostnader`, `lonespec`, `bokforing`, `installningar` (live via onSnapshot).
- **akarkassan / tripkassan**: per användare under `data/users/<uid>/`: `settings`, `skatt`, `ekonomi-2026`, `m-ÅÅÅÅ-MM` (månader), `bok-*`, `bank-*`. Fallback `seed/demo` och localStorage.
- **aktievarde**: `data/users/<uid>/watchlist` (ett dokument per användare).

## Beräkningsmotorerna (skydda dessa)

Affärslogiken är värdet i produkten. Den är redan skriven som ren JS utan DOM-beroenden:

- `avrakning`: `compute(S, D)`, `parseTaxiCaller`, `parseBambora`, `parseTcCsv`, `parseApp`, `countPassages`, `monthLabels`.
- `akarkassan`/`tripkassan`: objektet `ENG` (`parseLDL`, `parseBro`, `parseSturup`, `parseAvrakning`, `parseSkattetabell`, `tabellSkatt`, `agAvgift`, `compute`). Filen exporterar redan `module.exports = ENG`.
- `foliering`: prislistan `DEF_PRISER`, fakturanumrering, momsflödet (momsfaktura till fordonsägaren först när försäkringsbolaget betalat), påminnelseregler, SIE-export.

Regel: ändra aldrig en beräkning utan att först skriva ett test som låser nuvarande beteende, och visa diffen i resultat för ägaren.

## Migreringsplan

Gör stegen i ordning och stäm av med ägaren efter varje steg.

1. **Bryt ut och testa.** Flytta motorerna till `packages/core/` som ES-moduler med Vitest-tester. Använd syntetiska testfiler (påhittade LDL-, TaxiCaller- och Bambora-exempel), aldrig riktiga kundfiler. `akarkassan` och `tripkassan` delar nästan all kod: slå ihop till en motor med konfiguration.
2. **Byt runtime mot ett riktigt API.** Behåll samma gränssnitt som `claude-shim.js` (`doc/collection/get/set/onSnapshot`) men implementera det mot en backend med multi-tenant (förslag: Postgres med row level security, t.ex. Supabase, EU-region). Varje dokument får `tenant_id`. Då behöver UI-koden knappt ändras.
3. **Inloggning och kunder.** Auth per användare, roller (admin, ekonomi, läs), en tenant per kundföretag. Ersätt `user.id()`.
4. **AI-funktioner.** Ersätt `sample` med ett serveranrop mot Anthropic API. API-nyckeln får aldrig ligga i klienten.
5. **White label.** Bolagsnamn, logga, färger, org.nr och kontaktuppgifter ska komma från tenant-inställningar, inte vara hårdkodade.
6. **Frontend.** Först när 1 till 5 fungerar: dela upp de stora HTML-filerna i komponenter (Vite). Behåll designen.

## Regler

- **Inga riktiga personuppgifter i repot.** Inga namn, personnummer, telefonnummer, regnummer eller kundfiler. Testdata ska vara påhittad. Kontrollera innan commit.
- Gränssnittet är på svenska. Belopp formateras `sv-SE`, datum `ÅÅÅÅ-MM-DD`.
- Använd aldrig tankstreck (— eller –) i texter i gränssnittet eller dokument. Använd komma, punkt eller parentes.
- Filer kunden laddar upp läses i webbläsaren. Behåll det så långt det går (mindre personuppgiftsbehandling på servern).
- Skattesatser och avgifter (arbetsgivaravgift 31,42 %, ungdomsnedsättning, momssatser) ändras årligen. Lägg dem i konfiguration med giltighetsdatum, inte i koden.

## Kör lokalt

```bash
python3 -m http.server 8000
# http://localhost:8000/apps/<app>/
```

Rensa lokal data: töm localStorage-nycklar som börjar med `shim:` i webbläsarens utvecklarverktyg.
