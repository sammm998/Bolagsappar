// Månadsflödet i Åkarkassan utan DOM. Flyttat från onLdl, onBro, onStu, onAvr, applyAlias,
// storePassages, hydrate, importPlatt och lasLon i legacy/apps/akarkassan/index.html.
import { ENG as DEFAULT_ENG } from './engine.js';
import { utbDatum } from './lon.js';

export const monthOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
export const packP = rows => rows.map(p => [p.ts, p.desc, p.reg, p.typ, p.valuta, p.belopp]);
export const unpackP = (rows, ENG = DEFAULT_ENG) => (rows || []).map(a => ({ ts: a[0], t: ENG.toDate(a[0]), desc: a[1], reg: a[2], typ: a[3], valuta: a[4], belopp: a[5] }));
export function titleCase(s) { return String(s).toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\bAb\b/, 'AB'); }

export function emptyKassaSettings(foretag = '') { return { foretag, cfg: {}, forare: {}, bilar: {} }; }
export function emptyKassaMonth() { return { forare: {}, overrides: {} }; }

/** Felinloggade förarnummer: settings.alias = { fel: rätt }. */
export function applyAlias(shifts, settings) { const A = settings.alias || {}; shifts.forEach(s => { if (s.forareMegtax == null) s.forareMegtax = s.forare; s.forare = A[s.forareMegtax] || s.forareMegtax; }); return shifts; }

/**
 * Läs in LDL. Returnerar perioden, passen i den månaden, hur många som låg utanför och nya bilar/företagsnamn.
 */
export function ingestLdl(text, settings, ENG = DEFAULT_ENG) {
  const r = ENG.parseLDL(text);
  if (!r.shifts.length) return { error: 'Filen innehöll inga körpass. Välj LDL-filen från Megtax-portalen.' };
  const shifts = applyAlias(r.shifts, settings);
  const cnt = {}; shifts.forEach(s => { const k = monthOf(s.a); cnt[k] = (cnt[k] || 0) + 1; });
  const period = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
  const own = shifts.filter(s => monthOf(s.a) === period);
  const utanfor = shifts.length - own.length;
  const foretag = r.shifts[0].foretag && !settings.foretagLast ? titleCase(r.shifts[0].foretag) : null;
  const nyaBilar = {}; r.shifts.forEach(s => { if (!(settings.bilar || {})[s.reg]) nyaBilar[s.reg] = { regnr: s.regnr, bilId: s.bilId, namn: '' }; });
  return { period, shifts: own, utanfor, foretag, nyaBilar, warn: r.warn };
}

/** Återskapa passen från sparad LDL-text (hydrate). */
/** Sparar ett inläst löneunderlag (resultatet av ingestLdl) i inställningar och månad. Används av webben och mobilen. */
export function ldlTillManad({ text, name, r, settings, month }) {
  const nySettings = { ...settings, bilar: { ...(settings.bilar || {}), ...r.nyaBilar }, ...(r.foretag && !settings.foretagLast ? { foretag: r.foretag } : {}) };
  const nyManad = { ...month, ldl: text, forare: month.forare || {}, overrides: month.overrides || {}, files: { ...(month.files || {}), ldl: `${name}, ${r.shifts.length} pass` } };
  return { settings: nySettings, month: nyManad, msg: `Löneunderlaget är inläst${r.utanfor ? `, ${r.utanfor} pass från annan månad togs bort` : ''}. Lönen är uträknad.` };
}

export function hydrateShifts(ldl, period, settings, ENG = DEFAULT_ENG) {
  const r = ENG.parseLDL(ldl || '');
  return applyAlias(r.shifts.filter(s => monthOf(s.a) === period), settings);
}

/** Spara bara passager för egna bilar (storePassages). */
export function ownPassages(rows, shifts) { const regs = new Set(shifts.map(s => s.reg)); return regs.size ? rows.filter(p => regs.has(p.reg)) : rows; }

/** Känn igen en fil i Åkarkassan. read kommer från filetypes/read.js, lines från rawLines(). */
export function recognizeKassan(read, lines, ENG = DEFAULT_ENG) {
  if (read.kind === 'pdf') {
    const avr = ENG.parseAvrakning(lines);
    const bro = ENG.parseBro(lines);
    const stu = ENG.parseSturup(lines);
    if (stu.rows.length && /Swedavia|Malmö Airport/i.test(lines.join('\n'))) return { type: 'stu', stu };
    if (bro.rows.length && /Øresundsbro|Oresundsbro|oresundpay|Klass/i.test(lines.join('\n'))) return { type: 'bro', bro };
    if (avr.rows.length) return { type: 'avr', avr };
    return { type: 'unknown', hint: 'PDF' };
  }
  const text = read.text || '';
  if (/^30[B%]\d\d/m.test(text)) { const t = ENG.parseSkattetabell(text); if (Object.keys(t).length) return { type: 'skatt', tabeller: t }; }
  if (/^01;/m.test(text)) { const r = ENG.parseLDL(text); if (r.shifts.length) return { type: 'ldl', text }; }
  const h = (read.header || '').toLowerCase();
  if (/provision|service ?fee|commission|uber fee|avgift till uber/.test(h)) return { type: 'platt', src: /uber/.test(h) ? 'uber' : 'bolt', text };
  return { type: 'unknown', hint: read.kind === 'sheet' ? 'en Excel' : 'en textfil' };
}

// CSV med komma eller semikolon (csvRows i prototypen)
export function csvRows(t) { const out = []; let row = [], cur = '', q = false; for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else if (c === '"') q = true; else if (c === ',' || c === ';') { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = ''; } else cur += c; } if (cur || row.length) { row.push(cur); out.push(row); } return out; }
const tok = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
export function matchForare(namn, ids, namnFor) {
  const a = tok(namn); let best = null, bs = 0;
  ids.forEach(id => { const b = tok(namnFor(id)); if (!b.length) return; let sc = a.filter(x => b.includes(x)).length; if (a[0] === b[0]) sc += 0.5; if (sc > bs) { bs = sc; best = id; } });
  return bs >= 1.5 ? best : null;
}

/** Plattformsavgift från Bolt eller Uber (importPlatt). Returnerar ny månad och vilka som matchades. */
export function importPlatt(text, src, { month, ids, namnFor, ENG = DEFAULT_ENG }) {
  const F = { bolt: ['boltProv', 'Bolt'], uber: ['uberProv', 'Uber'] }[src]; const fld = F[0], nm = F[1];
  const rows = csvRows(text).filter(r => r.length > 3); const h = (rows[0] || []).map(x => x.trim());
  const col = re => h.findIndex(x => re.test(x));
  const iN = col(/^(Förare|Förarens namn|Driver|Driver name|Namn|Name)$/i);
  const iF = col(/^(Förnamn|First name|Driver first name)/i), iE = col(/^(Efternamn|Last name|Surname|Driver surname|Driver last name)/i);
  const iP = col(/^(Provisionsavgifter|Provision|Serviceavgift|Service ?fee|Uber service fee|Commission|Avgift till Uber|Uber fee)/i);
  if ((iN < 0 && iF < 0) || iP < 0) return { error: 'Hittade inte förarnamn och avgift i filen från ' + nm + '. Kolumner: ' + h.slice(0, 12).join(', ') + '.' };
  const namn = r => iN >= 0 ? r[iN] : [r[iF], iE >= 0 ? r[iE] : ''].join(' ');
  const num = x => Math.abs(parseFloat(String(x || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0);
  const forare = JSON.parse(JSON.stringify(month.forare || {}));
  const ok = [], miss = [];
  Object.values(forare).forEach(f => { delete f[fld]; });
  rows.slice(1).forEach(r => { const prov = num(r[iP]); if (!prov) return; const id = matchForare(namn(r), ids, namnFor); if (!id) { miss.push(namn(r)); return; }
    const f = (forare[id] = forare[id] || {}); f[fld] = ENG.r2((f[fld] || 0) + prov); ok.push({ id, prov }); });
  return { month: { ...month, forare }, ok, miss, src };
}

/** Godkänn lönekörningen (lasLon). Returnerar lonekorning för månaden och lonHist för inställningarna. */
export function godkannLon(LS, { period, c, lonHist = {}, datum = new Date().toISOString().slice(0, 10) }) {
  const lonekorning = { datum, utb: utbDatum(period, c), rader: Object.fromEntries(LS.map(({ r, L }) => [r.id, { brutto: L.brutto, skatt: L.skatt, netto: L.netto, ag: L.ag.belopp, kontant: r.kontant, rader: L.rader }])) };
  const H = JSON.parse(JSON.stringify(lonHist));
  LS.forEach(({ r, L }) => { (H[r.id] = H[r.id] || {})[period] = { brutto: L.brutto, skatt: L.skatt, utb: utbDatum(period, c, r.modell) }; });
  return { lonekorning, lonHist: H };
}

/**
 * Det centralen publicerat (shares.payload) i samma form som Åkarkassan läste från PDF:erna.
 * avr: som ENG.parseAvrakning, bro/stu: passager som ENG.parseBro/parseSturup.
 */
export function fromShare(payload, ENG = DEFAULT_ENG) {
  if (!payload) return { avr: null, bro: [], stu: [] };
  const avr = { nr: payload.fakturanr || '', datum: payload.publicerad?.slice(0, 10) || '', attBetala: payload.att, rows: (payload.rows || []).filter(r => r.art != null).map(r => ({ art: r.art, text: r.text, bil: (String(r.text).match(/[Bb]il (\d+)/) || [])[1] || '', antal: r.antal ?? null, summa: r.summa })), fran: payload.fran };
  const bro = (payload.passager?.bro || []).map(p => ({ ...p, t: ENG.toDate(p.ts) }));
  const stu = (payload.passager?.stu || []).map(p => ({ ...p, t: ENG.toDate(p.ts) }));
  return { avr, bro, stu };
}
