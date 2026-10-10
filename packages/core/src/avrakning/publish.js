// Det som publiceras till varje åkare när huvudkunden godkänner och publicerar månaden.
// Allt räknas här från compute(S, D). Skärmarna räknar aldrig själva.
import { r2, monthLabels, ymAdd } from './engine.js';
import { buildSpec, splitRutt } from './month.js';

const ART = { 1: 'Växelavgift', 8: 'Taklampa', 15: 'Sturup', 16: 'Øresundsbron', 17: 'CPH parkering', 50: 'Krediter persontransport', 51: 'Krediter bud', 52: 'Kontokort', 53: 'Serviceavgift', 54: 'Krediter utland', 55: 'Appbetalningar', 56: 'Dricks', 57: 'Specifikation per förare', 59: 'Förskott' };

/** Grupper för sammanfattningen i Min avräkning, i åkarens språk. */
export function sammanfattning(b, P) {
  const rows = b.rows || [];
  const s = f => r2(rows.filter(f).reduce((a, r) => a + r.summa, 0));
  const inkl = (f, moms) => { const ex = s(f); return r2(ex * (1 + moms)); };
  const m25 = P?.m25 ?? 0.25, m6 = P?.m6 ?? 0.06;
  // Krediter är negativa rader (centralen är skyldig åkaren). Visa dem positivt som intäkt.
  const L = [
    { key: 'intakt', text: `Intäkt, ${(b.bilar || []).length} ${(b.bilar || []).length === 1 ? 'bil' : 'bilar'}`, belopp: r2(-(inkl(r => r.art === 50, m6) + inkl(r => r.art === 51, m25) + s(r => [52, 54, 55, 56].includes(r.art)))) },
    { key: 'avgifter', text: 'Avgifter till centralen', belopp: r2(-inkl(r => [1, 8, 53, 57].includes(r.art), m25)) },
    { key: 'bro', text: 'Bro och CPH', belopp: r2(-inkl(r => r.art === 16 || r.art === 17, m25)), n: rows.filter(r => r.art === 16).reduce((a, r) => a + (+r.antal || 0), 0) },
    { key: 'sturup', text: 'Sturup', belopp: r2(-inkl(r => r.art === 15, m25)), n: rows.filter(r => r.art === 15).reduce((a, r) => a + (+r.antal || 0), 0) },
    { key: 'forskott', text: 'Förskott', belopp: r2(-s(r => r.art === 59)) },
    { key: 'skuld', text: 'Tidigare skulder', belopp: r2(-s(r => r.skuld)) },
    { key: 'ovrigt', text: 'Övriga poster', belopp: r2(-inkl(r => r.art == null && !r.skuld && r.moms === 25, m25) - s(r => r.art == null && !r.skuld && r.moms !== 25)) }
  ].filter(x => Math.abs(x.belopp) >= 0.005);
  // Avrundningen till hela kronor och öresavrundningen gör att summan kan skilja några öre. Lägg differensen på en egen rad.
  const far = r2(-b.att);
  const diff = r2(far - L.reduce((a, x) => a + x.belopp, 0));
  if (Math.abs(diff) >= 0.005) L.push({ key: 'avrundning', text: 'Moms och avrundning', belopp: diff });
  return L;
}

/** Per bil för åkaren: intäkt (inkl moms) och avdrag för bro, Sturup och CPH. */
export function perBil(R, b) {
  return R.perBil.filter(x => x.bolag === b.namn).map(x => {
    const intakt = r2(x.kort + x.dricks + x.person + x.bud + x.utland + x.app);
    const bil = String(x.bil);
    const avdragEx = (b.rows || []).filter(r => (r.art === 16 && String(r.text).endsWith(' ' + bil))).reduce((a, r) => a + r.summa, 0);
    const P = R._P || {};
    const avdrag = r2((avdragEx + (x.sturup || 0) * (P.sturup || 0) + (x.cph || 0) * (P.cph || 0)) * 1.25);
    return { bil: x.bil, reg: x.reg, intakt, avdrag: -avdrag, netto: r2(intakt - avdrag), bro: x.bro, sturup: x.sturup, cph: x.cph };
  });
}

/**
 * Bygger delningen till en åkare.
 * @param {object} a
 * @param {object} a.R compute(S, D)
 * @param {object} a.S inställningar
 * @param {object} a.bolag raden i R.bolag
 * @param {object} [a.spec] buildSpec(...).bolag-raden för åkaren (körningar per bil och förare)
 * @param {{bro:any[], stu:any[]}} [a.passager] tidsstämplade passager (ENG.parseBro/parseSturup) för hela fakturan
 * @param {string} a.fran huvudkundens namn
 * @param {number} [a.utbDag] utbetalningsdag i månaden efter
 * @param {number} [a.version]
 */
export function buildShare({ R, S, bolag: b, spec, passager, fran, utbDag = 5, version = 1, orsak = null }) {
  const period = R.period;
  const regs = new Set(S.bilar.filter(x => (x.avr || x.bolag) === b.namn).map(x => String(x.reg || '').replace(/\s/g, '').toUpperCase()).filter(Boolean));
  const own = L => (L || []).filter(p => regs.has(String(p.reg || '').replace(/\s/g, '').toUpperCase())).map(({ t, ...p }) => p);
  const utb = ymAdd(period, 1) + '-' + String(utbDag).padStart(2, '0');
  const RR = { ...R, _P: S.params };
  return {
    kind: 'akaravrakning', version, orsak,
    period, manad: monthLabels(period).namn, fran,
    namn: b.namn, kn: b.kn ?? null,
    att: b.att, riktning: b.att < 0 ? 'far' : b.att > 0 ? 'betalar' : 'noll', belopp: Math.abs(b.att), utbetalas: utb,
    netto: b.netto, moms25: b.moms25, moms6: b.moms6, oresavr: b.oresavr,
    rows: b.rows.map(r => ({ art: r.art, artNamn: ART[r.art] || null, text: r.text, antal: r.antal, apris: r.apris, summa: r.summa, moms: r.moms, ...(r.skuld ? { skuld: true } : {}), ...(r.rabattPct ? { rabattPct: r.rabattPct } : {}) })),
    sammanfattning: sammanfattning(b, S.params),
    perBil: perBil(RR, b),
    bilar: b.bilar,
    korningar: spec ? spec.bilar.map(x => ({ bil: x.bil, reg: x.reg, n: x.trips.length, sum: x.sum, trips: x.trips.map(t => ({ d: t.d, t: t.t, fran: t.fran, till: t.till, y: t.y, s: t.s, f: t.f })) })) : [],
    app: spec ? spec.app.map(x => ({ bil: x.bil, n: x.rows.length, sum: x.sum })) : [],
    passager: { bro: own(passager?.bro), stu: own(passager?.stu) },
    meddelande: b.att < 0
      ? `${monthLabels(period).namn.split(' ')[0]} är klar. Du får ${fmtKr(-b.att)} den ${dagText(utb)}.`
      : b.att > 0 ? `${monthLabels(period).namn.split(' ')[0]} är klar. Du betalar ${fmtKr(b.att)} senast den ${dagText(utb)}.` : `${monthLabels(period).namn.split(' ')[0]} är klar.`
  };
}

const MAN = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const dagText = d => +d.slice(8, 10) + ' ' + MAN[+d.slice(5, 7) - 1];
const fmtKr = x => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x).replace(/ /g, ' ') + ' kr';

/** Lista över vem som får vad och hur (steg 4). */
export function publishList(R, S, inloggade = new Set()) {
  return R.bolag.filter(b => b.aktiv).map(b => {
    const B = S.bolag.find(x => x.namn === b.namn) || {};
    const harKonto = inloggade.has(b.namn);
    return { namn: b.namn, att: b.att, riktning: b.att < 0 ? 'Får' : b.att > 0 ? 'Betalar in' : 'Noll', kanal: harKonto ? (B.mail ? 'App och mejl' : 'App') : (B.mail ? 'Mejl (inte inloggad än)' : 'Ingen kanal'), mail: B.mail || '' };
  }).sort((a, b) => a.att - b.att);
}

/** Avvikelser mot förra månaden (steg 2). Kompletterar compute().kontroll, ändrar ingen beräkning. */
export function avvikelser(R, prevSummary, { faktor = 2.5, minBelopp = 1000 } = {}) {
  const out = [];
  if (!prevSummary?.bolag) return out;
  for (const b of R.bolag.filter(x => x.aktiv)) {
    const p = prevSummary.bolag.find(x => x.namn === b.namn || String(x.kn) === String(b.kn));
    if (!p) continue;
    const bro = L => (L || []).filter(r => r.art === 16).reduce((a, r) => a + (+r.antal || 0), 0);
    const nb = bro(b.rows), np = bro(p.rows);
    if (np > 0 && nb >= np * faktor && (nb - np) * (R.bolag[0]?.rows?.find(r => r.art === 16)?.apris || 201) >= minBelopp) {
      const x = Math.round(nb / np * 10) / 10;
      out.push({ niva: 'fel', typ: `Brokostnad ${x >= 3 ? Math.round(x) + ' gånger' : String(x).replace('.', ',') + ' gånger'} högre än förra månaden`, vad: `${b.namn}. ${nb} passager mot ${np}.`, bolag: b.namn, belopp: null, atgard: 'Kontrollera passagerna per bil under Per bil.' });
    }
    if (p.att && b.att && Math.sign(p.att) === Math.sign(b.att) && Math.abs(b.att) > Math.abs(p.att) * faktor && Math.abs(b.att - p.att) > 10000) {
      out.push({ niva: 'info', typ: 'Stor ändring mot förra månaden', vad: `${b.namn}: ${Math.round(p.att)} kr blir ${Math.round(b.att)} kr`, bolag: b.namn, belopp: r2(b.att - p.att), atgard: 'Kontrollera att alla filer är rätt månad.' });
    }
  }
  return out;
}

/** Spec per åkare för en räknad månad (live). */
export function specForLive(R, S, D) {
  const kund = R.kund.map(k => ({ nr: k.nr, namn: k.namn, korn: k.korn || [] }));
  const appRows = (D.appRad || []).map(a => ({ id: String(a.id || ''), bil: +a.bil, d: String(a.datum || '').slice(0, 10), t: String(a.datum || '').slice(11, 16), s: +a.belopp || 0, f: String(a.forare || '').trim(), fran: a.fran || '', till: a.till || '' }));
  const bil2b = new Map(); R.perBil.forEach(x => bil2b.set(+x.bil, x.bolag));
  return buildSpec(S, kund, appRows, bil2b);
}

export { splitRutt };
