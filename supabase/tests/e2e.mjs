// Helhetstest mot en riktig Supabase-stack (Postgres, PostgREST, GoTrue och Edge Functions).
// Går igenom systemet som riktiga användare: inloggning med e-postlänk, Taxi Malmö som huvudkund,
// inbjudan av en åkare, publicering, Min avräkning, förare som signerar med pennan, support och admin.
// Kräver att stacken kör och att setup.sql är inläst. Se supabase/tests/README.md.
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, MAIL_DIR (där mejlen sparas)
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { createClient } from '../../packages/api/node_modules/@supabase/supabase-js/dist/index.mjs';
import { createSupabaseBackend } from '../../packages/api/src/supabase.js';
import { strokesToPng } from '../../packages/core/src/signatur.js';
import { avUpprata, avSignera } from '../../packages/core/src/kassan/avtal.js';
import { ENG } from '../../packages/core/src/kassan/engine.js';
import { parseForarlista, perAkare, forarlistaCsv, exempelForarlista } from '../../packages/core/src/forarlista.js';
import { readText } from '../../packages/core/src/filetypes/read.js';

const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAIL = process.env.MAIL_DIR, DB = process.env.DATABASE_URL;
const APP = process.env.APP_URL || 'http://localhost:8000/app';
const sql = fs.readFileSync(new URL('../forsta-agare.sql', import.meta.url), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const E = { ekonomi: `ekonomi.${run}@exempel.example`, agare: `agare.${run}@exempel.example`, akare: `akare.${run}@exempel.example`, forare: `forare.${run}@exempel.example`, annan: `annan.${run}@exempel.example`, verkstad: `verkstad.${run}@exempel.example` };

/** Senaste mejlet till en adress, med länken i. */
async function mejl(to, efter) {
  for (let i = 0; i < 40; i++) {
    const F = fs.readdirSync(MAIL).filter(f => +f.split('.')[0] > efter).sort().reverse();
    for (const f of F) {
      const t = fs.readFileSync(path.join(MAIL, f), 'utf8').replace(/=\r?\n/g, '').replace(/=3D/g, '=');
      if (t.toLowerCase().includes(to.toLowerCase())) return t;
    }
    await sleep(250);
  }
  throw new Error('Inget mejl till ' + to);
}

/** Loggar in som en riktig användare: begär länk, öppnar länken ur mejlet, får en session. */
async function loggaIn(email, { viaApp = true, efter = null } = {}) {
  const sb = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const b = createSupabaseBackend({ url: URL_, anonKey: ANON, client: sb, redirectTo: APP + '/valj-bolag' });
  const t0 = efter ?? Date.now();
  if (viaApp) await b.signInWithEmail(email);
  const brev = await mejl(email, t0 - 1);
  const lank = (brev.match(/https?:\/\/[^\s"'<>]+\/verify\?[^\s"'<>]+/) || [])[0];
  assert.ok(lank, 'länk i mejlet');
  const r = await fetch(lank.replace(/&amp;/g, '&'), { redirect: 'manual' });
  const loc = r.headers.get('location') || '';
  assert.ok(loc.startsWith(APP), 'länken leder till plattformen: ' + loc);
  const h = new URLSearchParams(loc.split('#')[1] || '');
  assert.ok(h.get('access_token'), 'session i länken');
  await sb.auth.setSession({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token') });
  return b;
}

let db, A, TM, akareTenant, B2, B3, EK;
before(async () => {
  db = new pg.Client({ connectionString: DB }); await db.connect();
  // Ägaren skapas i Supabase (Authentication, Users) och görs till ägare med forsta-agare.sql
  const u = await admin.auth.admin.createUser({ email: E.agare, email_confirm: true });
  assert.ifError(u.error);
  await db.query(sql.replace("'din@epost.se'", `'${E.agare}'`));
});

test('1. ägaren loggar in med e-postlänk och ser Bolagsappar och Taxi Malmö', async () => {
  A = await loggaIn(E.agare);
  const u = await A.getUser();
  assert.equal(u.email, E.agare);
  const acc = await A.myAccounts();
  assert.deepEqual(acc.map(a => [a.tenant.type, a.role]), [['platform', 'agare'], ['main', 'agare']]);
  TM = acc.find(a => a.tenant.type === 'main').tenant;
  assert.equal(TM.slug, 'taxi-malmo');
  assert.equal((await A.tenant('taxi-malmo')).id, TM.id);
  assert.deepEqual((await A.licenses(TM.id)).map(l => l.module_key).sort(), ['avrakning', 'forarlista']);
  assert.equal((await A.offers(TM.id)).length, 4);
  assert.ok((await A.modules()).length >= 6);
  assert.ok((await A.taxRates()).length >= 2);
});

test('2. dokument, inställningar och guide', async () => {
  await A.setDoc(TM.id, 'avrakning', 'settings/params', { vx: 1200 });
  await A.setDoc(TM.id, 'avrakning', 'settings/params', { tl: 95 }, { merge: true });
  assert.deepEqual(await A.getDoc(TM.id, 'avrakning', 'settings/params'), { vx: 1200, tl: 95 });
  await A.setDoc(TM.id, 'avrakning', 'months/2026-10', { status: 'pågår' });
  await A.setDoc(TM.id, 'avrakning', 'months/2026-10/del', { x: 1 });
  const L = await A.listDocs(TM.id, 'avrakning', 'months');
  assert.deepEqual(L.map(x => x.id), ['2026-10']);
  await A.deleteDoc(TM.id, 'avrakning', 'months/2026-10/del');
  await A.setGuideStep(TM.id, 'avrakning', 'bolag', true);
  assert.equal((await A.guideProgress(TM.id, 'avrakning')).length, 1);
  const t = await A.updateTenant(TM.id, { settings: { ...TM.settings, ort: 'Malmö' } });
  assert.equal(t.settings.ort, 'Malmö');
  await A.addFileRun({ tenant_id: TM.id, module_key: 'avrakning', period: '2026-10', kind: 'tc', filename: 'kontofakturor.pdf', sha256: 'x'.repeat(64), summary: { text: 'ok' } });
  assert.equal((await A.fileRuns(TM.id, 'avrakning', '2026-10')).length, 1);
  await A.log(TM.id, 'test', 'e2e', { ok: true });
  assert.ok((await A.auditLog(TM.id)).some(x => x.action === 'test'));
});

test('3. Taxi Malmö bjuder in en åkare, åkaren loggar in via inbjudan', async () => {
  const t0 = Date.now();
  const inv = await A.createInvite(TM.id, { name: 'Åkeri Test AB', org_nr: '556000-0000', email: E.akare, modules: ['avrakning', 'forarlista'] });
  assert.ok(inv.token);
  akareTenant = inv.tenant_id;
  assert.equal((await A.invites(TM.id)).length, 1);
  assert.equal((await A.children(TM.id)).length, 1);
  assert.equal((await A.childLicenses(TM.id)).length, 2);
  B2 = await loggaIn(E.akare, { viaApp: false, efter: t0 });
  const brev = await mejl(E.akare, t0 - 1);
  assert.ok(brev.includes('/inbjudan/' + inv.token) || brev.includes(encodeURIComponent('/inbjudan/' + inv.token)), 'inbjudningslänken leder till inbjudan');
  assert.equal(await B2.acceptInvite(inv.token), akareTenant);
  const acc = await B2.myAccounts();
  assert.deepEqual(acc.map(a => [a.tenant.name, a.role, a.parent?.slug]), [['Åkeri Test AB', 'agare', 'taxi-malmo']]);
  const net = await A.networkOverview(TM.id, 'avrakning', '2026-10');
  assert.equal(net.length, 1);
  assert.equal(net[0].name, 'Åkeri Test AB');
});

test('4. regel 1 och 3: åkaren ser inte Taxi Malmö, Taxi Malmö ser inte åkarens lön', async () => {
  // En vanlig användare på Taxi Malmö (ekonomi), inte Bolagsappar
  const t0 = Date.now();
  await A.addMember(TM.id, { email: E.ekonomi, name: 'Ekonomi Test', role: 'ekonomi' });
  EK = await loggaIn(E.ekonomi, { viaApp: false, efter: t0 });
  assert.deepEqual((await EK.myAccounts()).map(a => [a.tenant.slug, a.role]), [['taxi-malmo', 'ekonomi']]);
  assert.equal(await B2.getDoc(TM.id, 'avrakning', 'settings/params'), null);
  await assert.rejects(B2.setDoc(TM.id, 'avrakning', 'x', {}));
  await B2.setDoc(akareTenant, 'kassan', 'settings', { forare: { '100001': { namn: 'Förare Test', person: { personnr: '19900101-0000' } } } });
  assert.equal(await EK.getDoc(akareTenant, 'kassan', 'settings'), null);
  assert.equal((await EK.members(akareTenant)).length, 0);
  assert.equal((await EK.networkOverview(TM.id, 'avrakning', null)).length, 1);
  assert.equal((await EK.allTenants()).length, 2, 'Taxi Malmö ser sig själv och sin åkare');
});

test('5. godkänn och publicera, åkaren ser sin avräkning och notis', async () => {
  await EK.approvePeriod(TM.id, 'avrakning', '2026-10');
  const items = [{ to: akareTenant, kind: 'akaravrakning', payload: { att: -1000, belopp: 1000, riktning: 'far', fran: 'Taxi Malmö', sammanfattning: [], perBil: [] }, title: 'Avräkningen för oktober är klar', link: 'min-avrakning/2026-10' }];
  assert.equal(await EK.publish(TM.id, 'avrakning', '2026-10', items), 1);
  assert.equal((await A.getPeriod(TM.id, 'avrakning', '2026-10')).status, 'publicerad');
  const sh = await B2.sharesTo(akareTenant, 'avrakning');
  assert.equal(sh.length, 1);
  await B2.markOpened(sh[0].id);
  assert.ok((await A.sharesFrom(TM.id, 'avrakning', '2026-10'))[0].opened_at);
  const notis = await B2.notifications(akareTenant);
  assert.ok(notis.length >= 1);
  await B2.markRead(notis[0].id);
  // Rättelse: ny version med orsak
  await A.reopenForCorrection(TM.id, 'avrakning', '2026-10');
  await A.approvePeriod(TM.id, 'avrakning', '2026-10');
  await assert.rejects(A.publish(TM.id, 'avrakning', '2026-10', items));
  assert.equal(await A.publish(TM.id, 'avrakning', '2026-10', items, 'Fel bropris'), 1);
  assert.equal((await B2.sharesTo(akareTenant, 'avrakning'))[0].version, 2);
});

test('5b. förarlistan läses in och varje åkare får sina egna förare', async () => {
  const kids = await A.children(TM.id);
  const akare = kids.find(k => k.id === akareTenant);
  const csv = forarlistaCsv(exempelForarlista([akare.name, 'Okänt Åkeri AB'], '2026-10-10'));
  const lista = parseForarlista(readText('forare.csv', csv).bankRows, { idag: '2026-10-10' });
  assert.equal(lista.forare.length, 6);
  await A.setDoc(TM.id, 'forarlista', 'lista', { hamtad: '2026-10-10T08:00:00', forare: lista.forare });
  const P = perAkare(lista.forare, kids);
  assert.deepEqual(P.utan, [{ akeri: 'Okänt Åkeri AB', antal: 3 }]);
  assert.equal(await EK.shareList(TM.id, 'forarlista', 'forare', P.per.map(p => ({ to: p.id, payload: { forare: p.forare } }))), 1);
  const sh = await B2.sharesTo(akareTenant, 'forarlista');
  assert.equal(sh[0].payload.forare.length, 3);
  assert.equal(await B2.getDoc(TM.id, 'forarlista', 'lista'), null, 'åkaren ser inte hela listan');
  await assert.rejects(EK.shareList(TM.id, 'avrakning', 'akaravrakning', []), /godkännandet/);
});

test('6. åkaren aktiverar Åkarkassan och lägger till en förare som signerar med pennan', async () => {
  const lic = await B2.setLicense(akareTenant, 'kassan', { status: 'aktiv', paid_by: akareTenant });
  assert.equal(lic.module_key, 'kassan');
  const t0 = Date.now();
  await B2.addMember(akareTenant, { email: E.forare, name: 'Förare Test', role: 'forare', forare_id: '100001' });
  // Avtalet upprättas och arbetsgivaren väntar på förarens signatur
  const ctx = { settings: (await B2.getDoc(akareTenant, 'kassan', 'settings')), cfg: ENG.DEF, central: 'Taxi Malmö AB' };
  const v = await avUpprata('100001', ctx);
  await B2.setDoc(akareTenant, 'kassan', 'avtal-100001', { versioner: [v] });
  B3 = await loggaIn(E.forare, { viaApp: false, efter: t0 });
  await mejl(E.forare, t0 - 1);
  const acc = await B3.myAccounts();
  assert.deepEqual(acc.map(a => [a.role, a.forare_id]), [['forare', '100001']]);
  const png = strokesToPng([[[10, 20], [60, 5], [110, 30]]], 120, 40).png;
  const s = await avSignera(v, 'anst', { namn: 'Förare Test', ort: 'Malmö', png });
  await B3.signAgreement(akareTenant, 'avtal-100001', s.sign.anst);
  await assert.rejects(B3.signAgreement(akareTenant, 'avtal-100002', s.sign.anst));
  await assert.rejects(B3.setDoc(akareTenant, 'kassan', 'settings', {}));
  const d = await B2.getDoc(akareTenant, 'kassan', 'avtal-100001');
  assert.ok(d.versioner[0].sign.anst.png.startsWith('data:image/png'));
  await B2.signAgreement(akareTenant, 'avtal-100001', { ...s.sign.anst, namn: 'Ägare Test' });
  assert.ok((await B2.getDoc(akareTenant, 'kassan', 'avtal-100001')).versioner[0].sign.arbg);
});

test('7. support kräver godkännande, ärenden och adminportalen', async () => {
  const t = await B2.createTicket(akareTenant, 'Fråga om brorad');
  assert.equal(t.status, 'ny');
  assert.equal(await A.getDoc(akareTenant, 'kassan', 'settings'), null);
  await B2.grantSupport(akareTenant, 1, 'Hjälp med lönen');
  assert.equal((await B2.supportAccess(akareTenant)).length, 1);
  // Ägaren är också Bolagsappar (plattform), så support med godkännande ger läsrätt
  assert.ok(await A.getDoc(akareTenant, 'kassan', 'settings'));
  await B2.revokeSupport(akareTenant);
  assert.equal(await A.getDoc(akareTenant, 'kassan', 'settings'), null);
  assert.ok((await A.tickets()).some(x => x.subject === 'Fråga om brorad'));
  await A.setTicket(t.id, 'lost');
  assert.ok((await A.allTenants()).length >= 3);
  assert.ok((await A.allLicenses()).length >= 4);
  assert.ok((await A.allMemberships()).length >= 4);
  assert.ok((await A.guideStats()).length >= 1);
  const ny = await A.createTenant({ type: 'direct', name: 'Verkstad Test', slug: 'verkstad-test-' + run });
  assert.equal(ny.type, 'direct');
  // Som Ny kund i adminportalen: appar och ägare. Ägaren får en inbjudan och loggar in.
  await A.setLicense(ny.id, 'verkstad', { variant: 'direct', status: 'aktiv', paid_by: ny.id });
  const t0 = Date.now();
  await A.addMember(ny.id, { email: E.verkstad, name: 'Verkstad Ägare', role: 'agare' });
  const V = await loggaIn(E.verkstad, { viaApp: false, efter: t0 });
  assert.deepEqual((await V.myAccounts()).map(x => [x.tenant.name, x.role]), [['Verkstad Test', 'agare']]);
  assert.deepEqual((await V.licenses(ny.id)).map(l => l.module_key + ':' + l.variant), ['verkstad:direct']);
  await V.setDoc(ny.id, 'verkstad', 'arenden/V-1001', { id: 'V-1001', reg: 'QAB 12C' });
  assert.equal((await V.getDoc(ny.id, 'verkstad', 'arenden/V-1001')).reg, 'QAB 12C');
  assert.equal(await B2.getDoc(ny.id, 'verkstad', 'arenden/V-1001'), null, 'en annan kund ser inte verkstadens ärenden');
  await assert.rejects(B2.allTenants().then(L => { if (L.length > 2) throw new Error('ser för mycket'); return Promise.reject(new Error('ok')); }));
});

test('8. hemsidans bokningsformulär och AI utan nyckel', async () => {
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  const r = await anon.from('bookings').insert({ bransch: 'Taxi', foretag: 'Test AB', namn: 'Test', epost: 'test@exempel.example' });
  assert.ifError(r.error);
  assert.equal((await anon.from('bookings').select('*')).data.length, 0);
  const L = await A.bookings();
  assert.ok(L.length >= 1);
  await A.setBooking(L[0].id, { status: 'bokad', dag: '2026-11-14' });
  await assert.rejects(A.ai(TM.id, 'svar', 'Hej'), e => e.code === 'ai_off' || e.code === 'not_granted');
});

test('9. anonym besökare når ingenting', async () => {
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  for (const t of ['tenants', 'users', 'memberships', 'documents', 'shares', 'periods', 'licenses', 'invites', 'audit_log', 'notifications', 'support_tickets']) {
    const r = await anon.from(t).select('*');
    assert.ok(r.error || r.data.length === 0, t + ' syns för anonym');
  }
  for (const [fn, args] of [['network_overview', { parent: TM.id, module_key: 'avrakning', period: null }], ['publish_period', { from_tenant: TM.id, module_key: 'avrakning', period: '2026-12', items: [] }], ['approve_period', { tenant: TM.id, module_key: 'avrakning', period: '2026-12' }]]) {
    const r = await anon.rpc(fn, args);
    assert.ok(r.error || (Array.isArray(r.data) && r.data.length === 0), fn + ' gick att köra anonymt');
  }
  await db.end();
});
