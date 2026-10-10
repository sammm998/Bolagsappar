// Jämförelsetester: packages/core mot legacy/apps/avrakning med samma syntetiska filer.
import { describe, it, expect, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import { legacyAvrakning } from './legacy.js';
import * as A from '../src/avrakning/index.js';
import { readText } from '../src/filetypes/read.js';
import { taxiMalmoSettings, genMonth, taxiCallerCsv, taxiCallerPages, appCsv, oresundPages, sturupPages, bankRows } from '../testdata/index.js';

const j = x => JSON.parse(JSON.stringify(x));
const L = legacyAvrakning();
const S = taxiMalmoSettings();
const M = genMonth(S, '2026-10');

// Samma läsning som handleFile i prototypen (XLSX för CSV)
const csvObjects = text => { const wb = XLSX.read(text, { type: 'string', raw: true }); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false }); };

describe('parsrar ger samma resultat som prototypen', () => {
  it('parseTcCsv', () => {
    const rows = csvObjects(taxiCallerCsv(M));
    expect(j(A.parseTcCsv(rows, {}))).toEqual(j(L.parseTcCsv(rows, {})));
  });
  it('parseTaxiCaller (PDF)', () => {
    const pages = taxiCallerPages(M);
    const a = A.parseTaxiCaller(pages), b = L.parseTaxiCaller(pages);
    expect(j(a)).toEqual(j(b));
    expect(a.trips.length).toBe(M.trips.length);
    expect(a.period).toBe('2026-10');
  });
  it('parseBambora', () => { expect(j(A.parseBambora(M.bamb))).toEqual(j(L.parseBambora(M.bamb))); });
  it('parseApp', () => { const rows = csvObjects(appCsv(M)); expect(j(A.parseApp(rows))).toEqual(j(L.parseApp(rows))); });
  it('parseOresund och mapRegCounts', () => {
    const pages = oresundPages(M);
    const a = A.parseOresund(pages), b = L.parseOresund(pages);
    expect(j(a)).toEqual(j(b));
    expect(Object.values(a.bro).reduce((s, n) => s + n, 0)).toBe(M.bro.length);
    expect(j(A.mapRegCounts(a.bro, a.tag, S.bilar))).toEqual(j(L.mapRegCounts(b.bro, b.tag, S.bilar)));
    expect(j(A.mapRegPrices(a.broPris, a.tag, S.bilar))).toEqual(j(L.mapRegPrices(b.broPris, b.tag, S.bilar)));
  });
  it('parseSturup och mapSturup', () => {
    const pages = sturupPages(M);
    const a = A.parseSturup(pages), b = L.parseSturup(pages);
    expect(j(a)).toEqual(j(b));
    expect(a.antal).toBe(M.sturup.length);
    expect(j(A.mapSturup(a, S.bilar, 0.25))).toEqual(j(L.mapSturup(b, S.bilar, 0.25)));
  });
  it('kontoutdrag och gissning av bolag', () => {
    const rows = bankRows(S, '2026-10');
    const a = A.parseBankRows(rows), b = L.parseBankRows(rows);
    expect(j(a)).toEqual(j(b));
    for (const r of a) expect(A.guessBolag(r.text, S.bolag.map(x => x.namn), {})).toEqual(j(L.guessBolag(r.text, S.bolag.map(x => x.namn), {})));
  });
  it('countPassages och monthLabels', () => {
    const text = M.sturup.map(p => p.reg).join(' ');
    expect(j(A.countPassages(text, S.bilar))).toEqual(j(L.countPassages(text, S.bilar)));
    for (const p of ['2026-01', '2026-11', '2026-12']) expect(A.monthLabels(p)).toEqual(j(L.monthLabels(p)));
  });
});

describe('compute(S, D) ger samma avräkning som prototypen', () => {
  let D, R, RL;
  beforeAll(() => {
    // Plattformens flöde: läs, känn igen, lägg in
    D = A.emptyMonth('2026-10');
    const files = [
      { name: 'debkunder.csv', read: readText('debkunder.csv', taxiCallerCsv(M)) },
      { name: 'sales.xlsx', read: { name: 'sales.xlsx', kind: 'sheet', sheets: { Sales: M.bamb } } },
      { name: 'app.csv', read: readText('app.csv', appCsv(M)) },
      { name: 'bro.pdf', read: { name: 'bro.pdf', kind: 'pdf', pages: oresundPages(M) } },
      { name: 'sturup.pdf', read: { name: 'sturup.pdf', kind: 'pdf', pages: sturupPages(M) } }
    ];
    for (const f of files) {
      const rec = A.recognize(f.read, {});
      expect(rec.type).not.toBe('unknown');
      expect(A.periodOf(rec, S)).toBe('2026-10');
      const res = A.applyFile(D, S, rec, f.name);
      expect(res.error).toBeUndefined();
      D = res.D;
    }
    D.manuellt = { 'Kust Taxi AB': { forskott: 5000, rabatt: 0, extra: [{ text: 'Ny taklampa', antal: 1, apris: 1200, moms: 25 }] } };
    R = A.computeMonth(S, D, {});

    // Prototypens flöde med samma filer
    const DL = { tc: null, bamb: null, app: null, bro: {}, sturup: {}, cph: {}, manuellt: j(D.manuellt), period: null };
    DL.tc = L.parseTcCsv(csvObjects(taxiCallerCsv(M)), {});
    DL.bamb = L.parseBambora(M.bamb);
    DL.app = L.parseApp(csvObjects(appCsv(M)));
    const o = L.parseOresund(oresundPages(M));
    DL.bro = L.mapRegCounts(o.bro, o.tag, S.bilar).ut; DL.cph = L.mapRegCounts(o.cph, o.tag, S.bilar).ut; DL.broRad = L.mapRegPrices(o.broPris, o.tag, S.bilar);
    const nb = Object.values(o.bro).reduce((a, x) => a + x, 0), nc = Object.values(o.cph).reduce((a, x) => a + x, 0);
    DL.oresund = { fil: 'bro.pdf', fakturadatum: o.fakturadatum, manader: o.manader, kostBro: o.kostBro, kostCph: o.kostCph, nBro: nb, nCph: nc, okandaBro: {}, okandaCph: {}, ovriga: o.ovriga, priser: { '201.00': nb }, prisAndring: null };
    const st = L.parseSturup(sturupPages(M)); const ms = L.mapSturup(st, S.bilar, S.params.m25);
    DL.sturupRad = ms.rad; DL.sturup = {}; DL.sturupInfo = { fil: 'sturup.pdf', period: st.period, antal: st.antal, total: st.total, okanda: ms.okanda, avvik: ms.avvik };
    RL = L.compute(S, DL);
  });

  it('samma åkaravräkning per bolag', () => {
    expect(j(R.bolag)).toEqual(j(RL.bolag));
  });
  it('samma kundfakturor, per bil och nyckeltal', () => {
    expect(j(R.kund)).toEqual(j(RL.kund));
    expect(j(R.perBil)).toEqual(j(RL.perBil));
    expect(j(R.kpi)).toEqual(j(RL.kpi));
  });
  it('samma kontrollpunkter', () => { expect(j(R.kontroll)).toEqual(j(RL.kontroll)); });
  it('låser nuvarande resultat (ändras bara med avsikt)', () => {
    expect({ kpi: R.kpi, att: R.bolag.filter(b => b.aktiv).map(b => [b.namn, b.att]) }).toMatchSnapshot();
  });
  it('Excel-flikarna byggs från samma resultat', () => {
    const sh = A.excelSheets(R, D.forskottRad);
    expect(sh.map(s => s.name)).toEqual(['Åkaravräkning', 'Fakturarader', 'Kundfakturor', 'Specifikation', 'Per bil', 'Noteringar']);
    expect(sh[0].rows.length).toBe(R.bolag.filter(b => b.aktiv).length + 1);
  });
  it('efterdebitering med förra månadens summering', () => {
    const prev = A.monthSummary(R);
    prev.bolag.forEach(b => { b.rows = b.rows.filter(r => !(r.art === 1 && b.namn === 'Åkeri Norra AB')); });
    const months = { '2026-10': { summary: prev } };
    const D2 = { ...D, period: '2026-11', tc: { ...D.tc, period: '2026-11' } };
    const R2 = A.computeMonth(S, D2, months);
    const R2L = L.compute(S, { ...D2, prevSummary: prev });
    expect(j(R2.bolag)).toEqual(j(R2L.bolag));
    expect(R2.kontroll.some(k => k.typ === 'Växelavgift efterdebiteras')).toBe(true);
  });
});
