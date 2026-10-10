// Publicering till åkarna: det som hamnar i Min avräkning och Åkarkassan.
import { describe, it, expect } from 'vitest';
import * as A from '../src/avrakning/index.js';
import { ENG } from '../src/kassan/engine.js';
import { fromShare } from '../src/kassan/month.js';
import { readText } from '../src/filetypes/read.js';
import { taxiMalmoSettings, genMonth, taxiCallerCsv, appCsv, oresundPages, sturupPages } from '../testdata/index.js';

const S = taxiMalmoSettings();
const M = genMonth(S, '2026-10');
let D = A.emptyMonth('2026-10');
for (const [name, read] of [['deb.csv', readText('deb.csv', taxiCallerCsv(M))], ['s.xlsx', { kind: 'sheet', sheets: { Sales: M.bamb } }], ['app.csv', readText('app.csv', appCsv(M))], ['bro.pdf', { kind: 'pdf', pages: oresundPages(M) }], ['st.pdf', { kind: 'pdf', pages: sturupPages(M) }]]) D = A.applyFile(D, S, A.recognize(read, {}), name).D;
D.forskottRad = [{ datum: '2026-10-14', text: 'FÖRSKOTT', belopp: 5000, bolag: 'Kust Taxi AB', med: true }];
const R = A.computeMonth(S, D, {});
const passager = { bro: ENG.parseBro(A.pagesLines(oresundPages(M))).rows, stu: ENG.parseSturup(A.pagesLines(sturupPages(M))).rows };
const spec = A.specForLive(R, S, D);

describe('delning till åkare', () => {
  it('sammanfattningen summerar till det åkaren får', () => {
    for (const b of R.bolag.filter(x => x.aktiv)) {
      const sh = A.buildShare({ R, S, bolag: b, spec: spec.bolag.find(x => x.namn === b.namn), passager, fran: 'Taxi Malmö' });
      const sum = sh.sammanfattning.reduce((a, x) => a + x.belopp, 0);
      expect(Math.round(sum * 100) / 100).toBe(Math.round(-b.att * 100) / 100);
      expect(sh.riktning).toBe(b.att < 0 ? 'far' : b.att > 0 ? 'betalar' : 'noll');
    }
  });
  it('åkaren ser bara sina egna bilar och passager', () => {
    const b = R.bolag.find(x => x.namn === 'Åkeri Norra AB');
    const sh = A.buildShare({ R, S, bolag: b, spec: spec.bolag.find(x => x.namn === b.namn), passager, fran: 'Taxi Malmö' });
    const regs = new Set(S.bilar.filter(x => x.bolag === b.namn).map(x => x.reg));
    expect(sh.passager.bro.every(p => regs.has(p.reg))).toBe(true);
    expect(sh.perBil.every(x => b.bilar.includes(x.bil))).toBe(true);
    expect(sh.korningar.every(x => b.bilar.includes(x.bil))).toBe(true);
    expect(JSON.stringify(sh)).not.toContain('Resenär'); // passagerarnamn delas aldrig
    expect(sh.meddelande).toMatch(/^Oktober är klar\. Du (får|betalar) [\d ]+,\d\d kr (den|senast den) 5 november\.$/);
  });
  it('Åkarkassan läser delningen i samma form som PDF:erna', () => {
    const b = R.bolag.find(x => x.namn === 'Kust Taxi AB');
    const sh = A.buildShare({ R, S, bolag: b, spec: null, passager, fran: 'Taxi Malmö' });
    const k = fromShare(sh);
    expect(k.avr.attBetala).toBe(b.att);
    expect(k.avr.rows.some(r => r.art === 59 && r.summa === 5000)).toBe(true);
    expect(k.bro.every(p => p.t instanceof Date)).toBe(true);
  });
  it('lista över vem som får vad', () => {
    const L = A.publishList(R, S, new Set(['Åkeri Norra AB']));
    expect(L.length).toBe(R.bolag.filter(b => b.aktiv).length);
    expect(L.find(x => x.namn === 'Åkeri Norra AB').kanal).toBe('App och mejl');
    expect(L.find(x => x.namn === 'Limhamn Trafik AB').kanal).toBe('Mejl (inte inloggad än)');
  });
  it('avvikelser mot förra månaden', () => {
    const prev = A.monthSummary(R);
    const b = prev.bolag.find(x => x.namn === 'Åkeri Norra AB');
    b.rows = b.rows.map(r => r.art === 16 ? { ...r, antal: 1 } : r);
    const av = A.avvikelser(R, prev);
    expect(av.some(x => x.bolag === 'Åkeri Norra AB' && /^Brokostnad/.test(x.typ))).toBe(true);
  });
});
