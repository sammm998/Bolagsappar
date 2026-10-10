export default {
  title: 'Förarlista',
  welcome: [
    { title: 'Så funkar Förarlista', body: 'Förarna hämtas från TaxiCaller varje natt. Du ser vem som är aktiv och vems legitimation snart går ut.', art: 'flow',
      steg: [{ icon: 'refresh', title: 'Varje natt', sub: 'från TaxiCaller' }, { icon: 'users', title: 'Aktiva', sub: 'körning senaste 30 dagarna' }, { icon: 'alert', title: 'Legitimation', sub: 'gul inom 60 dagar' }, { icon: 'truck', title: 'Per åkare', sub: 'åkarna ser sina egna' }] },
    { title: 'Vem är aktiv', body: 'Du ser vem som är aktiv och vems legitimation snart går ut.', art: 'users' },
    { title: 'Åkarna ser sina egna', body: 'Åkarna ser bara sina egna förare.', art: 'truck' }
  ],
  checklist: [
    { key: 'taxicaller', title: 'Koppla TaxiCaller', sub: 'API-nyckel under Inställningar', to: 'installningar' },
    { key: 'kontroll', title: 'Kontrollera att förarna hamnat på rätt åkare', sub: 'Filtrera per åkare', to: 'forarlista' }
  ],
  help: {
    lista: { title: 'Förarlistan', body: 'Aktiv betyder körning de senaste 30 dagarna.' },
    legitimation: { title: 'Legitimation', body: 'Gul när den går ut inom 60 dagar.' }
  }
};
