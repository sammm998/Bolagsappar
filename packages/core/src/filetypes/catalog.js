// Filkatalogen (sidan 48 i specifikationen). En rad per fil som laddas upp.
// "auto" betyder att underkunden får filen från huvudkunden via delning.
// Fältet hjalp är filhjälpen ("Var hittar jag filen?"). Stegen fyller ägaren i, därför hakparenteser.

export const FILKATALOG = [
  { app: 'avrakning', key: 'tc', label: 'TaxiCaller kontofakturor', kalla: 'TaxiCaller', format: 'PDF eller CSV', anvands: 'Debiteringskörningar per konto och bil', parser: 'parseTaxiCaller, parseTcCsv', kravs: true,
    hjalp: { steg: ['[Logga in i TaxiCaller]', '[Välj Fakturor, Kontokunder]', 'Välj hela månaden och spara som PDF eller CSV', 'Dra in filen här'], nar: 'Efter månadsskiftet', taggar: ['Finns från den 1:a'] } },
  { app: 'avrakning', key: 'bamb', label: 'Bambora sales-export', kalla: 'Bambora', format: 'Excel', anvands: 'Kortköp i terminalerna, återbetalningar dras från bilen', parser: 'parseBambora', kravs: true,
    hjalp: { steg: ['[Logga in i Bamboras portal]', '[Välj rapport för försäljning]', 'Välj hela månaden och exportera som Excel', 'Dra in filen här'], nar: 'Finns från den 1:a', taggar: ['Finns från den 1:a', 'Kortköp i terminalerna'] } },
  { app: 'avrakning', key: 'app', label: 'TaxiCaller appbetalningar', kalla: 'TaxiCaller', format: 'CSV', anvands: 'Kortbetalningar i appen per bil', parser: 'parseApp',
    hjalp: { steg: ['[Logga in i TaxiCaller]', '[Välj Rapporter, Betalningar]', 'Välj hela månaden och spara som CSV', 'Dra in filen här'], nar: 'Efter månadsskiftet' } },
  { app: 'avrakning', key: 'bro', label: 'Øresundsbro samlingsfaktura', kalla: 'Øresundsbro', format: 'PDF', anvands: 'Bro och CPH parkering per bil', parser: 'parseOresund, countPassages',
    hjalp: { steg: ['[Logga in hos Øresundsbron]', '[Fakturor]', 'Ladda ner hela samlingsfakturan som PDF', 'Dra in filen här'], nar: 'Kommer runt den 5:e', taggar: ['Kommer runt den 5:e'] } },
  { app: 'avrakning', key: 'sturup', label: 'Swedavia Sturup', kalla: 'Swedavia', format: 'PDF', anvands: 'Parkering per bil och pris', parser: 'parseSturup, mapSturup',
    hjalp: { steg: ['[Steg 1 i Swedavias portal]', '[Steg 2]', 'Spara som PDF, dra in här'], nar: 'Kommer runt den 5:e', taggar: ['Kommer runt den 5:e'] } },
  { app: 'avrakning', key: 'resk', label: 'Visma kundreskontra', kalla: 'Visma', format: 'PDF', anvands: 'Tidigare skulder per åkare', parser: 'parseReskontra',
    hjalp: { steg: ['[Öppna Visma Administration]', '[Kundreskontralista, Uppgifter per faktura]', 'Reskontradatum: sista dagen i månaden', 'Skriv ut till PDF och dra in här'], nar: 'När ekonomen har registrerat månadens betalningar' } },
  { app: 'avrakning', key: 'bank', label: 'Handelsbanken kontoutdrag', kalla: 'Handelsbanken', format: 'Excel, CSV, PDF', anvands: 'Förskott till åkare', parser: 'parseBankRows, parseBankText',
    hjalp: { steg: ['[Logga in i Handelsbanken]', '[Kontotransaktioner]', 'Välj hela månaden och exportera som Excel', 'Dra in filen här'], nar: 'Efter månadsskiftet' } },
  { app: 'avrakning', key: 'visma', label: 'Visma avräkningar efter inmatning', kalla: 'Visma', format: 'PDF', anvands: 'Facit, jämförs per faktura i Kontroll', parser: 'parseVismaFakturor',
    hjalp: { steg: ['[Öppna Visma Administration]', '[Utskrifter, Faktura, Skickade fakturor]', 'Skriv ut månadens avräkningar till PDF', 'Dra in filen här'], nar: 'Efter att avräkningarna är inmatade i Visma' } },
  { app: 'avrakning', key: 'bilreg', label: 'Bilregister', kalla: 'Eget register', format: 'Excel', anvands: 'Bilar, åkare, avgifter (inställningar)', parser: 'importBilregister',
    hjalp: { steg: ['[Var bilregistret finns]', 'Första kolumnen bilnummer, andra reg nr, sjätte åkeri', 'Dra in filen under Inställningar, Bilar'], nar: 'När bilar byts' } },

  { app: 'kassan', key: 'ldl', label: 'Löneunderlag från Megtax (LDL)', kalla: 'Megtax', format: 'TXT, CSV', anvands: 'Pass, timmar och inkört per förare', parser: 'ENG.parseLDL', kravs: true,
    hjalp: { steg: ['[Logga in i Megtax]', '[Välj löneunderlag]', 'Välj perioden 1:a till 1:a nästa månad', 'Tryck Skapa LDL fil och spara', 'Dra in filen här'], nar: 'Efter månadsskiftet' } },
  { app: 'kassan', key: 'avr', label: 'Avräkning från centralen', kalla: 'Centralen', format: 'PDF eller delning', anvands: 'Kontokort, krediter, avgifter', parser: 'ENG.parseAvrakning', auto: true,
    hjalp: { steg: ['Kommer automatiskt när centralen publicerar', 'Har du en PDF kan du dra in den här'], nar: 'När centralen publicerar' } },
  { app: 'kassan', key: 'bro', label: 'Øresundsbron', kalla: 'Centralen', format: 'PDF eller delning', anvands: 'Bropassager per bil', parser: 'ENG.parseBro', auto: true,
    hjalp: { steg: ['Kommer automatiskt när centralen publicerar'], nar: 'När centralen publicerar' } },
  { app: 'kassan', key: 'stu', label: 'Sturup', kalla: 'Centralen', format: 'PDF eller delning', anvands: 'Passager per bil', parser: 'ENG.parseSturup', auto: true,
    hjalp: { steg: ['Kommer automatiskt när centralen publicerar'], nar: 'När centralen publicerar' } },
  { app: 'kassan', key: 'skatt', label: 'Skattetabell', kalla: 'Skatteverket', format: 'Skatteverkets fil', anvands: 'Tabellskatt, en gång per år', parser: 'ENG.parseSkattetabell', kravs: true,
    hjalp: { steg: ['[Gå till Skatteverkets sida för skattetabeller]', 'Ladda ner textfilen för månadslön (allmänna tabeller)', 'Dra in filen här'], nar: 'I december inför nytt år', taggar: ['En gång per år'] } },
  { app: 'kassan', key: 'platt', label: 'Plattformsavgift Bolt, Uber', kalla: 'Bolt, Uber', format: 'fil från plattformen', anvands: 'Avgift per förare',
    hjalp: { steg: ['[Logga in hos Bolt eller Uber]', '[Hämta månadsredovisningen]', 'Dra in filen här'], nar: 'Efter månadsskiftet, valfritt' } },
  { app: 'kassan', key: 'bank', label: 'Kontoutdrag', kalla: 'Banken', format: 'Excel, CSV', anvands: 'Avstämning av löneutbetalningar',
    hjalp: { steg: ['[Logga in i banken]', 'Exportera månadens transaktioner som Excel', 'Dra in filen här'], nar: 'Efter löneutbetalningen' } },

  { app: 'verkstad', key: 'bank', label: 'Bankfiler och BG-specifikationer', kalla: 'Banken', format: 'PDF, CSV, Excel', anvands: 'Betalningar matchas mot fakturor', parser: 'parseBgSpec, txFromLines',
    hjalp: { steg: ['[Logga in i banken]', 'Ladda ner bankgirospecifikationen som PDF eller kontoutdraget som Excel', 'Dra in filen här'], nar: 'När betalningar har kommit in' } },
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
