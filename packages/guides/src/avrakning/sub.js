// Min avräkning för åkaren (sidan 46).
export default {
  title: 'Min avräkning',
  welcome: [
    { title: 'Så funkar Min avräkning', body: 'Här ser du din del av {central}s avräkning. Du får en notis när en ny månad är klar.', art: 'flow',
      steg: [{ icon: 'bell', title: 'Notis', sub: 'när månaden är klar' }, { icon: 'receipt', title: 'Sammanfattning', sub: 'att få eller att betala' }, { icon: 'car', title: 'Per bil', sub: 'vilken bil drar in mest' }, { icon: 'file', title: 'PDF', sub: 'finns alltid kvar' }] },
    { title: 'Du får en notis', body: 'Du får en notis när en ny månad är klar.', art: 'bell' },
    { title: 'Se hur den räknas', body: 'Klicka på en rad för att se hur den räknas.', art: 'check' },
    { title: 'Stämmer något inte?', body: 'Stämmer något inte, fråga centralen direkt härifrån.', art: 'send' }
  ],
  checklist: [
    { key: 'logga-in', title: 'Logga in', sub: 'Med e-postlänken', auto: true },
    { key: 'bilar', title: 'Kontrollera era bilar', sub: 'Stämmer bilarna under Per bil?', to: 'min-avrakning' },
    { key: 'notiser', title: 'Slå på notiser', sub: 'Under Inställningar', to: 'installningar' }
  ],
  help: {
    manad: { title: 'Månaden', body: 'Att få betyder att centralen betalar dig. Att betala betyder att du betalar centralen.' },
    'per-bil': { title: 'Per bil', body: 'Intäkt och avdrag för varje bil.' },
    historik: { title: 'Historik', body: 'Alla månader sparas här, PDF finns alltid.' }
  }
};
