// Motor för Åkarkassan och Tripkassan. Flyttad från legacy/apps/akarkassan/index.html (objektet ENG).
// De två prototyperna hade nästan samma kod. Skillnaderna ligger nu i VARIANTS nedan.
// Arbetsgivaravgifterna läses från config/skatter.js (giltighetsdatum) i stället för att stå i koden.
/* eslint-disable */
import { agAvgiftMedSatser } from '../config/skatter.js';

const BASE_DEF = {
  procent: 35, semester: 12, utbetDag: 10, broAndel: 35, broPris: 201, cphPris: 17.04, inklPickup: true, inklSturup: true, bomBortLon: true,
  momsKlass: [25, 12, 6, 0, 0], dagStart: 4, dagSlut: 16,
  redovForarandel: 40, agAvgift: 31.42, broMarginalMin: 20
};

export const VARIANTS = {
  akarkassan: { def: {}, fastUtanPass: false, kontantEndastProcent: false },
  tripkassan: { def: { utbetDag: 25, utbetDagProv: 7, utbSamma: true }, fastUtanPass: true, kontantEndastProcent: true }
};

/** Skapar motorn för en variant ('akarkassan' eller 'tripkassan'). */
export function createEngine(variant = 'akarkassan') {
  const V = VARIANTS[variant];
  if (!V) throw new Error('Okänd variant: ' + variant);
  const DEF = { ...BASE_DEF, ...V.def };
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
  const pad = n => String(n).padStart(2, '0');
  const normReg = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const toDate = s => { const m = String(s).match(/(\d{4})-(\d\d)-(\d\d)[ T]+(\d\d):(\d\d)(?::(\d\d))?/); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : null; };
  const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const tstr = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
  const isoWeek = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7); };

  function decode(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { return new TextDecoder('windows-1252').decode(buf); }
  }

  /* Megtax/FlexMate löneunderlag (LDL.txt). Belopp i öre. */
  function parseLDL(text) {
    const shifts = []; let cur = null; const warn = [];
    text.split(/\r?\n/).forEach((line, i) => {
      const f = line.split(';');
      if (f[0] === '01' && f.length >= 30) {
        const n = k => (+f[k] || 0) / 100;
        const s = {
          id: f[6] + '-' + f[1] + '-' + f[2], rap: f[1], start: f[2], slut: f[3], rast: +f[4] || 0,
          forare: f[5], bilId: f[6], regnr: (f[7] || '').trim(), reg: normReg(f[7]), orgnr: f[8], foretag: f[9],
          turer: +f[12] || 0, passKm: (+f[13] || 0) / 10, betKm: (+f[14] || 0) / 10,
          kont: n(15), kred: n(16), kontDricks: n(17), kredDricks: n(18),
          kontKl: [n(20), n(21), n(22), n(23), n(24)], kredKl: [n(25), n(26), n(27), n(28), n(29)], pay: []
        };
        const a = toDate(s.start), b = toDate(s.slut);
        if (!a || !b) { warn.push('Rad ' + (i + 1) + ': kunde inte läsa tider'); cur = null; return; }
        s.a = a; s.b = b; s.tim = Math.max(0, (b - a) / 36e5 - s.rast / 60);
        if (s.kont + s.kred === 0 && s.turer === 0) { cur = null; return; } // tomma testpass
        shifts.push(s); cur = s;
      } else if (f[0] === '02' && cur) {
        const vals = f.slice(1).map(x => x.trim()).filter(x => x !== '');
        const count = +vals[vals.length - 1] || 0, amount = (+vals[vals.length - 2] || 0) / 100;
        cur.pay.push({ kod: vals[0], namn: vals.slice(1, vals.length - 2).join(' ') || vals[0], belopp: amount, antal: count });
        if (vals[0] === '999') cur.bom = (cur.bom || 0) + amount;
      }
    });
    return { shifts, warn };
  }

  /* Rader från en Øresundsbro-faktura (text per rad). */
  function parseBro(lines) {
    let kurs = null; const rows = [];
    for (const l of lines) {
      const k = l.match(/DKK\s+[\d\s]+,\d\d\s+(\d{1,3},\d{2})\s+25,00/);
      if (k && !kurs) kurs = parseFloat(k[1].replace(',', '.'));
      const m = l.match(/(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)(?:\s+(\d\d:\d\d:\d\d))?\s+(.+?)\s+(SEK|DKK)\s+([\d\s]*\d,\d\d)\s*$/);
      if (!m) continue;
      const rest = m[3];
      const regM = rest.match(/\b([A-Z]{3}\s?\d{2}[A-Z0-9])\s*\//) || rest.match(/\b([A-Z]{3}\s?\d{2}[A-Z0-9])\b/);
      const typ = /Klass|SV\/DK|DK\/SV/i.test(rest) ? 'bro' : 'avgift';
      const desc = (rest.match(/(SV\/DK Klass \d|DK\/SV Klass \d|Pick-up fee[^A-Z]*Zone\d|Pick-up fee)/i) || [typ === 'bro' ? 'Bro' : 'Avgift'])[0];
      rows.push({ ts: m[1], ts2: m[2] || null, t: toDate(m[1]), desc, reg: regM ? normReg(regM[1]) : '', typ, valuta: m[4], belopp: parseFloat(m[5].replace(/\s/g, '').replace(',', '.')), text: l.trim() });
    }
    return { rows, kurs: kurs || null };
  }

  /* Swedavia Malmö Airport (Sturup): block per bil, rader med in- och utpassage. Pris inkl moms. */
  function parseSturup(lines) {
    const rows = []; let reg = '', bil = '';
    for (const l of lines) {
      const h = l.match(/(?:Bil\s+(\d+)\s+)?\b([A-Z]{3}\s?\d{2}[A-Z0-9])\s+\(\d+\)/);
      if (h) { reg = normReg(h[2]); bil = h[1] || ''; continue; }
      const m = l.match(/(\d\d)\.(\d\d)\.(\d\d)\s+(\d\d):(\d\d)\s+(\d\d)\.(\d\d)\.(\d\d)\s+(\d\d):(\d\d).*?\s(\d+,\d\d)\s/);
      if (!m || !reg) continue;
      const t = new Date(2000 + +m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
      const ts = dstr(t) + ' ' + tstr(t) + ':00';
      rows.push({ ts, t, ts2: null, desc: 'Sturup ' + (/förbokad/i.test(l) ? 'förbokad' : 'P5'), reg, bil, typ: 'sturup', valuta: 'SEK', belopp: parseFloat(m[11].replace(',', '.')), text: l.trim() });
    }
    return { rows };
  }


  /* Avräkning (faktura) från Taxi Malmö AB till åkeriet. */
  function parseAvrakning(lines) {
    const money = t => { const m = t.match(/(-?\d{1,3}(?: \d{3})*,\d\d)$/); return m ? parseFloat(m[1].replace(/\s/g, '').replace(',', '.')) : null; };
    const rows = []; let nr = '', datum = '', attBetala = null;
    for (const l0 of lines) {
      const l = l0.trim();
      const fn = l.match(/^(?:Fakturanummer\s+)?(\d{5})\s+\d{7}\s+(\d{4}-\d\d-\d\d)/) || l.match(/^Fakturanummer\s+(\d{5})$/); if (fn && !nr) nr = fn[1];
      const fd = l.match(/Fakturadatum\s+(\d{4}-\d\d-\d\d)/); if (fd) datum = fd[1]; if (fn && fn[2]) datum = fn[2];
      const ab = l.match(/^ATT BETALA(?: SEK)?\s+(-?[\d ]+,\d\d)$/); if (ab) attBetala = parseFloat(ab[1].replace(/\s/g, '').replace(',', '.'));
      const m = l.match(/^(\d{1,2})\s+(.*)$/); if (!m) continue;
      const art = +m[1]; if (![1, 8, 15, 16, 17, 50, 51, 52, 53, 54, 55, 59].includes(art)) continue;
      let sum = money(m[2]); if (sum == null) continue;
      const bil = (m[2].match(/[Bb]il (\d{3})/) || m[2].match(/^\D*\d{4}\s(\d{3})\s/) || [])[1] || '';
      let antal = null;
      if ([1, 8, 15, 16, 17].includes(art)) {
        const ap = art <= 8 ? m[2].match(/(?:^|\s)(\d+) (\d{1,2} \d{3},\d\d|\d{1,3},\d\d) /) : m[2].match(/(?:^|\s)(\d+) (\d{1,3},\d\d) /);
        if (ap) { antal = +ap[1]; const apris = parseFloat(ap[2].replace(/\s/g, '').replace(',', '.'));
          const mm = m[2].match(/\s(\d) (\d{1,3}(?: \d{3})*,\d\d)$/); // en ensam momskod före summan
          if (mm && Math.abs(antal * apris - sum) > 1) { const alt = parseFloat(mm[2].replace(/\s/g, '').replace(',', '.')); if (Math.abs(antal * apris - alt) < Math.abs(antal * apris - sum)) sum = alt; } }
      }
      const text = { 1: 'Växelavgift', 8: 'Taklampa hyra', 15: 'Sturup passeringar', 16: 'Øresundsbron', 17: 'CPH parkering', 50: 'Krediter persontransport', 51: 'Krediter bud', 52: 'Kontokort', 53: 'Serviceavgifter', 54: 'Krediter utland', 55: 'Appbetalningar', 59: 'Förskottsbetalning' }[art];
      rows.push({ art, text, bil, antal, summa: sum });
    }
    return { nr, datum, attBetala, rows };
  }


  /* ===== Skatt och avgifter ===== */
  // Skatteverkets textfil allmanna-tabeller-manad.txt: "30B33  15201  15300 2279 2186 1215 2279 3832 3832"
  function parseSkattetabell(text) {
    const T = {};
    text.split(/\r?\n/).forEach(l => {
      if (!/^30[B%]\d\d/.test(l)) return;
      const tab = l.slice(3, 5), typ = l[2], to = +l.slice(12, 19), cols = [0, 1, 2, 3, 4, 5].map(i => +l.slice(19 + i * 5, 24 + i * 5));
      const t = T[tab] = T[tab] || { B: [], P: [] }; (typ === 'B' ? t.B : t.P).push([to, ...cols]);
    });
    return T;
  }
  function packTabell(t) { return t.B.map(r => r.join(',')).join(';') + '|' + t.P.map(r => r.join(',')).join(';'); }
  function unpackTabell(s) { if (!s) return null; const [b, p] = s.split('|'); const f = x => x ? x.split(';').map(r => r.split(',').map(Number)) : []; return { B: f(b), P: f(p) }; }
  function compactTabell(s) { // "to:c1,..;%to:.." till {B,P}
    const t = { B: [], P: [] }; s.trim().split(';').forEach(x => { const pct = x[0] === '%'; const [to, c] = x.replace('%', '').split(':'); (pct ? t.P : t.B).push([+to, ...c.split(',').map(Number)]); }); return t;
  }
  function tabellSkatt(t, kol, brutto) {
    if (!t || brutto <= 0) return 0; const k = Math.min(6, Math.max(1, kol || 1)); const b = Math.floor(brutto);
    if (t.B.length && b <= t.B[t.B.length - 1][0]) { const r = t.B.find(r => b <= r[0]); return r ? r[k] : 0; }
    const r = t.P.find(r => r[0] === 0 || b <= r[0]) || t.P[t.P.length - 1]; return r ? Math.floor(b * r[k] / 100) : 0;
  }
  function fodelsear(pnr) { const m = String(pnr || '').replace(/\D/g, ''); if (m.length === 12) return +m.slice(0, 4); if (m.length === 10) { const yy = +m.slice(0, 2); const sekel = String(pnr).includes('+') ? 1900 : (yy > (new Date().getFullYear() % 100) ? 1900 : 2000); return sekel + yy; } return null; }
  function skattekolumn(pnr, ar) { const f = fodelsear(pnr); return f && f <= ar - 67 ? 3 : 1; }
  // Arbetsgivaravgift efter ålder vid årets ingång och utbetalningsmånad (yyyy-mm)
  function agAvgift(pnr, brutto, utbMan) { return agAvgiftMedSatser(pnr, brutto, utbMan, fodelsear); }


  function periodOf(d, cfg) { const h = d.getHours() + d.getMinutes() / 60; return (h >= cfg.dagStart && h < cfg.dagSlut) ? 'dag' : 'natt'; }
  /* Dag/kväll per Megtax-pass. Grund: passets mitt. Sedan inloggningsordningen i bilen: tar en förare över bilen
     (inloggning inom 3 tim efter förra utloggningen) och båda passen hamnat på samma sida, blir det första dagpass
     och det som tar över kvällspass. Hela passet räknas alltid till en sida, inkörningen delas aldrig vid ett klockslag. */
  const PER = new WeakMap();
  const midPeriod = (s, cfg) => periodOf(new Date((s.a.getTime() + s.b.getTime()) / 2), cfg);
  function markPeriods(shifts, cfg) {
    const by = {}; shifts.forEach(s => { PER.set(s, midPeriod(s, cfg)); (by[s.reg] = by[s.reg] || []).push(s); });
    Object.values(by).forEach(l => { l.sort((x, y) => x.a - y.a); for (let i = 1; i < l.length; i++) {
      const x = l[i - 1], y = l[i], gap = y.a - x.b; if (gap < -18e5 || gap > 3 * 36e5 || x.forare === y.forare) continue;
      const px = PER.get(x), py = PER.get(y);
      if (px === 'dag' && py === 'dag' && (dstr(y.b) !== dstr(y.a) || y.b.getHours() >= cfg.dagSlut)) PER.set(y, 'natt');
      else if (px === 'natt' && py === 'natt' && dstr(x.a) === dstr(y.a) && x.a.getHours() >= cfg.dagStart && x.a.getHours() < cfg.dagSlut) PER.set(x, 'dag');
    } });
  }
  function shiftPeriod(s, cfg) { return PER.get(s) || midPeriod(s, cfg); }
  function exkl(s, cfg) { let e = 0; for (let c = 0; c < 5; c++) e += (s.kontKl[c] + s.kredKl[c]) / (1 + cfg.momsKlass[c] / 100); return e; }

  /* Koppla passager till pass enbart på Megtax start- och sluttid för samma bil.
     1) passagen ligger inom passet, 2) annars inom marginalen före start eller efter slut (närmaste pass vinner),
     3) annars ingen förare: passagen läggs i "Passager utan förare" med närmaste pass som förslag. Ingen dag/natt-regel. */
  function matchBro(passages, shifts, cfg, overrides) {
    const byReg = {}; shifts.forEach(s => (byReg[s.reg] = byReg[s.reg] || []).push(s));
    const mg = (cfg.broMarginalMin || 0) * 6e4;
    const dist = (t, x) => t < x.a ? x.a - t : t > x.b ? t - x.b : 0;
    return passages.map(p => {
      const key = p.ts + '|' + p.reg + '|' + p.typ;
      const o = { ...p, key, period: p.t ? periodOf(p.t, cfg) : '', shift: null, forare: null, metod: 'omatchad', forslag: null };
      const list = byReg[p.reg] || [];
      let s = null;
      if (p.t) {
        const inne = list.filter(x => p.t >= x.a && p.t <= x.b).sort((x, y) => y.a - x.a);
        if (inne.length) { s = inne[0]; o.metod = 'pass'; }
        else {
          const nara = list.map(x => [x, dist(p.t, x)]).sort((x, y) => x[1] - y[1]);
          const inom = nara.filter(x => x[1] <= mg);
          if (inom.length === 1 || (inom.length > 1 && inom[0][0].forare === inom[1][0].forare)) { s = inom[0][0]; o.metod = 'marginal'; }
          else if (nara.length && nara[0][1] <= 12 * 36e5) { const x = nara[0][0]; o.forslag = { forare: x.forare, start: x.start, slut: x.slut, min: Math.round(nara[0][1] / 6e4), annan: inom.length > 1 ? inom[1][0].forare : null }; }
        }
      }
      if (s) { o.shift = s.id; o.forare = s.forare; o.period = shiftPeriod(s, cfg); } // dag/kväll enligt passet i Megtax, inte klockslaget
      if (overrides && overrides[key] !== undefined) { o.forare = overrides[key] || null; o.metod = overrides[key] ? 'manuell' : 'omatchad'; }
      return o;
    });
  }

  function compute(shifts, passages, cfg0, month) {
    const cfg = { ...DEF, ...(cfg0 || {}) }; month = month || {};
    const man = month.forare || {};
    markPeriods(shifts, cfg);
    const bro = matchBro(passages || [], shifts, cfg, month.overrides || {});
    const kost = p => p.typ === 'bro' ? cfg.broPris : p.typ === 'sturup' ? r2(p.belopp / 1.25) : cfg.cphPris;
    const iLon = p => p.typ === 'bro' || (p.typ === 'sturup' ? cfg.inklSturup : cfg.inklPickup);
    const drivers = {};
    const D = id => drivers[id] = drivers[id] || { id, pass: 0, tim: 0, ink: 0, exkl: 0, kont: 0, kred: 0, kontDr: 0, kredDr: 0, km: 0, betKm: 0, bom: 0, bud: 0, broN: 0, cphN: 0, stuN: 0, broSek: 0, bilar: new Set(), pay: {} };
    shifts.forEach(s => {
      const d = D(s.forare); d.pass++; d.tim += s.tim; d.ink += s.kont + s.kred; d.exkl += exkl(s, cfg);
      d.kont += s.kont; d.kred += s.kred; d.kontDr += s.kontDricks; d.kredDr += s.kredDricks; d.km += s.passKm; d.betKm += s.betKm; d.bom += s.bom || 0; d.bud += s.kontKl[0] + s.kredKl[0]; d.bilar.add(s.regnr);
      s.pay.forEach(p => d.pay[p.namn] = (d.pay[p.namn] || 0) + p.belopp);
    });
    if (V.fastUtanPass) Object.keys(man).forEach(id => { if (man[id].modell === 'fast') D(id); }); // fast månadslön utan körpass
    bro.forEach(p => { p.kost = kost(p); p.iLon = iLon(p); if (!p.forare) return; const d = D(p.forare);
      if (p.typ === 'bro') d.broN++; else if (p.typ === 'sturup') d.stuN++; else d.cphN++;
      if (p.iLon) d.broSek += p.kost; });
    const rows = Object.values(drivers).map(d => {
      const m = man[d.id] || {};
      const modell = m.modell || 'procent';
      const bomEx = cfg.bomBortLon ? r2(d.bom / (1 + cfg.momsKlass[2] / 100)) : 0;
      const boltProv = r2((+m.boltProv || 0) + (+m.uberProv || 0)); const exk = r2(d.exkl - bomEx - boltProv); // plattformsavgift Bolt + Uber
      const proc = modell === 'procent' ? r2(exk * cfg.procent / 100) : 0;
      const broAvdr = modell === 'procent' ? r2(d.broSek * cfg.broAndel / 100) : 0;
      const ob = +m.ob || 0, bonus = +m.bonus || 0, fast = modell === 'fast' ? (+m.manadslon || 0) : 0;
      const sem = modell === 'procent' ? r2((proc - broAvdr + ob) * cfg.semester / 100) : (modell === 'fast' && m.semFast ? r2(fast * cfg.semester / 100) : 0);
      const brutto = r2(proc - broAvdr + sem + ob + bonus + fast);
      const kontant = m.kontant !== undefined && m.kontant !== '' && m.kontant !== null ? +m.kontant : !V.kontantEndastProcent || modell === 'procent' ? r2(d.kont) : 0; // tripkassan: fast lön, kontanterna sätts in på banken och kvittas inte
      return { ...d, bilar: [...d.bilar], modell, exklMegtax: r2(d.exkl), bomEx, exkl: exk, proc, broAvdr, broApris: r2(d.broSek), sem, ob, bonus, fast, brutto,
        agAvg: r2(brutto * cfg.agAvgift / 100), kontant, forskott: +m.forskott || 0, boltProv, ink: r2(d.ink) };
    }).sort((a, b) => b.ink - a.ink);

    /* Kassaredovisning per bil, dag för dag, dag/natt (som Excelmallen). */
    const bilar = {};
    shifts.forEach(s => {
      const per = shiftPeriod(s, cfg); const day = new Date(s.a); if (per === 'natt' && s.a.getHours() < cfg.dagStart) day.setDate(day.getDate() - 1);
      const b = bilar[s.reg] = bilar[s.reg] || { reg: s.reg, regnr: s.regnr, bilId: s.bilId, dagar: {} };
      const ds = dstr(day); const dd = b.dagar[ds] = b.dagar[ds] || { datum: ds, vecka: isoWeek(day), wd: day.getDay(), dag: null, natt: null };
      const c = dd[per] = dd[per] || { kassa: 0, kont: 0, kred: 0, bro: 0, broN: 0, stu: 0, stuN: 0, forare: new Set(), pass: [] };
      c.kassa += s.kont + s.kred; c.kont += s.kont; c.kred += s.kred; c.forare.add(s.forare); c.pass.push(s.id);
    });
    bro.forEach(p => {
      if (!p.shift) return; const s = shifts.find(x => x.id === p.shift); if (!s) return;
      const per = shiftPeriod(s, cfg); const day = new Date(s.a); if (per === 'natt' && s.a.getHours() < cfg.dagStart) day.setDate(day.getDate() - 1);
      const c = bilar[s.reg].dagar[dstr(day)][per];
      if (p.typ === 'sturup') { c.stu += p.kost; c.stuN++; } else { c.bro += p.kost; if (p.typ === 'bro') c.broN++; }
    });
    const andel = 1 - cfg.redovForarandel / 100;
    Object.values(bilar).forEach(b => Object.values(b.dagar).forEach(dd => ['dag', 'natt'].forEach(k => {
      const c = dd[k]; if (!c) return; c.forare = [...c.forare];
      c.exBro = c.kassa - c.bro - c.stu; c.andel = c.exBro * andel; c.hosForare = c.andel + c.bro + c.stu - c.kred; // = kontant minus förarens andel
    })));
    return { cfg, rows, bro, bilar };
  }

  return { DEF, parseLDL, parseBro, parseSturup, parseAvrakning, parseSkattetabell, packTabell, unpackTabell, compactTabell, tabellSkatt, fodelsear, skattekolumn, agAvgift, compute, decode, normReg, toDate, dstr, tstr, isoWeek, periodOf, shiftPeriod, exkl, r2 };
}

/** Standardmotorn (Åkarkassan). */
export const ENG = createEngine('akarkassan');
export default ENG;
