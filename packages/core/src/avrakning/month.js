// Månadsflödet i Avräkning utan DOM. Logiken är flyttad från handleFile, oresundFile,
// vismaFile, reskontraFile, sturupFile, passageFile, aggBamb, monthBody och queueSave i
// legacy/apps/avrakning/index.html. Skillnaden är att varje steg returnerar ett nytt
// månadsobjekt i stället för att skriva i globala variabler.
import {
  r2, ymAdd, monthLabels, compute, parseBambora, parseTcCsv, parseApp, parseTaxiCaller, countPassages,
  mapRegCounts, mapRegPrices, mapSturup, parseOresund, parseSturup, parseReskontra, parseVismaFakturor,
  parseBankRows, parseBankText, guessBolag, groupLines
} from './engine.js';

export const DEFAULT_PARAMS = { vx: 8900, tl: 250, sa: 0.03, m6: 0.06, m25: 0.25, bro: 201, sturup: 32.6, cph: 15, fs: 99 };

/** Tomma inställningar i samma form som S i prototypen. */
export function emptySettings() {
  return { params: { ...DEFAULT_PARAMS }, bilar: [], terminaler: [], kassor: [], bolag: [] };
}

/** Tom månad (D i prototypen). */
export function emptyMonth(period = null) {
  return { tc: null, bamb: null, app: null, appRad: null, bro: {}, sturup: {}, cph: {}, manuellt: {}, period, src: {}, files: {},
    oresund: null, sturupRad: null, sturupInfo: null, broRad: null, reskontra: null, forskottRad: null, prevSummary: null, visma: null, skuldMed: null, _okandaReg: null };
}

const clone = o => JSON.parse(JSON.stringify(o ?? null));
export const pagesText = pages => pages.map(p => groupLines(p).map(r => r.items.map(i => i.str).join(' ')).join('\n')).join('\n');
export const pagesLines = pages => pages.flatMap(p => groupLines(p).map(r => r.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim()));
const f0 = x => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(x);
const f2 = x => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x);

export function aggBamb(rows) {
  const m = new Map();
  for (const t of rows) { const k = t.tid + '|' + t.kassor + (t.refund ? '|R' : ''); const x = m.get(k) || { tid: t.tid, kassor: t.kassor, belopp: 0, dricks: 0, ...(t.refund ? { refund: true } : {}) }; x.belopp += t.belopp; x.dricks += t.dricks; m.set(k, x); }
  return [...m.values()].map(x => ({ ...x, belopp: r2(x.belopp), dricks: r2(x.dricks) }));
}

/** Kontonamn från tidigare månader (CSV-filen har bara kontonummer). */
export function kontoNamn(months = {}) {
  const m = {};
  for (const k of Object.keys(months).sort()) for (const x of (months[k].summary?.kund || [])) if (x.namn && !/^Konto \d+$/.test(x.namn)) m[String(x.nr)] = x.namn;
  return m;
}

/**
 * Känner igen en fil som har lästs in (se filetypes/read.js) och tolkar den.
 * Ordningen följer handleFile i prototypen exakt.
 * @param {{name:string, kind:'pdf'|'sheet'|'text', pages?:any[], sheets?:Record<string,any[]>, csvRows?:any[], header?:string, text?:string}} f
 * @param {{months?:object, forced?:string}} ctx
 */
export function recognize(f, ctx = {}) {
  const forced = ctx.forced || null;
  if (f.kind === 'pdf') {
    const pages = f.pages;
    const txt = pagesText(pages.slice(0, 2));
    if (/Kontotransaktioner/i.test(txt) && /Kontohavare|Bokföringsdag/i.test(txt)) return { type: 'bank', rows: parseBankText(pagesText(pages)) };
    if (forced === 'visma' && !/Fakturanummer/.test(txt)) return { type: 'error', message: `${f.name} ser inte ut som Vismas fakturautskrift (Utskrifter, Faktura, Skickade fakturor). Inget ändrades.` };
    if (/Körnings-id/.test(txt) && /Totalsum/.test(txt)) return { type: 'error', message: `${f.name} är listan Deb kunder utskriven som PDF (utan kontonamn och fakturabelopp). Använd fakturorna från TaxiCaller ("Konto #... Fakturanummer") eller listan sparad som CSV.` };
    if (/Fakturanummer/.test(txt) && /Artnr/.test(txt) && /Faktura - Kopia|SJÄLVFAKTURA|Fakturaadress/.test(pagesText(pages))) return { type: 'visma', fakturor: parseVismaFakturor(pages) };
    const rk = parseReskontra(pages);
    if (rk) return { type: 'resk', reskontra: rk, period: rk.datum ? rk.datum.slice(0, 7) : null };
    const ore = parseOresund(pages);
    if (ore) return { type: 'bro', oresund: ore, period: oresundPeriod(ore), lines: pagesLines(pages), incomplete: incompletePdf(pages) };
    if (/Konto #\d+/.test(txt)) { const tc = parseTaxiCaller(pages); return { type: 'tc', tc, period: tc.period }; }
    const st = parseSturup(pages);
    if (st) return { type: 'sturup', sturup: st, period: st.period, lines: pagesLines(pages) };
    if (forced === 'sturup') return { type: 'passager', text: pagesText(pages) };
    return { type: 'unknown', hint: 'PDF med ' + pages.length + (pages.length === 1 ? ' sida' : ' sidor') };
  }
  if (f.kind === 'sheet') {
    if (f.sheets && f.sheets.Sales) {
      const bamb = parseBambora(f.sheets.Sales);
      const bp = String(bamb[0]?.datum || '').slice(0, 7);
      return { type: 'bamb', bamb, period: /^\d{4}-\d\d$/.test(bp) ? bp : null };
    }
    if (f.bankRows) { const rows = parseBankRows(f.bankRows); if (rows.length && looksLikeBank(f.bankRows)) return { type: 'bank', rows }; }
    if (forced === 'sturup') return { type: 'passager', text: f.csvText || '' };
    return { type: 'unknown', hint: sheetHint(f) };
  }
  // text (CSV/TXT)
  const h0 = String(f.header ?? String(f.text || '').split('\n')[0]);
  if (/konto Nr/i.test(h0) && /Totalsumma/i.test(h0)) {
    const tc = parseTcCsv(f.csvRows || [], kontoNamn(ctx.months));
    if (!tc.trips.length) return { type: 'error', message: `${f.name} har inga körningar.` };
    return { type: 'tc', tc, period: tc.period };
  }
  if (/Vehicle number/i.test(h0)) {
    const app = parseApp(f.csvRows || []);
    if (!app.app.length) return { type: 'error', message: `${f.name} har inga appbetalningar (Payment = app). Fel fil? Välj appbetalningarna från TaxiCaller.` };
    const ap = String(app.app[0]?.datum || '').slice(0, 7);
    return { type: 'app', app, period: /^\d{4}-\d\d$/.test(ap) ? ap : null };
  }
  if (f.bankRows) { const rows = parseBankRows(f.bankRows); if (rows.length && looksLikeBank(f.bankRows)) return { type: 'bank', rows }; }
  if (forced === 'sturup') return { type: 'passager', text: f.text || '' };
  return { type: 'unknown', hint: sheetHint(f) };
}

function looksLikeBank(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const h = (rows[i] || []).map(x => String(x ?? '').toLowerCase());
    if (h.some(x => /(transaktions|bokförings|reskontra|valuta)?dat|bokföringsdag/.test(x)) && h.some(x => /^belopp|belopp$|amount/.test(x))) return true;
  }
  return false;
}
function sheetHint(f) {
  const rows = f.bankRows || [];
  const cols = rows.length ? Math.max(...rows.slice(0, 5).map(r => (r || []).length)) : 0;
  return (f.kind === 'sheet' ? 'en Excel' : 'en textfil') + (cols ? ` med ${cols} kolumner` : '');
}
function incompletePdf(pages) {
  const t = pagesText(pages);
  const m = [...t.matchAll(/Sida\s+(\d+)\s*(?:av|\/)\s*(\d+)/gi)];
  if (!m.length) return null;
  const total = Math.max(...m.map(x => +x[2])); const seen = new Set(m.map(x => +x[1]));
  const missing = []; for (let i = 1; i <= total; i++) if (!seen.has(i)) missing.push(i);
  return missing.length ? { total, missing } : null;
}
export function oresundPeriod(o) {
  if (o.fakturadatum) { const [y, mo] = o.fakturadatum.split('-').map(Number); return new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7); }
  if (o.manader?.length) return o.manader[o.manader.length - 1];
  return null;
}
export function vismaPeriod(F, S) {
  const A = (F || []).filter(f => /^9119/.test(String(f.kn)) || S.bolag.some(b => String(b.kn) === String(f.kn)));
  const ds = A.map(f => f.datum).filter(Boolean).sort(), fd = ds[Math.floor(ds.length / 2)] || null;
  return { A, fd, period: fd ? ymAdd(fd.slice(0, 7), -1) : null };
}

/**
 * Lägger in en igenkänd fil i månaden. Returnerar { D, summary, paramsChange?, error? }.
 * D muteras inte, en kopia returneras.
 */
export function applyFile(D0, S, rec, name) {
  const D = { ...D0, src: { ...(D0.src || {}) }, files: { ...(D0.files || {}) } };
  switch (rec.type) {
    case 'tc': {
      const tc = rec.tc;
      D.tc = tc; D.files.tc = name;
      D.src.tc = tc.csv ? { period: tc.period, fakt: {}, n: tc.trips.length, csv: true } : { period: tc.period, fakt: tc.fakt, n: tc.trips.length };
      const summary = tc.csv
        ? `${tc.trips.length} körningar, ${new Set(tc.trips.map(t => t.konto.nr)).size} konton, ${f0(tc.trips.reduce((a, t) => a + t.belopp, 0))} kr`
        : `${tc.trips.length} körningar, ${Object.keys(tc.fakt).length} konton`;
      return { D, slot: 'tc', summary };
    }
    case 'bamb': {
      const bamb = rec.bamb;
      D.bamb = bamb; D.files.bamb = name;
      const rf = bamb.filter(t => t.refund), nk = bamb.length - rf.length, rtot = rf.reduce((a, t) => a + t.belopp, 0);
      const tot = bamb.reduce((a, t) => a + (t.refund ? -t.belopp : t.belopp), 0);
      D.src.bamb = { agg: aggBamb(bamb), n: nk, nRefund: rf.length, refund: r2(rtot), tot: r2(tot) };
      return { D, slot: 'bamb', summary: `${nk} köp` + (rf.length ? `, ${rf.length} återbetalningar ${f0(rtot)} kr` : '') + `, netto ${f0(tot)} kr` };
    }
    case 'app': {
      const app = rec.app;
      D.app = app; D.appRad = app.app; D.files.app = name;
      const atot = app.app.reduce((a, x) => a + x.belopp, 0), per = {};
      for (const a of app.app) per[a.bil] = (per[a.bil] || 0) + a.belopp;
      D.src.app = { app: Object.entries(per).map(([b, v]) => ({ bil: +b, belopp: r2(v) })), ejApp: app.ejApp.map(e => ({ bil: e.bil, belopp: e.belopp, datum: e.datum || '' })), n: app.app.length, tot: r2(atot) };
      return { D, slot: 'app', summary: `${app.app.length} appbetalningar, ${f0(atot)} kr` };
    }
    case 'bro': {
      const o = rec.oresund;
      const b = mapRegCounts(o.bro, o.tag, S.bilar), c = mapRegCounts(o.cph, o.tag, S.bilar);
      D.bro = b.ut; D.cph = c.ut; D.broRad = mapRegPrices(o.broPris, o.tag, S.bilar);
      const pc = {}; for (const pp of Object.values(o.broPris || {})) for (const [p, n] of Object.entries(pp)) pc[p] = (pc[p] || 0) + n;
      const dom = Object.entries(pc).sort((x, y) => y[1] - x[1])[0];
      let prisAndring = null;
      if (dom && Math.abs(+dom[0] - S.params.bro) > 0.004) prisAndring = { fran: S.params.bro, till: +dom[0] };
      const nb = Object.values(o.bro).reduce((a, x) => a + x, 0), nc = Object.values(o.cph).reduce((a, x) => a + x, 0);
      D.oresund = { fil: name, fakturadatum: o.fakturadatum, manader: o.manader, kostBro: o.kostBro, kostCph: o.kostCph, nBro: nb, nCph: nc, okandaBro: b.okanda, okandaCph: c.okanda, ovriga: o.ovriga, priser: pc, prisAndring };
      D.files.bro = name;
      const ok = Object.keys(b.okanda).length + Object.keys(c.okanda).length;
      return { D, slot: 'bro', summary: `${nb} bropassager, ${nc} CPH-hämtningar` + (ok ? `, ${ok} okända reg nr` : ''), paramsChange: prisAndring ? { bro: prisAndring.till } : null };
    }
    case 'sturup': {
      const st = rec.sturup;
      if (!st || !st.antal) return { D: D0, error: `Hittade inga Sturup-passager i ${name}. Inget ändrades.` };
      const m = mapSturup(st, S.bilar, S.params.m25);
      D.sturupRad = m.rad; D.sturup = {};
      D.sturupInfo = { fil: name, period: st.period, antal: st.antal, total: st.total, okanda: m.okanda, avvik: m.avvik };
      D.files.sturup = name;
      return { D, slot: 'sturup', summary: `${st.antal} passager, ${f2(st.total)} kr inkl moms` + (m.okanda.length ? `, ${m.okanda.length} okända bilar` : '') };
    }
    case 'passager': {
      const { cnt, okanda } = countPassages(rec.text, S.bilar);
      const n = Object.values(cnt).reduce((a, b) => a + b, 0);
      if (!n) return { D: D0, error: `Hittade inga kända reg nr i ${name}. Skriv in antal under Per bil.` };
      D.sturup = cnt;
      const ok = Object.keys(okanda).length;
      if (ok) D._okandaReg = { ...(D._okandaReg || {}), Sturup: okanda };
      return { D, slot: 'sturup', summary: `Sturup: ${n} passager på ${Object.keys(cnt).length} bilar` + (ok ? `, ${ok} okända reg nr` : '') };
    }
    case 'resk': {
      const rk = rec.reskontra;
      D.reskontra = { fil: name, datum: rk.datum, poster: rk.poster };
      D.files.resk = name;
      const s = rk.poster.filter(p => p.kn.startsWith('9119')).reduce((a, p) => a + p.saldo, 0);
      return { D, slot: 'resk', summary: `${rk.poster.length} öppna fakturor per ${rk.datum}, åkare netto ${f0(s)} kr` };
    }
    case 'visma': {
      const { A, fd } = vismaPeriod(rec.fakturor, S);
      if (!A.length) return { D: D0, error: `Hittade inga åkaravräkningar i ${name}. Inget ändrades.` };
      const momsFor = r => r.art == null ? (/^F\d{5}/.test(r.text) ? 0 : 25) : ([50, 592].includes(r.art) ? 6 : ([52, 54, 55, 56, 59, 594, 500].includes(r.art) ? 0 : 25));
      D.visma = { fil: name, datum: fd, inlast: new Date().toISOString(), bolag: A.map(f => ({ namn: f.namn, kn: f.kn, nr: f.nr, att: f.att, rows: f.rows.map(r => ({ ...r, moms: momsFor(r) })) })) };
      D.files.visma = name;
      const sum = A.reduce((a, f) => a + (f.att || 0), 0);
      return { D, slot: 'visma', summary: `${A.length} avräkningar ${A.map(f => f.nr).sort()[0]} till ${A.map(f => f.nr).sort().pop()}, netto ${f0(sum)} kr` };
    }
    default:
      return { D: D0, error: rec.message || `Känner inte igen ${name}. Inget ändrades.` };
  }
}

/** Period som en igenkänd fil gäller, för att fånga "fil för fel månad". */
export function periodOf(rec, S) {
  if (rec.type === 'visma') return vismaPeriod(rec.fakturor, S).period;
  return rec.period || null;
}

/** Förra månadens summering används för efterdebitering (samma regel som recompute i prototypen). */
export function prevSummaryFor(period, months) {
  if (!period) return null;
  const [y, mo] = period.split('-').map(Number); const pp = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
  return months?.[pp]?.visma?.bolag ? months[pp].visma : (months?.[pp]?.summary || null);
}

/** Räkna månaden. Samma villkor som recompute: minst en av TaxiCaller, Bambora eller app. */
export function computeMonth(S, D, months) {
  const have = D.tc || D.bamb || D.app;
  if (!have || !S.bolag.length) return null;
  const DD = { ...D, prevSummary: prevSummaryFor(D.period, months) };
  return compute(S, DD);
}

/** Det som sparas på månaden (months/<period> i prototypen). */
export function monthBody(D) {
  return { skuldMed: !!D.skuldMed, bro: D.bro, sturup: D.sturup, cph: D.cph, manuellt: D.manuellt, oresund: D.oresund || null, reskontra: D.reskontra || null, broRad: D.broRad || null, sturupRad: D.sturupRad || null, sturupInfo: D.sturupInfo || null, forskottRad: D.forskottRad || null, src: D.src || null, visma: D.visma || null };
}
export function monthSummary(R) {
  if (!R) return null;
  return { kpi: R.kpi, bolag: R.bolag.filter(b => b.aktiv).map(b => ({ namn: b.namn, kn: b.kn, att: b.att, kort: b.kort, deb: b.deb, app: b.app, forsk: b.forsk, skuld: b.skuld, manad: b.manad, bilar: b.bilar, rows: b.rows, netto: b.netto, moms25: b.moms25, moms6: b.moms6, oresavr: b.oresavr })),
    kund: R.kund.map(k => ({ nr: k.nr, namn: k.namn, n: k.n, r592: k.r592, r593: k.r593, r594: k.r594, total: k.total, taxicaller: k.taxicaller, diff: k.diff })), kontroll: R.kontroll };
}

/** Återställer en sparad månad (applyMonth i prototypen) så att den kan räknas om utan originalfilerna. */
export function restoreMonth(period, m, spec) {
  const D = emptyMonth(period);
  if (!m) return D;
  for (const k of ['bro', 'sturup', 'cph']) D[k] = { ...(m[k] || {}) };
  D.manuellt = clone(m.manuellt || {});
  if (m.visma) D.visma = clone(m.visma);
  if (m.oresund) D.oresund = clone(m.oresund);
  if (m.sturupRad) { D.sturupRad = clone(m.sturupRad); D.sturupInfo = clone(m.sturupInfo); }
  if (m.broRad) D.broRad = clone(m.broRad);
  if (m.reskontra) D.reskontra = clone(m.reskontra);
  D.skuldMed = !!m.skuldMed;
  if (m.forskottRad) D.forskottRad = clone(m.forskottRad);
  D.files = { ...(m.files || {}) };
  const src = m.src || {};
  D.src = clone(src) || {};
  if (src.bamb?.agg) D.bamb = clone(src.bamb.agg);
  if (src.app?.app) D.app = { app: clone(src.app.app), ejApp: clone(src.app.ejApp || []) };
  if (src.tc && spec) {
    const namn = Object.fromEntries((m.summary?.kund || []).map(k => [String(k.nr), k.namn]));
    const typ = { p: 'person', b: 'bud', u: 'utland' }, trips = [];
    for (const [nr, L] of Object.entries(spec.kund || {})) for (const x of L) trips.push({ konto: { nr: /^\d+$/.test(nr) ? +nr : nr, namn: namn[nr] || '' }, bil: x.b, belopp: x.s, pass: x.p || '', rutt: x.r || '', datum: x.d, tid: x.t, forare: x.f || '', typ: typ[x.y] || 'person' });
    D.tc = { period, fakt: clone(src.tc.fakt || {}), trips, restored: true };
  }
  return D;
}

/** spec/<period>: körningar per konto utan förare. */
export function packSpec(R) {
  return { kund: Object.fromEntries(R.kund.map(k => [String(k.nr), (k.korn || []).map(({ f, ...t }) => t)])) };
}
// Förare per körning sparas separat. Format {namn: [förare], k: {konto: [index i namn, -1 = saknas]}}
export function packForare(kund) {
  const namn = [], ix = new Map(), k = {};
  for (const x of kund) k[String(x.nr)] = (x.korn || []).map(t => { const f = String(t.f || '').trim(); if (!f) return -1; if (!ix.has(f)) { ix.set(f, namn.length); namn.push(f); } return ix.get(f); });
  return { namn, k };
}
export function applyForare(kundMap, F) { if (!F) return; for (const [nr, L] of Object.entries(kundMap || {})) { const a = F.k?.[nr]; if (!a || a.length !== L.length) continue; L.forEach((t, i) => { if (a[i] >= 0) t.f = F.namn[a[i]]; }); } }
export const kortAdr = s => String(s || '').replace(/\u060c/g, ',').replace(/,\s*(Sverige|Danmark|Sweden|Denmark)\b/g, '').replace(/\s+/g, ' ').trim();
export function splitRutt(r) { const m = String(r || '').match(/från:\s*(.*?)\s*till:\s*(.*)$/i); return m ? [kortAdr(m[1]), kortAdr(m[2])] : [kortAdr(String(r || '').replace(/^\s*från:\s*/i, '')), '']; }
export function packApp(rows) {
  const f = [], ix = new Map();
  const r = rows.map(a => { const fn = String(a.forare || '').trim(); let i = -1; if (fn) { if (!ix.has(fn)) { ix.set(fn, f.length); f.push(fn); } i = ix.get(fn); }
    const x = [String(a.id || ''), +a.bil, String(a.datum || ''), r2(+a.belopp || 0), i]; if (a.fran || a.till) x.push(kortAdr(a.fran), kortAdr(a.till)); return x; });
  return { f, r };
}
export const unpackApp = A => (A?.r || []).map(x => ({ id: x[0], bil: +x[1], d: String(x[2] || '').slice(0, 10), t: String(x[2] || '').slice(11, 16), s: +x[3] || 0, f: x[4] >= 0 ? A.f[x[4]] : '', fran: x[5] || '', till: x[6] || '' }));

/**
 * Specifikation per åkare (specFor i prototypen) för en räknad månad.
 * kund: [{nr, namn, korn}] med förare, appRows: unpackApp-format.
 */
export function buildSpec(S, kund, appRows, bil2b) {
  const reg = new Map(S.bilar.map(b => [+b.bil, b.reg || ''])), avr = new Map(S.bilar.map(b => [+b.bil, (b.avr || b.bolag || '').trim()]));
  const out = new Map();
  const getO = bil => { const n = bil2b.get(+bil) || avr.get(+bil) || '(bil saknas i bilregistret)'; if (n === 'IGNORERA') return null;
    if (!out.has(n)) { const B = S.bolag.find(x => x.namn === n) || {}; out.set(n, { namn: n, kn: B.kn ?? '', mail: B.mail || '', bilar: new Map(), forare: new Map(), n: 0, sum: 0, app: new Map(), appF: new Map(), an: 0, asum: 0 }); }
    return out.get(n); };
  for (const k of kund) for (const t of k.korn) {
    const o = getO(t.b); if (!o) continue; if (!o.bilar.has(+t.b)) o.bilar.set(+t.b, { bil: +t.b, reg: reg.get(+t.b) || '', trips: [], sum: 0, typ: { p: 0, b: 0, u: 0 } });
    const bb = o.bilar.get(+t.b), [fran, till] = splitRutt(t.r);
    const trip = { d: t.d || '', t: t.t || '', kund: k.namn || '', konto: k.nr, fran, till, y: t.y, s: +t.s || 0, bil: +t.b, f: String(t.f || '').trim() || 'Förare saknas' };
    bb.trips.push(trip);
    if (!o.forare.has(trip.f)) o.forare.set(trip.f, { namn: trip.f, bilar: new Set(), trips: [], sum: 0, typ: { p: 0, b: 0, u: 0 } });
    const ff = o.forare.get(trip.f); ff.bilar.add(+t.b); ff.trips.push(trip); ff.sum += trip.s; ff.typ[t.y] = (ff.typ[t.y] || 0) + trip.s;
    bb.sum += +t.s || 0; bb.typ[t.y] = (bb.typ[t.y] || 0) + (+t.s || 0); o.n++; o.sum += +t.s || 0;
  }
  const debNamn = new Set(kund.flatMap(k => k.korn.map(t => String(t.f || '').trim())).filter(Boolean));
  const vand = n => n.includes(',') ? n.split(',').slice(1).join(',').trim() + ', ' + n.split(',')[0].trim() : n;
  for (const a of appRows) if (a.f && !debNamn.has(a.f)) a.f = vand(a.f);
  for (const a of appRows) {
    const o = getO(a.bil); if (!o) continue;
    if (!o.app.has(a.bil)) o.app.set(a.bil, { bil: a.bil, reg: reg.get(a.bil) || '', rows: [], sum: 0 });
    const x = o.app.get(a.bil); x.rows.push(a); x.sum += a.s; o.an++; o.asum += a.s;
    const fk = a.f || 'Förare saknas'; if (!o.appF.has(fk)) o.appF.set(fk, { namn: fk, bilar: new Set(), rows: [], sum: 0 });
    const y = o.appF.get(fk); y.bilar.add(a.bil); y.rows.push(a); y.sum += a.s;
  }
  const byDT = (x, y) => (x.d + x.t).localeCompare(y.d + y.t), fSort = (a, b) => (a.namn === 'Förare saknas') - (b.namn === 'Förare saknas') || a.namn.localeCompare(b.namn, 'sv');
  const bolag = [...out.values()].map(o => ({ ...o, sum: r2(o.sum), asum: r2(o.asum),
      bilar: [...o.bilar.values()].sort((a, b) => a.bil - b.bil).map(b => ({ ...b, sum: r2(b.sum), trips: b.trips.sort(byDT) })),
      forare: [...o.forare.values()].map(f => ({ ...f, sum: r2(f.sum), bilar: [...f.bilar].sort((a, b) => a - b), trips: f.trips.sort(byDT) })).sort(fSort),
      app: [...o.app.values()].sort((a, b) => a.bil - b.bil).map(x => ({ ...x, sum: r2(x.sum), rows: x.rows.sort(byDT) })),
      appF: [...o.appF.values()].map(f => ({ ...f, sum: r2(f.sum), bilar: [...f.bilar].sort((a, b) => a - b), rows: f.rows.sort(byDT) })).sort(fSort),
      appHarF: appRows.some(a => a.f), appHarAdr: appRows.some(a => a.fran || a.till) }))
    .sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
  return { bolag, appN: appRows.length };
}

// ---------- Förskott från kontoutdrag ----------
export function defaultRange(p) { const [y, m] = p.split('-').map(Number); const n = new Date(Date.UTC(y, m, 0)); return [p + '-01', n.toISOString().slice(0, 10)]; }
export const fKey = r => r.datum + '|' + String(r.text).trim().toUpperCase() + '|' + Math.abs(r.belopp);
export function otherMonthKeys(months, period) { const m = {}; for (const [p, d] of Object.entries(months || {})) if (p !== period) for (const f of (d.forskottRad || [])) if (f.med) m[fKey(f)] = p; return m; }
/** Förslag på förskott (readBank i prototypen). */
export function suggestForskott(rows, S, D, fMap) {
  const names = S.bolag.map(b => b.namn);
  const prev = new Set((D.forskottRad || []).filter(x => x.med).map(x => x.datum + '|' + x.text + '|' + x.belopp));
  return rows.map((r, i) => { const g = guessBolag(r.text, names, fMap); return { ...r, i, bolag: g.bolag, kalla: g.kalla, med: prev.size ? prev.has(r.datum + '|' + r.text + '|' + Math.abs(r.belopp)) : (r.belopp < 0 && !!g.bolag && (g.kalla === 'sparad' || /f(ö|o)rs(k|\b)/i.test(r.text))) }; });
}
/** Spara valda förskott (saveForsk i prototypen). Returnerar forskottRad och uppdaterad koppling text till bolag. */
export function saveForskott(rows, from, to, fMap) {
  const sel = rows.filter(r => r.med && !r.annan && r.bolag && r.datum >= from && r.datum <= to);
  const forskottRad = sel.map(r => ({ datum: r.datum, text: r.text, belopp: Math.abs(r.belopp), bolag: r.bolag, med: true }));
  const nm = { ...(fMap || {}) }; for (const r of rows) if (r.bolag && r.med) nm[String(r.text).toUpperCase().replace(/\s+/g, ' ').trim()] = r.bolag;
  return { forskottRad, fMap: nm };
}

// ---------- Inställningar ----------
export function normRows(key, rows) {
  const n = x => x === '' || x == null ? null : (isNaN(+x) ? x : +x);
  if (key === 'bolag') return rows.filter(r => r.namn).map(r => ({ namn: String(r.namn).trim(), kn: n(r.kn), mail: String(r.mail || '').trim(), vx: +r.vx || 0, tl: +r.tl || 0, vxInn: +r.vxInn ? 1 : 0, vxRab: Math.min(100, Math.max(0, +String(r.vxRab ?? '').replace(',', '.') || 0)), gratisTom: /^alltid$/i.test(String(r.gratisTom || '').trim()) ? 'alltid' : (/^\d{4}-\d\d$/.test(String(r.gratisTom || '').trim()) ? String(r.gratisTom).trim() : ''), fsFrom: /^\d{4}-\d\d$/.test(String(r.fsFrom || '').trim()) ? String(r.fsFrom).trim() : '', kommentar: r.kommentar || '', ...(r.orgnr ? { orgnr: String(r.orgnr) } : {}) }));
  if (key === 'bilar') return rows.filter(r => r.bil !== '' && r.bil != null).map(r => ({ bil: +r.bil, reg: String(r.reg || '').trim().toUpperCase(), bolag: String(r.bolag || '').trim(), avr: String(r.avr || r.bolag || '').trim(), kommentar: r.kommentar || '' })).sort((a, b) => a.bil - b.bil);
  if (key === 'terminaler') return rows.filter(r => r.id).map(r => ({ id: String(r.id).trim(), bil: n(r.bil), kommentar: r.kommentar || '' }));
  if (key === 'kassor') return rows.filter(r => r.kassor !== '' && r.kassor != null).map(r => ({ kassor: +r.kassor, bil: n(r.bil), kommentar: r.kommentar || '' }));
  return rows;
}
/** Läs bilregistret (importReg). rows: arrayer från första fliken. */
export function importBilregister(bilar, rows) {
  const out = clone(bilar) || []; const canon = {}; let upd = 0, ny = 0;
  for (const r of rows) {
    if (!r[0] || !/^\d+$/.test(String(r[0]).trim()) || !r[5]) continue;
    const b = +String(r[0]).trim(), reg = String(r[1] || '').trim().toUpperCase(); let bol = String(r[5]).trim(); bol = canon[bol.toLowerCase()] ||= bol;
    const ex = out.find(x => +x.bil === b);
    if (ex) { if (ex.reg !== reg || ex.bolag !== bol) { ex.reg = reg; ex.bolag = bol; upd++; } }
    else { out.push({ bil: b, reg, bolag: bol, avr: bol, kommentar: r[6] ? String(r[6]) : 'Ny från bilregistret' }); ny++; }
  }
  return { bilar: out, ny, upd };
}

// ---------- Excel (samma flikar som exportExcel) ----------
const TYP = { p: 'Person', b: 'Bud', u: 'Utland' };
const NOT = [[/vidarefakturerat mot kostnad/i, 'Vidarefakturerat till åkarna mot leverantörsfakturan (belopp = differens, ska vara nära 0).'],
  [/Dricks krediteras/i, 'Krediteras åkarna per bil på art 56 Dricks bil X, 0 % moms. Åkeriet betalar ut dricksen till föraren som lön.'],
  [/Växelavgift efterdebiteras/i, 'Två rader art 1 på avräkningen: efterdebiterad månad och ordinarie månad.'],
  [/Öresundsbron: nytt pris/i, 'Åkarna debiteras fakturans pris per passage.'],
  [/Återbetalning kort/i, 'Refund i Bambora dras från åkaren på art 52 Återbetalning kort bil X, 0 % moms.']];
/** Flikar som arrayer av rader. Skrivs till xlsx av filetypes/write.js. */
export function excelSheets(R, forskottRad) {
  const { bolag, kund, perBil, kontroll } = { bolag: R.bolag.filter(b => b.aktiv), kund: R.kund, perBil: R.perBil, kontroll: R.kontroll };
  const S = [];
  const A = (n, rows, w) => S.push({ name: n, rows, cols: w });
  A('Åkaravräkning', [['Bolag', 'Kundnr', 'Bilar', 'Kontokort', 'Deb inkl moms', 'App', 'Förskott', 'Netto', 'Moms 25 %', 'Moms 6 %', 'Att betala'],
    ...bolag.map(b => [b.namn, b.kn, (b.bilar || []).join(', '), b.kort, b.deb, b.app, b.forsk || 0, b.netto, b.moms25, b.moms6, b.att])], [32, 10, 18, 12, 12, 12, 12, 13, 11, 11, 12]);
  A('Fakturarader', [['Kundnr', 'Bolag', 'Artnr', 'Benämning', 'Antal', 'À-pris', 'Rabatt %', 'Summa', 'Moms %'], ...bolag.flatMap(b => (b.rows || []).map(r => [b.kn, b.namn, r.art ?? '', r.text, r.antal, r.apris, r.rabattPct || '', r.summa, r.moms]))], [10, 32, 7, 36, 7, 11, 8, 12, 7]);
  A('Kundfakturor', [['Konto', 'Namn', 'Körningar', '592 exkl moms', '593 bud exkl moms', '594 utland', 'Totalt inkl moms', 'TaxiCaller', 'Diff'], ...kund.map(k => [k.nr, k.namn, k.n, k.r592, k.r593, k.r594, k.total, k.taxicaller, k.diff])], [8, 34, 9, 13, 13, 11, 13, 12, 8]);
  A('Specifikation', [['Konto', 'Kund', 'Datum', 'Tid', 'Passagerare', 'Rutt', 'Bil', 'Typ', 'Belopp inkl moms'], ...kund.flatMap(k => (k.korn || []).map(t => [k.nr, k.namn, t.d, t.t, t.p, t.r, t.b, TYP[t.y] || '', t.s]))], [8, 30, 11, 6, 26, 60, 6, 8, 12]);
  if (perBil) A('Per bil', [['Bil', 'Reg nr', 'Avräknas på', 'Kontokort', 'Dricks', 'Deb person', 'Deb bud', 'Deb utland', 'App', 'Bro', 'Sturup', 'CPH'], ...perBil.map(x => [x.bil, x.reg, x.bolag, x.kort, x.dricks, x.person, x.bud, x.utland, x.app, x.bro, x.sturup, x.cph])], [6, 9, 30, 11, 8, 11, 10, 10, 10, 5, 7, 5]);
  const fr = forskottRad || [];
  if (fr.length) A('Förskott', [['Datum', 'Text i banken', 'Bolag', 'Belopp'], ...fr.filter(f => f.med !== false).map(f => [f.datum, f.text, f.bolag, f.belopp])], [11, 40, 32, 12]);
  const noter = kontroll.map(k => { const m = NOT.find(([re]) => re.test(k.typ)); return m ? [k.typ, k.vad, k.belopp, m[1]] : null; }).filter(Boolean);
  A('Noteringar', [['Typ', 'Vad', 'Belopp', 'Kommentar'], ...noter], [40, 60, 12, 70]);
  return S;
}

export { monthLabels, ymAdd };
