// Avräkning för huvudkunden (sidan 30 och 46). En mening per sak.
export default {
  title: 'Avräkning',
  welcome: [
    { title: 'Så funkar Avräkning', body: 'Varje månad drar du in filerna från TaxiCaller, Bambora, bron, Swedavia, Visma och banken. Vi räknar ut vad varje åkare ska ha, visar det som ser konstigt ut, och skickar varje åkares del till deras app när du godkänt.',
      art: 'flow', steg: [{ icon: 'upload', title: '1. Filer', sub: '8 filer, cirka 10 min' }, { icon: 'eye', title: '2. Kontroll', sub: 'avvikelser att titta på' }, { icon: 'check', title: '3. Godkänn', sub: 'månaden låses' }, { icon: 'send', title: '4. Publicera', sub: 'åkarna får sin del' }] },
    { title: 'Det tar cirka tio minuter', body: 'Det tar cirka tio minuter när du har filerna. Dra in allt på en gång, ordningen spelar ingen roll.', art: 'files' },
    { title: 'Vi visar det som ser konstigt ut', body: 'Vi visar det som ser konstigt ut innan du godkänner. Avvikelser mot förra månaden och mot Visma kommer först, med en knapp till raderna.', art: 'check' },
    { title: 'Varje åkare får sin del', body: 'När du publicerar får varje åkare sin del i appen. Åkaren ser bara sina egna bilar. Du ser vem som har öppnat avräkningen.', art: 'send' }
  ],
  checklist: [
    { key: 'bolag', title: 'Lägg till ert bolag och logga', sub: 'Namn, org.nr och logga', to: 'installningar' },
    { key: 'bilar', title: 'Läs in bilregistret', sub: 'Bilar, reg nr och åkare', to: 'avrakning/installningar' },
    { key: 'priser', title: 'Kontrollera priser och procentsatser', sub: 'Växelavgift, taklampa, serviceavgift, bro', to: 'avrakning/installningar' },
    { key: 'akarna', title: 'Bjud in åkarna', sub: 'De får en egen inloggning', to: 'akare' },
    { key: 'forsta-manad', title: 'Gör första månaden i nya Avräkning', sub: 'Guiden tar dig genom stegen', to: 'avrakning' },
    { key: 'publicera', title: 'Publicera till åkarna', sub: 'Åkarna får en notis i appen', to: 'avrakning' }
  ],
  help: {
    filer: { title: 'Steg 1: Månadens filer', body: 'Dra in allt på en gång. Saknas något står det på raden.', punkter: [['Dra in allt du har', 'Ordningen spelar ingen roll.'], ['Läs sammanfattningen', 'Stämmer antal körningar och bilar?'], ['Hämta det som saknas', 'Klicka "Var hittar jag filen?" på raden.']] },
    kontroll: { title: 'Kontroll', body: 'Här jämförs månaden mot förra månaden och mot Visma. Röda rader behöver en titt innan du godkänner. Markera dem som kontrollerade.', exempel: true },
    godkann: { title: 'Godkänn', body: 'Månaden låses. Rättelser blir en ny version med orsak.' },
    publicera: { title: 'Publicera', body: 'Åkarna får notis och mejl. Du ser vem som har öppnat.' },
    historik: { title: 'Historik', body: 'Alla publicerade månader finns kvar. En rättelse syns som en ny version.' },
    installningar: { title: 'Inställningar', body: 'Priser, bilar, åkare och terminaler. Ändringar gäller nästa månad du räknar.' }
  }
};
