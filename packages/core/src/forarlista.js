// Förarlista (sidan 34). Huvudkunden läser in förarexporten från TaxiCaller (CSV eller Excel) i webbläsaren.
// Varje åkare får sina egna förare. Kolumnerna hittas på namn, så både svensk och engelsk export fungerar.
// Den nattliga hämtningen via TaxiCallers API kräver en nyckel och en funktion på servern (öppen fråga).

const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
export const normReg = r => String(r || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const KOL = {
  nr: ['forarnr', 'forarnummer', 'forarid', 'driverid', 'drivernumber', 'drivernr', 'nr', 'id'],
  namn: ['namn', 'forare', 'forarnamn', 'name', 'driver', 'drivername'],
  fornamn: ['fornamn', 'firstname'],
  efternamn: ['efternamn', 'lastname', 'surname'],
  akeri: ['akeri', 'akare', 'bolag', 'foretag', 'company', 'fleet', 'owner'],
  bil: ['senastebil', 'bil', 'fordon', 'regnr', 'vehicle', 'lastvehicle', 'car'],
  leg: ['legitimation', 'leg', 'taxiforarlegitimation', 'legitimationgiltigtill', 'giltigtill', 'licenseexpiry', 'licenseexpires', 'license'],
  status: ['status', 'aktiv', 'active'],
  senast: ['senastekorning', 'senastkorning', 'senaste', 'lasttrip', 'lastride', 'lastactive'],
  pass: ['pass', 'passmanad', 'shifts', 'antalpass']
};

/** ÅÅÅÅ-MM-DD från 2027-03-31, 31.03.2027, 31/03/2027 och Excels 3/31/27. Annars tomt. */
export function datum(v) {
  const s = String(v ?? '').trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/))) return `${m[1]}-${m[2].padStart(2, '0')}` + (m[3] ? '-' + m[3].padStart(2, '0') : '');
  if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))) {
    const ar = m[3].length === 2 ? '20' + m[3] : m[3];
    // Dag först om första talet inte kan vara en månad, annars amerikansk ordning (Excel).
    const [man, dag] = +m[1] > 12 ? [m[2], m[1]] : [m[1], m[2]];
    return `${ar}-${man.padStart(2, '0')}-${dag.padStart(2, '0')}`;
  }
  return '';
}

const dagarMellan = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / 864e5;

/**
 * rows: tabellen som rader (första raden är rubriker). idag: ÅÅÅÅ-MM-DD.
 * Returnerar { forare, fel } eller null om filen inte ser ut som en förarlista.
 * Aktiv: statuskolumnen om den finns, annars körning de senaste 30 dagarna.
 */
export function parseForarlista(rows, { idag = new Date().toISOString().slice(0, 10) } = {}) {
  const R = (rows || []).map(r => (r || []).map(c => String(c ?? '').replace(/^﻿/, '').trim())).filter(r => r.some(Boolean));
  if (R.length < 2) return null;
  const h = R[0].map(norm);
  const col = Object.fromEntries(Object.entries(KOL).map(([k, names]) => [k, names.map(n => h.indexOf(n)).find(i => i >= 0) ?? -1]));
  const harNamn = col.namn >= 0 || col.fornamn >= 0;
  if (col.nr < 0 || !harNamn || col.akeri < 0) return null;
  const forare = [], fel = [], sett = new Set();
  R.slice(1).forEach((r, i) => {
    const g = k => (col[k] >= 0 ? r[col[k]] || '' : '');
    const namn = g('namn') || [g('fornamn'), g('efternamn')].filter(Boolean).join(' ');
    const nr = g('nr');
    if (!nr || !namn) { fel.push({ rad: i + 2, text: `Rad ${i + 2} saknar förarnummer eller namn.` }); return; }
    if (sett.has(nr)) { fel.push({ rad: i + 2, text: `Förare ${nr} finns två gånger. Den första raden används.` }); return; }
    sett.add(nr);
    const senast = datum(g('senast'));
    const st = norm(g('status'));
    const aktiv = col.status >= 0 ? ['aktiv', 'active', 'ja', 'yes', 'true', '1'].includes(st) : !!senast && dagarMellan(senast, idag) <= 30;
    forare.push({ nr, namn, akeri: g('akeri'), senasteBil: normReg(g('bil')), leg: datum(g('leg')).slice(0, 7), status: aktiv ? 'aktiv' : 'inaktiv', pass: +g('pass') || 0, senastKorning: senast });
  });
  return { forare, fel };
}

/**
 * Delar upp förarna per åkare. akare: [{ id, name }] (huvudkundens underkunder).
 * Åkeriet matchas på namn utan skillnad på stora och små bokstäver, AB och skiljetecken.
 */
export function perAkare(forare, akare) {
  const nyckel = s => norm(String(s || '').replace(/\b(ab|hb|kb)\b/gi, ''));
  const M = new Map(akare.map(a => [nyckel(a.name), a]));
  const per = new Map(), utan = new Map();
  for (const f of forare) {
    const a = M.get(nyckel(f.akeri));
    if (a) { if (!per.has(a.id)) per.set(a.id, { id: a.id, namn: a.name, forare: [] }); per.get(a.id).forare.push(f); }
    else utan.set(f.akeri || 'Inget åkeri', (utan.get(f.akeri || 'Inget åkeri') || 0) + 1);
  }
  return { per: [...per.values()], utan: [...utan.entries()].map(([akeri, antal]) => ({ akeri, antal })) };
}

/** Exempelfil i samma form som exporten (påhittad data). */
export function forarlistaCsv(lista) {
  const q = s => /[;"\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s);
  const rader = [['Förarnr', 'Namn', 'Åkeri', 'Senaste bil', 'Legitimation giltig till', 'Senaste körning', 'Pass', 'Status']];
  for (const f of lista.forare) rader.push([f.nr, f.namn, f.akeri, f.senasteBil, f.leg, f.senastKorning || '', f.pass, f.status === 'aktiv' ? 'Aktiv' : 'Inaktiv']);
  return '﻿' + rader.map(r => r.map(q).join(';')).join('\r\n') + '\r\n';
}

/** Påhittad exempellista med tre förare per åkare, för att visa hur filen ska se ut. */
export function exempelForarlista(akareNamn, idag = new Date().toISOString().slice(0, 10)) {
  const ar = +idag.slice(0, 4);
  const L = (akareNamn.length ? akareNamn : ['Åkeri Exempel AB']).flatMap((akeri, a) => [0, 1, 2].map(i => {
    const n = a * 3 + i;
    return { nr: String(900001 + n), namn: `Förare ${String.fromCharCode(65 + (a % 26))}${i + 1}`, akeri, senasteBil: i === 2 ? '' : `Q${String.fromCharCode(65 + (n % 26))}${String.fromCharCode(66 + (i % 24))}${String(10 + n).slice(-2)}${String.fromCharCode(67 + (a % 23))}`,
      leg: `${ar + 1 + (n % 2)}-${String(1 + (n * 5) % 12).padStart(2, '0')}`, senastKorning: i === 2 ? `${ar - 1}-12-15` : idag, pass: i === 2 ? 0 : 10 + n % 12, status: i === 2 ? 'inaktiv' : 'aktiv' };
  }));
  return { forare: L };
}
