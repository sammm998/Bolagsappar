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
    inkorg: { title: 'Inkorg', body: 'Utkast skickas aldrig automatiskt.' },
    kontroll: { title: 'Kontroll', body: 'Skillnader mellan kalkyl och arbetsorder.' }
  }
};
