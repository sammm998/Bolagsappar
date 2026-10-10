export default {
  title: 'Verkstad',
  welcome: [
    { title: 'Så funkar Verkstad', body: 'Ett ärende per bil och skada, från offert till betalt.', art: 'flow',
      steg: [{ icon: 'file', title: 'Offert', sub: 'till försäkringsbolaget' }, { icon: 'check', title: 'Godkänd', sub: 'skriftligt' }, { icon: 'receipt', title: 'Faktura', sub: 'och momsfaktura' }, { icon: 'bank', title: 'Betalt', sub: 'matchas mot banken' }] },
    { title: 'Momsfakturan kommer själv', body: 'Momsfakturan till fordonsägaren skapas när försäkringsbolaget betalat.', art: 'receipt' },
    { title: 'Banken matchas', body: 'Läs in bankfilen så matchas betalningarna själv.', art: 'bank' },
    { title: 'Bokföring', body: 'Exportera SIE till bokföringen.', art: 'file' }
  ],
  checklist: [
    { key: 'foretag', title: 'Fyll i företagsuppgifter', sub: 'Namn, org.nr, bankgiro', to: 'verkstad/installningar' },
    { key: 'priser', title: 'Kontrollera prislistan', sub: 'Vanlig och större bil', to: 'verkstad/installningar' },
    { key: 'forsakring', title: 'Lägg till försäkringsbolag', sub: 'Namn och e-post', to: 'verkstad/register' },
    { key: 'arende', title: 'Skapa första ärendet', sub: 'En skada på ett fordon', to: 'verkstad' }
  ],
  help: {
    arenden: { title: 'Ärenden', body: 'Status visar nästa steg för varje ärende.' },
    betalningar: { title: 'Betalningar', body: 'Förslag på matchning, du bekräftar.' },
    bokforing: { title: 'Bokföring', body: 'Röda punkter måste rättas innan export.' }
  }
};
