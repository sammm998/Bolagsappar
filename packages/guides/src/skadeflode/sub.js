export default {
  title: 'Skadeflöde',
  welcome: [
    { title: 'Så funkar Skadeflöde', body: 'Samla skadeärenden, bilder och mejl på ett ställe.', art: 'inbox' },
    { title: 'AI skriver utkast', body: 'AI skriver utkast till svar. Du granskar och skickar.', art: 'sparkles' },
    { title: 'Kalkylen kontrolleras', body: 'Kalkylen jämförs med arbetsordern.', art: 'check' }
  ],
  checklist: [
    { key: 'epost', title: 'Koppla e-post', sub: 'Vidarebefordra skademejl', to: 'skadeflode' },
    { key: 'arende', title: 'Skapa första ärendet', sub: 'Bilder och skadenummer', to: 'skadeflode' }
  ],
  help: {
    arenden: { title: 'Ärenden', body: 'Varje status har en gräns för hur länge ärendet får ligga. Röda dagar betyder att något väntar på dig eller försäkringsbolaget. Klicka på ett ärende för detaljer och tilläggsbegäran.' },
    nytt: { title: 'Nytt ärende', body: 'Klistra in kundens mejl. Uppgifterna fylls i på ärendekortet och du granskar innan ärendet sparas. Utan AI fylls det i som går att läsa ut, resten skriver du själv.' },
    inkorg: { title: 'Inkorg', body: 'Utkast skickas aldrig automatiskt.' },
    kontroll: { title: 'Kontroll', body: 'Skillnader mellan kalkyl och arbetsorder.' }
  }
};
