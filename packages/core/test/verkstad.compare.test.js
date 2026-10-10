// Jämförelsetester: Verkstad (packages/core/src/verkstad) mot legacy/apps/foliering.
import { describe, it, expect } from 'vitest';
import { legacyFoliering } from './legacy.js';
import { createVerkstad } from '../src/verkstad/engine.js';

const j = x => JSON.parse(JSON.stringify(x));
const TODAY = '2026-10-10';

export function verkstadState() {
  const S = { arenden: new Map(), fordon: new Map(), forsakring: new Map(), kostnader: new Map(), bokforing: new Map(), lonespec: new Map(), inst: { foretag: { namn: 'Folieringsfirman Exempel AB', orgnr: '559000-0001' }, personal: { items: [{ id: 'agare', namn: 'Ägare Exempel', roll: 'agare' }, { id: 'p1', namn: 'Montör Exempel', roll: 'anstalld' }] } } };
  S.forsakring.set('fa', { id: 'fa', namn: 'Försäkring Exempel A', kort: 'A' });
  S.forsakring.set('fb', { id: 'fb', namn: 'Försäkring Exempel B', kort: 'B' });
  S.fordon.set('QAB12D', { agare: 'Bilägare Exempel AB', epost: 'agare@example.se' });
  S.fordon.set('QCD56H', { agare: 'Bilägare Två AB', epost: 'tva@example.se' });
  const rad = (pid, antal, apris, text) => ({ pid, antal, apris, text });
  const add = a => S.arenden.set(a.id, a);
  add({ id: 'a1', reg: 'QAB 12D', skadenr: 'SK-100001', forsakring: 'fa', status: 'betald', storlek: 'vanlig', utforare: 'p1', agare: 'Bilägare Exempel AB',
    offert: { datum: '2026-08-10', rader: [rad('sf-fram', 1, 4000, 'Foliering stötfångare fram')] },
    faktura: { nr: 1001, datum: '2026-08-20', forfall: '2026-08-30', utfort: '2026-08-19', betald: true, betaldDatum: '2026-09-02', rader: [rad('sf-fram', 1, 4000, 'Foliering stötfångare fram'), rad('dorr', 2, 1500, 'Foliering 2 dörrar')] },
    moms: { nr: 'M-1001', datum: '2026-09-03', forfall: '2026-09-13', till: 'Bilägare Exempel AB', betald: true, betaldDatum: '2026-09-20', skickad: '2026-09-03' } });
  add({ id: 'a2', reg: 'QBC 34F', skadenr: 'SK-100002', forsakring: 'fb', status: 'fakturerad', storlek: 'storre', utforare: 'agare',
    offert: { datum: '2026-09-01', rader: [rad('hel', 1, 30000, 'Helfoliering hel bil')] },
    faktura: { nr: 1002, datum: '2026-09-15', forfall: '2026-09-25', utfort: '2026-09-14', betald: false, rader: [rad('hel', 1, 30000, 'Helfoliering hel bil')] } });
  add({ id: 'a3', reg: 'QCD 56H', skadenr: 'SK-100003', forsakring: 'fa', status: 'fakturerad', storlek: 'vanlig', utforare: 'p1',
    offert: { datum: '2026-09-05', rader: [rad('motorhuv', 1, 2500, 'Foliering motorhuv')] },
    faktura: { nr: 1003, datum: '2026-09-28', forfall: '2026-10-08', utfort: '2026-09-27', betald: true, betaldDatum: '2026-10-05', rader: [rad('motorhuv', 1, 2500, 'Foliering motorhuv'), rad(null, 1, 800, 'Dekalering motorhuv')] } });
  add({ id: 'a4', reg: 'QDE 78J', skadenr: 'SK-100004', forsakring: 'fb', status: 'skickad', storlek: 'vanlig', offert: { datum: '2026-10-01', skickad: '2026-10-01', rader: [rad('baklucka', 1, 2000, 'Foliering baklucka')] } });
  add({ id: 'a5', reg: 'QEF 90K', skadenr: 'SK-100005', forsakring: 'fa', status: 'godkand', storlek: 'vanlig', offert: { datum: '2026-10-02', godkandAv: 'Handläggare', rader: [rad('spegel', 2, 500, 'Foliering 2 backspeglar')] } });
  S.kostnader.set('k1', { id: 'k1', typ: 'material', datum: '2026-08-05', belopp: 4800, moms: 1200, meter: 60, leverantor: 'Foliegrossist Exempel', fakturanr: '55' });
  S.kostnader.set('k2', { id: 'k2', typ: 'ul', datum: '2026-09-10', belopp: 1500, moms: 375, arende: 'a2', leverantor: 'Underleverantör Exempel' });
  S.kostnader.set('k3', { id: 'k3', typ: 'lon', datum: '2026-09-25', belopp: 9000 });
  S.bokforing.set('2026-08', { period: '2026-08', status: 'last', keys: ['kost:k1'], ver: [{ nr: 1, key: 'kost:k1', datum: '2026-08-05', text: 'Material', rader: [{ k: 4010, b: 4800 }, { k: 2641, b: 1200 }, { k: 1930, b: -6000 }] }] });
  return S;
}

describe('Verkstad ger samma resultat som foliering', () => {
  const S1 = verkstadState(), S2 = verkstadState();
  const V = createVerkstad({ S: S1, today: () => TODAY });
  const L = legacyFoliering(S2, TODAY);
  it('nästa fakturanummer och meterpris', () => {
    expect(V.nastaFaktura()).toBe(L.nastaFaktura());
    expect(V.nastaFaktura()).toBe(1004);
    expect(V.meterpris()).toBe(L.meterpris());
  });
  it('kalkyl per ärende och per månad', () => {
    for (const a of S1.arenden.values()) expect(j(V.kalkylA(a))).toEqual(j(L.kalkylA(S2.arenden.get(a.id))));
    expect(j(V.manadsData('2026'))).toEqual(j(L.manadsData('2026')));
  });
  it('verifikationer, varningar och SIE per period', () => {
    for (const p of ['2026-08', '2026-09', '2026-10']) {
      expect(j(V.genAuto(p))).toEqual(j(L.genAuto(p)));
      const a = V.utkast(p), b = L.utkast(p);
      expect(j(a)).toEqual(j(b));
      expect(j(V.periodSum(a))).toEqual(j(L.periodSum(b)));
      expect(j(V.varningar(p, a))).toEqual(j(L.varningar(p, b)));
      const sa = new Uint8Array(V.bygSie(p, a)), sb = new Uint8Array(L.bygSie(p, b));
      const ta = new TextDecoder('latin1').decode(sa).replace('"Bolagsappar Verkstad"', '"Foliering Demo"');
      expect(ta).toBe(new TextDecoder('latin1').decode(sb));
    }
  });
  it('momsfakturan skapas först när försäkringsbolaget har betalat', () => {
    const a = S1.arenden.get('a3'), b = S2.arenden.get('a3');
    expect(V.momsEfterBetalning(a)).toBe(L.momsEfterBetalning(b));
    expect(j(a.moms)).toEqual(j(b.moms));
    expect(a.moms.nr).toBe('M-1003');
    expect(V.momsEfterBetalning(S1.arenden.get('a1'))).toBe(false); // redan skickad
  });
  it('matchning av inbetalning mot öppna fakturor', () => {
    const tx = { datum: '2026-10-09', text: 'BG INBET SK-100002', belopp: 30000 };
    const a = V.matchTx(tx, new Set()), b = L.matchTx(tx, new Set());
    expect(a.map(g => g.map(x => x.nr))).toEqual(b.map(g => g.map(x => x.nr)));
  });
  it('att göra-listan', () => {
    const t = V.attGora();
    expect(t.map(x => x.a.id)).toEqual(['a2', 'a3', 'a5', 'a4']);
    expect(t[1].h).toBe('Momsfaktura M-1003 ska skickas till ägaren');
    expect(t[0].h).toBe('Faktura 1002 är förfallen, påminnelse behövs');
  });
});

import { verkstadActions } from '../src/verkstad/actions.js';
describe('händelser på ärenden (samma regler som i prototypen)', () => {
  it('offert, faktura, betald och momsfaktura i rätt ordning', () => {
    const S = verkstadState();
    const V = createVerkstad({ S, today: () => TODAY }); const X = verkstadActions(V);
    let a = S.arenden.get('a4');
    a = X.godkand(a, 'Handläggare').a; expect(a.status).toBe('godkand');
    const f = X.skapaFaktura(a); a = f.a; S.arenden.set(a.id, a);
    expect(a.faktura.nr).toBe(1004); expect(a.faktura.forfall).toBe('2026-10-20'); expect(f.serie).toEqual({ nasta: 1005 });
    S.fordon.set('QDE78J', { agare: 'Bilägare Fyra AB' });
    const b = X.betald(a, '2026-10-15'); a = b.a;
    expect(a.status).toBe('betald'); expect(a.moms.nr).toBe('M-1004'); expect(a.moms.till).toBe('Bilägare Fyra AB');
    expect(b.msg).toContain('Momsfaktura M-1004');
    a = X.momsSkickad(a).a; expect(a.moms.skickad).toBe(TODAY);
    expect(a.logg.map(l => l.t)).toContain('Faktura 1004 betald 2026-10-15');
  });
});
