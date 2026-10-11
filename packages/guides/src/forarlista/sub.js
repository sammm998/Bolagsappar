export default {
  title: 'Mina förare',
  welcome: [
    { title: 'Så funkar Mina förare', body: 'Dina förare kommer från centralens förarlista. Du ser vem som är aktiv och vems legitimation snart går ut.', art: 'users' },
    { title: 'Koppla till lönen', body: 'Har du Åkarkassan kopplas förarna till personalen där.', art: 'link' }
  ],
  checklist: [{ key: 'kontroll', title: 'Kontrollera dina förare', sub: 'Saknas någon? Fråga centralen', to: 'mina-forare' }],
  help: {
    lista: { title: 'Mina förare', body: 'Aktiv betyder körning de senaste 30 dagarna.' },
    legitimation: { title: 'Legitimation', body: 'Gul när den går ut inom 60 dagar.' }
  }
};
