// Avräkning för logistik (exempel: Jetpack). Samma flöde som taxi, med andra ord och en annan fil:
// uppdrag i stället för körningar, underleverantörer i stället för åkare. Huvudkunden läser in uppdragsfilen,
// varje underleverantör får sin avräkning: uppdragens värde minus provision och avgifter.
// Allt här är ett exempel på strukturen. Riktiga avgifter och kolumner kommer med Jetpacks fil (öppen fråga 03).

export const LOGISTIK_ORD = { korning: 'uppdrag', korningar: 'uppdrag', akare: 'underleverantör', akarePl: 'underleverantörer', bil: 'fordon' };

/** Avgifter i exemplet. Ligger i kontots inställningar (settings/logistik) och kan ändras där. */
export const LOGISTIK_DEF = {
  provision: 0.12,      // andel av uppdragets pris exkl. moms
  perUppdrag: 15,       // kr exkl. moms per uppdrag (systemavgift)
  perFordon: 495,       // kr exkl. moms per fordon och månad
  moms: 0.25,
  utbDag: 10            // utbetalning den 10:e nästa månad
};

const r2 = x => Math.round((+x || 0) * 100) / 100;
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
export const normReg = r => String(r || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const num = v => { if (v == null || v === '') return 0; const s = String(v).replace(/\s| /g, '').replace(/kr$/i, ''); return +(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0; };

function csv(text) {
  const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const out = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); if (row.some(x => x.trim())) out.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); if (row.some(x => x.trim())) out.push(row); }
  return out;
}

// Kolumner hittas på namn, så både svensk och engelsk export fungerar.
const KOL = {
  datum: ['datum', 'date', 'leveransdatum'],
  id: ['uppdragsid', 'uppdrag', 'ordernr', 'orderid', 'id'],
  ul: ['underleverantor', 'leverantor', 'akeri', 'subcontractor', 'carrier'],
  reg: ['fordon', 'regnr', 'reg', 'vehicle'],
  fran: ['fran', 'from', 'upphamtning'],
  till: ['till', 'to', 'leverans'],
  kund: ['kund', 'customer'],
  pris: ['prisexklmoms', 'pris', 'belopp', 'price', 'amount'],
  tillagg: ['tillagg', 'extra', 'surcharge']
};

/** Läser uppdragsfilen (CSV). Returnerar { rader, fel } eller null om filen inte ser ut som en uppdragsfil. */
export function parseUppdrag(text) {
  const rows = csv(String(text || '').replace(/^﻿/, ''));
  if (rows.length < 2) return null;
  const h = rows[0].map(norm);
  const col = Object.fromEntries(Object.entries(KOL).map(([k, names]) => [k, h.findIndex(x => names.includes(x))]));
  if (col.id < 0 || col.ul < 0 || col.pris < 0) return null;
  const rader = [], fel = [];
  rows.slice(1).forEach((r, i) => {
    const g = k => (col[k] >= 0 ? String(r[col[k]] ?? '').trim() : '');
    const x = { rad: i + 2, datum: g('datum'), id: g('id'), ul: g('ul'), reg: normReg(g('reg')), fran: g('fran'), till: g('till'), kund: g('kund'), pris: r2(num(g('pris'))), tillagg: r2(num(g('tillagg'))) };
    if (!x.id && !x.pris) return;
    if (!/^\d{4}-\d\d-\d\d$/.test(x.datum)) fel.push({ rad: x.rad, text: `Rad ${x.rad}: datum saknas eller har fel format (ÅÅÅÅ-MM-DD)` });
    rader.push(x);
  });
  return { rader, fel };
}

export const kanUppdrag = text => !!parseUppdrag(text);

/**
 * Avräkning per underleverantör.
 * @param {{ datum, id, ul, reg, pris, tillagg }[]} rader
 * @param {{ period: string, underleverantorer: { id: string, namn: string }[], cfg?: object }} o
 */
export function avraknaLogistik(rader, { period, underleverantorer, cfg = {} }) {
  const c = { ...LOGISTIK_DEF, ...cfg };
  const byNamn = new Map(underleverantorer.map(u => [norm(u.namn), u]));
  const varningar = [];
  const sedda = new Set(), per = new Map();
  for (const x of rader) {
    if (x.datum && x.datum.slice(0, 7) !== period) { varningar.push({ typ: 'manad', text: `Uppdrag ${x.id} är från ${x.datum}, utanför ${period}. Det räknas inte.` }); continue; }
    if (sedda.has(x.id)) { varningar.push({ typ: 'dubblett', text: `Uppdrag ${x.id} finns två gånger. Det räknas en gång.` }); continue; }
    sedda.add(x.id);
    const u = byNamn.get(norm(x.ul));
    if (!u) { varningar.push({ typ: 'okand', text: `${x.ul || 'Ingen underleverantör'} på uppdrag ${x.id} finns inte bland underleverantörerna.` }); continue; }
    if (!per.has(u.id)) per.set(u.id, { id: u.id, namn: u.namn, uppdrag: [], fordon: new Map() });
    const p = per.get(u.id); p.uppdrag.push(x);
    const f = p.fordon.get(x.reg || '') || { reg: x.reg, n: 0, intakt: 0 }; f.n++; f.intakt = r2(f.intakt + x.pris + x.tillagg); p.fordon.set(x.reg || '', f);
  }
  const L = [...per.values()].map(p => {
    const intakt = r2(p.uppdrag.reduce((s, x) => s + x.pris + x.tillagg, 0));
    const provision = r2(intakt * c.provision);
    const uppdragsavgift = r2(p.uppdrag.length * c.perUppdrag);
    const fordonsavgift = r2([...p.fordon.keys()].filter(Boolean).length * c.perFordon);
    const netto = r2(intakt - provision - uppdragsavgift - fordonsavgift);
    const moms = r2(netto * c.moms);
    return { id: p.id, namn: p.namn, antal: p.uppdrag.length, intakt, provision, uppdragsavgift, fordonsavgift, netto, moms, att: r2(-(netto + moms)), fordon: [...p.fordon.values()], uppdrag: p.uppdrag };
  }).sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
  const utan = underleverantorer.filter(u => !per.has(u.id)).map(u => u.namn);
  return { period, cfg: c, per: L, varningar, utan, summa: { antal: L.reduce((s, x) => s + x.antal, 0), intakt: r2(L.reduce((s, x) => s + x.intakt, 0)), att: r2(L.reduce((s, x) => s + x.att, 0)) } };
}

const MAN = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const ymAdd = (p, n) => { const d = new Date(Date.UTC(+p.slice(0, 4), +p.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const fmt = n => String(Math.abs(Math.round(n * 100) / 100).toFixed(2)).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Det som publiceras till underleverantören. Samma form som taxiavräkningen, så Min avräkning visar den. */
export function logistikPayload(x, R, { fran }) {
  const utb = ymAdd(R.period, 1) + '-' + String(R.cfg.utbDag).padStart(2, '0');
  const man = MAN[+R.period.slice(5, 7) - 1];
  return {
    kind: 'logistikavrakning', period: R.period, manad: man + ' ' + R.period.slice(0, 4), fran, namn: x.namn,
    att: x.att, riktning: x.att < 0 ? 'far' : x.att > 0 ? 'betalar' : 'noll', belopp: Math.abs(x.att), utbetalas: utb,
    sammanfattning: [
      { key: 'intakt', text: `Uppdrag, ${x.antal} st`, belopp: x.intakt },
      { key: 'provision', text: `Provision ${Math.round(R.cfg.provision * 100)} %`, belopp: -x.provision },
      { key: 'uppdragsavgift', text: 'Systemavgift per uppdrag', belopp: -x.uppdragsavgift },
      { key: 'fordonsavgift', text: `Fordonsavgift, ${x.fordon.filter(f => f.reg).length} fordon`, belopp: -x.fordonsavgift },
      { key: 'moms', text: `Moms ${Math.round(R.cfg.moms * 100)} %`, belopp: x.moms }
    ],
    perBil: x.fordon.map(f => ({ bil: f.reg || 'okänt', reg: f.reg, intakt: f.intakt, netto: f.intakt, n: f.n })),
    bilar: x.fordon.map(f => f.reg).filter(Boolean),
    uppdrag: x.uppdrag.map(u => ({ d: u.datum, id: u.id, fran: u.fran, till: u.till, s: u.pris + u.tillagg })),
    // Fakturaraderna (samma form som taxi). Negativt belopp betyder att huvudkunden betalar underleverantören.
    rows: [
      { art: null, grupp: 'intakt', text: `Uppdrag, ${x.antal} st`, antal: x.antal, apris: null, summa: -x.intakt, moms: Math.round(R.cfg.moms * 100) },
      { art: null, grupp: 'provision', text: `Provision ${Math.round(R.cfg.provision * 100)} %`, antal: 1, apris: x.provision, summa: x.provision, moms: Math.round(R.cfg.moms * 100) },
      { art: null, grupp: 'uppdragsavgift', text: 'Systemavgift per uppdrag', antal: x.antal, apris: R.cfg.perUppdrag, summa: x.uppdragsavgift, moms: Math.round(R.cfg.moms * 100) },
      { art: null, grupp: 'fordonsavgift', text: 'Fordonsavgift', antal: x.fordon.filter(f => f.reg).length, apris: R.cfg.perFordon, summa: x.fordonsavgift, moms: Math.round(R.cfg.moms * 100) }
    ],
    passager: { bro: [], stu: [] },
    meddelande: x.att < 0 ? `${man[0].toUpperCase() + man.slice(1)} är klar. Du får ${fmt(-x.att)} kr den ${utb}.` : `${man[0].toUpperCase() + man.slice(1)} är klar.`
  };
}
