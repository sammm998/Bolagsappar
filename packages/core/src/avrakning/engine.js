// Motor för Avräkning. Flyttad oförändrad från legacy/apps/avrakning/index.html
// (raderna mellan "Kärnlogik" och "Sidans logik"). Ändra inte en beräkning utan
// att först låsa nuvarande beteende med ett test, se test/avrakning.compare.test.js.
/* eslint-disable */
const MANAD = ['JANUARI','FEBRUARI','MARS','APRIL','MAJ','JUNI','JULI','AUGUSTI','SEPTEMBER','OKTOBER','NOVEMBER','DECEMBER'];
const MAN3 = ['JAN','FEB','MARS','APR','MAJ','JUNI','JULI','AUG','SEP','OKT','NOV','DEC'];
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;

function groupLines(items) {
  const rows = [];
  items.filter(i => i.str && i.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x).forEach(it => {
    let r = rows.find(r => Math.abs(r.y - it.y) < 2.5);
    if (!r) { r = { y: it.y, items: [] }; rows.push(r); }
    r.items.push(it);
  });
  rows.sort((a, b) => a.y - b.y); rows.forEach(r => r.items.sort((a, b) => a.x - b.x));
  return rows;
}

// pages: [[{str,x,y}]] med y nedåt
function parseTaxiCaller(pages) {
  const trips = [], fakt = {}; let acct = null, col = null, cur = null, period = null, datum = null;
  const close = () => { if (cur) trips.push(cur); cur = null; };
  for (const items of pages) {
    for (const r of groupLines(items)) {
      const text = r.items.map(i => i.str).join(' ');
      const pm = text.match(/period:\s*(\d{4})-(\d\d)-\d\d/); if (pm && !period) period = pm[1] + '-' + pm[2];
      const m = text.match(/Konto #(\d+)\s*-\s*(.*)$/); if (m) { close(); acct = { nr: +m[1], namn: m[2].trim() }; continue; }
      const f = text.match(/Fakturabelopp\s+(-?[\d.]+)/); if (f && acct) fakt[acct.nr] = +f[1];
      if (/^Start\b/.test(r.items[0].str.trim()) && /Passagerare/.test(text)) {
        const x = n => { const it = r.items.find(i => i.str.trim().toLowerCase().startsWith(n)); return it ? it.x : null; };
        col = { pass: x('passagerare'), rutt: x('rutt'), bil: x('bil'), forare: x('förare'), betal: x('betal') }; continue;
      }
      if (!col) continue;
      if (/^\d{4}-\d\d-\d\d$/.test(text.trim())) { close(); datum = text.trim(); continue; }
      if (/Totalt pris|Kostnadsställe|TaxiCaller|Sida \d/.test(text)) { close(); continue; }
      const first = r.items[0];
      const isTrip = /^\d\d:\d\d(\s|$)/.test(first.str.trim());
      if (isTrip && /#\d{6,}/.test(text)) {
        close();
        const nums = r.items.filter(i => /^-?\d+\.\d\d$/.test(i.str.trim()));
        const bilIt = r.items.find(i => i.x >= col.bil - 8 && i.x < col.forare - 3 && /^\d{1,6}$/.test(i.str.trim()));
        let bil = bilIt ? +bilIt.str.trim() : null;
        if (bil == null) { const mm = text.match(/\s(\d{1,6})\s+[^\d#]+?\s+[A-Z]{1,2}\s+-?[\d.]+\s/); if (mm) bil = +mm[1]; }
        let pass = '', rutt = '';
        for (const i of r.items) {
          if (i === first) { pass += i.str.replace(/^\s*\d\d:\d\d\s*/, '') + ' '; continue; }
          if (i.x < col.rutt - 3 && !/#\d{6,}/.test(i.str)) pass += i.str + ' ';
          else if (i.x < col.bil - 3 || /#\d/.test(i.str)) rutt += i.str + ' ';
        }
        const inF = i => col.forare != null && i.x >= col.forare - 3 && i.x < (col.betal ?? 1e9) - 3;
        const forare = r.items.filter(i => i !== first && inF(i)).map(i => i.str.trim()).join(' ');
        cur = { konto: acct, bil, belopp: nums.length ? +nums[nums.length - 1].str : 0, pass, rutt, datum, forare, tid: (first.str.match(/\d\d:\d\d/) || [''])[0] };
        continue;
      }
      if (cur) {
        for (const i of r.items) {
          const s = i.str;
          if (i.x < col.rutt - 3) {
            const k = s.search(/\s(till:|från:|Info:)/);
            if (k >= 0) { cur.pass += ' ' + s.slice(0, k); cur.rutt += ' ' + s.slice(k); } else cur.pass += ' ' + s;
          } else if (i.x < col.bil - 3) cur.rutt += ' ' + s;
          else if (col.forare != null && i.x >= col.forare - 3 && i.x < (col.betal ?? 1e9) - 3 && cur.forare) cur.forare += ' ' + s.trim();
        }
      }
    }
  }
  close();
  for (const t of trips) {
    t.bud = t.pass.toUpperCase().replace(/\s/g, '').includes('BUD');
    const rr = t.rutt.split('Info:')[0].split('Id:')[0].toLowerCase();
    t.utland = ['danmark', 'denmark', 'kastrup', 'københavn', 'kobenhavn', 'copenhagen', 'köpenhamn'].some(k => rr.includes(k));
    t.typ = t.utland ? 'utland' : (t.bud ? 'bud' : 'person');
    t.forare = String(t.forare || '').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();
  }
  // Förarnamn som bröts på två rader och tappade andra raden: ersätt med det längre namnet på samma bil
  const fn = [...new Set(trips.map(t => t.forare).filter(Boolean))];
  for (const t of trips) { if (!t.forare) continue; const m = fn.find(n => n !== t.forare && n.startsWith(t.forare + ' ') && trips.some(x => x.forare === n && x.bil === t.bil)); if (m) t.forare = m; }
  return { trips, fakt, period };
}

// Bambora: rader som objekt med rubriker från flik Sales
function parseBambora(rows) {
  // Bara transaktioner som gått igenom (STATE Cleared). Sale krediteras åkaren.
  // Refund (återbetalning till kunden) dras från åkaren på samma bil (beslut 10 okt 2026).
  return rows.filter(r => r['STATE'] === 'Cleared' && (r['TYPE'] == null || r['TYPE'] === 'Sale' || r['TYPE'] === 'Refund')).map(r => ({
    tid: String(r['TERMINAL ID'] ?? '').trim(), kassor: parseInt(r['CASHIER ID'], 10),
    belopp: Math.abs(+r['SALE AMOUNT'] || 0), dricks: r['TYPE'] === 'Refund' ? 0 : (+r['TIP'] || 0), datum: String(r['TRANSACTION DATE'] ?? ''),
    ...(r['TYPE'] === 'Refund' ? { refund: true } : {})
  }));
}

// TaxiCaller debiteringskunder (CSV): Körnings-id, Vehicle number, konto Nr, Totalsumma, Passagerare, Lämnad, Upphämtningsplats, Avlämningsaddress
function parseTcCsv(rows, namn = {}) {
  const trips = [];
  for (const r of rows) {
    const nr = String(r['konto Nr'] ?? '').trim(); if (!nr) continue;
    const l = String(r['Lämnad'] || '').trim();
    trips.push({ konto: { nr: /^\d+$/.test(nr) ? +nr : nr, namn: namn[nr] || 'Konto ' + nr }, bil: parseInt(r['Vehicle number'], 10), belopp: parseFloat(String(r['Totalsumma'] ?? '').replace(',', '.')) || 0,
      pass: String(r['Passagerare'] || '').trim(), rutt: 'från: ' + String(r['Upphämtningsplats'] || '').trim() + ' till: ' + String(r['Avlämningsaddress'] || '').trim(), datum: l.slice(0, 10), tid: l.slice(11, 16) });
  }
  for (const t of trips) {
    t.bud = t.pass.toUpperCase().replace(/\s/g, '').includes('BUD');
    const rr = t.rutt.toLowerCase();
    t.utland = ['danmark', 'denmark', 'kastrup', 'københavn', 'kobenhavn', 'copenhagen', 'köpenhamn'].some(k => rr.includes(k));
    t.typ = t.utland ? 'utland' : (t.bud ? 'bud' : 'person');
  }
  const ds = trips.map(t => t.datum).filter(d => /^\d{4}-\d\d/.test(d)).sort();
  return { trips, fakt: {}, period: ds.length ? ds[Math.floor(ds.length / 2)].slice(0, 7) : null, csv: true };
}

// TaxiCaller appbetalningar (CSV)
function parseApp(rows) {
  const ut = [], ej = [];
  for (const r of rows) {
    const bil = parseInt(r['Vehicle number'], 10), p = parseFloat(r['Price']) || 0, typ = String(r['Payment'] || '');
    if (r['Skede'] && !/^(levererad|delivered)$/i.test(String(r['Skede']).trim())) continue;
    const col = re => { const k = Object.keys(r).find(k => re.test(k)); return k ? String(r[k] ?? '').trim() : ''; };
    (/app/i.test(typ) ? ut : ej).push({ bil, belopp: p, typ, datum: r['Lämnad'], id: String(r['id'] ?? r['\ufeffid'] ?? col(/^\W*id$/i)), forare: col(/förare|driver/i).replace(/\s+,/g, ','), fran: col(/upphämtning|pickup|från/i), till: col(/avlämning|dropoff|destination|till/i) });
  }
  return { app: ut, ejApp: ej };
}

// Öresundsbron / Sturup / CPH: räknar förekomster av reg nr eller "bil NNN" i text eller tabell
function countPassages(text, bilar) {
  const reg = {}; bilar.forEach(b => { if (b.reg) reg[b.reg.replace(/\s/g, '').toUpperCase()] = b.bil; });
  const cnt = {}, okanda = {};
  const T = text.toUpperCase();
  const re = /\b([A-Z]{3})\s?(\d{2}[A-Z0-9])\b/g; let m;
  while ((m = re.exec(T))) {
    const k = m[1] + m[2];
    if (reg[k] != null) cnt[reg[k]] = (cnt[reg[k]] || 0) + 1; else okanda[k] = (okanda[k] || 0) + 1;
  }
  return { cnt, okanda };
}

// Spec per förare: frivillig tjänst, aktiv från bolagets fsFrom (ÅÅÅÅ-MM)
const fsAktiv = (B, p) => !!(B && B.fsFrom && p && p >= B.fsFrom);
// Provmånad: alla får förarna i PDF och mail utan debitering (settings/params.fsGratis = 'ÅÅÅÅ-MM')
const fsProv = (p, params) => !!(params && params.fsGratis && p === params.fsGratis);
const fsVisa = (B, p, params) => fsAktiv(B, p) || fsProv(p, params);
const ymAdd = (p, n) => { const [y, m] = p.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
function monthLabels(period) {
  const [y, mo] = period.split('-').map(Number);
  const vxM = (mo - 1 + 2) % 12, vxY = y + Math.floor((mo - 1 + 2) / 12);
  return { namn: MANAD[mo - 1].charAt(0) + MANAD[mo - 1].slice(1).toLowerCase() + ' ' + y,
    lang: MANAD[mo - 1] + y, vx: MAN3[vxM] + String(vxY).slice(2) };
}

// S = inställningar {params, bilar[], terminaler[], kassor[], bolag[]}
// D = {tc, bamb, app, bro:{bil:antal}, sturup:{}, cph:{}, manuellt:{bolag:{forskott, oppna, rabatt}}}
function compute(S, D) {
  const P = S.params, period = D.tc?.period || D.period;
  const O0 = D.oresund, cphPris = O0?.kostCph && O0?.nCph ? Math.max(P.cph, Math.ceil(O0.kostCph / O0.nCph * 100) / 100) : P.cph;
  const L = period ? monthLabels(period) : { namn: '', lang: '', vx: '' };
  const bilar = new Map(); S.bilar.forEach(b => bilar.set(+b.bil, { ...b, avr: (b.avr || b.bolag || '').trim() }));
  const term = new Map(S.terminaler.map(t => [String(t.id).trim(), t.bil == null || t.bil === '' ? null : +t.bil]));
  const kass = new Map(S.kassor.map(k => [+k.kassor, +k.bil]));
  const pb = new Map(); const bil = b => { if (!pb.has(b)) pb.set(b, { bil: b, kort: 0, refund: 0, dricks: 0, person: 0, bud: 0, utland: 0, app: 0, bro: 0, sturup: 0, cph: 0 }); return pb.get(b); };
  const kontroll = [];
  const okandTerm = {};
  for (const t of (D.bamb || [])) {
    let b = term.has(t.tid) ? term.get(t.tid) : (kass.has(t.kassor) ? kass.get(t.kassor) : t.kassor);
    if (b == null || !bilar.has(b)) { const k = '…' + t.tid.slice(-6) + ' / kassör ' + t.kassor; okandTerm[k] = (okandTerm[k] || 0) + (t.refund ? -t.belopp : t.belopp); continue; }
    const x = bil(b);
    // kort = netto (köp minus återbetalningar), refund = återbetalt belopp
    if (t.refund) { x.kort -= t.belopp; x.refund += t.belopp; } else { x.kort += t.belopp; x.dricks += t.dricks; }
  }
  for (const t of (D.tc?.trips || [])) bil(t.bil)[t.typ] += t.belopp;
  for (const a of (D.app?.app || [])) bil(a.bil).app += a.belopp;
  for (const k of ['bro', 'sturup', 'cph']) for (const [b, n] of Object.entries(D[k] || {})) if (n) bil(+b)[k] += +n;
  for (const [b, pr] of Object.entries(D.sturupRad || {})) if (!(D.sturup && D.sturup[b] != null)) bil(+b).sturup += Object.values(pr).reduce((a, n) => a + n, 0);
  for (const [b, x] of pb) {
    const inf = bilar.get(b);
    x.reg = inf?.reg || ''; x.bolag = inf ? inf.avr : '(saknas i bilregistret)';
    if (!inf) kontroll.push({ niva: 'fel', typ: 'Bil saknas i bilregistret', vad: 'Bil ' + b, belopp: x.kort + x.person + x.bud + x.utland + x.app, atgard: 'Lägg till bilen under Inställningar, Bilar.' });
  }
  for (const [k, v] of Object.entries(okandTerm)) kontroll.push({ niva: 'fel', typ: 'Kortbetalningar utan bil', vad: 'Terminal ' + k, belopp: v, atgard: 'Koppla terminalen till en bil under Inställningar, Terminaler.' });

  const man = D.manuellt || {};
  const RK = D.skuldMed ? D.reskontra : null, rkBy = {};
  if (D.reskontra && !D.skuldMed) kontroll.push({ niva: 'info', typ: 'Tidigare skulder räknas inte med', vad: 'Kundreskontra ' + (D.reskontra.datum || '') + ' är inläst men används inte denna månad', belopp: null, atgard: 'Bocka i "Räkna in tidigare skulder" i ruta 6 först när ekonomen har registrerat alla betalningar i Visma.' });
  if (RK) for (const p of RK.poster) (rkBy[String(p.kn)] = rkBy[String(p.kn)] || []).push(p);
  const nrm = s => deacc(s).replace(/[^A-ZÅÄÖ0-9]/g, '').replace(/AKTIEBOLAG$|AB$/, '');
  const used = new Set();
  const reskFor = B => {
    if (!RK) return [];
    const out = [];
    const kns = [String(B.kn ?? ''), ...String(B.kn2 ?? '').split(/[,\s]+/)].filter(Boolean);
    for (const k of kns) for (const p of (rkBy[k] || [])) { out.push(p); used.add(k); }
    for (const [k, L] of Object.entries(rkBy)) if (!kns.includes(k) && (!k.startsWith('9119') || !B.kn) && L[0] && nrm(L[0].namn) === nrm(B.namn)) { L.forEach(p => out.push({ ...p, via: true })); used.add(k); }
    return out.sort((a, b) => a.fdat.localeCompare(b.fdat));
  };
  const bolag = [];
  const bolagNamn = new Set(S.bolag.map(b => b.namn));
  for (const B of S.bolag) {
    const cars = [...pb.values()].filter(x => x.bolag === B.namn).sort((a, b) => a.bil - b.bil);
    const sum = k => cars.reduce((a, x) => a + x[k], 0);
    const rows = [];
    const add = (art, text, antal, apris, moms) => { const s = r2(antal * apris); if (Math.abs(s) >= 0.005) rows.push({ art, text, antal, apris: r2(apris), summa: s, moms }); };
    const M = man[B.namn] || {};
    // Växelavgift tas i förskott: avräkningsmånad M tar ut avgiften för M+2 (samma linje för alla).
    // Undantag vxInn (INNEVARANDE): M+1. Gratis t.o.m. jämförs mot avgiftsmånaden.
    // Efterdebitering: antal bilar som saknades på förra avräkningen (förra avgiftsmånaden), räknat per bil.
    const off = +B.vxInn ? 1 : 2, inn = +B.vxInn ? ' INNEVARANDE' : '';
    const vxP = period ? ymAdd(period, off) : null, vxPrev = period ? ymAdd(period, off - 1) : null;
    const lab = q => MAN3[+q.slice(5, 7) - 1] + q.slice(2, 4);
    const gratisFor = p => B.gratisTom === 'alltid' || (!!B.gratisTom && !!p && p <= B.gratisTom);
    const vxAntal = gratisFor(vxP) ? 0 : (+B.vx || 0), rabPct = Math.min(100, Math.max(0, +B.vxRab || 0));
    const vxBrutto = r2(vxAntal * P.vx * (1 - rabPct / 100));
    const vxSumma = r2(vxBrutto - (+M.rabatt || 0));
    const prevB = D.prevSummary ? (D.prevSummary.bolag || []).find(x => String(x.kn) === String(B.kn) || x.namn === B.namn) : null;
    const prevHar = !!(prevB && (prevB.rows || []).length);
    // Antal bilar med ordinarie växelavgift på förra avräkningen (oavsett hur månaden är skriven i texten; efterdebiteringar räknas inte)
    const nPrevVx = prevHar ? prevB.rows.filter(r => r.art === 1 && !/efterdeb/i.test(String(r.text))).reduce((a, r) => a + (+r.antal || 0), 0) : 0;
    const nPrevTl = prevHar ? prevB.rows.filter(r => r.art === 8 && !/saknades|kredit/i.test(String(r.text))).reduce((a, r) => a + (+r.antal || 0), 0) : 0;
    const ovr = v => v !== undefined && v !== null && v !== '';
    let nBak = vxAntal && prevHar && !gratisFor(vxPrev) ? Math.max(0, vxAntal - nPrevVx) : 0;
    if (+M.ejBak) nBak = 0; if (ovr(M.vxBak)) nBak = Math.max(0, +M.vxBak || 0);
    const bak = nBak > 0;
    if (bak) rows.push({ art: 1, text: 'Växelavgift Åkare ' + lab(vxPrev) + inn + ' (efterdebitering)', antal: nBak, apris: P.vx, summa: r2(nBak * P.vx * (1 - rabPct / 100)), moms: 25, bak: true, ...(rabPct ? { rabattPct: rabPct } : {}) });
    if (vxAntal) rows.push({ art: 1, text: 'Växelavgift Åkare ' + lab(vxP) + inn, antal: vxAntal, apris: P.vx, summa: vxSumma, moms: 25, rabatt: +M.rabatt || 0, ...(rabPct ? { rabattPct: rabPct } : {}) });
    add(8, 'Taklampa hyra', B.tl, P.tl, 25);
    let nTlBak = (+B.tl || 0) && prevHar && nPrevVx > 0 ? Math.max(0, (+B.tl || 0) - nPrevTl) : 0;
    if (ovr(M.tlBak)) nTlBak = Math.max(0, +M.tlBak || 0);
    if (nTlBak) { add(8, 'Taklampa hyra ' + lab(ymAdd(period, 1)) + ' saknades', nTlBak, P.tl, 25); rows[rows.length - 1].bak = true; }
    if (fsAktiv(B, period)) { const nb = cars.filter(x => x.person + x.bud + x.utland + x.app !== 0).length; add(57, 'Specifikation per förare ' + L.lang, nb, P.fs ?? 99, 25); }
    add(50, 'Krediter persontransport', 1, -sum('person') / (1 + P.m6), 6);
    add(51, 'Krediter bud', 1, -sum('bud') / (1 + P.m25), 25);
    add(54, 'Krediter Utland', 1, -sum('utland'), 0);
    for (const x of cars) add(52, 'Kontokort bil ' + x.bil, 1, -(x.kort + x.refund), 0);
    for (const x of cars) if (x.refund) { add(52, 'Återbetalning kort bil ' + x.bil, 1, x.refund, 0); kontroll.push({ niva: 'info', typ: 'Återbetalning kort dras från åkaren', vad: B.namn + ', bil ' + x.bil, belopp: r2(x.refund), atgard: 'Refund i Bambora (pengarna gick tillbaka till kunden). Egen rad art 52, 0 % moms. Ligger felet hos centralen: lägg en kreditrad under Övriga rader.' }); }
    for (const x of cars) add(56, 'Dricks bil ' + x.bil, 1, -x.dricks, 0);
    add(55, 'In app payment', 1, -sum('app'), 0);
    const bas = sum('kort') + sum('person') + sum('bud') + sum('utland') + sum('app');
    add(53, 'Service avgifter', 1, P.sa * bas, 25);
    for (const x of cars) {
      const fp = D.broRad?.[x.bil];
      if (fp && Object.values(fp).reduce((a, n) => a + n, 0) === x.bro) for (const [p, n] of Object.entries(fp).sort((a, b) => +a[0] - +b[0])) add(16, 'Oresundsbron ' + L.lang + ' ' + x.bil, n, +p, 25);
      else add(16, 'Oresundsbron ' + L.lang + ' ' + x.bil, x.bro, P.bro, 25);
    }
    { const pr = {};
      for (const x of cars) {
        const fr = D.sturupRad?.[x.bil];
        if (fr && !(D.sturup && D.sturup[x.bil] != null)) for (const [a, n] of Object.entries(fr)) pr[a] = (pr[a] || 0) + n;
        else if (x.sturup) pr[P.sturup.toFixed(2)] = (pr[P.sturup.toFixed(2)] || 0) + x.sturup;
      }
      for (const [a, n] of Object.entries(pr).sort((p, q) => +p[0] - +q[0])) add(15, 'Sturup passeringar ' + L.lang, n, +a, 25);
    }
    add(17, 'CPH PARKERING', sum('cph'), cphPris, 25);
    for (const f of (D.forskottRad || []).filter(f => f.med && f.bolag === B.namn).sort((a, b) => a.datum.localeCompare(b.datum)))
      add(59, 'FÖRSKOTTSBETALNING ' + f.datum.replace(/-/g, '.'), 1, +f.belopp, 0);
    if (+M.forskott) add(59, 'FÖRSKOTTSBETALNING', 1, +M.forskott, 0);
    if (+M.oppna) add(null, 'Övriga poster (manuellt)', 1, +M.oppna, 0);
    for (const e of (M.extra || [])) { if (!e || !String(e.text || '').trim()) continue; const a = e.art === '' || e.art == null ? null : +e.art;
      const n0 = rows.length; add(isNaN(a) ? null : a, String(e.text).trim(), +e.antal || 1, +e.apris || 0, [0, 6, 25].includes(+e.moms) ? +e.moms : 25);
      if (rows.length > n0) { rows[n0].extra = true; if (e.skuld) rows[n0].skuld = true; } }
    for (const p of reskFor(B)) { add(null, 'F' + p.nr + ' (' + p.fdat + ')' + (p.via ? ' kundnr ' + p.kn : ''), 1, p.saldo, 0); rows[rows.length - 1].skuld = true; }
    const bas25 = rows.filter(r => r.moms === 25).reduce((a, r) => a + r.summa, 0);
    const bas6 = rows.filter(r => r.moms === 6).reduce((a, r) => a + r.summa, 0);
    const netto = rows.reduce((a, r) => a + r.summa, 0);
    const moms25 = r2(bas25 * P.m25), moms6 = r2(bas6 * P.m6);
    const brutto = netto + moms25 + moms6, att = Math.round(brutto);
    const auto = rows.filter(r => r.art !== 59 && r.art !== null).reduce((a, r) => a + r.summa, 0);
    const kredit = sum('kort') + sum('person') + sum('bud') + sum('utland') + sum('app');
    const forsk = rows.filter(r => r.art === 59).reduce((a, r) => a + r.summa, 0);
    const skuld = r2(rows.filter(r => r.skuld).reduce((a, r) => a + r.summa, 0));
    bolag.push({ ...B, forsk, skuld, manad: Math.round(att - skuld), bilar: cars.map(x => x.bil), rows, netto: r2(netto), moms25, moms6, oresavr: r2(att - brutto), att,
      kredit, kort: sum('kort'), deb: sum('person') + sum('bud') + sum('utland'), app: sum('app'), bro: sum('bro'), sturup: sum('sturup'), cph: sum('cph'), aktiv: rows.length > 0 });
    if (B.gratisTom === 'alltid') kontroll.push({ niva: 'info', typ: 'Gratis växelavgift (alltid)', vad: B.namn, belopp: null, atgard: 'Avtalad gratis växelavgift utan slutdatum.' });
    else if (B.gratisTom && gratisFor(vxP)) { if (rows.length) kontroll.push({ niva: 'info', typ: 'Gratis växelavgift', vad: B.namn + ' t.o.m. ' + B.gratisTom, belopp: null, atgard: 'Avgiften för ' + L.vx + ' tas inte ut. Första avgiften tas i avräkningen två månader före första betalmånaden.' }); }
    else if (B.gratisTom && !B.vx) kontroll.push({ niva: 'fel', typ: 'Gratis växelavgift har gått ut', vad: B.namn + ' (gratis t.o.m. ' + B.gratisTom + ')', belopp: null, atgard: 'Sätt antal växelavgift under Inställningar, Bolag.' });
    else if (!B.vx && kredit > 0) kontroll.push({ niva: 'info', typ: 'Krediter men ingen växelavgift', vad: B.namn, belopp: kredit, atgard: 'Kontrollera om bolaget ska avräknas denna månad.' });
    if (fsAktiv(B, period) && rows.some(r => r.art === 57)) kontroll.push({ niva: 'info', typ: 'Spec per förare debiteras', vad: B.namn, belopp: rows.find(r => r.art === 57).summa, atgard: 'Art 57, antal bilar med körningar i månaden.' });
    if (bak) kontroll.push({ niva: 'info', typ: 'Växelavgift efterdebiteras', vad: B.namn + ': ' + nBak + ' st ' + lab(vxPrev) + ' saknades i förra avräkningen' + (prevHar ? ' (där fanns ' + nPrevVx + ' av ' + vxAntal + ')' : ''), belopp: r2(nBak * P.vx * (1 - rabPct / 100)), atgard: 'Tas med som extra rad art 1. Stämmer det inte: skriv rätt antal i "Efterdebitering växelavgift, antal" under bolagets manuella poster (0 = ingen).' });
    if (nTlBak) kontroll.push({ niva: 'info', typ: 'Taklampa efterdebiteras', vad: B.namn + ': ' + nTlBak + ' st saknades i förra avräkningen (där fanns ' + nPrevTl + ' av ' + B.tl + ')', belopp: r2(nTlBak * P.tl), atgard: 'Extra rad art 8. Stämmer det inte: skriv rätt antal i "Efterdebitering taklampa, antal" (0 = ingen).' });
    if (rabPct) kontroll.push({ niva: 'info', typ: 'Rabatt på växelavgift', vad: B.namn + ': ' + rabPct + ' %', belopp: null, atgard: 'Skriv rabatten i Vismas rabattkolumn på raden art 1.' });
  }
  if (RK) {
    const [py, pm] = (period || '0000-00').split('-').map(Number), last = period ? new Date(Date.UTC(py, pm, 0)).toISOString().slice(0, 10) : null;
    if (last && RK.datum !== last) kontroll.push({ niva: 'info', typ: 'Kundreskontran har annat datum', vad: 'Reskontradatum ' + RK.datum + ', avräkningsmånaden slutar ' + last, belopp: null, atgard: 'Ta ut kundreskontralistan per sista dagen i avräkningsmånaden.' });
    const prev = D.prevSummary ? Object.fromEntries((D.prevSummary.bolag || []).map(b => [b.namn, b.skuld || 0])) : null;
    for (const b of bolag) {
      if (!b.skuld) continue;
      if (b.skuld >= (P.skuldGrans || 50000)) kontroll.push({ niva: 'fel', typ: 'Hög skuld hos åkare', vad: b.namn, belopp: b.skuld, atgard: 'Obetalda avräkningar enligt kundreskontran. Följ upp betalning eller kvitta mot kommande utbetalningar.' });
      if (prev && prev[b.namn] != null && b.skuld > prev[b.namn] + 1) kontroll.push({ niva: 'info', typ: 'Skulden har ökat', vad: b.namn + ': ' + r2(prev[b.namn]) + ' kr blir ' + b.skuld + ' kr', belopp: r2(b.skuld - prev[b.namn]), atgard: 'Kontrollera varför förra avräkningen inte är betald.' });
      if (b.skuld < 0) kontroll.push({ niva: 'info', typ: 'Taxi Malmö har obetald skuld till åkare', vad: b.namn, belopp: b.skuld, atgard: 'Tidigare avräkning är inte utbetald. Den räknas med i Att betala.' });
    }
    const bolagKn = new Set(S.bolag.flatMap(b => [String(b.kn ?? ''), ...String(b.kn2 ?? '').split(/[,\s]+/)]).filter(Boolean));
    for (const [k, L] of Object.entries(rkBy)) if (k.startsWith('9119') && !bolagKn.has(k) && !used.has(k)) {
      const s = r2(L.reduce((a, p) => a + p.saldo, 0)); if (s) kontroll.push({ niva: 'info', typ: 'Tidigare åkare med öppet saldo', vad: k + ' ' + L[0].namn + ' (' + L.length + ' fakturor, äldsta ' + L[0].fdat + ')', belopp: s, atgard: s > 0 ? 'Gammal fordran. Överväg inkasso eller bortskrivning.' : 'Taxi Malmö är skyldig. Kontrollera och betala ut.' });
    }
  }
  const perBolagKredit = {};
  for (const x of pb.values()) perBolagKredit[x.bolag] = (perBolagKredit[x.bolag] || 0) + x.kort + x.person + x.bud + x.utland + x.app;
  for (const [n, v] of Object.entries(perBolagKredit)) if (v && !bolagNamn.has(n) && n !== 'IGNORERA' && n !== '(saknas i bilregistret)')
    kontroll.push({ niva: 'fel', typ: 'Bolag saknas under Bolag', vad: n, belopp: v, atgard: 'Lägg till bolaget under Inställningar, Bolag, annars faktureras det inte.' });
  { const ej = {}; for (const e of (D.app?.ejApp || [])) { const x = ej[e.bil] = ej[e.bil] || { n: 0, s: 0 }; x.n++; x.s += +e.belopp || 0; }
    for (const [b, x] of Object.entries(ej)) kontroll.push({ niva: 'info', typ: 'Kortbetalning utanför appen (räknas inte)', vad: 'Bil ' + b + ', ' + x.n + ' st', belopp: r2(x.s), atgard: 'Troligen egen terminal. Ingen åtgärd om det stämmer.' }); }
  if (D.oresund) {
    const O = D.oresund, nb = Object.values(D.bro || {}).reduce((a, x) => a + (+x || 0), 0), nc = Object.values(D.cph || {}).reduce((a, x) => a + (+x || 0), 0);
    for (const [r, n] of Object.entries(O.okandaBro || {})) kontroll.push({ niva: 'fel', typ: 'Bropassager på okänt reg nr', vad: r + ', ' + n + ' passager', belopp: n * P.bro, atgard: 'Lägg till bilen med reg nr under Inställningar, Bilar, annars faktureras passagerna inte.' });
    for (const [r, n] of Object.entries(O.okandaCph || {})) kontroll.push({ niva: 'fel', typ: 'CPH-hämtningar på okänt reg nr', vad: r + ', ' + n + ' st', belopp: n * P.cph, atgard: 'Lägg till bilen med reg nr under Inställningar, Bilar.' });
    if (O.manader?.length && period && !O.manader.includes(period))
      kontroll.push({ niva: 'info', typ: 'Brofakturan avser andra månader', vad: 'Faktura ' + (O.fakturadatum || '') + ', passager ' + O.manader.join(', '), belopp: null, atgard: 'Kontrollera att det är rätt brofaktura för ' + L.namn + '.' });
    const kontor = Object.entries(O.ovriga || {}).filter(([k]) => k.startsWith('bro|')).reduce((s, [, n]) => s + n, 0) * P.bro;
    if (O.prisAndring) kontroll.push({ niva: 'info', typ: 'Öresundsbron: nytt pris', vad: 'Fakturan har ' + O.prisAndring.till + ' kr per passage (tidigare ' + O.prisAndring.fran + ' kr)', belopp: null, atgard: 'Priset under Inställningar är uppdaterat. Åkarna debiteras fakturans pris.' });
    const nbx = bolag.reduce((s, b) => s + b.rows.filter(r => r.art === 16).reduce((a, r) => a + r.summa, 0), 0);
    if (O.kostBro != null) { const d = r2(nbx + kontor - O.kostBro);
      kontroll.push({ niva: Math.abs(d) > 1 ? 'fel' : 'info', typ: 'Öresundsbron: vidarefakturerat mot kostnad', vad: nb + ' passager, ' + r2(nbx) + ' kr' + (kontor ? ' + kontorets brickor ' + kontor + ' kr' : '') + ' mot fakturans ' + O.kostBro + ' kr exkl moms', belopp: d, atgard: d ? 'Passager saknas eller är fel kopplade. Diff ska vara 0.' : 'Stämmer.' }); }
    if (O.kostCph != null) kontroll.push({ niva: r2(nc * cphPris - O.kostCph) < -1 ? 'fel' : 'info', typ: 'CPH parkering: vidarefakturerat mot kostnad', vad: nc + ' st x ' + cphPris + ' kr mot fakturans ' + O.kostCph + ' kr exkl moms', belopp: r2(nc * cphPris - O.kostCph), atgard: 'Priset per hämtning följer fakturans kostnad (avrundat uppåt), så Taxi Malmö lägger aldrig ut.' });
  }
  if (D.oresund?.ovriga) for (const [k, n] of Object.entries(D.oresund.ovriga)) { const [t, o] = k.split('|');
    kontroll.push({ niva: 'info', typ: (t === 'bro' ? 'Bropassager' : 'CPH') + ' utan bil (kontorets bricka)', vad: o + ', ' + n + ' st', belopp: n * (t === 'bro' ? P.bro : P.cph), atgard: 'Faktureras inte vidare. Kontrollera att brickan är Taxi Malmös egen.' }); }
  if (D.sturupInfo) { const I = D.sturupInfo;
    for (const o of I.okanda || []) kontroll.push({ niva: 'fel', typ: 'Sturup: bil saknas i bilregistret', vad: 'Bil ' + o.bil + ' ' + o.reg + ', ' + o.antal + ' passager', belopp: o.belopp, atgard: 'Lägg till bilen under Inställningar, Bilar, annars faktureras passagerna inte.' });
    for (const a of I.avvik || []) kontroll.push({ niva: 'info', typ: 'Sturup: reg nr och bilnummer stämmer inte', vad: a.bilFil != null ? `Filen säger bil ${a.bilFil} med ${a.regFil}, registret säger bil ${a.bil}` : `Bil ${a.bil}: filen har ${a.regFil}, registret har ${a.regReg}`, belopp: null, atgard: a.bilFil != null ? 'Avräknat på bilen enligt reg nr. Kontrollera.' : 'Avräknat på bilnumret. Uppdatera reg nr i bilregistret om bilen bytts.' });
    if (I.period && period && I.period !== period) kontroll.push({ niva: 'info', typ: 'Sturupfakturan avser annan månad', vad: 'Passager ' + I.period, belopp: null, atgard: 'Kontrollera att det är rätt fil för ' + L.namn + '.' });
  }
  // Avstämning mot Visma (facit inläst för månaden): per faktura och artikel
  if (D.visma?.bolag) {
    const AN = { 1: 'växelavgift', 8: 'taklampa', 15: 'Sturup', 16: 'bron', 17: 'CPH', 50: 'krediter person', 51: 'krediter bud', 52: 'kontokort', 53: 'serviceavgift', 54: 'krediter utland', 55: 'app', 56: 'dricks', 57: 'spec per förare', 59: 'förskott' };
    const used = new Set();
    for (const b of bolag.filter(x => x.aktiv)) {
      const v = D.visma.bolag.find(x => String(x.kn) === String(b.kn)); if (!v) { kontroll.push({ niva: 'fel', typ: 'Saknas i Visma', vad: b.namn + ' (kundnr ' + b.kn + ')', belopp: b.att, atgard: 'Avräkningen finns inte bland Vismas fakturor för månaden.' }); continue; }
      used.add(v);
      const d = Math.round(b.att - v.att); if (Math.abs(d) < 2) continue;
      const sa = {}, sv = {}; for (const r of b.rows) { const k = r.art == null ? (r.skuld ? 'skuld' : 'övrigt') : r.art; sa[k] = (sa[k] || 0) + r.summa; }
      for (const r of v.rows || []) { const k = r.art == null ? (/^F\d{5}/.test(r.text) ? 'skuld' : 'övrigt') : r.art; sv[k] = (sv[k] || 0) + (+r.summa || 0); }
      const det = [...new Set([...Object.keys(sa), ...Object.keys(sv)])].map(k => [k, r2((sa[k] || 0) - (sv[k] || 0))]).filter(([, x]) => Math.abs(x) >= 1).map(([k, x]) => (AN[k] || (isNaN(+k) ? k : 'art ' + k)) + ' ' + (x > 0 ? '+' : '') + x).join(', ');
      kontroll.push({ niva: 'fel', typ: 'Avviker mot Visma', vad: b.namn + ', faktura ' + (v.nr || '') + (det ? ': ' + det + ' (exkl moms)' : ''), belopp: d, atgard: 'Sidan minus Visma, inkl moms. Rätta i Visma eller lägg mellanskillnaden på nästa månad.' });
    }
    for (const v of D.visma.bolag) if (!used.has(v)) kontroll.push({ niva: 'info', typ: 'Finns bara i Visma', vad: (v.namn || '') + ' faktura ' + (v.nr || '') + ' (kundnr ' + v.kn + ')', belopp: v.att, atgard: 'Kontrollera bolaget under Inställningar, Bolag (kundnr).' });
  }
  const tip = [...pb.values()].reduce((a, x) => a + x.dricks, 0);
  if (tip) kontroll.push({ niva: 'info', typ: 'Dricks krediteras åkarna (art 56, 0 % moms)', vad: 'Alla bilar', belopp: tip, atgard: 'Åkeriet betalar ut dricksen till föraren som lön.' });

  // Kundfakturor
  const kon = new Map();
  for (const t of (D.tc?.trips || [])) {
    const k = t.konto?.nr; if (!kon.has(k)) kon.set(k, { nr: k, namn: t.konto?.namn, n: 0, person: 0, bud: 0, utland: 0 });
    const x = kon.get(k); x.n++; x[t.typ] += t.belopp;
    (x.korn = x.korn || []).push({ d: t.datum, t: t.tid, p: t.pass.replace(/\s+/g, ' ').trim().slice(0, 60), r: t.rutt.split('Info:')[0].split('Id:')[0].replace(/#\d+\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 160), b: t.bil, s: t.belopp, y: t.typ[0], f: String(t.forare || '').replace(/\s+/g, ' ').trim() });
  }
  const kund = [...kon.values()].map(x => {
    const tot = x.person + x.bud + x.utland, tcb = D.tc?.fakt?.[x.nr];
    const o = { ...x, r592: r2(x.person / (1 + P.m6)), r593: r2(x.bud / (1 + P.m25)), r594: r2(x.utland), total: r2(tot), taxicaller: tcb ?? null, diff: tcb == null ? null : r2(tot - tcb) };
    if (o.diff) kontroll.push({ niva: 'fel', typ: 'Kundfaktura avviker mot TaxiCaller', vad: 'Konto ' + x.nr + ' ' + x.namn, belopp: o.diff, atgard: 'Kontrollera körningarna i TaxiCaller.' });
    return o;
  }).sort((a, b) => (a.namn || '').localeCompare(b.namn || '', 'sv'));

  const aktiva = bolag.filter(b => b.aktiv);
  const kpi = {
    kundTotal: r2(kund.reduce((a, k) => a + k.total, 0)), kundAntal: kund.length, korningar: (D.tc?.trips || []).length,
    kort: r2(bolag.reduce((a, b) => a + b.kort, 0)), app: r2(bolag.reduce((a, b) => a + b.app, 0)),
    vx: aktiva.reduce((a, b) => a + b.rows.filter(r => r.art === 1).reduce((s, r) => s + r.summa, 0), 0),
    serv: r2(aktiva.reduce((a, b) => a + (b.rows.find(r => r.art === 53)?.summa || 0), 0)),
    skuldPos: aktiva.reduce((a, b) => a + Math.max(0, b.skuld || 0), 0), skuldNeg: aktiva.reduce((a, b) => a + Math.min(0, b.skuld || 0), 0),
    utbet: aktiva.filter(b => b.att < 0).reduce((a, b) => a + b.att, 0), inbet: aktiva.filter(b => b.att > 0).reduce((a, b) => a + b.att, 0),
    fel: kontroll.filter(k => k.niva === 'fel').length
  };
  return { period, L, perBil: [...pb.values()].sort((a, b) => a.bil - b.bil), bolag, kund, kontroll, kpi };
}


// Øresundsbro Konsortiet samlingsfaktura (bro + CPH parkering)
function parseOresund(pages) {
  const lines = pages.flatMap(p => groupLines(p).map(r => r.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim()));
  const txt = lines.join('\n');
  if (!/Øresundsbro|Oresundsbro|oresundpay/i.test(txt)) return null;
  const num = s => +String(s).replace(/\s/g, '').replace(',', '.');
  const fd = (txt.match(/Fakturadatum:?\s*(\d{4}-\d\d-\d\d)/) || [])[1] || null;
  const kb = txt.match(/Øresundsbro Konsortiet SEK (\d{1,3}(?: \d{3})*,\d\d)/);
  const kc = txt.match(/CPH Parkering[^\n]*?\s(\d{1,3}(?: \d{3})*,\d\d)\s*$/m);
  const bro = {}, cph = {}, tag = {}, man = {}, ovriga = {}, broPris = {};
  let sect = 'bro';
  for (const l of lines) {
    if (/Leverantör/.test(l) && /CPH/.test(l)) sect = 'cph';
    else if (/Leverantör/.test(l) && /Øresundsbro/.test(l)) sect = 'bro';
    const d = l.match(/(\d{4}-\d\d)-\d\d \d\d:\d\d/);
    if (!d || !/Klass|Pick-up|fee/i.test(l)) continue;
    const t = /Klass/.test(l) ? 'bro' : 'cph';
    man[d[1]] = (man[d[1]] || 0) + 1;
    const m = l.match(/\b([A-Z]{3}\s?\d{2}[A-Z0-9])\s?\/\s?(?:ID|BIL)?\s?(\d*)/);
    if (m) {
      const reg = m[1].replace(/\s/g, '');
      (t === 'bro' ? bro : cph)[reg] = ((t === 'bro' ? bro : cph)[reg] || 0) + 1;
      if (t === 'bro') { const pm = l.match(/(\d{1,3}(?: \d{3})*,\d\d)\s*$/); if (pm) { const p = (+pm[1].replace(/\s/g, '').replace(',', '.')).toFixed(2); (broPris[reg] = broPris[reg] || {})[p] = (broPris[reg][p] || 0) + 1; } }
      if (m[2] && m[2].length >= 3) tag[reg] = +m[2];
    } else {
      const o = (l.match(/\/\s*([^\d/][^/]*?)\s+25,00/) || [])[1] || 'okänd bricka';
      const k = t + '|' + o.trim(); ovriga[k] = (ovriga[k] || 0) + 1;
    }
  }
  return { fakturadatum: fd, manader: Object.keys(man).sort(), bro, cph, tag, ovriga, broPris,
    kostBro: kb ? num(kb[1]) : null, kostCph: kc ? num(kc[1]) : null };
}
// reg -> bil via bilregistret, annars bilnumret i fakturans text
function mapRegCounts(counts, tag, bilar) {
  const reg = {}; bilar.forEach(b => { if (b.reg) reg[String(b.reg).replace(/\s/g, '').toUpperCase()] = +b.bil; });
  const nr = new Set(bilar.map(b => +b.bil));
  const ut = {}, okanda = {};
  for (const [r, n] of Object.entries(counts)) {
    const b = reg[r] ?? (tag[r] && nr.has(tag[r]) ? tag[r] : null);
    if (b != null) ut[b] = (ut[b] || 0) + n; else okanda[r + (tag[r] ? ' (bil ' + tag[r] + ')' : '')] = n;
  }
  return { ut, okanda };
}

// Swedavia Malmö Airport (Sturup): block per bil med passager och pris inkl moms
function parseSturup(pages) {
  const lines = pages.flatMap(p => groupLines(p).map(r => r.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim()));
  const txt = lines.join('\n');
  if (!/Swedavia|Malmö Airport/i.test(txt)) return null;
  const pm = txt.match(/Debiteras[^:]*:\s*(\d\d)\.(\d\d)\.(\d\d)/);
  const period = pm ? '20' + pm[3] + '-' + pm[2] : null;
  const cars = []; let cur = null;
  for (const l of lines) {
    // Rubrik per bil: "Bil 466 PUC06X (320) Taxi klass 2", "Bil 447 CKC50E (626) Taxi (faktureras)", "Bil ? SXM30H (1735) ...", " GFD83P (1635) ..."
    const h = l.match(/^(?:Bil\s+(\d+|\?)\s+)?([A-Z]{3}\s?\d{2}[A-Z0-9])\s*\(\d+\)\s*Taxi\s*(?:klass\s*(\d)|\(faktureras\))/);
    if (h) { const reg = h[2].replace(/\s/g, ''), bn = h[1] && h[1] !== '?' ? +h[1] : null; cur = cars.find(c => c.reg === reg); if (!cur) { cur = { bil: bn, reg, klass: h[3] ? +h[3] : null, priser: [] }; cars.push(cur); } continue; }
    const r = l.match(/^P\d.*?\d\d\.\d\d\.\d\d \d\d:\d\d.*?(\d+,\d\d)\s*-+\s*$/);
    if (r && cur) cur.priser.push(+r[1].replace(',', '.'));
  }
  const total = cars.reduce((a, c) => a + c.priser.reduce((x, y) => x + y, 0), 0);
  const antal = cars.reduce((a, c) => a + c.priser.length, 0);
  if (!antal) return null;
  return { period, cars, total: Math.round(total * 100) / 100, antal };
}
// Koppla Sturup-bilar: reg nr först, annars bilnumret. Ger {bil: {apris_exkl: antal}}
function mapSturup(st, bilar, m25) {
  const reg = {}; bilar.forEach(b => { if (b.reg) reg[String(b.reg).replace(/\s/g, '').toUpperCase()] = +b.bil; });
  const nr = new Map(bilar.map(b => [+b.bil, b]));
  const rad = {}, okanda = [], avvik = [];
  for (const c of st.cars) {
    let b = reg[c.reg];
    if (b == null && c.bil != null && nr.has(c.bil)) { b = c.bil; avvik.push({ bil: c.bil, regFil: c.reg, regReg: nr.get(c.bil).reg }); }
    else if (b != null && c.bil != null && b !== c.bil) avvik.push({ bil: b, regFil: c.reg, bilFil: c.bil });
    if (b == null) { okanda.push({ bil: c.bil, reg: c.reg, antal: c.priser.length, belopp: c.priser.reduce((a, x) => a + x, 0) }); continue; }
    rad[b] = rad[b] || {};
    for (const p of c.priser) { const k = (Math.round(p / (1 + m25) * 100) / 100).toFixed(2); rad[b][k] = (rad[b][k] || 0) + 1; }
  }
  return { rad, okanda, avvik };
}

// ===== Kontoutdrag =====
function parseAmount(s) {
  if (typeof s === 'number') return s;
  let t = String(s ?? '').replace(/\u2212/g, '-').replace(/\s|\u00a0/g, '').replace(/kr|SEK/gi, '');
  if (!/\d/.test(t)) return null;
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(/,/g, '');
  const n = parseFloat(t); return isNaN(n) ? null : n;
}
function parseDate(s) {
  if (s instanceof Date) return s.toISOString().slice(0, 10);
  if (typeof s === 'number' && s > 30000 && s < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + s * 864e5); return d.toISOString().slice(0, 10); }
  const t = String(s ?? '').trim();
  let m = t.match(/^(\d{4})-?(\d\d)-?(\d\d)/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d\d)[./-](\d\d)[./-](\d{2,4})/); if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2]}-${m[1]}`;
  m = t.match(/^(\d\d)(\d\d)(\d\d)$/); if (m) return `20${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
// rows: array av arrayer (första raderna kan vara rubriker)
function parseBankRows(rows) {
  let hi = -1, cD = -1, cA = -1, cT = [];
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const h = rows[i].map(x => String(x ?? '').toLowerCase());
    const d = h.findIndex(x => /(transaktions|bokförings|reskontra|valuta)?dat|bokföringsdag|^dag$/.test(x));
    const a = h.findIndex(x => /^belopp|belopp$|^summa|amount/.test(x));
    if (d >= 0 && a >= 0) { hi = i; cD = d; cA = a; cT = h.map((x, j) => /text|meddelande|beskrivning|mottagare|referens|namn|specifikation|avsändare/.test(x) ? j : -1).filter(j => j >= 0); break; }
  }
  const out = [];
  const start = hi >= 0 ? hi + 1 : 0;
  for (let i = start; i < rows.length; i++) {
    const r = rows[i]; if (!r || !r.length) continue;
    let dat, bel, txt;
    if (hi >= 0) { dat = parseDate(r[cD]); bel = parseAmount(r[cA]); txt = (cT.length ? cT : r.map((_, j) => j).filter(j => j !== cD && j !== cA && typeof r[j] === 'string')).map(j => String(r[j] ?? '').trim()).filter((x, k, arr) => x && arr.indexOf(x) === k).join(' '); }
    else { const di = r.findIndex(x => parseDate(x)); if (di < 0) continue; dat = parseDate(r[di]); const nums = r.map(parseAmount).map((n, j) => ({ n, j })).filter(o => o.n != null && o.j !== di); if (!nums.length) continue; bel = nums[nums.length > 1 ? nums.length - 2 : 0].n; txt = r.filter((x, j) => j !== di && typeof x === 'string' && parseAmount(x) == null).join(' '); }
    if (dat && bel != null) out.push({ datum: dat, text: String(txt || '').replace(/\s+/g, ' ').trim(), belopp: bel });
  }
  return out;
}
function parseBankText(text) {
  const out = [], D = String.raw`(?:\d{4}-\d\d-\d\d|\d\d\.\d\d\.\d{2,4}|\d{6})`, A = String.raw`-?\d{1,3}(?:[  ]\d{3})*,\d\d`;
  const re = new RegExp(String.raw`^\s*(?:\d{4}\s+)?(${D})(?:\s+${D}){0,2}\s+(.*?)\s+(${A})(?:\s+(${A}))?\s*$`);
  for (const l of text.split('\n')) {
    const m = l.match(re);
    if (m && m[2] && !/saldo/i.test(m[2])) out.push({ datum: parseDate(m[1]), text: m[2].trim(), belopp: parseAmount(m[3]) });
  }
  return out;
}
const STOP = new Set(['ÖRESUNDSBRO', 'FÖRSK', 'FÖRS', 'FORSK', 'ANSTÄLLD', 'AB', 'TAXI', 'TRANSPORT', 'TRANSPORTER', 'SERVICE', 'MALMÖ', 'MALMO', 'SYD', 'OCH', 'BG', 'PG', 'BANKGIRO', 'BETALNING', 'ÖVERFÖRING', 'OVERFORING', 'FÖRSKOTT', 'LÖN', 'I', 'AKTIEBOLAG', 'HB', 'KB']);
const deacc = s => String(s || '').toUpperCase().replace(/[ÉÈÊË]/g, 'E').replace(/[ÁÀÂ]/g, 'A').replace(/Ü/g, 'U');
const toks = s => deacc(s).replace(/[^A-ZÅÄÖÉ0-9 ]/g, ' ').split(/\s+/).filter(t => t.length >= 3 && !STOP.has(t));
function guessBolag(text, bolag, map) {
  const key = deacc(text).replace(/\s+/g, ' ').trim();
  if (map && map[key]) return { bolag: map[key], kalla: 'sparad' };
  const T = new Set(toks(text)); let best = null, bs = 0;
  const hit = t => [...T].some(u => u === t || (Math.min(u.length, t.length) >= 4 && (u.startsWith(t) || t.startsWith(u) || u.includes(t))));
  for (const b of bolag) { const s = toks(b).filter(hit).length; if (s > bs) { bs = s; best = b; } }
  return best ? { bolag: best, kalla: 'gissad' } : { bolag: '', kalla: '' };
}

function mapRegPrices(pris, tag, bilar) {
  const reg = {}; bilar.forEach(b => { if (b.reg) reg[String(b.reg).replace(/\s/g, '').toUpperCase()] = +b.bil; });
  const nr = new Set(bilar.map(b => +b.bil)); const ut = {};
  for (const [r, pp] of Object.entries(pris || {})) {
    const b = reg[r] ?? (tag[r] && nr.has(tag[r]) ? tag[r] : null); if (b == null) continue;
    ut[b] = ut[b] || {}; for (const [p, n] of Object.entries(pp)) ut[b][p] = (ut[b][p] || 0) + n;
  }
  return ut;
}

// Visma Administration: Kundreskontralista (Uppgifter per faktura)
function parseReskontra(pages) {
  const lines = pages.flatMap(p => groupLines(p).map(r => r.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim()));
  const txt = lines.join('\n'); if (!/Kundreskontralista/i.test(txt)) return null;
  const datum = (txt.match(/Reskontradatum:\s*(\d{4}-\d\d-\d\d)/) || [])[1] || null;
  const A = String.raw`(-?\d{1,3}(?: \d{3})*,\d\d)`, num = s => +s.replace(/\s/g, '').replace(',', '.');
  const poster = []; let kund = null, inv = null;
  for (const l of lines) {
    let m = l.match(/^(\d{3,8}) ([^\d].*)$/);
    if (m && !/\d\d-\d\d-\d\d/.test(l) && !/Sida|Antal|Fakturerat|Kundfordran/.test(l)) { kund = { kn: m[1], namn: m[2].trim() }; inv = null; continue; }
    m = l.match(new RegExp(String.raw`^(\d+) (\d\d-\d\d-\d\d) (\d\d-\d\d-\d\d) .*?(Faktura|Kredit\w*) ` + A + '$'));
    if (m && kund) { inv = { kn: kund.kn, namn: kund.namn, nr: m[1], fdat: '20' + m[2], typ: m[4], belopp: num(m[5]), saldo: null }; poster.push(inv); continue; }
    m = l.match(new RegExp('Saldo: ' + A));
    if (m && inv && inv.saldo == null) inv.saldo = num(m[1]);
  }
  const open = poster.filter(p => p.saldo);
  return { datum, antal: poster.length, poster: open.map(({ kn, namn, nr, fdat, saldo }) => ({ kn, namn, nr, fdat, saldo })) };
}

// Visma Administration: utskrift av skickade fakturor (en eller flera, flersidiga). Ger facit per faktura och rad.
function parseVismaFakturor(pages) {
  const num = s => { const t = String(s).replace(/\s/g, '').replace(',', '.'); const n = parseFloat(t); return isNaN(n) ? null : n; };
  const out = new Map();
  for (const items of pages) {
    const L = groupLines(items), txt = L.map(r => r.items.map(i => i.str).join(' ')).join('\n');
    if (!/Fakturanummer/.test(txt) || !/Artnr/.test(txt)) continue;
    const nr = (txt.match(/Fakturanummer\s+(\d+)/) || [])[1]; if (!nr) continue;
    let f = out.get(nr);
    if (!f) {
      const ai = L.findIndex(r => /Fakturaadress/.test(r.items.map(i => i.str).join(' ')));
      const namn = ai >= 0 ? (r => r.items.filter(i => i.x > 380).map(i => i.str).join(' ').trim())(L[ai]) : '';
      f = { nr, kn: (txt.match(/Kundnummer\s+(\d+)/) || [])[1] || '', namn, datum: (txt.match(/Fakturadatum\s+(\d{4}-\d\d-\d\d)/) || [])[1] || '', att: null, rows: [] };
      out.set(nr, f);
    }
    let inRows = false, last = null;
    for (const r of L) {
      const t = r.items.map(i => i.str).join(' ');
      if (/^Artnr\b/.test(t.trim()) && /Benämning/.test(t)) { inRows = true; continue; }
      if (!inRows) continue;
      if (/^Netto\b/.test(t.trim()) || /Forts\.\.\./.test(t) || /Tel:/.test(t)) { inRows = false; continue; }
      if (/^SJÄLVFAKTURA$/.test(t.trim())) continue;
      const col = (a, b) => r.items.filter(i => i.x >= a && i.x < b).map(i => i.str.trim()).join('');
      const art = col(0, 120), ben = r.items.filter(i => i.x >= 120 && i.x < 318).map(i => i.str.trim()).join(' ').trim();
      const antal = col(318, 372), apris = col(372, 470), mid = col(470, 494), summa = col(494, 600);
      const pct = (r.items.find(i => /%\s*$/.test(i.str) && i.x >= 420) || {}).str;
      if (!art && !antal && !summa && ben && last) { last.text += ' ' + ben; continue; }
      if (!ben && !summa) continue;
      last = { art: /^\d+$/.test(art) ? +art : null, text: ben, antal: num(antal), apris: num(apris), summa: num(summa) };
      if (pct) last.rabattPct = num(pct.replace('%', ''));
      if (last.summa == null && last.antal != null && last.apris != null) last.summa = Math.round(last.antal * last.apris * (1 - (last.rabattPct || 0) / 100) * 100) / 100;
      f.rows.push(last);
    }
    const ab = L.find(r => /^ATT BETALA$/.test(r.items.filter(i => i.x < 480).map(i => i.str).join(' ').trim()));
    if (ab) f.att = num(ab.items.filter(i => i.x >= 480).map(i => i.str.trim()).join(''));
  }
  return [...out.values()];
}



export {
  MANAD, MAN3, r2, groupLines, parseTaxiCaller, parseBambora, parseTcCsv, parseApp, countPassages,
  fsAktiv, fsProv, fsVisa, ymAdd, monthLabels, compute,
  parseOresund, mapRegCounts, parseSturup, mapSturup,
  parseAmount, parseDate, parseBankRows, parseBankText, guessBolag, deacc, toks, STOP,
  mapRegPrices, parseReskontra, parseVismaFakturor
};
