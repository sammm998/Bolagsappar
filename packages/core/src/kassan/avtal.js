// Anställningsavtal och tillägg om plattformsavgift. Flyttat från avText, tpText och avSaknas i
// legacy/apps/akarkassan/index.html. Centralens namn och ort kommer från kontot (white label).
// Signering sker med pennan (rita eller skriv namnet), som i prototypen. Ingen BankID.
/* eslint-disable */
const MON = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const nf0 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const krs = (x, d) => (d ? nf2 : nf0).format(x || 0) + ' kr';
export const avDatum = s => { if (!s) return ''; const d = new Date(s); return isNaN(d) ? s : d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };
export const TP = 'tp:';
export const rid = id => String(id).startsWith(TP) ? String(id).slice(TP.length) : id;
export const isTP = id => String(id).startsWith(TP);

export function avSaknas(id, settings) {
  if (isTP(id)) { const f = (settings.forare || {})[rid(id)] || {}, p = f.person || {}; return [!f.namn && 'namn', !p.personnr && 'personnummer', !p.adress && 'adress'].filter(Boolean); }
  const f = (settings.forare || {})[id] || {}, p = f.person || {};
  return [!f.namn && 'namn', !p.personnr && 'personnummer', !p.adress && 'adress', !f.anstForm && 'anställningsform', !f.start && 'anställd från', (f.anstForm === 'sava' && !f.slut) && 'slutdatum', (f.modell === 'fast' && !f.manadslon) && 'månadslön'].filter(Boolean);
}

export function tpText(id, { settings, cfg }) {
  const c = cfg, f = (settings.forare || {})[id] || {}, p = f.person || {}, co = settings.bolag || {}, fo = settings.foretag || '';
  const fran = f.plattFran || '2026-09-01'; const d = new Date(fran); const manad = MON[d.getMonth()] + ' ' + d.getFullYear(); const utb = new Date(d.getFullYear(), d.getMonth() + 1, 1); const utbM = MON[utb.getMonth()] + ' ' + utb.getFullYear();
  const ref = f.start ? `sedan den ${avDatum(f.start)}` : 'enligt gällande anställningsvillkor';
  return [
    { h: 'Parter', p: [`Arbetsgivare: ${fo}, org.nr ${co.orgnr || ''}, ${[co.adress, co.postadress].filter(Boolean).join(', ')}.`, `Arbetstagare: ${f.namn || ''}, personnummer ${p.personnr || ''}, ${[p.adress, p.postadress].filter(Boolean).join(', ')}${f.anst ? ', anställningsnummer ' + f.anst : ''}.`] },
    { h: 'Bakgrund', p: [`Arbetstagaren är anställd som taxiförare hos arbetsgivaren ${ref}. Arbetstagaren har provisionslön om ${c.procent} % av det belopp arbetstagaren kör in exklusive mervärdesskatt enligt taxameterns redovisning, samt semesterersättning om ${c.semester} % som betalas ut löpande med lönen.`] },
    { h: 'Ändrat villkor', p: ['För körningar som förmedlas via externa bokningsplattformar, till exempel Bolt och Uber, beräknas provisionslönen på körningens belopp exklusive mervärdesskatt efter avdrag för den avgift (provision) som plattformen tar ut av arbetsgivaren för körningen, enligt plattformens månadsredovisning.', `Semesterersättningen om ${c.semester} % beräknas på provisionslönen efter avdraget. För övriga körningar gäller provisionslönen oförändrad.`, `Exempel: en Boltkörning på 106 kr inklusive moms är 100 kr exklusive moms. Tar Bolt ut 25 kr i avgift blir underlaget 75 kr och provisionslönen ${nf2.format(75 * c.procent / 100)} kr.`] },
    { h: 'Redovisning', p: ['Avdraget för plattformsavgift redovisas varje månad på lönespecifikationen. Arbetstagaren har rätt att på begäran ta del av plattformens redovisning för sina körningar.'] },
    { h: 'Giltighet', p: [`Villkoret gäller för körningar som utförts från och med den ${avDatum(fran)}. Arbetstagaren godkänner genom sin underskrift uttryckligen att villkoret tillämpas på lönen för ${manad}, som betalas ut i ${utbM}.`] },
    { h: 'Övrigt', p: ['I övrigt gäller anställningsavtalet och tidigare överenskomna villkor oförändrade. Detta tillägg utgör skriftlig information om ändrade anställningsvillkor enligt 6 e § lagen (1982:80) om anställningsskydd. Tillägget har upprättats i elektronisk form och signerats elektroniskt av båda parter. Vardera parten har rätt till en kopia.'] }
  ];
}

export function avText(id, { settings, cfg, central = "centralen", ort = "Malmö" }) {
  if (isTP(id)) return tpText(rid(id), { settings, cfg });
  const c = cfg, f = (settings.forare || {})[id] || {}, p = f.person || {}, co = settings.bolag || {}, fo = settings.foretag || '';
  const fast = f.modell === 'fast', form = f.anstForm, sem = c.semester || 12;
  const formTxt = {
    prov: `Anställningen inleds med en provanställning från och med ${avDatum(f.start)}${f.slut ? ' till och med ' + avDatum(f.slut) : ' om sex månader'} (6 § LAS). Provanställningen övergår därefter i en tillsvidareanställning om inte någon av parterna senast två veckor före provanställningens slut har lämnat besked om att den ska upphöra (31 § LAS). Provanställningen kan avbrytas före prövotidens utgång.`,
    tills: `Anställningen är en tillsvidareanställning från och med ${avDatum(f.start)}.`,
    sava: `Anställningen är en särskild visstidsanställning (5 § LAS) från och med ${avDatum(f.start)} till och med ${avDatum(f.slut)}. Anställningen upphör utan föregående uppsägning vid anställningstidens slut.`,
    behov: `Anställningen avser arbete vid behov från och med ${avDatum(f.start)}. Varje arbetspass utgör en särskild visstidsanställning (5 § LAS). Arbetstagaren är fri att tacka ja eller nej till erbjudna pass.`
  }[form] || '';
  const lon = fast
    ? [`Arbetstagaren har en fast månadslön om ${krs(f.manadslon)} före skatt.${f.semFast ? ` Utöver månadslönen betalas semesterersättning om ${sem} % ut löpande med lönen.` : ''}`,
       'Lönen betalas ut den 25:e varje månad för innevarande månad, till det bankkonto arbetstagaren har uppgett. Infaller dagen på en helgdag betalas lönen ut närmast föregående bankdag.']
    : [`Arbetstagaren har provisionslön om ${c.procent} % av det belopp arbetstagaren kör in exklusive mervärdesskatt, enligt taxameterns redovisning (Megtax). Bomkörning ingår inte i underlaget. Någon särskild ersättning för obekväm arbetstid utgår inte.`,
       'För körningar som förmedlas via externa bokningsplattformar, till exempel Bolt och Uber, beräknas provisionslönen på körningens belopp exklusive mervärdesskatt efter avdrag för den avgift (provision) som plattformen tar ut av arbetsgivaren för körningen, enligt plattformens månadsredovisning. Avdraget redovisas på lönespecifikationen. Villkoret gäller för körningar som utförs från och med den dag avtalet har undertecknats av båda parter.',
       `Semesterersättning om ${sem} % av provisionslönen betalas ut löpande med lönen (16 a § semesterlagen).`,
       'Provisionslönen för en kalendermånad betalas ut omkring den 10:e i påföljande månad, senast den 12:e, till det bankkonto arbetstagaren har uppgett.'];
  return [
    { h: 'Parter', p: [`Arbetsgivare: ${fo}, org.nr ${co.orgnr || ''}, ${[co.adress, co.postadress].filter(Boolean).join(', ')}.`, `Arbetstagare: ${f.namn || ''}, personnummer ${p.personnr || ''}, ${[p.adress, p.postadress].filter(Boolean).join(', ')}.`] },
    { h: 'Befattning och arbetsuppgifter', p: [`Arbetstagaren anställs som taxiförare. Arbetet omfattar persontransporter och budkörning med arbetsgivarens fordon i trafik ansluten till ${central}, kontanthantering och redovisning av körningar enligt arbetsgivarens rutiner samt omvårdnad av fordonet under passet.`, 'Arbetstagaren ska under hela anställningen inneha giltig taxiförarlegitimation (taxitrafiklagen (2012:211)) och giltigt körkort. Arbetstagaren ska omedelbart underrätta arbetsgivaren om legitimationen eller körkortet återkallas, upphör eller ifrågasätts.'] },
    { h: 'Arbetsplats', p: [`Arbetet utförs i arbetsgivarens fordon med utgångspunkt i ${ort}. Körningarna sker inom och utanför ${ort}${ort === "Malmö" ? ", inklusive Malmö Airport (Sturup) och Köpenhamn" : ""}.`] },
    { h: 'Anställningsform och tillträde', p: [formTxt] },
    { h: 'Arbetstid', p: [`Anställningen avser ${f.omfattning === 'deltid' ? 'deltid' : 'heltid, 40 timmar per vecka i genomsnitt'}. Arbetet förläggs i pass enligt schema, normalt dagpass 04.00 till 16.00 eller kvällspass 16.00 till 04.00. Schema meddelas i god tid.`, 'Arbetstidslagen (1982:673) gäller, bland annat om dygnsvila, veckovila och raster. Övertid utförs endast efter överenskommelse med arbetsgivaren.'] },
    { h: 'Lön', p: lon },
    { h: 'Avdrag och kvittning', p: [`Arbetstagaren medger att arbetsgivaren får göra följande avdrag från nettolönen (1 § lagen (1970:215) om arbetsgivares kvittningsrätt): kontanter som arbetstagaren har tagit emot för arbetsgivarens räkning och inte redovisat in, ${c.broAndel} % av kostnaden exklusive mervärdesskatt för passager över Øresundsbron, parkering vid Köpenhamns flygplats och passager vid Malmö Airport (Sturup) under arbetstagarens pass, samt utbetalda löneförskott.`, 'Överstiger avdragen nettolönen ska arbetstagaren betala in mellanskillnaden till arbetsgivaren senast på lönedagen. Varje avdrag redovisas på lönespecifikationen.'] },
    { h: 'Semester', p: [`Arbetstagaren har rätt till semester enligt semesterlagen (1977:480), 25 semesterdagar per semesterår. Semesterns förläggning bestäms efter samråd med arbetstagaren.${fast && !f.semFast ? ' Semesterlön betalas enligt semesterlagen.' : ''}`] },
    { h: 'Uppsägning', p: ['Vid uppsägning gäller uppsägningstider enligt 11 § LAS. Arbetstagarens uppsägningstid är en månad. Arbetsgivarens uppsägningstid är en månad och förlängs till två månader efter två års sammanlagd anställningstid, tre månader efter fyra år, fyra månader efter sex år, fem månader efter åtta år och sex månader efter tio år.', 'Uppsägning ska vara skriftlig. Uppsägning från arbetsgivarens sida kräver saklig grund (7 § LAS).'] },
    { h: 'Kollektivavtal och försäkringar', p: ['Arbetsgivaren är inte bunden av kollektivavtal. Arbetsgivaren betalar lagstadgade arbetsgivaravgifter, vilket ger arbetstagaren socialförsäkringsskydd enligt socialförsäkringsbalken. Fordonen är trafikförsäkrade.'] },
    { h: 'Kompetensutveckling', p: [`Arbetsgivaren erbjuder den introduktion och utbildning som krävs för arbetet, bland annat i taxameter, betalterminaler och ${central}:s rutiner. Sådan utbildning sker på arbetstid.`] },
    { h: 'Fordon, kontanter och utrustning', p: [`Fordon, taxameter, betalterminal och övrig utrustning tillhör arbetsgivaren och får endast användas i tjänsten. Arbetstagaren ska följa arbetsgivarens och ${central}:s instruktioner för redovisning av körningar och kontanter. Skador och fel ska rapporteras samma dag.`] },
    { h: 'Tystnadsplikt', p: ['Arbetstagaren får inte till obehörig lämna ut uppgifter om resenärer, beställare eller arbetsgivarens affärsförhållanden. Tystnadsplikten gäller även efter anställningens slut.'] },
    { h: 'Personuppgifter', p: [`${fo} behandlar arbetstagarens personuppgifter (bland annat namn, personnummer, kontaktuppgifter, bankkonto, lön och körpass) för att fullgöra anställningsavtalet och rättsliga förpliktelser inom lön, skatt och bokföring, enligt dataskyddsförordningen (EU) 2016/679 artikel 6.1 b och c. Uppgifterna lämnas till Skatteverket och banken i den mån det krävs och sparas så länge lagen kräver, för räkenskapsinformation sju år (bokföringslagen 7 kap.). Arbetstagaren har rätt att begära tillgång till och rättelse av sina uppgifter.`] },
    { h: 'Övrigt', p: ['Detta avtal ersätter tidigare muntliga och skriftliga överenskommelser om anställningen. Ändringar ska göras skriftligt. Avtalet har upprättats i elektronisk form och signerats elektroniskt av båda parter. Vardera parten har rätt till en kopia.'] }
  ];
}

/** Status för senaste versionen: null, 'utkast' eller 'signerat'. */
export function avStatus(doc) { const v = (doc || { versioner: [] }).versioner; const a = v[v.length - 1]; if (!a) return null; return a.sign && a.sign.anst && a.sign.arbg ? 'signerat' : 'utkast'; }

/** SHA-256 av avtalstexten. Låser texten vid signering. */
export async function avHash(obj) {
  const b = new TextEncoder().encode(JSON.stringify(obj));
  const h = await globalThis.crypto.subtle.digest('SHA-256', b);
  return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/** Ny version för signering. */
export async function avUpprata(id, ctx) { const text = avText(id, ctx); return { skapad: new Date().toISOString(), text, hash: await avHash(text), sign: {} }; }

/**
 * Signera en version med pennan. role: 'anst' (arbetstagaren) eller 'arbg' (arbetsgivaren).
 * png är underskriften som bild (data-URL). Returnerar ny version eller kastar fel med svensk text.
 */
export async function avSignera(v, role, { namn, ort, png, ua = '' }) {
  if (!png || !String(namn || '').trim()) throw new Error('Underskrift och namn krävs');
  if (await avHash(v.text) !== v.hash) throw new Error('Avtalstexten har ändrats, signering avbruten');
  if (role === 'arbg' && !v.sign.anst) throw new Error('Arbetstagaren signerar först');
  return { ...v, sign: { ...v.sign, [role]: { namn: String(namn).trim(), ort: String(ort || '').trim(), tid: new Date().toISOString(), png, ua: String(ua).slice(0, 120) } } };
}
