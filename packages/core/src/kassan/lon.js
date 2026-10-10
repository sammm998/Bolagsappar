// Lönespec per förare. Flyttad från lonOf, ytd, utbMan och tabellFor i legacy/apps/akarkassan/index.html.
// Skillnaden är att inställningar, skattetabeller och period skickas in i stället för att läsas globalt.
import { ENG as DEFAULT_ENG } from './engine.js';

const parseKr = s => s == null ? 0 : typeof s === 'number' ? s : parseFloat(String(s).replace(/\s/g, '').replace(',', '.')) || 0;
const sum = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);

/** Utbetalningsmånad. Normalt månaden efter perioden. Tripkassan (cfg.utbSamma): fast lön betalas samma månad. */
export function utbMan(period, c = {}, mod) { if (!period) return ''; if (c.utbSamma && mod !== 'procent') return period; const y = +period.slice(0, 4), m = +period.slice(5); return m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0'); }
export function utbDatum(period, c, mod) {
  if (c.utbSamma) { const dag = mod === 'procent' ? (c.utbetDagProv || 7) : (c.utbetDag || 10); return utbMan(period, c, mod) + '-' + String(dag).padStart(2, '0'); }
  return utbMan(period, c) + '-' + String(c.utbetDag || 10).padStart(2, '0');
}

export function tabellFor(skatt, nr, ENG = DEFAULT_ENG) { const t = skatt && skatt[String(nr || 33)]; return t ? (t.B ? t : ENG.unpackTabell(t)) : null; }

/** Lön och skatt hittills i år, för lönespecen. */
export function ytd({ person: p = {}, lonHist = {}, period, brutto, skatt, c = {}, ENG = DEFAULT_ENG }) {
  const ar = utbMan(period, c).slice(0, 4); let lon = 0, sk = 0;
  const hist = lonHist || {};
  const bas = p.ytd && p.ytd.tom && p.ytd.tom.slice(0, 4) === ar && p.ytd.tom < period ? p.ytd : null;
  if (bas) { lon += parseKr(bas.lon); sk += parseKr(bas.skatt); }
  Object.entries(hist).forEach(([per, h]) => { if (h.utb && h.utb.slice(0, 4) === ar && per < period && (!bas || per > bas.tom)) { lon += h.brutto; sk -= h.skatt; } });
  return { lon: ENG.r2(lon + brutto), skatt: ENG.r2(sk - skatt) };
}

/**
 * Lönespec för en rad från ENG.compute.
 * @param {object} a
 * @param {object} a.r rad från compute().rows
 * @param {object} a.c cfg (compute().cfg)
 * @param {object} a.person settings.forare[id].person
 * @param {object} a.skatt skattetabeller {"33": {B,P} eller packad sträng}
 * @param {string} a.period ÅÅÅÅ-MM
 * @param {object} [a.lonHist] settings.lonHist[id]
 */
export function lonespec({ r, c, person = {}, skatt, period, lonHist, ENG = DEFAULT_ENG }) {
  const p = person; const fel = [];
  const rader = [];
  const add = (kod, text, antal, apris, belopp, info) => rader.push({ kod, text, antal, apris, belopp: ENG.r2(belopp), info: !!info });
  if (r.modell === 'procent') {
    add('020', 'Procentlön', c.procent / 100, r.exkl, r.proc);
    if (r.broApris) add('009', 'Bro, Sturup och CPH', c.broAndel / 100, -r.broApris, -r.broAvdr);
    if (r.sem) add('420', 'Semesterersättning ' + c.semester + ' %', 1, r.sem, r.sem);
    if (r.bonus) add('010', 'Bonus', 1, r.bonus, r.bonus);
    add('804', r.boltProv ? 'Inkört exkl. moms, efter plattformsavgift' : 'Inkört exkl. moms', 1, r.exkl, r.exkl, true);
    if (r.boltProv) add('806', 'Plattformsavgift Bolt/Uber, avdragen från underlaget', 1, -r.boltProv, -r.boltProv, true);
  } else if (r.modell === 'fast') {
    add('001', 'Månadslön', 1, r.fast, r.fast);
    if (r.sem) add('420', 'Semesterersättning ' + c.semester + ' %', 1, r.sem, r.sem);
    if (r.bonus) add('010', 'Bonus', 1, r.bonus, r.bonus);
  }
  const brutto0 = sum(rader.filter(x => !x.info), x => x.belopp);
  const brutto = Math.round(brutto0); const avr = ENG.r2(brutto - brutto0);
  if (Math.abs(avr) >= 0.005) add('990', 'Avrundning', 1, avr, avr);
  const ar = +utbMan(period, c, r.modell).slice(0, 4);
  const kol = p.kolumn || ENG.skattekolumn(p.personnr, ar);
  let skattBelopp = 0, skattTxt = '';
  if (+p.engang > 0) { skattBelopp = Math.floor(brutto * p.engang / 100); skattTxt = 'Engångsskatt ' + p.engang + ' %'; }
  else if (p.jamkning !== undefined && p.jamkning !== '' && p.jamkning !== null) { skattBelopp = +p.jamkning; skattTxt = 'Skatt enligt jämkningsbeslut'; }
  else { const t = tabellFor(skatt, p.tabell || 33, ENG); if (!t) fel.push('Skattetabell ' + (p.tabell || 33) + ' saknas'); skattBelopp = ENG.tabellSkatt(t, kol, brutto); skattTxt = 'Tabellskatt ' + (p.tabell || 33) + ', kolumn ' + kol; }
  if (brutto > 0) add('912', skattTxt, 1, -skattBelopp, -skattBelopp);
  if (r.kontant) add('008', 'Kontanter i bilen, kvittas', 1, -r.kontant, -r.kontant);
  if (r.forskott) add('970', 'Avdrag löneförskott', 1, -r.forskott, -r.forskott);
  const netto = ENG.r2(brutto - skattBelopp - (r.kontant || 0) - (r.forskott || 0));
  const ag = ENG.agAvgift(p.personnr, brutto, utbMan(period, c, r.modell));
  if (!p.personnr) fel.push('Personnummer saknas');
  if (netto > 0 && !p.bank) fel.push('Bankkonto saknas');
  const y = ytd({ person: p, lonHist, period, brutto, skatt: skattBelopp, c, ENG });
  return { rader, brutto, skatt: skattBelopp, kol, netto, ag, fel, ytd: y, p };
}

export function anstalld(settings, id, per) { const f = (settings.forare || {})[id] || {}; if (!per) return true; const fr = per + '-01', ti = per + '-31'; return (!f.start || f.start <= ti) && (!f.slut || f.slut >= fr); }

/**
 * Indata till ENG.compute från inställningar och månad (result() i prototyperna).
 * Åkarkassan: förare från körpassen. Tripkassan: även anställda med fast lön och modell 'ingen' utanför anställningen.
 */
export function computeInput(settings, month, shifts, { variant = 'akarkassan', period = null, demo = false } = {}) {
  const man = {}; const F = settings.forare || {};
  if (variant === 'tripkassan') {
    const ids = new Set([...shifts.map(s => s.forare), ...(demo ? [] : Object.entries(F).filter(([k, f]) => f.modell === 'fast' && !f.slutat && anstalld(settings, k, period)).map(([k]) => k))]);
    ids.forEach(id => { const f = F[id] || {}; man[id] = { ...((month.forare || {})[id] || {}), modell: anstalld(settings, id, period) ? (f.modell || 'procent') : 'ingen', manadslon: f.manadslon || 0, semFast: !!f.semFast }; });
  } else {
    const ids = new Set(shifts.map(s => s.forare));
    ids.forEach(id => { const f = F[id] || {}; man[id] = { ...((month.forare || {})[id] || {}), modell: f.modell || 'procent', manadslon: f.manadslon || 0, semFast: !!f.semFast }; });
  }
  return { forare: man, overrides: month.overrides || {} };
}
