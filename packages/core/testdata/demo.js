// Påhittad demodata för Förarlista och Verkstad.
import { rng } from './index.js';

/** Förarlista för en central: aktiva och inaktiva förare per åkare. */
export function forarlistaDemo(S, { aktiva = 186, inaktiva = 883, idag = '2026-10-10', seed = 21 } = {}) {
  const R = rng(seed);
  const out = [];
  const byBolag = new Map(); for (const b of S.bilar) { if (!byBolag.has(b.bolag)) byBolag.set(b.bolag, []); byBolag.get(b.bolag).push(b); }
  const bolagL = [...byBolag.keys()];
  const add = (i, aktiv) => {
    const bolag = bolagL[i % bolagL.length];
    const bilar = byBolag.get(bolag);
    const bokstav = String.fromCharCode(65 + (bolagL.indexOf(bolag) % 26));
    const nr = String(100000 + i);
    const ar = 2026 + R.int(0, 2), man = R.int(1, 12);
    let leg = `${ar}-${String(man).padStart(2, '0')}`;
    if (aktiv && R.chance(0.04)) leg = '2026-' + String(R.int(11, 12)).padStart(2, '0');
    const pass = aktiv ? R.int(1, 22) : 0;
    out.push({ nr, namn: `Förare ${bokstav}${Math.floor(i / bolagL.length) + 1}`, akeri: bolag, senasteBil: aktiv ? R.pick(bilar).reg : (R.chance(0.3) ? R.pick(bilar).reg : ''), leg, status: aktiv ? 'aktiv' : 'inaktiv', pass,
      senastKorning: aktiv ? `2026-10-${String(R.int(1, 9)).padStart(2, '0')}` : `2026-0${R.int(1, 6)}-${String(R.int(1, 28)).padStart(2, '0')}`, utanBil: aktiv && R.chance(0.065) });
  };
  for (let i = 0; i < aktiva; i++) add(i, true);
  for (let i = aktiva; i < aktiva + inaktiva; i++) add(i, false);
  return { hamtad: idag + 'T03:00:00', forare: out };
}

/** Verkstad: ärenden, fordon, försäkringsbolag och kostnader i samma form som foliering. */
export function verkstadDemo(idag = '2026-10-10') {
  const fors = [
    { id: 'fa', namn: 'Försäkring Exempel A', epost: 'skador@forsakring-a.example', kort: 'A' },
    { id: 'fb', namn: 'Försäkring Exempel B', epost: 'skador@forsakring-b.example', kort: 'B' },
    { id: 'fc', namn: 'Försäkring Exempel C', epost: 'skador@forsakring-c.example', kort: 'C' }
  ];
  const fordon = [['QAB12D', 'Bilägare Ett AB'], ['QBC34F', 'Bilägare Två AB'], ['QCD56H', 'Bilägare Tre AB'], ['QDE78J', 'Bilägare Fyra AB'], ['QEF90K', 'Bilägare Fem AB'], ['QFG12L', 'Bilägare Sex AB']]
    .map(([reg, agare]) => ({ id: reg, reg, agare, epost: 'ekonomi@' + agare.toLowerCase().replace(/[^a-z]/g, '') + '.example' }));
  const r = (pid, antal, apris, text) => ({ pid, antal, apris, text });
  const arenden = [
    { id: 'V-1042', reg: 'QAB 12D', skadenr: 'SK-104200', forsakring: 'fa', status: 'skickad', storlek: 'vanlig', skapad: '2026-10-06', offert: { datum: '2026-10-06', skickad: '2026-10-06', rader: [r('motorhuv', 1, 2500, 'Foliering motorhuv'), r('sf-fram', 1, 4000, 'Foliering stötfångare fram'), r('kapa-vf', 1, 1000, 'Foliering vänster sidokåpa fram'), r('spegel', 2, 500, 'Foliering 2 backspeglar'), r(null, 1, 3900, 'Skärmar, båda sidor')] } },
    { id: 'V-1041', reg: 'QBC 34F', skadenr: 'SK-104100', forsakring: 'fb', status: 'godkand', storlek: 'vanlig', skapad: '2026-10-01', offert: { datum: '2026-10-01', skickad: '2026-10-01', godkandAv: 'Handläggare B', rader: [r('dorr', 1, 1500, 'Foliering 1 dörr'), r(null, 1, 7400, 'Lackskada, dörr')] } },
    { id: 'V-1039', reg: 'QCD 56H', skadenr: 'SK-103900', forsakring: 'fc', status: 'betald', storlek: 'storre', utforare: 'p1', agare: 'Bilägare Tre AB', skapad: '2026-09-10', offert: { datum: '2026-09-10', rader: [r(null, 1, 21300, 'Skadeåterställning')] },
      faktura: { nr: 1039, datum: '2026-09-20', forfall: '2026-09-30', utfort: '2026-09-19', betald: true, betaldDatum: '2026-10-02', rader: [r(null, 1, 21300, 'Skadeåterställning')] } },
    { id: 'V-1037', reg: 'QDE 78J', skadenr: 'SK-103700', forsakring: 'fa', status: 'fakturerad', storlek: 'vanlig', utforare: 'p1', skapad: '2026-09-01', offert: { datum: '2026-09-01', rader: [r('hel', 1, 25000, 'Helfoliering hel bil'), r(null, 1, 9000, 'Extra folie tak')] },
      faktura: { nr: 1037, datum: '2026-09-24', forfall: '2026-10-04', utfort: '2026-09-23', betald: false, rader: [r('hel', 1, 25000, 'Helfoliering hel bil'), r(null, 1, 9000, 'Extra folie tak')] } },
    { id: 'V-1038', reg: 'QEF 90K', skadenr: 'SK-103800', forsakring: 'fb', status: 'fakturerad', storlek: 'vanlig', utforare: 'agare', skapad: '2026-09-05', offert: { datum: '2026-09-05', rader: [r('sf-bak', 1, 3500, 'Foliering stötfångare bak'), r('baklucka', 1, 2000, 'Foliering baklucka')] },
      faktura: { nr: 1038, datum: '2026-10-03', forfall: '2026-10-13', utfort: '2026-10-02', betald: false, rader: [r('sf-bak', 1, 3500, 'Foliering stötfångare bak'), r('baklucka', 1, 2000, 'Foliering baklucka')] } },
    { id: 'V-1036', reg: 'QFG 12L', skadenr: 'SK-103600', forsakring: 'fc', status: 'betald', storlek: 'vanlig', utforare: 'p1', agare: 'Bilägare Sex AB', skapad: '2026-08-20', offert: { datum: '2026-08-20', rader: [r('dek-2', 1, 3000, 'Dekalering, båda sidor')] },
      faktura: { nr: 1036, datum: '2026-08-28', forfall: '2026-09-07', utfort: '2026-08-27', betald: true, betaldDatum: '2026-09-05', rader: [r('dek-2', 1, 3000, 'Dekalering, båda sidor')] },
      moms: { nr: 'M-1036', datum: '2026-09-06', forfall: '2026-09-16', till: 'Bilägare Sex AB', betald: true, betaldDatum: '2026-09-14', skickad: '2026-09-06' } },
    { id: 'V-1043', reg: 'QAB 12D', skadenr: 'SK-104300', forsakring: 'fa', status: 'skickad', storlek: 'vanlig', skapad: '2026-10-08', offert: { datum: '2026-10-08', skickad: '2026-10-08', rader: [r('sf-fram', 1, 4000, 'Foliering stötfångare fram'), r('kapa-hb', 1, 1000, 'Foliering höger bakkåpa')] } },
    { id: 'V-1044', reg: 'QBC 34F', skadenr: 'SK-104400', forsakring: 'fc', status: 'skickad', storlek: 'storre', skapad: '2026-10-09', offert: { datum: '2026-10-09', skickad: '2026-10-09', rader: [r('baklucka', 1, 3000, 'Foliering baklucka'), r('spegel', 2, 700, 'Foliering 2 backspeglar'), r('dek-mh', 1, 750, 'Dekalering motorhuv')] } }
  ];
  const kostnader = [
    { id: 'k1', typ: 'material', datum: '2026-09-04', belopp: 9600, moms: 2400, meter: 120, leverantor: 'Foliegrossist Exempel', fakturanr: '5501', beskrivning: 'Folie 120 m' },
    { id: 'k2', typ: 'ul', datum: '2026-09-18', belopp: 4500, moms: 1125, arende: 'V-1039', leverantor: 'Lackerare Exempel', fakturanr: '88', beskrivning: 'Lackering' },
    { id: 'k3', typ: 'ovrigt', datum: '2026-10-01', belopp: 1200, moms: 300, leverantor: 'Verktyg Exempel', fakturanr: '12', beskrivning: 'Verktyg' }
  ];
  const inst = {
    foretag: { namn: 'Folieringsfirman', adress: 'Box 0000', postort: '211 00 Malmö', orgnr: '559xxx-0001', momsnr: 'SE559000000101', epost: 'info@folieringsfirman.example', bg: '0000-0000', underskrift: 'Fia Exempel', titel: 'VD', villkorDagar: 10, giltighet: 30 },
    personal: { items: [{ id: 'agare', namn: 'Fia Exempel', roll: 'agare', epost: '' }, { id: 'p1', namn: 'Montör Exempel', roll: 'anstalld', epost: '' }] },
    bokforing: { rarStart: 9 }
  };
  return { arenden, fordon, forsakring: fors, kostnader, inst, idag };
}

/** Skadeflöde för Folieringsfirman. Påhittade bilar, kunder, försäkringsbolag och handläggare. */
export function skadeflodeDemo() {
  const A = (id, reg, bil, kund, bolag, skadenr, reglerare, typ, status, statusFran, kalkyl, sjalvrisk, kalkylrader = [], logg = []) =>
    ({ id, reg, bil, kund, telefon: '070 000 00 ' + id.slice(-2), bolag, skadenr, reglerare, typ, beskrivning: '', status, statusFran, skapad: '2026-09-28', kalkyl, sjalvrisk, lanebil: false, kalkylrader, logg });
  const arenden = [
    A('S-207', 'QNK41C', 'Exempelbil XC 2022', 'Kund Exempel 1', 'Försäkring Exempel A', 'FA-26-118734', 'Handläggare A', 'Parkeringsskada, bakre stötfångare vänster', 'tillagg', '2026-10-07', 18450, 2000, [], [{ d: '2026-09-29', t: 'Skadeanmälan inkom' }, { d: '2026-09-30', t: 'Kalkyl skickad, 18 450 kr' }, { d: '2026-10-01', t: 'Godkänd av Handläggare A' }, { d: '2026-10-02', t: 'Dold skada på stötfångarhållare upptäckt vid demontering' }, { d: '2026-10-07', t: 'Tillägg begärt, väntar svar' }]),
    A('S-206', 'QGT82M', 'Exempelbil Hybrid 2021', 'Kund Exempel 2', 'Försäkring Exempel B', 'FB-7739102', 'Handläggare B', 'Viltolycka, front och motorhuv', 'vantar', '2026-10-08', 41200, 1500),
    A('S-205', 'QXA07P', 'Exempelbil EV 2023', 'Kund Exempel 3', 'Försäkring Exempel C', 'FC-2026-55210', 'Handläggare C', 'Hagelskada tak', 'kalkyl', '2026-10-09', 0, 1000),
    A('S-204', 'QLB55K', 'Exempelbil EV 2022', 'Taxi, åkeri 14', 'Försäkring Exempel A', 'FA-4410287', 'Handläggare D', 'Kollision höger framskärm och dörr', 'produktion', '2026-10-06', 27860, 3000),
    A('S-203', 'QCD19W', 'Exempelbil Kombi 2020', 'Kund Exempel 5', 'Försäkring Exempel B', 'FB-7738845', 'Handläggare B', 'Vindruta och frontkamera', 'faktura', '2026-10-08', 16940, 1500, [
      ['Vindruta, ny (OE)', 'Reservdel', 7420, 7420], ['Lister och klips vindruta', 'Reservdel', 640, 640], ['Byte vindruta', 'Arbete', 2380, 2380],
      ['Kalibrering frontkamera (ADAS)', 'Arbete', 1850, 0], ['Regnsensor, gelpad', 'Reservdel', 290, 0], ['Rengöring och primer', 'Material', 410, 410],
      ['Lackmaterial A-stolpe', 'Lack', 1120, 860], ['Lackering A-stolpe vänster', 'Lack', 2830, 2830]]),
    A('S-202', 'QYT63D', 'Exempelbil Kombi 2021', 'Kund Exempel 6', 'Försäkring Exempel A', 'FA-26-117902', 'Handläggare A', 'Repa och buckla bakdörr', 'klar', '2026-10-01', 9820, 2000),
    A('S-201', 'QPL28F', 'Exempelbil Sedan 2019', 'Kund Exempel 7', 'Försäkring Exempel C', 'FC-2026-54987', 'Handläggare C', 'Påbackning, bakre stötfångare', 'intag', '2026-10-08', 0, 1000)
  ];
  const mejl = [
    { id: 'm1', arende: 'S-207', fran: 'Handläggare A, Försäkring Exempel A', datum: '2026-10-10', amne: 'Re: Tillägg FA-26-118734', text: 'Hej,\n\nTack för tilläggsbegäran. Innan jag kan godkänna behöver jag bilder på stötfångarhållaren efter demontering samt en förklaring till varför parkeringssensorn inte kan återanvändas.\n\nMvh\nHandläggare A\nSkadereglerare, Försäkring Exempel A', svar: 'Ämne: Re: Tillägg FA-26-118734\n\nHej,\n\nBifogat finns fyra bilder på stötfångarhållaren efter demontering. Hållaren är deformerad vid infästningen och kan inte riktas utan att hållfastheten påverkas.\n\nParkeringssensorn kan inte återanvändas eftersom fästet är avbrutet och kåpan sprucken. Sensorn ger felkod vid systemtest, och en skadad kåpa släpper in fukt.\n\nBilen står i väntan på ert besked.\n\nMed vänliga hälsningar\nFolieringsfirman' },
    { id: 'm2', arende: 'S-206', fran: 'Handläggare B, Försäkring Exempel B', datum: '2026-10-09', amne: 'Kalkyl FB-7739102', text: 'Hej,\n\nKalkylen för QGT82M godkänns med justering. Vi godkänner inte byte av motorhuv utan riktning och lackering enligt vår besiktning. Ny totalsumma enligt vår beräkning blir 36 900 kr inkl. moms. Återkom om ni har synpunkter.\n\nVänliga hälsningar\nHandläggare B', svar: 'Ämne: Re: Kalkyl FB-7739102\n\nHej,\n\nTack för beskedet. Vi har synpunkter på justeringen av motorhuven. Huven har ett veck i den bakre förstärkningen som inte syns utifrån, och riktning där riskerar att påverka fotgängarskyddets funktion enligt tillverkarens reparationsanvisning.\n\nVi bifogar bilder från undersidan och föreslår att byte av motorhuv godkänns enligt ursprunglig kalkyl. Vi kan annars ta emot en ombesiktning hos oss.\n\nMed vänliga hälsningar\nFolieringsfirman' },
    { id: 'm3', arende: 'S-205', fran: 'Handläggare C, Försäkring Exempel C', datum: '2026-10-09', amne: 'Hagelskada QXA07P', text: 'Hej,\n\nVi har fått skadeanmälan för QXA07P. Kan ni ange beräknad ledtid och om ni utför PDR (bucklor utan lackering) på taket? Kunden önskar lånebil under reparationstiden.\n\nHandläggare C, Försäkring Exempel C', svar: 'Ämne: Re: Hagelskada QXA07P\n\nHej,\n\nVi utför PDR på taket där lacken är oskadad. Bucklor med lackskada åtgärdas med traditionell riktning och lackering. Kalkylen kommer efter inspektion.\n\nBeräknad ledtid är 4 till 5 arbetsdagar från godkännande. Vi ordnar lånebil till kunden under reparationstiden.\n\nMed vänliga hälsningar\nFolieringsfirman' }
  ];
  const exempelAnmalan = 'Hej!\n\nJag backade in i en stolpe i parkeringshuset igår kväll. Bakre stötfångaren är spräckt på höger sida och baklampan höger har en spricka. Bilen är en Exempelbil SUV 2023, regnummer QFG 73L. Jag är försäkrad i Försäkring Exempel A och har skadenummer FA-4412093. Självrisken är 3 000 kr enligt mitt brev.\n\nKan jag få en tid nästa vecka? Jag behöver lånebil eftersom jag pendlar.\n\nMvh\nKund Exempel 8\n070 000 00 08';
  return { arenden, mejl, exempelAnmalan, foretag: 'Folieringsfirman, Exempelgatan 2, 211 00 Malmö. Skadeverkstad och foliering, avtal med alla försäkringsbolag, lånebil vid behov.' };
}

/** Jetpack (exempel): underleverantörer och en uppdragsfil. Påhittat, bara för att visa strukturen. */
export const JETPACK_UL = [
  { namn: 'Kurir Exempel Nord AB', fordon: ['QJA 11A', 'QJA 12B'] },
  { namn: 'Budfirma Exempel AB', fordon: ['QJB 21C'] },
  { namn: 'Transport Exempel Syd AB', fordon: ['QJC 31D', 'QJC 32E', 'QJC 33F'] },
  { namn: 'Leverans Exempel HB', fordon: ['QJD 41G'] }
];
const PLATSER = ['Lager Exempel, Malmö', 'Hamnen, Malmö', 'Centrum, Lund', 'Industriområde, Burlöv', 'Terminal, Helsingborg', 'Butik Exempel, Trelleborg'];
const KUNDER = ['Kund Exempel 1 AB', 'Kund Exempel 2 AB', 'Kund Exempel 3 AB'];

/** Uppdragsfilen som CSV med semikolon (som en export från ett transportsystem). */
export function jetpackUppdragCsv({ period = '2026-09', antal = 140, seed = 7, ul = JETPACK_UL, extra = true } = {}) {
  const G = rng(seed), R = G.next, pick = G.pick;
  const dagar = new Date(Date.UTC(+period.slice(0, 4), +period.slice(5, 7), 0)).getUTCDate();
  const rows = ['Datum;Uppdrags-ID;Underleverantör;Fordon;Från;Till;Kund;Pris exkl moms;Tillägg'];
  for (let i = 0; i < antal; i++) {
    const u = pick(ul), d = 1 + Math.floor(R() * dagar);
    const pris = (250 + Math.round(R() * 1450)).toFixed(2).replace('.', ',');
    const till = R() < 0.15 ? (75 + Math.round(R() * 150)).toFixed(2).replace('.', ',') : '';
    rows.push([`${period}-${String(d).padStart(2, '0')}`, `JP-${period.replace('-', '')}-${String(i + 1).padStart(4, '0')}`, u.namn, pick(u.fordon), pick(PLATSER), pick(PLATSER), pick(KUNDER), pris, till].join(';'));
  }
  if (extra) {
    // Saker som ska fångas i kontrollen: en dubblett, ett uppdrag från fel månad och en okänd underleverantör
    rows.push(rows[1]);
    rows.push([`${period.slice(0, 4)}-01-15`, 'JP-FEL-0001', ul[0].namn, ul[0].fordon[0], PLATSER[0], PLATSER[1], KUNDER[0], '500,00', ''].join(';'));
    rows.push([`${period}-03`, 'JP-OKAND-0001', 'Okänd Åkare Exempel AB', 'QJZ 99Z', PLATSER[2], PLATSER[3], KUNDER[1], '800,00', ''].join(';'));
  }
  return rows.join('\n') + '\n';
}
