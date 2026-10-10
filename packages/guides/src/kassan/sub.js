// Åkarkassan för åkaren (sidan 37 till 40 och 47). Signering med pennan, ingen BankID.
export default {
  title: 'Åkarkassan',
  welcome: [
    { title: 'Så funkar Åkarkassan', body: 'Lön och kassa för dina förare, varje månad. Det mesta kommer från {central}. Du lägger bara till LDL från Megtax.', art: 'flow',
      steg: [{ icon: 'inbox', title: '1. Underlag', sub: 'centralens filer kommer själv' }, { icon: 'link', title: '2. Bro och Sturup', sub: 'vem körde när bilen passerade' }, { icon: 'wallet', title: '3. Lön', sub: 'kontrollera och godkänn' }, { icon: 'file', title: '4. Lönespecar', sub: 'till förarna i appen' }] },
    { title: 'Centralen skickar resten', body: 'Avräkning, bro och Sturup kommer från {central}.', art: 'inbox' },
    { title: 'Du laddar bara upp LDL', body: 'Du laddar bara upp LDL från Megtax.', art: 'upload' },
    { title: 'Förarna får lönespecen', body: 'Du godkänner lönen, förarna får lönespecen i appen.', art: 'send' }
  ],
  checklist: [
    { key: 'forare', title: 'Lägg till förarna och bankkonton', sub: 'Under Personal', to: 'akarkassan/personal' },
    { key: 'skatt', title: 'Läs in skattetabellen', sub: 'Fil från Skatteverket, en gång per år', to: 'akarkassan/installningar' },
    { key: 'procent', title: 'Ställ in procentlön och avdrag', sub: 'Under Inställningar', to: 'akarkassan/installningar' },
    { key: 'forsta-lon', title: 'Gör första lönen', sub: 'Guiden visar varje steg', to: 'akarkassan' },
    { key: 'avtal', title: 'Skicka anställningsavtal', sub: 'Föraren signerar med pennan i appen', to: 'akarkassan/personal' }
  ],
  help: {
    oversikt: { title: 'Översikt', body: 'Det som saknas för månaden står överst.' },
    lon: { title: 'Lön', body: 'Klicka på en förare för hela uträkningen.' },
    kassa: { title: 'Kassaredovisning', body: 'Per bil och dag, dagpass och kvällspass.' },
    bro: { title: 'Bro och Sturup', body: 'Välj förare bara där vi inte kunde avgöra själv.' },
    personal: { title: 'Personal', body: 'Avtal signeras med pennan i appen. Föraren ritar sin underskrift med fingret.' },
    korpass: { title: 'Körpass', body: 'Alla pass från LDL-filen.' },
    ekonomi: { title: 'Ekonomi', body: 'Resultat per månad.' },
    bokforing: { title: 'Bokföring och bank', body: 'Underlag till bokföringen och avstämning mot banken.' },
    installningar: { title: 'Inställningar', body: 'Procentlön, semester, avdrag och skattetabell.' }
  }
};
