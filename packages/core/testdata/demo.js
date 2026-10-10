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
