// Filkatalogen (sidan 48 i specifikationen). En rad per fil som laddas upp.
// "auto" betyder att underkunden får filen från huvudkunden via delning.
// Fältet hjalp är filhjälpen ("Var hittar jag filen?"). Stegen bygger på zip-filens appar (rubriker, felmeddelanden
// och parsrarna). Menynamnen i portalerna stäms av med den som hämtar filen första gången (kontrollera: true).

export const FILKATALOG = [
  { app: 'avrakning', key: 'tc', label: 'TaxiCaller kontofakturor', kalla: 'TaxiCaller', format: 'PDF eller CSV', anvands: 'Debiteringskörningar per konto och bil', parser: 'parseTaxiCaller, parseTcCsv', kravs: true,
    hjalp: { steg: ['Logga in i TaxiCaller som administratör', 'Gå till Fakturering och välj Kontofakturor', 'Välj förra månaden (1:a till sista) och alla konton', 'Exportera alla fakturor i en PDF, eller som CSV', 'Dra in filen här'], nar: 'Efter månadsskiftet, när kontofakturorna är skapade', taggar: ['Finns från den 1:a'], kontrollera: true } },
  { app: 'avrakning', key: 'bamb', label: 'Bambora sales-export', kalla: 'Bambora', format: 'Excel', anvands: 'Kortköp i terminalerna, återbetalningar dras från bilen', parser: 'parseBambora', kravs: true,
    hjalp: { steg: ['Logga in i Bamboras portal (Worldline)', 'Öppna Rapporter och välj försäljning (Sales)', 'Välj förra månaden och alla terminaler', 'Exportera till Excel. Filen har en flik som heter Sales', 'Dra in filen här'], nar: 'Finns från den 1:a', taggar: ['Finns från den 1:a', 'Kortköp i terminalerna'], kontrollera: true } },
  { app: 'avrakning', key: 'app', label: 'TaxiCaller appbetalningar', kalla: 'TaxiCaller', format: 'CSV', anvands: 'Kortbetalningar i appen per bil', parser: 'parseApp',
    hjalp: { steg: ['Logga in i TaxiCaller som administratör', 'Öppna Rapporter och välj betalningar i appen (kortbetalningar)', 'Välj förra månaden', 'Exportera som CSV', 'Dra in filen här'], nar: 'Efter månadsskiftet', kontrollera: true } },
  { app: 'avrakning', key: 'bro', label: 'Øresundsbro samlingsfaktura', kalla: 'Øresundsbro', format: 'PDF', anvands: 'Bro och CPH parkering per bil', parser: 'parseOresund, countPassages',
    hjalp: { steg: ['Logga in på Øresundsbrons företagsportal (BroPas)', 'Öppna Fakturor', 'Ladda ner månadens samlingsfaktura som PDF, med specifikationen per bil', 'Dra in filen här. Bro och CPH parkering räknas per bil'], nar: 'Kommer runt den 5:e', taggar: ['Kommer runt den 5:e'], kontrollera: true } },
  { app: 'avrakning', key: 'sturup', label: 'Swedavia Sturup', kalla: 'Swedavia', format: 'PDF', anvands: 'Parkering per bil och pris', parser: 'parseSturup, mapSturup',
    hjalp: { steg: ['Månadsfakturan för parkeringen kommer från Swedavia Malmö Airport, oftast med e-post', 'Spara fakturan som PDF. Den ska ha passagerna per bil', 'Dra in filen här'], nar: 'Kommer runt den 5:e', taggar: ['Kommer runt den 5:e'], kontrollera: true } },
  { app: 'avrakning', key: 'resk', label: 'Visma kundreskontra', kalla: 'Visma', format: 'PDF', anvands: 'Tidigare skulder per åkare', parser: 'parseReskontra',
    hjalp: { steg: ['Öppna Visma Administration', 'Välj Kundreskontra, Utskrifter, Kundreskontralista', 'Välj Uppgifter per faktura och reskontradatum sista dagen i månaden', 'Skriv ut till PDF', 'Dra in filen här'], nar: 'När ekonomen har registrerat månadens betalningar i Visma', kontrollera: true } },
  { app: 'avrakning', key: 'bank', label: 'Handelsbanken kontoutdrag', kalla: 'Handelsbanken', format: 'Excel, CSV, PDF', anvands: 'Förskott till åkare', parser: 'parseBankRows, parseBankText',
    hjalp: { steg: ['Logga in i Handelsbanken (företag)', 'Öppna kontot och välj Kontohändelser', 'Välj förra månaden och alla poster', 'Exportera till Excel (eller spara som PDF)', 'Dra in filen här. Förskott till åkarna hittas på texten'], nar: 'Efter månadsskiftet', kontrollera: true } },
  { app: 'avrakning', key: 'visma', label: 'Visma avräkningar efter inmatning', kalla: 'Visma', format: 'PDF', anvands: 'Facit, jämförs per faktura i Kontroll', parser: 'parseVismaFakturor',
    hjalp: { steg: ['Öppna Visma Administration', 'Välj Utskrifter, Faktura, Skickade fakturor', 'Välj månadens avräkningar (alla åkare)', 'Skriv ut till en PDF', 'Dra in filen här. Den jämförs per faktura under Kontroll'], nar: 'Efter att avräkningarna är inmatade i Visma', kontrollera: true } },
  { app: 'avrakning', key: 'bilreg', label: 'Bilregister', kalla: 'Eget register', format: 'Excel', anvands: 'Bilar, åkare, avgifter (inställningar)', parser: 'importBilregister',
    hjalp: { steg: ['Bilregistret är Excelfilen med alla bilar (samma som i TaxiCaller under Fordon)', 'Första kolumnen bilnummer, andra reg nr, sjätte åkeri', 'Dra in filen under Inställningar, Bilar och klicka Spara'], nar: 'När bilar byts', kontrollera: true } },

  { app: 'logistik', key: 'uppdrag', label: 'Uppdragsfil', kalla: 'Transportsystemet', format: 'CSV', anvands: 'Uppdrag per underleverantör och fordon', parser: 'parseUppdrag', kravs: true,
    hjalp: { steg: ['Exportera månadens uppdrag från transportsystemet som CSV', 'Kolumner: datum, uppdrags-id, underleverantör, fordon, pris exkl. moms (tillägg valfritt)', 'Dra in filen här'], nar: 'Efter månadsskiftet', taggar: ['Exempel, Jetpack'], kontrollera: true } },
  { app: 'forarlista', key: 'forare', label: 'Förarexport från TaxiCaller', kalla: 'TaxiCaller', format: 'CSV eller Excel', anvands: 'Förare per åkeri, senaste bil, legitimation och status', parser: 'parseForarlista', kravs: true,
    hjalp: { steg: ['Logga in i TaxiCaller som administratör', 'Öppna förarna (Drivers) och välj alla förare, även inaktiva', 'Exportera listan som CSV eller Excel. Förarnr, namn och åkeri måste finnas med, gärna senaste bil, legitimation och senaste körning', 'Dra in filen här. Varje åkare får sina egna förare'], nar: 'När förare börjar eller slutar, eller en gång i månaden', kontrollera: true } },
  { app: 'kassan', key: 'ldl', label: 'Löneunderlag från Megtax (LDL)', kalla: 'Megtax', format: 'TXT, CSV', anvands: 'Pass, timmar och inkört per förare', parser: 'ENG.parseLDL', kravs: true,
    hjalp: { steg: ['Logga in i Megtax (FlexMate)', 'Öppna Löneunderlag', 'Välj perioden från den 1:a till den 1:a nästa månad', 'Tryck Skapa LDL fil och spara filen', 'Dra in filen här, eller välj den i mobilen under Ladda upp'], nar: 'Efter månadsskiftet', kontrollera: true } },
  { app: 'kassan', key: 'avr', label: 'Avräkning från centralen', kalla: 'Centralen', format: 'PDF eller delning', anvands: 'Kontokort, krediter, avgifter', parser: 'ENG.parseAvrakning', auto: true,
    hjalp: { steg: ['Kommer automatiskt när centralen publicerar', 'Har du en PDF kan du dra in den här'], nar: 'När centralen publicerar' } },
  { app: 'kassan', key: 'bro', label: 'Øresundsbron', kalla: 'Centralen', format: 'PDF eller delning', anvands: 'Bropassager per bil', parser: 'ENG.parseBro', auto: true,
    hjalp: { steg: ['Kommer automatiskt när centralen publicerar'], nar: 'När centralen publicerar' } },
  { app: 'kassan', key: 'stu', label: 'Sturup', kalla: 'Centralen', format: 'PDF eller delning', anvands: 'Passager per bil', parser: 'ENG.parseSturup', auto: true,
    hjalp: { steg: ['Kommer automatiskt när centralen publicerar'], nar: 'När centralen publicerar' } },
  { app: 'kassan', key: 'skatt', label: 'Skattetabell', kalla: 'Skatteverket', format: 'Skatteverkets fil', anvands: 'Tabellskatt, en gång per år', parser: 'ENG.parseSkattetabell', kravs: true,
    hjalp: { steg: ['Gå till skatteverket.se och sök på Skattetabeller, Teknisk beskrivning', 'Ladda ner filen allmanna-tabeller-manad.txt för nästa år', 'Dra in filen här. Alla tabeller läses in på en gång'], nar: 'Varje december inför nytt år', taggar: ['En gång per år'] } },
  { app: 'kassan', key: 'platt', label: 'Plattformsavgift Bolt, Uber', kalla: 'Bolt, Uber', format: 'fil från plattformen', anvands: 'Avgift per förare',
    hjalp: { steg: ['Bolt: logga in i Bolt Fleet, öppna Rapporter och ladda ner förarrapporten för månaden som CSV', 'Uber: logga in i Uber Fleet (Supplier), öppna Betalningar och ladda ner månadens rapport per förare som CSV', 'Dra in filen här. Svensk och engelsk export fungerar'], nar: 'Efter månadsskiftet, valfritt', kontrollera: true } },
  { app: 'kassan', key: 'bank', label: 'Kontoutdrag', kalla: 'Banken', format: 'Excel, CSV', anvands: 'Avstämning av löneutbetalningar',
    hjalp: { steg: ['Logga in i banken (företag)', 'Öppna lönekontot och välj kontohändelser för månaden', 'Exportera som Excel eller CSV', 'Dra in filen här'], nar: 'Efter löneutbetalningen', kontrollera: true } },

  { app: 'verkstad', key: 'bank', label: 'Bankfiler och BG-specifikationer', kalla: 'Banken', format: 'PDF, CSV, Excel', anvands: 'Betalningar matchas mot fakturor', parser: 'parseBgSpec, txFromLines',
    hjalp: { steg: ['Logga in i banken (företag)', 'Ladda ner bankgirospecifikationen (inbetalningar) som PDF, eller kontoutdraget som Excel', 'Dra in filen här. Betalningarna matchas på skadenummer, fakturanummer och belopp'], nar: 'När betalningar har kommit in', kontrollera: true } },
  { app: 'verkstad', key: 'lev', label: 'Leverantörsfaktura', kalla: 'Leverantör', format: 'PDF', anvands: 'Kostnader, meter folie',
    hjalp: { steg: ['Spara fakturan som PDF', 'Dra in filen här'], nar: 'När fakturan kommer' } },
  { app: 'skadeflode', key: 'bild', label: 'Skadebilder', kalla: 'Kunden eller verkstaden', format: 'Bilder', anvands: 'Underlag för ärendekort',
    hjalp: { steg: ['Ta bilder på skadan', 'Dra in dem här eller ladda upp från mobilen'], nar: 'När ärendet skapas' } }
];

export const filerFor = app => FILKATALOG.filter(f => f.app === app);
export const fil = (app, key) => FILKATALOG.find(f => f.app === app && f.key === key) || null;

/** Felmeddelanden skrivna som hjälp (sidan 11). */
const MAN = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
export const manadNamn = p => p ? MAN[+p.slice(5, 7) - 1] : '';
export const HJALPTEXT = {
  felManad: (filP, arbP) => `Filen gäller ${manadNamn(filP)}. Du jobbar med ${manadNamn(arbP)}. Byt månad eller välj en annan fil.`,
  okand: (hint, app) => `Vi känner inte igen filen. Den ser ut som ${hint || 'en fil vi inte läser'}. Vilken fil skulle det vara?` + (app ? ' ' + filerFor(app).map(f => f.label).join(', ') + '.' : ''),
  dubblett: datum => `Den här filen är redan inläst ${datum}. Vill du ersätta den?`,
  ofullstandig: (saknas, total, kalla) => `Fakturan saknar sida ${saknas.join(' och ')} av ${total}. Ladda ner hela PDF:en från ${kalla} igen.`
};
