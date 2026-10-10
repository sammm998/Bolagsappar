// Motor för Verkstad (folierings- och skadeverkstad). Flyttad från legacy/apps/foliering/index.html.
// Koden är oförändrad men ligger i en fabrik som får tillståndet S (Map per samling) och dagens datum.
// Prislistan DEF_PRISER, fakturanumreringen, momsflödet (momsfaktura till fordonsägaren först när
// försäkringsbolaget har betalat), påminnelsereglerna och SIE-exporten finns här.
/* eslint-disable */

/**
 * @param {{ S: {arenden: Map, fordon: Map, forsakring: Map, kostnader: Map, bokforing: Map, lonespec: Map, inst: object}, today?: () => string }} ctx
 */
export function createVerkstad(ctx) {
  const S = ctx.S;
/* ============ Grundfunktioner ============ */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = x => Math.round((+x + Number.EPSILON) * 100) / 100;
function fmt(n, dec) {
  n = +n || 0; const neg = n < 0; n = Math.abs(n);
  const showDec = dec === true || (dec !== false && Math.round(n * 100) % 100 !== 0);
  let [i, d] = n.toFixed(2).split('.'); i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (neg ? '-' : '') + i + (showDec ? ',' + d : '');
}
const kr = (n, dec) => fmt(n, dec) + ' kr';
const today = () => { if (ctx.today) return ctx.today(); const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
const sumRows = rows => r2((rows || []).reduce((a, r) => a + (+r.antal || 0) * (+r.apris || 0), 0));
const clone = o => JSON.parse(JSON.stringify(o));
const plateTxt = r => { const s = String(r || '').toUpperCase().replace(/\s/g, ''); return /^[A-Z]{3}\d{2}[A-Z0-9]$/.test(s) ? s.slice(0, 3) + ' ' + s.slice(3) : s; };
const plate = (r, lg) => r ? `<span class="plate${lg ? ' lg' : ''}"><i>S</i><span>${esc(plateTxt(r))}</span></span>` : '<span class="muted">Inget reg nr</span>';
const normReg = r => String(r || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/* ============ Standardvärden (används om databasen saknar inställningar) ============ */
const DEF_FORETAG = { namn: 'Demo Foliering AB', adress: 'Box 0000', postort: '211 00 Malmö', orgnr: '559000-0001', momsnr: 'SE559000000101', epost: 'info@example.se', bg: '0000-0000', underskrift: 'Förnamn Efternamn', titel: 'VD', villkorDagar: 10, giltighet: 30 };
const DEF_PRISER = [
  { id: 'sf-fram', kat: 'Stötfångare', text: 'Foliering stötfångare fram', vanlig: 4000, storre: 5500, mv: 2, ms: 2.4 },
  { id: 'sf-bak', kat: 'Stötfångare', text: 'Foliering stötfångare bak', vanlig: 3500, storre: 5000, mv: 1.8, ms: 2.2 },
  { id: 'dorr', kat: 'Dörrar', text: 'Foliering 1 dörr', textN: 'Foliering {n} dörrar', vanlig: 1500, storre: 2000, perSt: true, mv: 1, ms: 1.2 },
  { id: 'kapa-vf', kat: 'Kåpor och sidodetaljer', text: 'Foliering vänster sidokåpa fram', vanlig: 1000, storre: 1500, mv: 0.7, ms: 0.85 },
  { id: 'kapa-hb', kat: 'Kåpor och sidodetaljer', text: 'Foliering höger bakkåpa', vanlig: 1000, storre: 1500, mv: 0.7, ms: 0.85 },
  { id: 'kapa-sb', kat: 'Kåpor och sidodetaljer', text: 'Foliering sidokåpa bak', vanlig: 1000, storre: 1500, mv: 0.7, ms: 0.85 },
  { id: 'spegel', kat: 'Kåpor och sidodetaljer', text: 'Foliering backspegel', textN: 'Foliering {n} backspeglar', vanlig: 500, storre: 700, perSt: true, mv: 0.25, ms: 0.3 },
  { id: 'dek-2', kat: 'Dekaler', text: 'Dekalering, båda sidor', vanlig: 3000, storre: 3000, mv: 0, ms: 0 },
  { id: 'dek-1', kat: 'Dekaler', text: 'Dekalering, en sida', vanlig: 1500, storre: 1500, mv: 0, ms: 0 },
  { id: 'dek-h', kat: 'Dekaler', text: 'Dekalering, halv sida', vanlig: 750, storre: 750, mv: 0, ms: 0 },
  { id: 'dek-mh', kat: 'Dekaler', text: 'Dekalering motorhuv', vanlig: 750, storre: 750, mv: 0, ms: 0 },
  { id: 'motorhuv', kat: 'Övriga ytor', text: 'Foliering motorhuv', vanlig: 2500, storre: 3500, mv: 1.6, ms: 1.9 },
  { id: 'baklucka', kat: 'Övriga ytor', text: 'Foliering baklucka', vanlig: 2000, storre: 3000, mv: 1.4, ms: 1.7 },
  { id: 'hel', kat: 'Helfoliering', text: 'Helfoliering hel bil', vanlig: 25000, storre: 30000, mv: 16, ms: 19 }
];
const ST = {
  utkast: { t: 'Utkast', c: 'muted' }, skickad: { t: 'Offert skickad', c: 'info' }, godkand: { t: 'Godkänd', c: 'warn' },
  fakturerad: { t: 'Fakturerad', c: 'accent' }, betald: { t: 'Betald', c: 'good' }, avslag: { t: 'Avslag', c: 'bad' }
};
const STEG = ['utkast', 'skickad', 'godkand', 'fakturerad', 'betald'];
const pill = (t, c) => `<span class="pill p-${c}">${esc(t)}</span>`;
const stPill = s => pill(ST[s]?.t || s, ST[s]?.c || 'muted');

const foretag = () => ({ ...DEF_FORETAG, ...(S.inst.foretag || {}) });
const priser = () => (S.inst.priser?.items?.length ? S.inst.priser.items : DEF_PRISER);
const fors = id => S.forsakring.get(id) || { id, namn: id || 'Okänt bolag', epost: '', adress1: '', adress2: '', kontakt: '', kort: 'X' };
const forsList = () => [...S.forsakring.values()].sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
const arList = () => [...S.arenden.values()];
const belopp = a => a.faktura ? sumRows(a.faktura.rader) : sumRows(a.offert?.rader);
const aDatum = a => a.faktura?.datum || a.offert?.datum || a.skapad || '';
function fakStatus(f) { if (!f) return null; if (f.betald) return 'betald'; return f.forfall && f.forfall < today() ? 'forfallen' : 'obetald'; }
const FS = { betald: ['Betald', 'good'], forfallen: ['Förfallen', 'bad'], obetald: ['Ej betald', 'warn'], ejskickad: ['Ej skickad', 'muted'], vantar: ['Väntar på försäkringsbolaget', 'muted'] };
/* Rutin: momsfakturan skickas till fordonsägaren först när försäkringsbolaget har betalat. */
function momsStatus(a) { const m = a.moms; if (!m) return null; if (m.betald) return 'betald'; if (!m.skickad) return a.faktura?.betald ? 'ejskickad' : 'vantar'; return fakStatus(m); }
/* Rutin: påminnelse till försäkringsbolaget första bankdagen efter förfallodagen, sedan var 7:e dag tills betalt. */
const PAMINN_DAGAR = 7;
/* Rutin: offerter utan skriftligt godkännande påminns var 5:e dag. */
const OFFERT_DAGAR = 5;
const momsAttSkicka = () => arList().filter(a => a.faktura?.betald && !(a.moms && (a.moms.skickad || a.moms.betald))).sort((x, y) => (x.faktura.betaldDatum || '').localeCompare(y.faktura.betaldDatum || ''));
function momsEfterBetalning(a) {
  if (a.moms && (a.moms.skickad || a.moms.betald)) return false;
  const F = foretag(), t = today();
  if (!a.agare) { const v = agareInfo(a); if (v.agare) a.agare = v.agare; }
  if (!a.agare) { log(a, `Momsfaktura M-${a.faktura.nr} kan inte skapas: fordonsägare saknas`); return false; }
  a.moms = { nr: 'M-' + a.faktura.nr, datum: t, forfall: addDays(t, +F.villkorDagar || 10), till: a.agare, betald: false, betaldDatum: '', skickad: '' };
  log(a, `Momsfaktura ${a.moms.nr} klar att skicka till ${a.agare} (${kr(momsBelopp(a), true)}), daterad ${t}`);
  return true;
}
const fsPill = s => s ? pill(FS[s][0], FS[s][1]) : '';
function nastaFaktura() { let m = 0; for (const a of S.arenden.values()) if (a.faktura?.nr) m = Math.max(m, +a.faktura.nr); return Math.max(m + 1, +(S.inst.serie?.nasta || 0), 1001); }
const momsBelopp = a => r2(belopp(a) * 0.25);
const agareInfo = a => S.fordon.get(normReg(a.reg)) || {};

/* ============ Databas ============ */
function log(a, t) { (a.logg = a.logg || []).push({ d: today(), t }); }
function openItems() {
  const o = [];
  for (const a of S.arenden.values()) {
    if (a.faktura && !a.faktura.betald) o.push({ a, typ: 'f', nr: String(a.faktura.nr), belopp: belopp(a), fs: a.forsakring });
    if (a.moms && a.moms.skickad && !a.moms.betald) o.push({ a, typ: 'm', nr: a.moms.nr, belopp: momsBelopp(a), fs: 'agare:' + a.agare });
  }
  return o;
}
function paidMatch(tx) {
  const P = []; for (const a of S.arenden.values()) if (a.faktura?.betald) P.push({ nr: String(a.faktura.nr), belopp: belopp(a), fs: a.forsakring, d: a.faktura.datum });
  const one = P.find(x => Math.abs(x.belopp - tx.belopp) < 0.01 && x.d <= tx.datum); if (one) return [one];
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (P[i].fs === P[j].fs && P[i].d <= tx.datum && P[j].d <= tx.datum && Math.abs(P[i].belopp + P[j].belopp - tx.belopp) < 0.01) return [P[i], P[j]];
  return [];
}
function matchTx(tx, used) {
  const O = openItems().filter(x => !used.has(x.typ + x.nr) && (x.typ === 'f' ? x.a.faktura.datum : x.a.moms.datum) <= tx.datum);
  const hit = O.filter(x => Math.abs(x.belopp - tx.belopp) < 0.01);
  const T = normReg(tx.text), skn = x => normReg(x.a.skadenr);
  const bySk = O.filter(x => x.typ === 'f' && skn(x).length >= 6 && T.includes(skn(x)));
  if (bySk.length) return [bySk];
  const byNr = hit.find(x => tx.text.includes(x.nr.replace('M-', '')));
  if (byNr) return [[byNr]];
  const out = hit.map(x => [x]);
  const groups = {}; O.forEach(x => (groups[x.fs] = groups[x.fs] || []).push(x));
  for (const G of Object.values(groups)) {
    const n = Math.min(G.length, 14);
    for (let mask = 1; mask < (1 << n); mask++) {
      if ((mask & (mask - 1)) === 0) continue;
      let s = 0, pick = []; for (let i = 0; i < n; i++) if (mask & (1 << i)) { s += G[i].belopp; pick.push(G[i]); }
      if (pick.length <= 5 && Math.abs(s - tx.belopp) < 0.01) out.push(pick);
    }
  }
  const age = p => p.reduce((m, x) => { const d = x.typ === 'f' ? x.a.faktura.datum : x.a.moms.datum; return d < m ? d : m; }, '9999');
  return out.sort((p, q) => age(p).localeCompare(age(q)) || p.length - q.length).slice(0, 6);
}
const skNorm = s => String(s || '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
function bgSpecKey(sp) { return 'bg|' + sp.datum + '|' + sp.belopp + '|' + sp.poster.map(p => p.ref).join(','); }
function matchPost(p) {
  const L = arList().filter(a => a.faktura);
  const byNr = L.find(a => String(a.faktura.nr) === String(p.ref).replace(/\D/g, ''));
  const bySk = p.skadenr ? L.find(a => skNorm(a.skadenr) === skNorm(p.skadenr)) : null;
  const a = byNr || bySk; if (!a) return { st: 'saknas', msg: 'Ingen faktura med nr ' + (p.ref || '?') + (p.skadenr ? ' eller skadenr ' + p.skadenr : '') };
  const w = [];
  if (byNr && bySk && byNr !== bySk) w.push(`skadenr ${p.skadenr} hör till faktura ${bySk.faktura.nr}`);
  else if (p.skadenr && skNorm(a.skadenr) !== skNorm(p.skadenr)) w.push(`skadenr i betalningen (${p.skadenr}) skiljer sig från fakturans (${a.skadenr})`);
  if (!byNr && p.ref) w.push(`referens ${p.ref} matchar inte fakturanumret ${a.faktura.nr}`);
  if (Math.abs(belopp(a) - p.belopp) > 0.01) w.push(`beloppet ${kr(p.belopp, true)} skiljer sig från fakturans ${kr(belopp(a), true)}`);
  return { a, st: w.length ? 'varning' : 'ok', msg: w.join(', ') };
}
function parseBgBlock(L) {
  const get = re => { for (const l of L) { const m = l.match(re); if (m) return m; } return null; };
  const d = get(/^Datum\s+(\d{4}-\d\d-\d\d)/), b = get(/^Belopp\s+(-?[\d .]+,\d\d)/), n = get(/(?:^|\s)Namn\s+(.+?)(?:\s+Adress\b.*)?$/), ref = get(/^Betalningsreferens\s+(\S+)/);
  if (!d || !b) return null;
  const sp = { datum: d[1], belopp: parseAmount(b[1]), avsandare: n ? n[1].trim() : '', poster: [] };
  const mi = L.findIndex(l => /^Meddelande$/i.test(l));
  if (mi >= 0) for (const l of L.slice(mi + 1)) {
    if (/Bankgirot|^Sida \d/i.test(l)) break;
    const pm = l.match(/^(\S+)\s+(-?\d{1,3}(?:[. ]\d{3})*,\d\d)$/);
    if (pm) { sp.poster.push({ ref: pm[1], belopp: parseAmount(pm[2]), skadenr: '' }); continue; }
    const sk = l.match(/SKAD[AE]?\s*(?:NR|NUMMER)\.?:?\s*([\dA-Z][\dA-Z-]{4,})/i);
    if (sk && sp.poster.length && !sp.poster[sp.poster.length - 1].skadenr) sp.poster[sp.poster.length - 1].skadenr = sk[1];
  }
  if (!sp.poster.length) { const txt = L.slice(mi + 1).join(' '), sk = txt.match(/SKAD[AE]?\s*(?:NR|NUMMER)\.?:?\s*([\dA-Z][\dA-Z-]{4,})/i); sp.poster.push({ ref: ref ? ref[1] : '', belopp: sp.belopp, skadenr: sk ? sk[1] : '' }); }
  return sp;
}
function parseBgSpec(lines, fil) {
  const L = lines.map(l => l.replace(/[‐‑–—]/g, '-').trim()).filter(Boolean);
  // En specifikation kan innehålla flera insättningar (Insättningsuppgifter, Detaljer): ett block per insättning som börjar med "Datum ÅÅÅÅ-MM-DD"
  const starts = L.map((l, i) => /^Datum\s+\d{4}-\d\d-\d\d/.test(l) ? i : -1).filter(i => i >= 0);
  if (starts.length < 2) { const sp = parseBgBlock(L); return sp && { fil, ...sp }; }
  const B = starts.map((s, k) => parseBgBlock(L.slice(s, starts[k + 1] ?? L.length))).filter(Boolean);
  if (!B.length) return null;
  const poster = B.flatMap(x => x.poster), sum = r2(poster.reduce((s, p) => s + p.belopp, 0));
  const tot = L.map(l => l.match(/^\d+\s+(-?\d{1,3}(?:[ .]\d{3})*,\d\d)\s+TOTALT$/i)).find(Boolean);
  return { fil, datum: B[0].datum, belopp: tot ? parseAmount(tot[1]) : sum, avsandare: [...new Set(B.map(x => x.avsandare).filter(Boolean))].join(' / '), poster };
}
function parseAmount(s) {
  if (typeof s === 'number') return s;
  let t = String(s ?? '').replace(/−/g, '-').replace(/\s| /g, '').replace(/kr|SEK/gi, '');
  if (!/\d/.test(t)) return null;
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else if (/\.\d{3}$/.test(t)) t = t.replace(/\./g, ''); else t = t.replace(/,/g, '');
  const n = parseFloat(t); return isNaN(n) ? null : n;
}
function parseDate(s) {
  if (typeof s === 'number' && s > 30000 && s < 80000) return new Date(Date.UTC(1899, 11, 30) + s * 864e5).toISOString().slice(0, 10);
  const t = String(s ?? '').trim(); let m = t.match(/^(\d{4})-?(\d\d)-?(\d\d)/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d\d)[./-](\d\d)[./-](\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`; return null;
}
function txFromLines(lines) {
  const out = [];
  for (const l of lines) {
    const m = l.match(/^(\d{4}-\d\d-\d\d)\s+(.+?)\s+(-?\d{1,3}(?:[.\s]\d{3})*,\d\d)(?:\s+-?\d{1,3}(?:[.\s]\d{3})*,\d\d)?\s*$/);
    if (m) out.push({ datum: m[1], text: m[2].trim(), belopp: parseAmount(m[3]) });
  }
  return out;
}
const KTYP = { material: 'Folie och material', lon: 'Lön', ul: 'Underleverantör', ovrigt: 'Övrigt' };
const MAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
const kalk = () => ({ ag: 31.42, sem: 12, skatt: 32, lonHelV: 4000, lonHelS: 5500, ...(S.inst.kalkyl || {}) });
/* Lön anges netto (utbetalt, inkl. semesterersättning). Kostnad = netto / (1 - skatt) × (1 + arbetsgivaravgift). */
const lonFaktor = () => { const k = kalk(), s = Math.min(+k.skatt || 0, 90) / 100; return (1 / (1 - s)) * (1 + (+k.ag || 0) / 100); };
const kostList = () => [...S.kostnader.values()].sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
function meterpris() {
  const m = kostList().filter(k => k.typ === 'material' && +k.meter > 0);
  const kr_ = m.reduce((s, k) => s + (+k.belopp || 0), 0), mt = m.reduce((s, k) => s + (+k.meter || 0), 0);
  return mt ? r2(kr_ / mt) : (+kalk().meterpris || 0);
}
const DEF_P = id => DEF_PRISER.find(x => x.id === id);
const HEL_M = () => { const h = priser().find(x => x.id === 'hel') || DEF_P('hel'); return { v: +(h.mv ?? 16), s: +(h.ms ?? 19), pv: +h.vanlig || 25000, ps: +h.storre || 30000 }; };
function normM(p, storlek) { if (!p) return null; const d = DEF_P(p.id) || {}; const k = storlek === 'storre' ? 'ms' : 'mv'; const v = p[k] ?? d[k]; return v == null || v === '' ? null : +v; }
function radMeter(r, storlek) {
  const P = priser(), n = +r.antal || 0;
  let p = r.pid ? P.find(x => x.id === r.pid) : null;
  if (!p) { const t = String(r.text || '').toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim(); p = P.find(x => String(x.text).toLowerCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim() === t); }
  if (/^dekal/i.test(r.text || '')) return 0;
  const m = normM(p, storlek); if (m != null) return m * n;
  const H = HEL_M(); return (storlek === 'storre' ? H.s / H.ps : H.v / H.pv) * n * (+r.apris || 0);
}
const meterUppsk = a => r2((a.faktura?.rader || a.offert?.rader || []).reduce((s, r) => s + radMeter(r, a.storlek), 0));
const meterManuell = a => +(a.kalkyl?.meter) > 0;
const meterA = a => meterManuell(a) ? +a.kalkyl.meter : meterUppsk(a);
const lonHel = st => +(st === 'storre' ? kalk().lonHelS : kalk().lonHelV) || 0;
const lonUppsk = a => { const H = HEL_M(), hp = a.storlek === 'storre' ? H.ps : H.pv; return hp ? r2(belopp(a) * lonHel(a.storlek) / hp) : 0; };
const lonManuell = a => +(a.kalkyl?.lon) > 0;
const ingenLon = a => !!a.kalkyl?.ingenLon;
const lonA = a => ingenLon(a) || utfAv(a)?.roll === 'agare' ? 0 : lonManuell(a) ? +a.kalkyl.lon : lonUppsk(a);
const intDatum = a => a.faktura?.utfort || a.faktura?.datum || '';
function kalkylA(a) {
  const k = a.kalkyl || {}, mp = meterpris();
  const intakt = a.faktura ? belopp(a) : 0;
  const m = meterA(a), mat = r2(m * mp + (+k.material || 0));
  const lonB = lonA(a), lon = r2(lonB * lonFaktor());
  const ul = r2(kostList().filter(x => x.arende === a.id && x.typ === 'ul').reduce((s, x) => s + (+x.belopp || 0), 0));
  const tb = r2(intakt - mat - lon - ul);
  return { intakt, mat, lon, ul, tb, m, mUppsk: !meterManuell(a), lonB, lonUppsk: !lonManuell(a) && !ingenLon(a), tbp: intakt ? tb / intakt : null, klar: !!(k.lon || k.meter || k.material || k.ingenLon), off: belopp(a) };
}
function manadsData(ar) {
  const M = MAN.map((n, i) => ({ n, m: `${ar}-${String(i + 1).padStart(2, '0')}`, intakt: 0, material: 0, lon: 0, ul: 0, ovrigt: 0, jobb: 0 }));
  const by = d => M.find(x => d && d.startsWith(x.m));
  for (const a of S.arenden.values()) if (a.faktura) { const x = by(intDatum(a)); if (x) { x.intakt += belopp(a); x.jobb++; x.lon += lonA(a) * lonFaktor(); } }
  for (const k of S.kostnader.values()) { const x = by(k.datum); if (!x) continue; if (k.typ === 'lon') x.lon += (+k.belopp || 0) * lonFaktor(); else x[k.typ] = (x[k.typ] || 0) + (+k.belopp || 0); }
  M.forEach(x => { x.kost = x.material + x.lon + x.ul + x.ovrigt; x.res = x.intakt - x.kost; });
  return M;
}
const KONTON = { 1510: 'Kundfordringar', 1630: 'Skattekonto', 1930: 'Företagskonto', 2081: 'Aktiekapital', 2611: 'Utgående moms på försäljning inom Sverige, 25 %', 2641: 'Debiterad ingående moms', 2710: 'Personalskatt', 2731: 'Avräkning lagstadgade sociala avgifter', 2890: 'Övriga kortfristiga skulder', 2910: 'Upplupna löner', 2940: 'Upplupna lagstadgade sociala avgifter', 3001: 'Försäljning inom Sverige, 25 % moms', 4010: 'Inköp material och varor', 4600: 'Legoarbeten och underentreprenader', 6570: 'Bankkostnader', 6990: 'Övriga externa kostnader', 7010: 'Löner till kollektivanställda', 7082: 'Semesterlöner till kollektivanställda', 7510: 'Arbetsgivaravgifter', 8423: 'Kostnadsränta för skatter och avgifter' };
const BOK_START = '2026-08';
const KOST_KONTO = { material: 4010, ul: 4600, ovrigt: 6990 };
const pAdd = (p, n) => { const [y, m] = p.split('-').map(Number), t = y * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
const pSlut = p => addDays(pAdd(p, 1) + '-01', -1);
const pNamn = p => { const [y, m] = p.split('-'); return MAN[+m - 1] + ' ' + y; };
const rarStart = () => +(S.inst.bokforing?.rarStart || 9);
function rarFor(p) { const [y, m] = p.split('-').map(Number), s = rarStart(), sy = m >= s ? y : y - 1, st = `${sy}-${String(s).padStart(2, '0')}`; return { start: st + '-01', slut: pSlut(pAdd(st, 11)), forsta: st }; }
function perioder() { const out = [], end = today().slice(0, 7); for (let p = BOK_START; p <= end; p = pAdd(p, 1)) out.push(p); return out; }
const bDoc = p => S.bokforing.get(p) || null;
const last = p => bDoc(p)?.status === 'last';
const forstaOppna = () => perioder().find(p => !last(p)) || null;
const lastaKeys = () => new Set([...S.bokforing.values()].filter(d => d.status === 'last').flatMap(d => d.keys || []));
const rnd = x => r2(x);
const regTxt = a => normReg(a.reg);

/* Händelser i appen som ska bli verifikationer under perioden p */
function genAuto(p) {
  const out = [], inP = d => d && d.slice(0, 7) === p;
  for (const a of S.arenden.values()) {
    const f = a.faktura;
    if (f?.betald && inP(f.betaldDatum)) { const b = belopp(a); out.push({ key: 'fbet:' + a.id, datum: f.betaldDatum, typ: 'auto', text: `Inbetalning faktura ${f.nr} ${regTxt(a)} skada ${a.skadenr}`, rader: [{ k: 1930, b, t: `${fors(a.forsakring).namn} faktura ${f.nr}` }, { k: 3001, b: -b, t: `Foliering faktura ${f.nr} ${regTxt(a)}` }] }); }
    const m = a.moms;
    if (m?.betald && inP(m.betaldDatum)) { const b = momsBelopp(a); out.push({ key: 'mbet:' + a.id, datum: m.betaldDatum, typ: 'auto', text: `Inbetalning momsfaktura ${m.nr} ${regTxt(a)}`, rader: [{ k: 1930, b, t: `${m.till} ${m.nr}` }, { k: 2611, b: -b, t: `Utg moms 25 % ${m.nr}` }] }); }
  }
  for (const k of S.kostnader.values()) {
    if (!inP(k.datum) || !KOST_KONTO[k.typ]) continue;
    const bel = rnd(+k.belopp || 0), mo = rnd(+k.moms || 0);
    const rader = [{ k: KOST_KONTO[k.typ], b: bel, t: k.beskrivning || KTYP[k.typ] }]; if (mo) rader.push({ k: 2641, b: mo, t: 'Ingående moms' }); rader.push({ k: 1930, b: -rnd(bel + mo), t: k.leverantor || '' });
    out.push({ key: 'kost:' + k.id, datum: k.datum, typ: 'auto', text: `${KTYP[k.typ]} ${k.leverantor || ''}${k.fakturanr ? ' faktura ' + k.fakturanr : ''}`.trim(), rader, varn: 'Bokas som betald på fakturadatum. Ändra datumet i kostnaden om den betalades en annan dag.' });
  }
  // Återföring av bokslutsposter från föregående låsta period
  const pr = bDoc(pAdd(p, -1));
  if (pr?.status === 'last') for (const v of pr.ver || []) if (v.bokslut) out.push({ key: `rev:${pr.period}:${v.nr}`, datum: p + '-01', typ: 'aterforing', text: `Återföring A${v.nr} ${v.text}`.slice(0, 90), rader: v.rader.map(r => ({ k: r.k, b: -r.b, t: r.t })) });
  // Bokslut vid räkenskapsårets sista månad
  const R = rarFor(p);
  if (pSlut(p) === R.slut) {
    const sl = R.slut, rader = []; let moms = 0;
    for (const a of S.arenden.values()) {
      const f = a.faktura; if (!f || !f.datum || f.datum > sl) continue;
      if (!(f.betald && f.betaldDatum && f.betaldDatum <= sl)) { const b = belopp(a); rader.push({ k: 1510, b, t: `Faktura ${f.nr} ${regTxt(a)}` }, { k: 3001, b: -b, t: `Foliering faktura ${f.nr}` }); }
      if (!(a.moms?.betald && a.moms.betaldDatum && a.moms.betaldDatum <= sl)) moms += momsBelopp(a);
    }
    if (moms) rader.push({ k: 1510, b: rnd(moms), t: 'Moms fordonsägare, obetald' }, { k: 2611, b: -rnd(moms), t: 'Utg moms 25 %, obetald' });
    if (rader.length) out.push({ key: 'bokslut:' + p, datum: sl, typ: 'bokslut', bokslut: true, text: `Bokslut kontantmetod, obetalda kundfordringar ${sl}`, rader });
  }
  return out;
}
/* Händelser som hör till en låst period men som inte kom med i exporten */
function efterreg(p) {
  if (p !== forstaOppna()) return [];
  const keys = lastaKeys(), out = [];
  for (const q of perioder()) { if (q >= p || !last(q)) continue;
    for (const v of genAuto(q)) if (!keys.has(v.key) && v.typ === 'auto') out.push({ ...v, key: v.key, datum: p + '-01', typ: 'efterreg', text: `Efterreg. ${v.datum}: ${v.text}`.slice(0, 90), orig: v.datum }); }
  return out;
}
/* Bokförda händelser i låsta perioder som inte längre finns i appen (t.ex. ångrad betalning) */
function forsvunna() {
  const out = [];
  for (const d of S.bokforing.values()) { if (d.status !== 'last') continue; const now = new Set(genAuto(d.period).map(v => v.key));
    for (const v of d.ver || []) if (/^(fbet|mbet|kost):/.test(v.key || '') && !now.has(v.key)) out.push({ p: d.period, v }); }
  return out;
}
function utkast(p) {
  const d = bDoc(p);
  if (d?.status === 'last') return clone(d.ver || []);
  const keys = lastaKeys();
  const L = [...genAuto(p).filter(v => !keys.has(v.key)), ...efterreg(p), ...(d?.manuella || []).map(m => ({ ...m, key: 'man:' + m.id, typ: 'manuell' }))];
  L.sort((a, b) => a.datum.localeCompare(b.datum) || ({ aterforing: 0, efterreg: 1, auto: 2, manuell: 3, bokslut: 4 }[a.typ] - { aterforing: 0, efterreg: 1, auto: 2, manuell: 3, bokslut: 4 }[b.typ]));
  const R = rarFor(p); let nr = 1;
  for (const q of perioder()) if (q < p && q >= R.forsta && last(q)) nr += (bDoc(q).ver || []).length;
  L.forEach(v => { v.nr = nr++; v.rader = v.rader.map(r => ({ k: +r.k, b: rnd(r.b), t: r.t || '' })); });
  return L;
}
const verSum = v => rnd(v.rader.reduce((s, r) => s + r.b, 0));
function periodSum(V) {
  const s = { int: 0, kost: 0, utg: 0, ing: 0, bank: 0 };
  for (const v of V) for (const r of v.rader) { const k = +r.k;
    if (k >= 3000 && k < 4000) s.int -= r.b; else if (k >= 4000 && k < 9000) s.kost += r.b;
    if (k >= 2610 && k <= 2639) s.utg -= r.b; if (k >= 2640 && k <= 2649) s.ing += r.b; if (k === 1930) s.bank += r.b; }
  for (const x in s) s[x] = rnd(s[x]); s.res = rnd(s.int - s.kost); s.moms = rnd(s.utg - s.ing); return s;
}
function varningar(p, V) {
  const w = [], inP = d => d && d.slice(0, 7) === p;
  V.filter(v => Math.abs(verSum(v)) > 0.005).forEach(v => w.push(['bad', `Verifikation A${v.nr} balanserar inte (diff ${kr(verSum(v), true)}).`]));
  for (const a of S.arenden.values()) { if (a.faktura?.betald && !a.faktura.betaldDatum) w.push(['bad', `Faktura ${a.faktura.nr} är markerad betald men saknar betaldatum, den kommer inte med.`]); }
  const jobb = arList().filter(a => a.faktura && inP(a.faktura.utfort || a.faktura.datum));
  if (jobb.length && !V.some(v => v.typ !== 'aterforing' && v.rader.some(r => +r.k === 7010))) w.push(['warn', `${jobb.length} jobb utförda i perioden men ingen lön bokad. Lägg in löneutbetalningen som verifikation när lönen betalas (eller som upplupen lön i bokslutet).`]);
  V.filter(v => v.typ === 'efterreg').forEach(v => w.push(['warn', `A${v.nr}: händelsen ${v.orig} hör till en låst period och bokas nu som efterregistrering.`]));
  V.filter(v => v.varn).forEach(v => w.push(['info', `A${v.nr}: ${v.varn}`]));
  if (p === forstaOppna()) forsvunna().forEach(x => w.push(['bad', `${pNamn(x.p)} A${x.v.nr} (${x.v.text}) är exporterad men händelsen finns inte längre i appen. Rätta med en manuell verifikation.`]));
  if (pSlut(p) === rarFor(p).slut) w.push(['info', 'Räkenskapsårets sista månad: kontrollera upplupen lön och andra skulder per ' + pSlut(p) + ' och lägg in dem som manuell verifikation markerad som bokslut.']);
  return w;
}

/* SIE4I */
const CP437 = { 'Ç': 128, 'ü': 129, 'é': 130, 'â': 131, 'ä': 132, 'à': 133, 'å': 134, 'ç': 135, 'ê': 136, 'ë': 137, 'è': 138, 'ï': 139, 'î': 140, 'ì': 141, 'Ä': 142, 'Å': 143, 'É': 144, 'æ': 145, 'Æ': 146, 'ô': 147, 'ö': 148, 'ò': 149, 'û': 150, 'ù': 151, 'ÿ': 152, 'Ö': 153, 'Ü': 154, 'ø': 155, '£': 156, 'Ø': 157, 'á': 160, 'í': 161, 'ó': 162, 'ú': 163, 'ñ': 164, 'Ñ': 165, '§': 21 };
function cp437(s) { const out = new Uint8Array(s.length); let n = 0; for (const ch of s) { const c = ch.charCodeAt(0); out[n++] = c < 128 ? c : (CP437[ch] ?? 63); } return out.slice(0, n).buffer; }
const sieTxt = s => '"' + String(s ?? '').replace(/[–—]/g, '-').replace(/["\\]/g, '').replace(/[\r\n]+/g, ' ').slice(0, 100) + '"';
const sieD = d => d.replace(/-/g, '');
function bygSie(p, V) {
  const F = foretag(), R = rarFor(p), gen = sieD(today());
  const used = [...new Set(V.flatMap(v => v.rader.map(r => +r.k)))].sort((a, b) => a - b);
  const L = ['#FLAGGA 0', '#FORMAT PC8', '#SIETYP 4', '#PROGRAM "Bolagsappar Verkstad" 1.0', '#GEN ' + gen, '#FNAMN ' + sieTxt(F.namn), '#ORGNR ' + F.orgnr, `#RAR 0 ${sieD(R.start)} ${sieD(R.slut)}`, '#KPTYP BAS2014', '#VALUTA SEK'];
  used.forEach(k => L.push(`#KONTO ${k} ${sieTxt(KONTON[k] || 'Konto ' + k)}`));
  V.forEach(v => { L.push(`#VER A ${v.nr} ${sieD(v.datum)} ${sieTxt(v.text)} ${gen}`, '{'); v.rader.forEach(r => L.push(`#TRANS ${r.k} {} ${(+r.b).toFixed(2)} ${sieD(v.datum)} ${sieTxt(r.t)}`)); L.push('}'); });
  return cp437(L.join('\r\n') + '\r\n');
}
const sieNamn = p => `SIE_${String(foretag().namn || 'Verkstad').replace(/[^A-Za-z0-9]/g, '')}_${p}.se`;

/* Vy */
const DEF_PERSONAL = [{ id: 'agare', namn: 'Förnamn Efternamn', roll: 'agare', epost: '' }];
const personal = () => (S.inst.personal?.items?.length ? S.inst.personal.items : DEF_PERSONAL);
const person = id => personal().find(p => p.id === id) || null;
const utfAv = a => person(a.utforare);
const jobbDatum = a => a.faktura?.utfort || a.faktura?.datum || '';
const nettoTillBrutto = n => { const s = (+kalk().skatt || 0) / 100; return s < 1 ? r2(n / (1 - s)) : n; };
function jobbLista() { return arList().filter(a => a.faktura).sort((x, y) => jobbDatum(y).localeCompare(jobbDatum(x))); }
const lsAll = () => [...S.lonespec.values()];
const lsFor = pid => lsAll().filter(x => x.person === pid).sort((a, b) => (b.utb || '').localeCompare(a.utb || ''));
const lsNesta = () => 'L-' + String(lsAll().reduce((m, x) => Math.max(m, +(String(x.nr || '').replace(/\D/g, '')) || 0), 0) + 1).padStart(3, '0');
const lsOppnaJobb = pid => jobbLista().filter(a => a.utforare === pid && !a.lonspec && !ingenLon(a) && lonA(a) > 0);
function lsCalc(pid, ids, skattKr, utb) {
  const K = kalk(), J = ids.map(id => S.arenden.get(id)).filter(Boolean).sort((a, b) => jobbDatum(a).localeCompare(jobbDatum(b)));
  const netto = r2(J.reduce((s, a) => s + r2(lonA(a)), 0));
  const skatt = skattKr == null || skattKr === '' ? r2(nettoTillBrutto(netto) - netto) : r2(+skattKr);
  const brutto = r2(netto + skatt), semPct = +K.sem || 0, lon = r2(brutto / (1 + semPct / 100)), sem = r2(brutto - lon), agPct = +K.ag || 0, ag = r2(brutto * agPct / 100);
  let rest = lon; const rader = J.map((a, i) => { const b = i === J.length - 1 ? r2(rest) : r2(netto ? lon * r2(lonA(a)) / netto : 0); rest = r2(rest - b);
    return { id: a.id, text: `Foliering ${normReg(a.reg)}, ${(a.faktura.rader || []).map(r => r.text.replace(/^Foliering\s+/i, '')).join(', ')}`.slice(0, 120), datum: jobbDatum(a), belopp: b }; });
  const ar = (utb || today()).slice(0, 4), prev = lsFor(pid).filter(x => (x.utb || '').startsWith(ar) && x.utb < (utb || '9999'));
  return { J, netto, skatt, brutto, lon, sem, semPct, ag, agPct, rader, ytdBrutto: r2(prev.reduce((s, x) => s + x.brutto, 0) + brutto), ytdSkatt: r2(prev.reduce((s, x) => s + x.skatt, 0) + skatt) };
}
function rowText(p, n) { return n > 1 && p?.textN ? p.textN.replace('{n}', n) : p?.text; }
function repris(a) { const P = priser(); (a.offert.rader || []).forEach(r => { const p = P.find(x => x.id === r.pid); if (p) r.apris = a.storlek === 'storre' ? +p.storre : +p.vanlig; }); }

  /** Att göra-listan på översikten (viewOversikt i prototypen) som data. */
  function attGora() {
    const L = arList(), t = today();
    const skick = L.filter(a => a.status === 'skickad'), godk = L.filter(a => a.status === 'godkand');
    const obet = L.filter(a => a.faktura && !a.faktura.betald), forf = obet.filter(a => a.faktura.forfall < t);
    const todo = [];
    for (const a of forf) { const pd = a.faktura.paminnelse, sen = pd && pd >= a.faktura.forfall ? daysBetween(pd, t) : null, behov = sen == null || sen >= PAMINN_DAGAR;
      todo.push({ sev: behov ? 'bad' : 'info', o: -daysBetween(a.faktura.forfall, t), a, h: behov ? `Faktura ${a.faktura.nr} är förfallen, påminnelse behövs` : `Faktura ${a.faktura.nr} förfallen, påmind ${pd}`, s: `${fors(a.forsakring).namn} · ${kr(belopp(a))} · förföll ${a.faktura.forfall} (${daysBetween(a.faktura.forfall, t)} dagar)${pd ? ' · senaste påminnelse ' + pd : ''}`, btn: behov ? 'Påminn' : 'Öppna' }); }
    for (const a of godk) todo.push({ sev: 'warn', o: 0, a, h: 'Godkänd offert att fakturera', s: `${fors(a.forsakring).namn} · ${kr(belopp(a))}${a.offert?.godkandAv ? ' · godkänd av ' + a.offert.godkandAv : ''}`, btn: 'Fakturera' });
    for (const a of skick) { const sk = a.offert?.skickad || a.offert?.datum || t, pm = a.offert?.paminnelse, sen = pm && pm >= sk ? pm : sk, d = daysBetween(sen, t); if (d >= OFFERT_DAGAR) todo.push({ sev: 'warn', o: 10 - d, a, h: pm ? `Offert utan svar, ny påminnelse (senast ${pm})` : `Offert utan svar i ${d} dagar, påminn`, s: `${fors(a.forsakring).namn} · ${kr(belopp(a))} · skickad ${sk}`, btn: 'Påminn' }); }
    for (const a of momsAttSkicka()) todo.push({ sev: 'warn', o: -1, a, h: `Momsfaktura M-${a.faktura.nr} ska skickas till ägaren`, s: `${a.agare || 'Fordonsägare saknas'} · moms ${kr(momsBelopp(a), true)} · ${fors(a.forsakring).namn} betalade ${a.faktura.betaldDatum}`, btn: 'Skicka' });
    for (const a of L.filter(a => a.status === 'utkast')) todo.push({ sev: 'info', o: 5, a, h: 'Utkast som inte är skickat', s: `${fors(a.forsakring).namn} · ${kr(belopp(a))}`, btn: 'Öppna' });
    todo.sort((x, y) => ({ bad: 0, warn: 1, info: 2 }[x.sev] - { bad: 0, warn: 1, info: 2 }[y.sev]) || x.o - y.o);
    return todo;
  }

  return { r2, fmt, kr, today, addDays, daysBetween, sumRows, clone, plateTxt, normReg, DEF_FORETAG, DEF_PRISER, ST, STEG, foretag, priser, fors, forsList, arList, belopp, aDatum, fakStatus, FS, momsStatus, PAMINN_DAGAR, OFFERT_DAGAR, momsAttSkicka, momsEfterBetalning, nastaFaktura, momsBelopp, agareInfo, log, openItems, paidMatch, matchTx, skNorm, bgSpecKey, matchPost, parseBgBlock, parseBgSpec, parseAmount, parseDate, txFromLines, KTYP, MAN, kalk, lonFaktor, kostList, meterpris, radMeter, meterA, lonA, kalkylA, manadsData, KONTON, BOK_START, KOST_KONTO, pAdd, pSlut, pNamn, rarFor, perioder, last, forstaOppna, genAuto, efterreg, forsvunna, utkast, verSum, periodSum, varningar, cp437, bygSie, sieNamn, personal, person, utfAv, jobbDatum, nettoTillBrutto, jobbLista, lsAll, lsFor, lsNesta, lsOppnaJobb, lsCalc, rowText, repris, attGora };
}
