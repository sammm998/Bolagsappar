// Grunddata: konton, användare, roller, licenser och erbjudanden. Används av den lokala backenden
// och av scripts/gen-seed-sql.mjs som skriver supabase/seed.sql. Alla personer och bolag utom
// Taxi Malmö och Bolagsappar är påhittade.
import { AKERIER, JETPACK_UL } from '@bolagsappar/core/testdata';
import { MODULES } from '@bolagsappar/modules';

const id = (pre, n) => `00000000-0000-4000-8000-${pre}${String(n).padStart(12 - pre.length, '0')}`;
export const T = { platform: id('a', 1), taxi: id('a', 2), jetpack: id('a', 3), folie: id('a', 4), stad: id('a', 5) };
export const U = { admin: id('b', 1), sara: id('b', 2), ahmed: id('b', 3), forare: id('b', 4), fia: id('b', 5), jet: id('b', 6), jetUl: id('b', 7) };
export const subId = i => id('c', i + 1);
export const jetSubId = i => id('ab', i + 1);
export const ownerId = i => id('d', i + 1);

export const slugify = s => String(s).toLowerCase().replace(/å|ä/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e').replace(/\b(ab|hb|kb)\b/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Inbjudna men inte inloggade än (Inbjudna 3 på sidan 28)
const INBJUDNA = new Set(['Öresund Bil AB', 'Klagshamn Taxi AB', 'Toftanäs Trafik AB']);
// Åkare med Åkarkassan aktiv (9 av 24)
const KASSAN = new Set(['Åkeri Norra AB', 'Söder Taxi HB', 'Hamnens Taxi AB', 'Fosie Trafik AB', 'Oxie Trafik AB', 'Hyllie Trafik AB', 'Rosengård Taxi AB', 'Pildamm Taxi AB', 'Värnhem Trafik AB']);

export function buildSeed(now = new Date('2026-10-10T08:00:00Z')) {
  const daysAgo = n => new Date(now.getTime() - n * 864e5).toISOString();
  const tenants = [
    { id: T.platform, parent_id: null, type: 'platform', name: 'Bolagsappar', slug: 'admin', org_nr: null, brand: { initialer: 'BA', accent: '#0E1E35', text: '#FFFFFF' }, settings: {} },
    { id: T.taxi, parent_id: null, type: 'main', name: 'Taxi Malmö', slug: 'taxi-malmo', org_nr: null, brand: { initialer: 'TM', accent: '#F5B301', text: '#0E1E35', akarOrd: 'åkare' }, settings: { centralNamn: 'Taxi Malmö AB', ort: 'Malmö', utbDag: 5, kontakt: '040-911 911' } },
    { id: T.jetpack, parent_id: null, type: 'main', name: 'Jetpack', slug: 'jetpack', org_nr: null, brand: { initialer: 'JP', accent: '#7C5CFF', text: '#FFFFFF', akarOrd: 'underleverantör' }, settings: { status: 'bygger', dag: 6, dagar: 14, bransch: 'logistik', ord: { korningar: 'uppdrag', akare: 'underleverantör' } } },
    { id: T.folie, parent_id: null, type: 'direct', name: 'Folieringsfirman', slug: 'folieringsfirman', org_nr: '559xxx-0001', brand: { initialer: 'FF', accent: '#1F4D3A', text: '#FFFFFF' }, settings: {} },
    { id: T.stad, parent_id: null, type: 'direct', name: '[Städfirma]', slug: 'stadfirma', org_nr: null, brand: { initialer: 'SF', accent: '#6B7385', text: '#FFFFFF' }, settings: { status: 'arbetsdag', arbetsdag: '2026-11-14' } }
  ];
  const users = [
    { id: U.admin, name: 'Bo Admin', email: 'admin@bolagsappar.example', last_login_at: daysAgo(0) },
    { id: U.sara, name: 'Sara Exempel', email: 'sara@taxi-malmo.example', last_login_at: daysAgo(0) },
    { id: U.ahmed, name: 'Ahmed Exempel', email: 'ahmed@akeri-norra.example', last_login_at: daysAgo(0) },
    { id: U.forare, name: 'Förare A1', email: 'forare.a1@akeri-norra.example', last_login_at: daysAgo(2) },
    { id: U.fia, name: 'Fia Exempel', email: 'fia@folieringsfirman.example', last_login_at: daysAgo(1) },
    { id: U.jet, name: 'Jens Exempel', email: 'jens@jetpack.example', last_login_at: daysAgo(3) },
    { id: U.jetUl, name: 'Ulla Exempel', email: 'ulla@budfirma.example', last_login_at: daysAgo(5) }
  ];
  const memberships = [
    { user_id: U.admin, tenant_id: T.platform, role: 'agare' },
    { user_id: U.sara, tenant_id: T.taxi, role: 'ekonomi' },
    { user_id: U.ahmed, tenant_id: T.taxi, role: 'ekonomi' },
    { user_id: U.fia, tenant_id: T.folie, role: 'agare' },
    { user_id: U.jet, tenant_id: T.jetpack, role: 'agare' }
  ];
  const licenses = [
    { tenant_id: T.taxi, module_key: 'avrakning', variant: 'main', status: 'aktiv', paid_by: T.taxi, price: null, started_at: '2026-09-01' },
    { tenant_id: T.taxi, module_key: 'forarlista', variant: 'main', status: 'aktiv', paid_by: T.taxi, price: null, started_at: '2026-09-01' },
    { tenant_id: T.jetpack, module_key: 'avrakning', variant: 'main', status: 'aktiv', paid_by: T.jetpack, price: null, started_at: '2026-10-05' },
    { tenant_id: T.folie, module_key: 'verkstad', variant: 'direct', status: 'aktiv', paid_by: T.folie, price: null, started_at: '2026-08-01' },
    { tenant_id: T.folie, module_key: 'skadeflode', variant: 'direct', status: 'aktiv', paid_by: T.folie, price: null, started_at: '2026-08-01' }
  ];
  const invites = [];
  const login = [0, 1, 3, 12, 0, null, 2, 5, 1, 7, 0, 4, 9, 2, 1, 6, 3, 15, 2, 0, 8, 1, null, null];
  AKERIER.forEach(([namn, , agare], i) => {
    const t = subId(i);
    tenants.push({ id: t, parent_id: T.taxi, type: 'sub', name: namn, slug: slugify(namn), org_nr: '556xxx-' + String(101 + i).padStart(4, '0'), brand: { initialer: initials(namn), accent: '#0E1E35', text: '#FFFFFF' }, settings: { bilar: AKERIER[i][1] } });
    if (INBJUDNA.has(namn)) {
      invites.push({ id: id('e', i + 1), parent_id: T.taxi, tenant_id: t, org_nr: '556xxx-' + String(101 + i).padStart(4, '0'), name: namn, email: 'ekonomi@' + slugify(namn) + '.example', modules: ['avrakning'], status: 'skickad', token: 'demo-' + slugify(namn), expires_at: new Date(now.getTime() + 20 * 864e5).toISOString(), created_at: daysAgo(10) });
      return;
    }
    const uid = namn === 'Åkeri Norra AB' ? U.ahmed : ownerId(i);
    if (uid !== U.ahmed) users.push({ id: uid, name: (agare || 'Ägare') + ' Exempel', email: slugify(agare || 'agare') + '@' + slugify(namn) + '.example', last_login_at: login[i] == null ? null : daysAgo(login[i]) });
    memberships.push({ user_id: uid, tenant_id: t, role: 'agare' });
    licenses.push({ tenant_id: t, module_key: 'avrakning', variant: 'sub', status: 'aktiv', paid_by: T.taxi, price: null, started_at: '2026-09-01' });
    licenses.push({ tenant_id: t, module_key: 'forarlista', variant: 'sub', status: 'aktiv', paid_by: T.taxi, price: null, started_at: '2026-09-01' });
    if (KASSAN.has(namn)) licenses.push({ tenant_id: t, module_key: 'kassan', variant: 'sub', status: 'aktiv', paid_by: t, price: null, started_at: '2026-09-01' });
  });
  memberships.push({ user_id: U.forare, tenant_id: subId(0), role: 'forare', forare_id: '100001' });
  // Jetpack (exempel): underleverantörer med Min avräkning som Jetpack betalar
  JETPACK_UL.forEach((u, i) => {
    tenants.push({ id: jetSubId(i), parent_id: T.jetpack, type: 'sub', name: u.namn, slug: slugify(u.namn), org_nr: '559xxx-' + String(201 + i).padStart(4, '0'), brand: { initialer: initials(u.namn), accent: '#7C5CFF', text: '#FFFFFF', akarOrd: 'underleverantör' }, settings: { fordon: u.fordon } });
    licenses.push({ tenant_id: jetSubId(i), module_key: 'avrakning', variant: 'sub', status: 'aktiv', paid_by: T.jetpack, price: null, started_at: '2026-10-05' });
  });
  memberships.push({ user_id: U.jetUl, tenant_id: jetSubId(1), role: 'agare' });

  const offers = [
    { parent_id: T.taxi, module_key: 'avrakning', variant: 'sub', mode: 'ingar', paid_by: 'parent', price: null, auto_enable: true },
    { parent_id: T.taxi, module_key: 'kassan', variant: 'sub', mode: 'tillval', paid_by: 'self', price: null, auto_enable: false },
    { parent_id: T.taxi, module_key: 'forarlista', variant: 'sub', mode: 'ingar', paid_by: 'parent', price: null, auto_enable: true },
    { parent_id: T.taxi, module_key: 'skadeflode', variant: 'sub', mode: 'av', paid_by: 'self', price: null, auto_enable: false }
  ];
  const modules = MODULES.map(m => ({ key: m.key, name: m.name, version: m.version, manifest: { status: m.status, icon: m.icon, tone: m.tone, beskrivning: m.beskrivning, variants: Object.keys(m.variants) } }));
  const tax_rates = [
    { id: 1, kind: 'avgifter', valid_from: '2000-01', valid_to: null, data: { arbetsgivaravgift: 0.3142, fodd_senast_noll: 1937, pension_alder: 67, pension_sats: 0.1021, ung: { from: '2026-04', tom: '2027-09', aldrar_fran: 19, aldrar_tom: 23, sats: 0.2081, tak: 25000 } } },
    { id: 2, kind: 'moms', valid_from: '2000-01', valid_to: null, data: { normal: 0.25, livsmedel: 0.12, persontransport: 0.06 } }
  ];
  const support_tickets = [
    { id: id('f', 1), tenant_id: subId(3), subject: 'Fråga om brorad', status: 'vantar', created_at: daysAgo(0) },
    { id: id('f', 2), tenant_id: T.jetpack, subject: 'Exempel på uppdragsfil', status: 'ny', created_at: daysAgo(0) },
    { id: id('f', 3), tenant_id: subId(2), subject: 'Skattetabell inläst', status: 'lost', created_at: daysAgo(1) }
  ];
  return { tenants, users, memberships, licenses, offers, invites, modules, tax_rates, support_tickets };
}

export function initials(namn) {
  return String(namn).replace(/\b(AB|HB|KB)\b/g, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/** Demo-användare för inloggningen i lokalt läge. */
export const DEMO_LOGINS = [
  { user: U.sara, roll: 'Taxi Malmö, ekonomi', hint: 'Huvudkundens portal' },
  { user: U.ahmed, roll: 'Åkeri Norra AB, ägare (och ekonomi på Taxi Malmö)', hint: 'Två bolag, kontoväljaren' },
  { user: U.forare, roll: 'Förare på Åkeri Norra AB', hint: 'Lönespec och signering' },
  { user: U.fia, roll: 'Folieringsfirman, ägare', hint: 'Direktkund med Verkstad' },
  { user: U.jet, roll: 'Jetpack, ägare (logistik, exempel)', hint: 'Uppdrag och underleverantörer' },
  { user: U.jetUl, roll: 'Budfirma Exempel AB, underleverantör till Jetpack', hint: 'Min avräkning från Jetpack' },
  { user: U.admin, roll: 'Bolagsappar, superadmin', hint: 'Adminportalen' }
];
