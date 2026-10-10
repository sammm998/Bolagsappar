// Jämförelsetester: sammanslagen motor (packages/core/src/kassan) mot ENG i akarkassan och tripkassan.
import { describe, it, expect } from 'vitest';
import { legacyENG, legacyLon } from './legacy.js';
import { createEngine, ENG } from '../src/kassan/engine.js';
import { lonespec, computeInput, utbMan, utbDatum } from '../src/kassan/lon.js';
import { ingestLdl, recognizeKassan, importPlatt, godkannLon } from '../src/kassan/month.js';
import { avText, avUpprata, avSignera, avStatus, avSaknas } from '../src/kassan/avtal.js';
import { pagesLines } from '../src/avrakning/month.js';
import { readText } from '../src/filetypes/read.js';
import { ldlText, akeriKassa, skattetabellText, genMonth, taxiMalmoSettings, oresundPages, sturupPages } from '../testdata/index.js';

const j = x => JSON.parse(JSON.stringify(x));
const K = akeriKassa();
const text = ldlText({ period: '2026-10', bilar: K.bilar, forare: K.forare });

describe('ENG: parsrar och motor', () => {
  for (const app of ['akarkassan', 'tripkassan']) {
    const L = legacyENG(app), E = createEngine(app);
    it(`${app}: DEF är samma`, () => { expect(j(E.DEF)).toEqual(j(L.DEF)); });
    it(`${app}: parseLDL`, () => { expect(j(E.parseLDL(text))).toEqual(j(L.parseLDL(text))); });
    it(`${app}: parseSkattetabell och tabellSkatt`, () => {
      const t = skattetabellText();
      const a = E.parseSkattetabell(t), b = L.parseSkattetabell(t);
      expect(j(a)).toEqual(j(b));
      for (const brutto of [0, 5000, 18234, 26696, 45000, 79999, 90000]) for (const kol of [1, 3]) expect(E.tabellSkatt(a['33'], kol, brutto)).toBe(L.tabellSkatt(b['33'], kol, brutto));
    });
    it(`${app}: agAvgift från konfiguration ger samma som hårdkodat`, () => {
      const pnrs = ['19500101-0000', '19370101-0000', '19580601-0000', '20040301-0000', '20060101-0000', '19900101-0000', '', '9001010000'];
      for (const p of pnrs) for (const man of ['2026-01', '2026-03', '2026-04', '2026-11', '2027-09', '2027-10']) for (const b of [12000, 25000, 40000]) expect(E.agAvgift(p, b, man)).toEqual(j(L.agAvgift(p, b, man)));
    });
    it(`${app}: bro och Sturup från samma PDF som centralen`, () => {
      const S = taxiMalmoSettings(), M = genMonth(S, '2026-10');
      const lb = pagesLines(oresundPages(M)), ls = pagesLines(sturupPages(M));
      expect(j(E.parseBro(lb))).toEqual(j(L.parseBro(lb)));
      expect(E.parseBro(lb).rows.filter(r => r.typ === 'bro').length).toBe(M.bro.length);
      expect(j(E.parseSturup(ls))).toEqual(j(L.parseSturup(ls)));
      expect(E.parseSturup(ls).rows.length).toBe(M.sturup.length);
    });
  }

  it('compute: Åkarkassan, samma rader, passager och kassaredovisning', () => {
    const L = legacyENG('akarkassan');
    const shifts = ENG.parseLDL(text).shifts, shiftsL = L.parseLDL(text).shifts;
    const regs = K.bilar.map(b => b[1].replace(/\s/g, ''));
    const pass = []; let n = 0;
    for (const s of shifts.slice(0, 40)) { const t = new Date(s.a.getTime() + 2 * 36e5); pass.push({ ts: `${ENG.dstr(t)} ${ENG.tstr(t)}:00`, t, desc: 'SV/DK Klass 2', reg: s.reg, typ: n++ % 5 === 4 ? 'sturup' : 'bro', valuta: 'SEK', belopp: 201 }); }
    pass.push({ ts: '2026-10-03 02:10:00', t: new Date(2026, 9, 3, 2, 10), desc: 'SV/DK Klass 2', reg: regs[0], typ: 'bro', valuta: 'SEK', belopp: 201 });
    const month = { forare: { '100001': { bonus: 500, forskott: 1000 }, '100003': { kontant: 0, boltProv: 320 } }, overrides: {} };
    const settings = { forare: { '100002': { modell: 'procent' } } };
    const input = computeInput(settings, month, shifts);
    const a = ENG.compute(shifts, pass, { procent: 36 }, input);
    const b = L.compute(shiftsL, j(pass).map(p => ({ ...p, t: new Date(p.t) })), { procent: 36 }, j(input));
    expect(j(a.rows)).toEqual(j(b.rows));
    expect(j(a.bro)).toEqual(j(b.bro));
    expect(j(a.bilar)).toEqual(j(b.bilar));
  });

  it('compute: Tripkassan, fast lön utan körpass och kontanter som inte kvittas', () => {
    const L = legacyENG('tripkassan'), E = createEngine('tripkassan');
    const shifts = E.parseLDL(text).shifts, shiftsL = L.parseLDL(text).shifts;
    const settings = { forare: { '100002': { modell: 'fast', manadslon: 26000, semFast: true }, '999999': { modell: 'fast', manadslon: 22000 } } };
    const input = computeInput(settings, { forare: {}, overrides: {} }, shifts, { variant: 'tripkassan', period: '2026-10' });
    expect(Object.keys(input.forare)).toContain('999999');
    const a = E.compute(shifts, [], {}, input), b = L.compute(shiftsL, [], {}, j(input));
    expect(j(a.rows)).toEqual(j(b.rows));
    expect(a.rows.find(r => r.id === '100002').kontant).toBe(0);
    expect(a.rows.find(r => r.id === '999999').fast).toBe(22000);
    // Åkarkassan räknar annorlunda (kontanter kvittas alltid)
    const c = ENG.compute(shifts, [], {}, input);
    expect(c.rows.find(r => r.id === '100002').kontant).toBeGreaterThan(0);
  });
});

describe('lönespec', () => {
  for (const app of ['akarkassan', 'tripkassan']) {
    it(`${app}: samma lönespec som lonOf`, () => {
      const E = createEngine(app);
      const skatt = E.parseSkattetabell(skattetabellText());
      const settings = { cfg: {}, forare: {
        '100001': { namn: 'Förare A1', person: { personnr: '19900101-0000', tabell: 33, bank: '1234-1234567' } },
        '100002': { namn: 'Förare A2', modell: 'fast', manadslon: 25000, semFast: true, person: { personnr: '20050101-0000', tabell: 32 } },
        '100003': { namn: 'Förare A3', person: { personnr: '19580101-0000', engang: 30, bank: 'x' } },
        '100004': { namn: 'Förare A4', person: { personnr: '19800101-0000', jamkning: 4000 } }
      }, lonHist: { '100001': { '2026-09': { brutto: 20000, skatt: 4000, utb: '2026-10-10' } } } };
      const shifts = E.parseLDL(text).shifts;
      const input = computeInput(settings, { forare: { '100001': { forskott: 500 } } }, shifts, { variant: app, period: '2026-10' });
      const R = E.compute(shifts, [], settings.cfg, input);
      const L = legacyLon(app, { settings, skatt, period: '2026-10' });
      for (const r of R.rows) {
        const a = lonespec({ r, c: R.cfg, person: settings.forare[r.id]?.person || {}, skatt, period: '2026-10', lonHist: settings.lonHist[r.id], ENG: E });
        const b = L.lonOf(j(r), j(R.cfg));
        expect(j(a)).toEqual(j(b));
      }
      expect(utbMan('2026-10', R.cfg)).toBe(L.utbMan());
    });
  }
  it('utbetalningsdatum', () => {
    expect(utbDatum('2026-10', { utbetDag: 10 })).toBe('2026-11-10');
    expect(utbDatum('2026-12', { utbetDag: 10 })).toBe('2027-01-10');
    expect(utbDatum('2026-10', createEngine('tripkassan').DEF, 'fast')).toBe('2026-10-25');
    expect(utbDatum('2026-10', createEngine('tripkassan').DEF, 'procent')).toBe('2026-11-07');
  });
});

describe('månadsflöde i Åkarkassan', () => {
  it('ingestLdl väljer vanligaste månaden och tar bort pass utanför', () => {
    const extra = ldlText({ period: '2026-09', bilar: K.bilar.slice(0, 1), forare: K.forare.slice(0, 1), dagar: 2, seed: 99 });
    const r = ingestLdl(text + '\n' + extra, { bilar: {}, forare: {} });
    expect(r.period).toBe('2026-10');
    expect(r.utanfor).toBeGreaterThan(0);
    expect(r.foretag).toBe('Exempel AB');
    expect(Object.keys(r.nyaBilar)).toHaveLength(4);
  });
  it('känner igen LDL och skattetabell', () => {
    expect(recognizeKassan(readText('LDL.txt', text), []).type).toBe('ldl');
    expect(recognizeKassan(readText('tabell.txt', skattetabellText()), []).type).toBe('skatt');
  });
  it('plattformsavgift från Bolt matchas på namn', () => {
    const csv = 'Förare,Turer,Intäkt,Provision\nFörare A1,10,1000,"250,50"\nOkänd Person,2,100,25';
    const r = importPlatt(csv, 'bolt', { month: { forare: {} }, ids: ['100001', '100002'], namnFor: id => ({ '100001': 'Förare A1', '100002': 'Förare A2' })[id] });
    expect(r.month.forare['100001'].boltProv).toBe(250.5);
    expect(r.miss).toEqual(['Okänd Person']);
  });
  it('godkänn lön sparar historik', () => {
    const E = ENG; const shifts = E.parseLDL(text).shifts; const R = E.compute(shifts, [], {}, computeInput({ forare: {} }, {}, shifts));
    const LS = R.rows.map(r => ({ r, L: lonespec({ r, c: R.cfg, person: { personnr: '19900101-0000' }, skatt: E.parseSkattetabell(skattetabellText()), period: '2026-10' }) }));
    const g = godkannLon(LS, { period: '2026-10', c: R.cfg, datum: '2026-11-02' });
    expect(Object.keys(g.lonekorning.rader)).toHaveLength(R.rows.length);
    expect(g.lonHist['100001']['2026-10'].utb).toBe('2026-11-10');
  });
});

describe('avtal och signering med pennan', () => {
  const settings = { foretag: 'Exempel Åkeri AB', bolag: { orgnr: '559000-0009', adress: 'Gatan 1' }, forare: { '100003': { namn: 'Förare A3', anstForm: 'sava', start: '2026-10-01', slut: '2027-03-31', modell: 'procent', omfattning: 'deltid', person: { personnr: '19900101-0000', adress: 'Vägen 2' } } } };
  const ctx = { settings, cfg: ENG.DEF, central: 'Taxi Malmö AB' };
  it('avtalet nämner centralen och saknar inga uppgifter', () => {
    expect(avSaknas('100003', settings)).toEqual([]);
    const t = avText('100003', ctx);
    expect(t.map(s => s.h)).toContain('Lön');
    expect(JSON.stringify(t)).toContain('Taxi Malmö AB');
    expect(JSON.stringify(t)).not.toMatch(/[—–]/);
  });
  it('arbetstagaren signerar först, sedan arbetsgivaren, texten är låst', async () => {
    let v = await avUpprata('100003', ctx);
    await expect(avSignera(v, 'arbg', { namn: 'Chef', png: 'data:' })).rejects.toThrow('Arbetstagaren signerar först');
    v = await avSignera(v, 'anst', { namn: 'Förare A3', ort: 'Malmö', png: 'data:image/png;base64,AAA' });
    expect(avStatus({ versioner: [v] })).toBe('utkast');
    v = await avSignera(v, 'arbg', { namn: 'Ägare', ort: 'Malmö', png: 'data:image/png;base64,BBB' });
    expect(avStatus({ versioner: [v] })).toBe('signerat');
    const fusk = { ...v, text: [...v.text, { h: 'Extra', p: ['x'] }], sign: {} };
    await expect(avSignera(fusk, 'anst', { namn: 'X', png: 'p' })).rejects.toThrow('Avtalstexten har ändrats');
  });
});
