// Påhittad testdata. Inga riktiga namn, personnummer eller regnummer.
// Regnummer börjar med Q (används aldrig på svenska skyltar). Personnummer slutar på -0000 (ogiltig kontrollsiffra).
// Samma frö ger alltid samma filer, så att testerna är stabila.

export function rng(seed = 1) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return { next, int: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: L => L[Math.floor(next() * L.length)], chance: p => next() < p };
}

export const HUVUDKUND = { namn: 'Taxi Malmö', orgnr: '556000-0000', kort: 'TM' };

// 24 påhittade åkerier. Bilar per åkeri summerar till 61.
export const AKERIER = [
  ['Åkeri Norra AB', 4, 'Ahmed'], ['Limhamn Trafik AB', 2, 'Lina'], ['Söder Taxi HB', 1, 'Jonas'], ['Kust Taxi AB', 3, 'Mira'],
  ['Väster Taxi AB', 2, 'Omar'], ['Öresund Bil AB', 5, null], ['Hamnens Taxi AB', 3, 'Sofia'], ['Ribersborg Trafik AB', 2, 'Elias'],
  ['Pildamm Taxi AB', 3, 'Nora'], ['Kirseberg Bil HB', 2, 'Adam'], ['Fosie Trafik AB', 4, 'Leila'], ['Husie Taxi AB', 2, 'Viktor'],
  ['Bunkeflo Bil AB', 2, 'Hanna'], ['Oxie Trafik AB', 3, 'Karim'], ['Rosengård Taxi AB', 3, 'Maja'], ['Slottsstaden Bil AB', 2, 'Erik'],
  ['Värnhem Trafik AB', 2, 'Sara'], ['Möllan Taxi HB', 1, 'Ali'], ['Lindängen Bil AB', 3, 'Ida'], ['Hyllie Trafik AB', 4, 'Noah'],
  ['Kroksbäck Taxi AB', 2, 'Elsa'], ['Västra Hamnen Bil AB', 3, 'Yusuf'], ['Toftanäs Trafik AB', 2, 'Alva'], ['Klagshamn Taxi AB', 1, 'Leo']
];

const pad = (n, w = 2) => String(n).padStart(w, '0');
const L3 = 'ABCDEFGHJKLMNPRSTUWXYZ';

/** Inställningar för Avräkning (S i prototypen) för Taxi Malmö med 24 åkare och 61 bilar. */
export function taxiMalmoSettings() {
  const bolag = [], bilar = [], terminaler = [], kassor = [];
  let bil = 101, k = 0;
  AKERIER.forEach(([namn, n], i) => {
    const kn = 911900 + i + 1;
    bolag.push({ namn, kn, mail: 'ekonomi@' + namn.toLowerCase().replace(/åäö/g, 'a').replace(/[^a-z]/g, '').slice(0, 14) + '.example', vx: n, tl: n, vxInn: 0, vxRab: 0, gratisTom: '', fsFrom: i % 5 === 0 ? '2026-01' : '', kommentar: '', orgnr: '559' + pad(100 + i, 3) + '-0000' });
    for (let j = 0; j < n; j++, bil++, k++) {
      const reg = 'Q' + L3[i % L3.length] + L3[(j * 7 + i) % L3.length] + pad(10 + ((bil * 13) % 89)) + L3[(bil + j) % L3.length];
      bilar.push({ bil, reg, bolag: namn, avr: namn, kommentar: '' });
      terminaler.push({ id: '5' + pad(1000000 + bil * 37, 7), bil, kommentar: '' });
      kassor.push({ kassor: 7000 + bil, bil, kommentar: '' });
    }
  });
  return { params: { vx: 8900, tl: 250, sa: 0.03, m6: 0.06, m25: 0.25, bro: 201, sturup: 32.6, cph: 15, fs: 99 }, bilar, terminaler, kassor, bolag };
}

const KONTON = [
  [4101, 'Region Exempel Sjukresor'], [4102, 'Exempelkommunen Skolskjuts'], [4103, 'Hotell Exempel AB'], [4104, 'Kontorsbolaget Exempel AB'],
  [4105, 'Sjukhuset Exempel'], [4106, 'Budfirman Exempel AB'], [4107, 'Resebyrån Exempel AB'], [4108, 'Fastighetsbolaget Exempel AB']
];
const GATOR = ['Storgatan', 'Kyrkogatan', 'Hamngatan', 'Parkgatan', 'Skolgatan', 'Järnvägsgatan', 'Torggatan', 'Ängsvägen', 'Bokvägen', 'Ekvägen'];
const ORTER = ['Malmö', 'Lund', 'Malmö C', 'Hyllie', 'Limhamn', 'Burlöv'];
const daysIn = p => { const [y, m] = p.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

/** Körningar, kortköp, appbetalningar och passager för en månad. */
export function genMonth(S, period = '2026-10', seed = 11, counts = {}) {
  const R = rng(seed);
  const C = { deb: 1284, bamb: 1912, refund: 6, app: 412, ejApp: 9, bro: 538, cph: 24, sturup: 96, ...counts };
  const N = daysIn(period);
  const bilar = S.bilar;
  const forareFor = b => ['Förare ' + String.fromCharCode(65 + (b.bil % 26)) + (1 + (b.bil % 3)), 'Förare ' + String.fromCharCode(65 + ((b.bil + 7) % 26)) + (2 + (b.bil % 2))];
  const ts = () => { const d = R.int(1, N), h = R.int(0, 23), m = R.int(0, 59); return { d: `${period}-${pad(d)}`, t: `${pad(h)}:${pad(m)}`, h, m, s: R.int(0, 59) }; };
  // Debiteringskörningar
  const trips = [];
  for (let i = 0; i < C.deb; i++) {
    const b = R.pick(bilar), [nr, namn] = R.pick(KONTON), x = ts();
    const typ = R.chance(0.04) ? 'utland' : R.chance(0.06) ? 'bud' : 'person';
    const pass = typ === 'bud' ? 'BUD ' + R.int(1, 99) : 'Resenär ' + R.int(1, 400);
    const fran = R.pick(GATOR) + ' ' + R.int(1, 60) + ', ' + R.pick(ORTER);
    const till = typ === 'utland' ? 'Kastrup Lufthavn, Danmark' : R.pick(GATOR) + ' ' + R.int(1, 60) + ', ' + R.pick(ORTER);
    const belopp = Math.round((typ === 'utland' ? R.int(650, 1100) : R.int(120, 680)) * 100 + R.int(0, 1) * 50) / 100;
    trips.push({ id: String(8000000 + i * 3), bil: b.bil, konto: nr, kontoNamn: namn, d: x.d, t: x.t, pass, fran, till, belopp, forare: R.pick(forareFor(b)), typ });
  }
  trips.sort((a, b) => a.konto - b.konto || (a.d + a.t).localeCompare(b.d + b.t));
  // Bambora
  const term = new Map(S.terminaler.map(t => [t.bil, t.id]));
  const bamb = [];
  for (let i = 0; i < C.bamb; i++) {
    const b = R.pick(bilar), x = ts();
    bamb.push({ 'STATE': R.chance(0.01) ? 'Declined' : 'Cleared', 'TYPE': 'Sale', 'TERMINAL ID': term.get(b.bil), 'CASHIER ID': String(7000 + b.bil), 'SALE AMOUNT': R.int(95, 640) + R.int(0, 99) / 100, 'TIP': R.chance(0.15) ? R.int(5, 40) : 0, 'TRANSACTION DATE': `${x.d} ${x.t}:${pad(x.s)}` });
  }
  for (let i = 0; i < C.refund; i++) { const b = R.pick(bilar), x = ts(); bamb.push({ 'STATE': 'Cleared', 'TYPE': 'Refund', 'TERMINAL ID': term.get(b.bil), 'CASHIER ID': String(7000 + b.bil), 'SALE AMOUNT': -(R.int(80, 300)), 'TIP': 0, 'TRANSACTION DATE': `${x.d} ${x.t}:00` }); }
  bamb.sort((a, b) => a['TRANSACTION DATE'].localeCompare(b['TRANSACTION DATE']));
  // App
  const app = [];
  for (let i = 0; i < C.app + C.ejApp; i++) {
    const b = R.pick(bilar), x = ts();
    app.push({ id: String(9100000 + i), bil: b.bil, price: (R.int(110, 520) + R.int(0, 9) / 10).toFixed(2), payment: i < C.app ? 'app' : 'card', lamnad: `${x.d} ${x.t}`, skede: 'Levererad', forare: R.pick(forareFor(b)), fran: R.pick(GATOR) + ' ' + R.int(1, 60) + ', Malmö, Sverige', till: R.pick(GATOR) + ' ' + R.int(1, 60) + ', Malmö, Sverige' });
  }
  app.sort((a, b) => a.lamnad.localeCompare(b.lamnad));
  // Bro och CPH
  const bro = [];
  for (let i = 0; i < C.bro; i++) { const b = R.pick(bilar.slice(0, Math.max(10, Math.floor(bilar.length * 0.7)))), x = ts(); bro.push({ bil: b.bil, reg: b.reg, ts: `${x.d} ${x.t}:${pad(x.s)}`, dir: R.chance(0.5) ? 'SV/DK' : 'DK/SV', pris: 201 }); }
  bro.sort((a, b) => a.ts.localeCompare(b.ts));
  const cph = [];
  for (let i = 0; i < C.cph; i++) { const b = R.pick(bilar.slice(0, 20)), x = ts(); cph.push({ bil: b.bil, reg: b.reg, ts: `${x.d} ${x.t}:${pad(x.s)}`, pris: 17.04 }); }
  cph.sort((a, b) => a.ts.localeCompare(b.ts));
  // Sturup
  const sturup = [];
  for (let i = 0; i < C.sturup; i++) { const b = R.pick(bilar.slice(5, 40)), x = ts(); sturup.push({ bil: b.bil, reg: b.reg, d: x.d, t: x.t, h: x.h, m: x.m, pris: R.chance(0.8) ? 40.75 : 54 }); }
  sturup.sort((a, b) => a.bil - b.bil || (a.d + a.t).localeCompare(b.d + b.t));
  return { period, trips, bamb, app, bro, cph, sturup };
}

// ---------- Filer i samma form som källsystemen ----------
const csvCell = v => /[",;\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
const csv = rows => rows.map(r => r.map(csvCell).join(',')).join('\n');

/** TaxiCaller debiteringskunder som CSV. */
export function taxiCallerCsv(M) {
  return csv([['Körnings-id', 'Vehicle number', 'konto Nr', 'Totalsumma', 'Passagerare', 'Lämnad', 'Upphämtningsplats', 'Avlämningsaddress'],
    ...M.trips.map(t => [t.id, t.bil, t.konto, t.belopp.toFixed(2), t.pass, `${t.d} ${t.t}`, t.fran, t.till])]);
}

/** TaxiCaller appbetalningar som CSV. */
export function appCsv(M) {
  return csv([['id', 'Vehicle number', 'Price', 'Payment', 'Lämnad', 'Skede', 'Förare', 'Upphämtningsplats', 'Avlämningsadress'],
    ...M.app.map(a => [a.id, a.bil, a.price, a.payment, a.lamnad, a.skede, a.forare, a.fran, a.till])]);
}

/** Text till pdf-sidor: [[{str,x,y}]] med y nedåt, som pdfPages ger. En rad = flera textbitar med x. */
function pagesFrom(rows, perPage = 60) {
  const pages = []; let cur = [], y = 40;
  for (const r of rows) {
    if (cur.length && y > 40 + perPage * 12) { pages.push(cur); cur = []; y = 40; }
    for (const [x, str] of r) cur.push({ str, x, y });
    y += 12;
  }
  if (cur.length) pages.push(cur);
  return pages;
}

/** TaxiCaller kontofakturor som PDF-sidor (parseTaxiCaller). */
export function taxiCallerPages(M) {
  const rows = [];
  const by = new Map(); for (const t of M.trips) { if (!by.has(t.konto)) by.set(t.konto, []); by.get(t.konto).push(t); }
  for (const [nr, L] of by) {
    rows.push([[40, `Konto #${nr} - ${L[0].kontoNamn}`]]);
    rows.push([[40, `Fakturanummer ${nr}${M.period.replace('-', '')}`], [300, `period: ${M.period}-01 - ${M.period}-${pad(daysIn(M.period))}`]]);
    rows.push([[40, 'Start'], [90, 'Passagerare'], [180, 'Rutt'], [380, 'Bil'], [420, 'Förare'], [500, 'Betalning'], [560, 'Pris']]);
    let d = null;
    for (const t of L) {
      if (t.d !== d) { d = t.d; rows.push([[40, d]]); }
      rows.push([[40, `${t.t} ${t.pass}`], [180, `#${t.id} från: ${t.fran} till: ${t.till}`], [380, String(t.bil)], [420, t.forare], [500, 'K'], [560, t.belopp.toFixed(2)]]);
    }
    const sum = L.reduce((a, t) => a + t.belopp, 0);
    rows.push([[40, 'Totalt pris'], [560, sum.toFixed(2)]]);
    rows.push([[40, `Fakturabelopp ${sum.toFixed(2)}`]]);
  }
  return pagesFrom(rows, 55);
}

const sek = x => { const [i, d] = Math.abs(x).toFixed(2).split('.'); return (x < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + d; };

/** Øresundsbro samlingsfaktura som PDF-sidor. Läses både av parseOresund (Avräkning) och ENG.parseBro (Åkarkassan). */
export function oresundPages(M, { fakturadatum } = {}) {
  const fd = fakturadatum || (() => { const [y, m] = M.period.split('-').map(Number); return new Date(Date.UTC(y, m, 3)).toISOString().slice(0, 10); })();
  const kostBro = M.bro.reduce((a, p) => a + p.pris, 0), kostCph = Math.round(M.cph.reduce((a, p) => a + p.pris, 0) * 100) / 100;
  const rows = [[[40, 'Øresundsbro Konsortiet'], [400, 'Samlingsfaktura']], [[40, `Fakturadatum: ${fd}`]], [[40, `Øresundsbro Konsortiet SEK ${sek(kostBro)}`]], [[40, `CPH Parkering SEK ${sek(kostCph)}`]],
    [[40, 'Leverantör Øresundsbro Konsortiet']]];
  for (const p of M.bro) rows.push([[40, `${p.ts} ${p.reg.slice(0, 3)} ${p.reg.slice(3)} / BIL ${p.bil} ${p.dir} Klass 2 SEK ${sek(p.pris)}`]]);
  rows.push([[40, 'Leverantör CPH Parkering']]);
  for (const p of M.cph) rows.push([[40, `${p.ts} ${p.reg} / ${p.bil} Pick-up fee Zone1 SEK ${sek(p.pris)}`]]);
  return pagesFrom(rows, 70);
}

/** Swedavia Malmö Airport (Sturup) som PDF-sidor. Läses av parseSturup i båda motorerna. */
export function sturupPages(M) {
  const [y, m] = M.period.split('-');
  const rows = [[[40, 'Swedavia AB, Malmö Airport']], [[40, `Debiteras perioden: 01.${m}.${y.slice(2)} till ${pad(daysIn(M.period))}.${m}.${y.slice(2)}`]]];
  let cur = null;
  for (const p of M.sturup) {
    if (p.bil !== cur) { cur = p.bil; rows.push([[40, `Bil ${p.bil} ${p.reg} (${300 + p.bil}) Taxi klass 2`]]); }
    const dd = p.d.slice(8, 10) + '.' + m + '.' + y.slice(2), ut = `${pad(p.h)}:${pad(Math.min(59, p.m + 12))}`;
    rows.push([[40, `P5 ${dd} ${p.t} ${dd} ${ut} Taxi ${sek(p.pris)} ---`]]);
  }
  return pagesFrom(rows, 70);
}

/** Kontoutdrag som rader (Excel), med förskott till några åkare. */
export function bankRows(S, period, seed = 5) {
  const R = rng(seed);
  const rows = [['Bokföringsdag', 'Transaktionsdag', 'Text', 'Belopp', 'Saldo']];
  let saldo = 250000;
  for (let i = 0; i < 18; i++) {
    const d = `${period}-${pad(R.int(1, 28))}`;
    if (i % 3 === 0) { const b = R.pick(S.bolag.slice(0, 8)); const bel = -R.int(2, 8) * 1000; saldo += bel; rows.push([d, d, 'FÖRSKOTT ' + b.namn.toUpperCase().replace(/ AB| HB/, ''), bel, saldo]); }
    else { const bel = R.chance(0.5) ? R.int(500, 9000) : -R.int(200, 3000); saldo += bel; rows.push([d, d, R.chance(0.5) ? 'BG INBETALNING' : 'KORTKÖP KONTOR', bel, saldo]); }
  }
  return rows;
}

// ---------- Åkarkassan ----------
/** LDL från Megtax för ett åkeri. Belopp i öre. Samma format som demoData() i prototypen. */
export function ldlText({ period = '2026-10', bilar, forare, foretag = 'EXEMPEL AB', seed = 7, dagar = null }) {
  const R = rng(seed); const lines = [];
  const N = dagar || daysIn(period);
  const toDate = s => { const m = s.match(/(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/); return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]); };
  const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const tstr = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
  let rap = 5000;
  for (let d = 1; d <= N; d++) bilar.forEach(([id, reg], bi) => {
    [['05:', 11], ['16:', 11]].forEach(([h, len], pi) => {
      if (R.next() < 0.12) return;
      const st = `${period}-${pad(d)} ${h}${pad(Math.floor(R.next() * 50))}`;
      const a = toDate(st), b = new Date(a.getTime() + (len - R.next() * 2) * 36e5);
      const kont = Math.round(R.next() * (pi ? 900 : 300)) * 100, kred = Math.round(1000 + R.next() * 2200) * 100;
      const kl1 = R.next() < 0.1 ? Math.round(kred * 0.2) : 0;
      const f = ['01', String(rap++), st, dstr(b) + ' ' + tstr(b), '0', forare[bi][pi], id, reg, '', foretag, '', '', String(8 + Math.floor(R.next() * 8)), '1500', '800', String(kont), String(kred), '0', '0', '0', String(kl1), '0', String(kont), '0', '0', '0', '0', String(kred - kl1), '0', '0'];
      lines.push(f.join(';')); if (kont) lines.push('02;1;KONTANT;' + kont + ';2;'); lines.push('02;4;KONTOKORT;' + kred + ';6;');
    });
  });
  return lines.join('\n');
}

/** Liten skattetabell (påhittade belopp, samma format som Skatteverkets fil). */
export function skattetabellText(tabeller = [32, 33, 34]) {
  const L = [];
  const fw = (n, w) => String(n).padStart(w, ' ');
  for (const t of tabeller) {
    for (let to = 2000; to <= 80000; to += 1000) {
      const from = to - 999;
      const base = Math.max(0, Math.round((to - 1800) * (t - 3) / 100));
      const cols = [base, Math.round(base * 0.95), Math.round(base * 0.55), base, Math.round(base * 1.6), Math.round(base * 1.6)];
      L.push('30B' + t + fw(from, 7) + fw(to, 7) + cols.map(c => fw(c, 5)).join(''));
    }
    L.push('30%' + t + fw(80001, 7) + fw(0, 7) + [t, t - 1, t - 12, t, t + 15, t + 15].map(c => fw(c, 5)).join(''));
  }
  return L.join('\n');
}

/** Förare och bilar för ett påhittat åkeri i Åkarkassan. */
export function akeriKassa(seed = 3) {
  const bilar = [['901', 'QAB 12D'], ['902', 'QBC 34F'], ['903', 'QCD 56H'], ['904', 'QDE 78J']];
  const forare = [['100001', '100002'], ['100003', '100004'], ['100005', '100006'], ['100007', '100008']];
  const namn = { '100001': 'Förare A1', '100002': 'Förare A2', '100003': 'Förare A3', '100004': 'Förare A4', '100005': 'Förare A5', '100006': 'Förare A6', '100007': 'Förare A7', '100008': 'Förare A8' };
  return { bilar, forare, namn, seed };
}
