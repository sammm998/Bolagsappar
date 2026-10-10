// Skadeflöde. Flyttat från legacy/apps/skadeflode/index.html: statusar, gränser för hur länge ett ärende får ligga,
// kalkylkontroll (godkänd kalkyl mot arbetsorder), prompter till AI och svar som används när AI inte är påslaget.
// AI anropas bara från servern (edge function "ai"). Utkast skickas aldrig automatiskt.

export const STATUS = {
  intag: 'Intag', kalkyl: 'Kalkyl', vantar: 'Väntar godkännande', tillagg: 'Tillägg begärt',
  produktion: 'I produktion', faktura: 'Klar att fakturera', klar: 'Avstämd'
};
export const STATUS_ORDNING = ['intag', 'kalkyl', 'vantar', 'tillagg', 'produktion', 'faktura', 'klar'];
/** Antal dagar ett ärende får ligga i statusen innan det markeras som sent. */
export const LIMIT = { vantar: 2, tillagg: 2, faktura: 1, intag: 1 };

export const STYLE = 'Skriv på svenska, sakligt och kort, som en erfaren verkstad skriver till en skadereglerare. Använd aldrig tankstreck, använd komma, punkt eller parentes. Ingen markdown.';

const fmt = n => String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' kr';
const fornamn = s => String(s || '').trim().split(/\s+/)[0] || '';
export const normReg = r => String(r || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function dagarI(a, today) {
  const from = a.statusFran || a.skapad || today;
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(from)) / 864e5));
}
export const sen = (a, today) => LIMIT[a.status] !== undefined && dagarI(a, today) > LIMIT[a.status];

/** Byter status och loggar. Returnerar en kopia. */
export function setStatus(a0, status, today, text) {
  const a = JSON.parse(JSON.stringify(a0));
  a.status = status; a.statusFran = today;
  (a.logg = a.logg || []).push({ d: today, t: text || 'Status: ' + STATUS[status] });
  return a;
}

/** Kalkylkontroll: rader [moment, typ, kalkyl, arbetsorder]. */
export function kontroll(rows) {
  const R = (rows || []).map(([moment, typ, k, a]) => {
    const d = (+a || 0) - (+k || 0);
    return { moment, typ, kalkyl: +k || 0, arbetsorder: +a || 0, diff: d, flagga: !+a ? 'saknas' : d < 0 ? 'lagre' : d > 0 ? 'hogre' : null };
  });
  const tk = R.reduce((s, r) => s + r.kalkyl, 0), ta = R.reduce((s, r) => s + r.arbetsorder, 0);
  const ejDeb = R.reduce((s, r) => s + Math.max(0, r.kalkyl - r.arbetsorder), 0);
  return { rader: R, kalkyl: tk, arbetsorder: ta, ejDebiterat: ejDeb, overKalkyl: R.reduce((s, r) => s + Math.max(0, r.arbetsorder - r.kalkyl), 0), avvikelser: R.filter(r => r.flagga).length };
}

/** Kontrollen i text, används när AI inte är påslaget. Samma punkter som AI-genomgången ska ta upp. */
export function kontrollText(a) {
  const K = kontroll(a.kalkylrader);
  if (!K.avvikelser) return '- Arbetsordern stämmer med den godkända kalkylen. Klart att fakturera.' + (a.sjalvrisk ? `\n- Kom ihåg att fakturera kunden självrisken ${fmt(a.sjalvrisk)}.` : '');
  const out = [];
  for (const r of K.rader) {
    if (r.flagga === 'saknas') out.push(`- ${r.moment} ${fmt(r.kalkyl)} saknas på arbetsordern. Kontrollera att momentet är utfört, lägg till det och bifoga underlag till fakturan.`);
    else if (r.flagga === 'lagre') out.push(`- ${r.moment} är debiterat ${fmt(r.arbetsorder)} mot godkända ${fmt(r.kalkyl)}. Justera upp om åtgången stämmer med kalkylen.`);
    else if (r.flagga === 'hogre') out.push(`- ${r.moment} är debiterat ${fmt(r.arbetsorder)}, över godkända ${fmt(r.kalkyl)}. Begär tillägg innan fakturan skickas.`);
  }
  out.push(`- Totalt ${fmt(K.ejDebiterat)} godkänt men ej debiterat.`);
  if (a.sjalvrisk) out.push(`- Kom ihåg att fakturera kunden självrisken ${fmt(a.sjalvrisk)}.`);
  return out.join('\n');
}

export function promptKontroll(a, foretag) {
  const rows = (a.kalkylrader || []).map(([m, t, k, x]) => `${m} (${t}): kalkyl ${k} kr, arbetsorder ${x} kr`).join('\n');
  return `${STYLE}\n\nVerkstad: ${foretag}\n\nDu kontrollerar en godkänd kalkyl mot verkstadens arbetsorder innan fakturan skickas till försäkringsbolaget. Skriv en kort genomgång till verkstadschefen: vilka rader avviker, trolig orsak och vad som ska göras innan fakturering. Max 8 rader, punktlista med bindestreck i början av raden är okej.\n\nÄrende ${a.id}, ${a.reg}, ${a.bil || ''}, ${a.bolag}.\n${rows}\nSjälvrisk ${a.sjalvrisk || 0} kr.`;
}

export function promptSvar(a, mejl, foretag, hint = '') {
  return `${STYLE}\n\nVerkstad: ${foretag}\n\nSkriv ett svarsmejl (ämnesrad först) från verkstaden till skaderegleraren. Svara på det som efterfrågas, håll verkstadens intressen men var korrekt mot försäkringsbolaget. Hitta inte på siffror som inte finns i underlaget.${hint ? '\nVerkstadens instruktion: ' + hint : ''}\n\nÄrende: ${a.id}, regnr ${a.reg}, ${a.bil || ''}, ${a.typ || ''}, kalkyl ${a.kalkyl ? fmt(a.kalkyl) : 'ej klar'}, skadenummer ${a.skadenr}.\n\nInkommande mejl:\n${mejl.text}`;
}

/** Svarsutkast utan AI: en mall som verkstaden fyller i. */
export function svarMall(a, mejl, signatur) {
  return `Ämne: Re: ${mejl.amne}\n\nHej ${fornamn(mejl.fran)},\n\nTack för ert mejl om ${normReg(a.reg)}, skadenummer ${a.skadenr}.\n\n[Svar på frågan]\n\nMed vänliga hälsningar\n${signatur}`;
}

export function promptTillagg(a, fynd, foretag, signatur) {
  return `${STYLE}\n\nVerkstad: ${foretag}\n\nSkriv ett mejl (ämnesrad först, sedan brödtext) till skaderegleraren ${a.reglerare || ''} på ${a.bolag} med en tilläggsbegäran för ärendet nedan. Motivera varför tillägget behövs, lista delar och arbete, säg att bilder bifogas och att arbetet står still i väntan på godkännande. Avsluta med ${signatur}.\n\nÄrende: ${a.id}, regnr ${a.reg}, ${a.bil || ''}, skadenummer ${a.skadenr}, ursprunglig kalkyl ${fmt(a.kalkyl)}.\n\nTeknikerns fynd:\n${fynd}`;
}
export function tillaggMall(a, fynd, signatur) {
  return `Ämne: Tilläggsbegäran ${a.skadenr}, ${normReg(a.reg)}\n\nHej ${fornamn(a.reglerare)},\n\nVid arbetet med ${normReg(a.reg)} (${a.bil || 'bilen'}) har vi hittat skador som inte syntes vid kalkyltillfället.\n\n${fynd}\n\nBilder bifogas. Arbetet står still i väntan på ert godkännande.\n\nMed vänliga hälsningar\n${signatur}`;
}

export const INTAG_FALT = ['kund', 'telefon', 'regnr', 'bil', 'bolag', 'skadenr', 'sjalvrisk', 'skadetyp', 'beskrivning', 'lanebil', 'onskemal'];
export function promptIntag(foretag, text) {
  return `Du hjälper en svensk verkstad (${foretag}) att registrera ett försäkringsärende innan kalkylen görs. Läs kundens meddelande och svara med ENBART ett JSON-objekt med fälten: kund, telefon, regnr (utan mellanslag, versaler), bil, bolag, skadenr, sjalvrisk (tal i kr eller null), skadetyp (kort), beskrivning (1 till 2 meningar), lanebil (bool), onskemal, moment (array av {moment, typ}), saknas (array av uppgifter som saknas innan kalkyl). Hitta inte på uppgifter som inte står i meddelandet.\n\nMeddelande:\n${text}`;
}

/** Läser ut det som går med mönster när AI inte är påslaget. Resten fyller verkstaden i. */
export function intagUtanAI(text) {
  const t = String(text || '');
  const reg = (t.match(/\b([A-ZÅÄÖ]{3})\s?(\d{2}[A-Z0-9])\b/) || []);
  const skn = (t.match(/skadenummer\s*:?\s*([A-Z0-9][A-Z0-9-]{4,})/i) || t.match(/\b([A-Z]{1,4}-\d[\d-]{4,})\b/) || [])[1] || '';
  const tel = (t.match(/(?:\+46|0)7\d[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/) || [])[0] || '';
  const sr = t.match(/självrisk\w*\s*(?:är|på|:)?\s*(\d[\d\s]*)\s*kr/i);
  const bolag = (t.match(/försäkrad (?:i|hos) ([A-ZÅÄÖ][\wÅÄÖåäö-]*(?:\s[A-ZÅÄÖ][\wÅÄÖåäö-]*)*)/) || [])[1] || '';
  const bil = (t.match(/[Bb]ilen är en ([^,.\n]+?)(?:,|\.|\n| regnummer)/) || [])[1] || '';
  const rader = t.trim().split(/\n/).map(s => s.trim()).filter(Boolean);
  const kund = rader.length >= 2 && /^(mvh|med vänlig|hälsningar)/i.test(rader[rader.length - 3] || '') ? rader[rader.length - 2] : (rader.find((r, i) => i > 0 && /^(mvh|med vänlig)/i.test(rader[i - 1])) || '');
  const k = { kund, telefon: tel, regnr: reg[1] ? reg[1] + reg[2] : '', bil, bolag, skadenr: skn, sjalvrisk: sr ? +sr[1].replace(/\s/g, '') : null, skadetyp: '', beskrivning: '', lanebil: /lånebil/i.test(t), onskemal: '', moment: [] };
  k.saknas = [!k.regnr && 'Registreringsnummer', !k.skadenr && 'Skadenummer', !k.bolag && 'Försäkringsbolag', k.sjalvrisk == null && 'Självrisk'].filter(Boolean);
  return k;
}

/** Nytt ärende från ett ärendekort. */
export function nyttArende(k, ids, today) {
  const n = Math.max(200, ...ids.map(x => +String(x).replace(/\D/g, '') || 0)) + 1;
  return { id: 'S-' + n, reg: normReg(k.regnr), bil: k.bil || '', kund: k.kund || '', telefon: k.telefon || '', bolag: k.bolag || '', skadenr: k.skadenr || '', reglerare: '', typ: k.skadetyp || '', beskrivning: k.beskrivning || '', status: 'intag', statusFran: today, skapad: today, kalkyl: 0, sjalvrisk: +k.sjalvrisk || 0, lanebil: !!k.lanebil, kalkylrader: [], logg: [{ d: today, t: 'Ärendet skapat' }] };
}
