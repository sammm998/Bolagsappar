// Fyller den lokala backenden med påhittad demodata för Taxi Malmö och dess åkare, Folieringsfirman
// och Bolagsappar. Allt räknas med motorerna i packages/core, precis som i plattformen.
import * as A from '@bolagsappar/core/avrakning';
import { ENG, packP, lonespec, computeInput, godkannLon, avUpprata, avSignera, fromShare } from '@bolagsappar/core/kassan';
import { readText } from '@bolagsappar/core/filetypes';
import { taxiMalmoSettings, genMonth, taxiCallerCsv, appCsv, oresundPages, sturupPages, ldlText, skattetabellText, forarlistaDemo, verkstadDemo, skadeflodeDemo, bankRows } from '@bolagsappar/core/testdata';
import { T, U, subId } from './seed.js';

const MANADER = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
const PUBLICERAD = { '2026-04': '2026-05-04', '2026-05': '2026-06-03', '2026-06': '2026-07-03', '2026-07': '2026-08-04', '2026-08': '2026-09-03', '2026-09': '2026-10-04' };

/** Läs in månadens filer med samma flöde som plattformen. */
export function monthFromFiles(S, M, { utan = [] } = {}) {
  let D = A.emptyMonth(M.period);
  const files = [
    ['tc', 'TaxiCaller_kontofakturor_' + M.period + '.csv', () => readText('tc.csv', taxiCallerCsv(M))],
    ['bamb', 'Bambora_sales_' + M.period + '.xlsx', () => ({ kind: 'sheet', sheets: { Sales: M.bamb } })],
    ['app', 'TaxiCaller_app_' + M.period + '.csv', () => readText('app.csv', appCsv(M))],
    ['bro', 'Oresundsbro_samlingsfaktura_' + M.period + '.pdf', () => ({ kind: 'pdf', pages: oresundPages(M) })],
    ['sturup', 'Swedavia_Sturup_' + M.period + '.pdf', () => ({ kind: 'pdf', pages: sturupPages(M) })]
  ];
  const runs = [];
  for (const [key, name, read] of files) {
    if (utan.includes(key)) continue;
    const r = read(); const rec = A.recognize({ name, ...r }, {}); const res = A.applyFile(D, S, rec, name);
    D = res.D; runs.push({ kind: key, filename: name, summary: { text: res.summary } });
  }
  const passager = { bro: ENG.parseBro(A.pagesLines(oresundPages(M))).rows.map(({ t, ...p }) => p), stu: ENG.parseSturup(A.pagesLines(sturupPages(M))).rows.map(({ t, ...p }) => p) };
  return { D, runs, passager };
}

const fakeSha = s => Array.from({ length: 64 }, (_, i) => '0123456789abcdef'[(s.charCodeAt(i % s.length) + i * 7) % 16]).join('');

/** Fyll backenden. Körs en gång, första gången den lokala backenden startar. */
export async function seedDemo(backend) {
  const db = backend._raw();
  if (db.seededDemo) return;
  let avtalFn = null;
  const put = (tenant_id, module_key, path, data, at = '2026-10-10T07:00:00Z') => { db.documents.push({ tenant_id, module_key, path, data: JSON.parse(JSON.stringify(data)), version: 1, updated_by: U.sara, updated_at: at }); };
  const S = taxiMalmoSettings();

  // Taxi Malmö: inställningar
  put(T.taxi, 'avrakning', 'settings/params', S.params);
  put(T.taxi, 'avrakning', 'settings/bilar', { list: S.bilar });
  put(T.taxi, 'avrakning', 'settings/bolag', { list: S.bolag });
  put(T.taxi, 'avrakning', 'settings/terminaler', { terminaler: S.terminaler, kassor: S.kassor });
  put(T.taxi, 'avrakning', 'settings/forskottMap', { map: {} });

  const subByName = new Map(db.tenants.filter(t => t.parent_id === T.taxi).map(t => [t.name, t]));
  const members = new Set(db.memberships.map(m => m.tenant_id));
  const months = {};
  let seed = 100;
  for (const p of MANADER) {
    const M = genMonth(S, p, seed++);
    const { D, runs, passager } = monthFromFiles(S, M);
    if (p === '2026-09') D.forskottRad = [{ datum: '2026-09-14', text: 'FÖRSKOTT KUST TAXI', belopp: 5000, bolag: 'Kust Taxi AB', med: true }];
    const R = A.computeMonth(S, D, months);
    const summary = A.monthSummary(R);
    months[p] = { ...A.monthBody(D), summary, files: D.files, last: true, updatedAt: PUBLICERAD[p] + 'T09:00:00Z' };
    put(T.taxi, 'avrakning', 'months/' + p, months[p]);
    put(T.taxi, 'avrakning', 'spec/' + p, A.packSpec(R));
    put(T.taxi, 'avrakning', 'forare/' + p, A.packForare(R.kund));
    put(T.taxi, 'avrakning', 'appspec/' + p, A.packApp(D.appRad || []));
    put(T.taxi, 'avrakning', 'passager/' + p, passager);
    db.periods.push({ tenant_id: T.taxi, module_key: 'avrakning', period: p, status: 'publicerad', version: 1, approved_by: U.sara, approved_at: PUBLICERAD[p] + 'T08:30:00Z', published_by: U.sara, published_at: PUBLICERAD[p] + 'T09:00:00Z' });
    for (const r of runs) db.file_runs.push({ id: 'fr-' + p + r.kind, tenant_id: T.taxi, module_key: 'avrakning', period: p, kind: r.kind, filename: r.filename, sha256: fakeSha(p + r.kind), summary: r.summary, created_by: U.sara, created_at: PUBLICERAD[p] + 'T07:00:00Z' });
    // Publicerat till åkarna
    const spec = A.specForLive(R, S, D);
    for (const b of R.bolag.filter(x => x.aktiv)) {
      const t = subByName.get(b.namn); if (!t) continue;
      const payload = A.buildShare({ R, S, bolag: b, spec: spec.bolag.find(x => x.namn === b.namn), passager, fran: 'Taxi Malmö', utbDag: 5 });
      const opened = members.has(t.id) && !(p === '2026-09' && b.namn === 'Kust Taxi AB');
      db.shares.push({ id: 'sh-' + p + '-' + t.slug, from_tenant: T.taxi, to_tenant: t.id, module_key: 'avrakning', period: p, kind: 'akaravrakning', payload, version: 1, reason: null, created_at: PUBLICERAD[p] + 'T09:00:00Z', opened_at: opened ? PUBLICERAD[p] + 'T1' + (t.name.length % 9) + ':00:00Z' : null });
      if (p === '2026-09') db.notifications.push({ id: 'n-' + t.slug, tenant_id: t.id, user_id: null, title: 'Ny avräkning från Taxi Malmö', body: payload.meddelande, link: 'min-avrakning/' + p, created_at: PUBLICERAD[p] + 'T09:00:00Z', read_at: null });
    }
  }

  // Oktober pågår: 6 av 8 filer, Bambora och kontoutdraget saknas
  {
    const p = '2026-10';
    const M = genMonth(S, p, 200);
    const full = monthFromFiles(S, M);
    // Visma-facit är inmatat med förskotten från kontoutdraget (exempelfilen i demon)
    const [f0, f1] = A.defaultRange(p);
    full.D.forskottRad = A.saveForskott(A.suggestForskott(A.parseBankRows(bankRows(S, p)), S, full.D, {}), f0, f1, {}).forskottRad;
    const Rf = A.computeMonth(S, full.D, months);
    const part = monthFromFiles(S, M, { utan: ['bamb'] });
    const D = part.D;
    // Visma: facit inmatat från ett tidigare utkast. Väster Taxi skiljer 120 kr (avrundning eller saknad rad).
    D.visma = { fil: 'Visma_avrakningar_' + p + '.pdf', datum: '2026-11-02', inlast: '2026-10-09T10:00:00Z', bolag: Rf.bolag.filter(b => b.aktiv).map((b, i) => ({ namn: b.namn, kn: b.kn, nr: String(10210 + i), att: b.namn === 'Väster Taxi AB' ? b.att - 120 : b.att, rows: b.rows.map(r => ({ ...r })) })) };
    const vb = D.visma.bolag.find(b => b.namn === 'Väster Taxi AB'); if (vb) { const rr = vb.rows.find(r => r.art === 53); if (rr) rr.summa = Math.round((rr.summa - 96) * 100) / 100; }
    D.reskontra = { fil: 'Visma_kundreskontra_' + p + '.pdf', datum: '2026-10-31', poster: [{ kn: String(S.bolag[3].kn), namn: 'Kust Taxi AB', nr: '10088', fdat: '2026-09-30', saldo: 1420 }] };
    D.files = { ...D.files, visma: D.visma.fil, resk: D.reskontra.fil };
    D.forskottRad = null;
    const R = A.computeMonth(S, D, months);
    put(T.taxi, 'avrakning', 'months/' + p, { ...A.monthBody(D), summary: A.monthSummary(R), files: D.files, updatedAt: '2026-10-09T10:00:00Z' });
    put(T.taxi, 'avrakning', 'spec/' + p, A.packSpec(R));
    put(T.taxi, 'avrakning', 'forare/' + p, A.packForare(R.kund));
    put(T.taxi, 'avrakning', 'appspec/' + p, A.packApp(D.appRad || []));
    put(T.taxi, 'avrakning', 'passager/' + p, part.passager);
    db.periods.push({ tenant_id: T.taxi, module_key: 'avrakning', period: p, status: 'oppen', version: 1 });
    for (const r of part.runs) db.file_runs.push({ id: 'fr-' + p + r.kind, tenant_id: T.taxi, module_key: 'avrakning', period: p, kind: r.kind, filename: r.filename, sha256: fakeSha(p + r.kind), summary: r.summary, created_by: U.sara, created_at: '2026-10-08T09:00:00Z' });
    db.file_runs.push({ id: 'fr-' + p + 'resk', tenant_id: T.taxi, module_key: 'avrakning', period: p, kind: 'resk', filename: D.reskontra.fil, sha256: fakeSha(p + 'resk'), summary: { text: '1 öppen faktura per 2026-10-31' }, created_by: U.sara, created_at: '2026-10-09T09:00:00Z' });
    db.file_runs.push({ id: 'fr-' + p + 'visma', tenant_id: T.taxi, module_key: 'avrakning', period: p, kind: 'visma', filename: D.visma.fil, sha256: fakeSha(p + 'visma'), summary: { text: D.visma.bolag.length + ' fakturor' }, created_by: U.sara, created_at: '2026-10-09T10:00:00Z' });
    // Exempelfilerna för det som saknas finns att ladda ner i demoläget
    put(T.taxi, 'avrakning', 'demo/' + p, { bamb: M.bamb.length });
  }

  // Kom igång på plattformen: 3 av 5 klara
  for (const step of ['bolag', 'bilar', 'akarna', 'priser']) db.guide_progress.push({ user_id: U.sara, tenant_id: T.taxi, module_key: 'avrakning', step_key: step, done_at: '2026-09-02T10:00:00Z' });
  db.guide_progress.push({ user_id: U.sara, tenant_id: T.taxi, module_key: 'avrakning', step_key: 'welcome', done_at: '2026-09-02T10:00:00Z' });

  // Förarlista
  const fl = forarlistaDemo(S);
  put(T.taxi, 'forarlista', 'lista', fl);
  for (const t of subByName.values()) {
    const own = fl.forare.filter(f => f.akeri === t.name);
    db.shares.push({ id: 'sf-' + t.slug, from_tenant: T.taxi, to_tenant: t.id, module_key: 'forarlista', period: '2026-10', kind: 'forare', payload: { hamtad: fl.hamtad, forare: own }, version: 1, reason: null, created_at: fl.hamtad, opened_at: null });
  }

  // Åkeri Norra AB: Åkarkassan. Augusti klar med lön, september väntar på LDL.
  {
    const t = subId(0);
    const bilar = S.bilar.filter(b => b.bolag === 'Åkeri Norra AB');
    const reg = r => r.slice(0, 3) + ' ' + r.slice(3);
    const forare = [['100001', '100002'], ['100003', '100004'], ['100001', '100003'], ['100002', '100004']];
    const settings = { foretag: 'Åkeri Norra AB', foretagLast: true, cfg: {}, bolag: { orgnr: '556xxx-0101', adress: 'Exempelvägen 1', postadress: '211 00 Malmö', firmatecknare: 'Ahmed Exempel' },
      bilar: Object.fromEntries(bilar.map((b, i) => [b.reg, { regnr: reg(b.reg), bilId: String(901 + i), namn: 'Bil ' + b.bil }])),
      forare: {
        '100001': { namn: 'Förare A1', anstForm: 'tills', start: '2025-03-01', modell: 'procent', omfattning: 'heltid', person: { personnr: '19880101-0000', adress: 'Gatan 1', postadress: '211 00 Malmö', tabell: 33, bank: '1234-1234567', kolumn: null } },
        '100002': { namn: 'Förare A2', anstForm: 'prov', start: '2026-08-01', slut: '2027-01-31', modell: 'procent', omfattning: 'heltid', person: { personnr: '19920101-0000', adress: 'Gatan 2', postadress: '211 00 Malmö', tabell: 33, bank: '1234-7654321' } },
        '100003': { namn: 'Förare A3', anstForm: 'sava', start: '2026-09-01', slut: '2027-02-28', modell: 'procent', omfattning: 'deltid', person: { personnr: '19990101-0000', adress: 'Gatan 3', postadress: '211 00 Malmö', tabell: 33 } },
        '100004': { namn: 'Förare A4', anstForm: 'tills', start: '2024-01-01', modell: 'procent', omfattning: 'deltid', person: { personnr: '19700101-0000', adress: 'Gatan 4', postadress: '212 00 Malmö', tabell: 32, bank: '1234-1111111' } }
      }, lonHist: {} };
    const skatt = ENG.parseSkattetabell(skattetabellText());
    const packed = Object.fromEntries(Object.entries(skatt).map(([k, v]) => [k, ENG.packTabell(v)]));
    put(t, 'kassan', 'skatt', { ar: 2026, tabeller: packed });
    // Augusti: LDL, delning från centralen, lön godkänd
    const aug = ldlText({ period: '2026-08', bilar: bilar.slice(0, 2).map((b, i) => [String(901 + i), reg(b.reg)]), forare: forare.slice(0, 2), foretag: 'AKERI NORRA AB', seed: 81, skippa: 0.35 });
    const shAug = db.shares.find(s => s.to_tenant === t && s.period === '2026-08' && s.module_key === 'avrakning');
    const fa = fromShare(shAug.payload);
    const shifts = ENG.parseLDL(aug).shifts;
    const monthAug = { forare: {}, overrides: {}, ldl: aug, bro: packP(fa.bro), stu: packP(fa.stu), avr: fa.avr, files: { ldl: 'LDL_augusti.txt, ' + shifts.length + ' pass', avr: 'Från Taxi Malmö', bro: 'Från Taxi Malmö', stu: 'Från Taxi Malmö' } };
    const R = ENG.compute(shifts, [...fa.bro, ...fa.stu].filter(p => new Set(shifts.map(s => s.reg)).has(p.reg)), settings.cfg, computeInput(settings, monthAug, shifts));
    const LS = R.rows.map(r => ({ r, L: lonespec({ r, c: R.cfg, person: settings.forare[r.id]?.person || {}, skatt, period: '2026-08' }) }));
    const g = godkannLon(LS, { period: '2026-08', c: R.cfg, datum: '2026-09-08' });
    monthAug.lonekorning = g.lonekorning; settings.lonHist = g.lonHist;
    put(t, 'kassan', 'm-2026-08', monthAug);
    put(t, 'kassan', 'm-2026-09', { forare: {}, overrides: {}, files: {} });
    put(t, 'kassan', 'settings', settings);
    // Avtal: A1 och A2 signerade, A3 väntar på förarens signatur, A4 saknar avtal
    const ctx = { settings, cfg: ENG.DEF, central: 'Taxi Malmö AB' };
    const pngSig = 'data:image/svg+xml;base64,' + (typeof btoa !== 'undefined' ? btoa('<svg xmlns="http://www.w3.org/2000/svg" width="450" height="140"><path d="M20 100 C 80 20, 120 140, 180 60 S 300 120, 420 50" stroke="#0E1E35" stroke-width="4" fill="none"/></svg>') : '');
    const avtal = async () => {
      for (const id of ['100001', '100002']) {
        let v = await avUpprata(id, ctx); v.skapad = '2026-08-01T10:00:00Z';
        v = await avSignera(v, 'anst', { namn: settings.forare[id].namn, ort: 'Malmö', png: pngSig });
        v = await avSignera(v, 'arbg', { namn: 'Ahmed Exempel', ort: 'Malmö', png: pngSig });
        put(t, 'kassan', 'avtal-' + id, { versioner: [v] });
      }
      const v3 = await avUpprata('100003', ctx);
      put(t, 'kassan', 'avtal-100003', { versioner: [v3] });
      backend._save();
    };
    avtalFn = avtal;
  }

  // Folieringsfirman: Verkstad
  {
    const V = verkstadDemo();
    for (const a of V.arenden) put(T.folie, 'verkstad', 'arenden/' + a.id, a);
    for (const f of V.fordon) put(T.folie, 'verkstad', 'fordon/' + f.id, f);
    for (const f of V.forsakring) put(T.folie, 'verkstad', 'forsakring/' + f.id, f);
    for (const k of V.kostnader) put(T.folie, 'verkstad', 'kostnader/' + k.id, k);
    for (const [k, v] of Object.entries(V.inst)) put(T.folie, 'verkstad', 'installningar/' + k, v);
    const SF = skadeflodeDemo();
    for (const a of SF.arenden) put(T.folie, 'skadeflode', 'arenden/' + a.id, a);
    for (const m of SF.mejl) put(T.folie, 'skadeflode', 'mejl/' + m.id, m);
    put(T.folie, 'skadeflode', 'installningar', { foretag: SF.foretag, signatur: 'Folieringsfirman', epost: 'skador@folieringsfirman.example' });
  }

  // Guidestatistik för adminportalen
  const steg = [['kassan', 'skatt'], ['kassan', 'skatt'], ['kassan', 'forsta-lon'], ['avrakning', 'publicera']];
  steg.forEach(([m, s], i) => db.guide_progress.push({ user_id: U.ahmed, tenant_id: subId(i + 2), module_key: m, step_key: s, done_at: '2026-10-0' + (i + 1) + 'T10:00:00Z' }));

  db.seededDemo = true;
  if (avtalFn) await avtalFn();
  backend._save();
}
