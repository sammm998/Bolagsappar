// RLS-tester mot en riktig Postgres: migrationerna och seed.sql körs i en ny databas.
// Klart när: automatiska tester visar att konto A aldrig kan läsa konto B.
// Kör: pnpm test:rls (DATABASE_URL pekar på en Postgres där vi får skapa databaser).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';

const BASE = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
const DBNAME = 'bolagsappar_rls_' + Date.now();
const dir = new URL('..', import.meta.url);
const read = p => fs.readFileSync(new URL(p, dir), 'utf8');

const T = { taxi: '00000000-0000-4000-8000-a00000000002', folie: '00000000-0000-4000-8000-a00000000004', norra: '00000000-0000-4000-8000-c00000000001', limhamn: '00000000-0000-4000-8000-c00000000002' };
const U = { admin: '00000000-0000-4000-8000-b00000000001', sara: '00000000-0000-4000-8000-b00000000002', ahmed: '00000000-0000-4000-8000-b00000000003', forare: '00000000-0000-4000-8000-b00000000004', fia: '00000000-0000-4000-8000-b00000000005', lina: '00000000-0000-4000-8000-d00000000002' };

let admin, db;
const url = name => { const u = new URL(BASE); u.pathname = '/' + name; return u.toString(); };

before(async () => {
  admin = new pg.Client({ connectionString: BASE }); await admin.connect();
  await admin.query(`create database ${DBNAME}`);
  db = new pg.Client({ connectionString: url(DBNAME) }); await db.connect();
  await db.query(read('tests/bootstrap.sql'));
  for (const f of fs.readdirSync(new URL('migrations/', dir)).sort()) await db.query(read('migrations/' + f));
  await db.query(read('seed.sql'));
  // Data som superanvändare (som en Edge Function med service role)
  await db.query(`insert into documents(tenant_id, module_key, path, data) values
    ($1, 'kassan', 'settings', '{"forare":{"100001":{"namn":"Förare A1","person":{"personnr":"19880101-0000"}}}}'),
    ($1, 'kassan', 'm-2026-09', '{"lonekorning":{"rader":{}}}'),
    ($2, 'avrakning', 'months/2026-09', '{"summary":{}}'),
    ($3, 'verkstad', 'arenden/V-1042', '{"id":"V-1042"}'),
    ($4, 'kassan', 'settings', '{"forare":{}}')`, [T.norra, T.taxi, T.folie, T.limhamn]);
});
after(async () => { await db?.end(); await admin?.query(`drop database if exists ${DBNAME}`); await admin?.end(); });

/** Kör som inloggad användare (rollen authenticated, auth.uid() = uid). */
async function as(uid, sql, params = []) {
  await db.query('begin');
  try {
    await db.query(`set local role ${uid ? 'authenticated' : 'anon'}`);
    if (uid) await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
    const r = await db.query(sql, params);
    await db.query('commit');
    return r.rows;
  } catch (e) { await db.query('rollback'); throw e; }
}
const docs = (uid, t) => as(uid, 'select path from documents where tenant_id = $1 order by path', [t]);

test('regel 1: konto A kan aldrig läsa konto B', async () => {
  assert.equal((await docs(U.sara, T.norra)).length, 0, 'centralen ser inte åkarens dokument');
  assert.equal((await docs(U.lina, T.norra)).length, 0, 'en åkare ser inte en annan åkares dokument');
  assert.equal((await docs(U.lina, T.taxi)).length, 0, 'åkaren ser inte centralens avräkning');
  assert.equal((await docs(U.ahmed, T.norra)).length, 2, 'ägaren ser sitt eget konto');
  assert.equal((await docs(U.fia, T.taxi)).length, 0);
  const t = await as(U.lina, 'select name from tenants order by name');
  assert.deepEqual(t.map(x => x.name), ['Limhamn Trafik AB', 'Taxi Malmö'], 'åkaren ser sitt konto och sin central');
});

test('regel 3: lön och personal syns aldrig uppåt', async () => {
  const r = await as(U.sara, `select count(*)::int n from documents where module_key = 'kassan'`);
  assert.equal(r[0].n, 0);
});

test('skriva i ett annat konto stoppas', async () => {
  await assert.rejects(as(U.sara, `insert into documents(tenant_id, module_key, path, data) values ($1, 'kassan', 'x', '{}')`, [T.norra]), /row-level security/);
  await assert.rejects(as(U.forare, `insert into documents(tenant_id, module_key, path, data) values ($1, 'kassan', 'x', '{}')`, [T.norra]), /row-level security/, 'föraren kan inte skriva');
  const u = await as(U.lina, `update documents set data = '{}' where tenant_id = $1 returning path`, [T.norra]);
  assert.equal(u.length, 0);
});

test('regel 2: publicering nedåt och bara till underkunder', async () => {
  await assert.rejects(as(U.sara, `select publish_period($1, 'avrakning', '2026-10', '[]'::jsonb)`, [T.taxi]), /måste godkännas/);
  await as(U.sara, `select approve_period($1, 'avrakning', '2026-10')`, [T.taxi]);
  await assert.rejects(as(U.sara, `select publish_period($1, 'avrakning', '2026-10', $2::jsonb)`, [T.taxi, JSON.stringify([{ to: T.folie, kind: 'akaravrakning', payload: {} }])]), /inte en underkund/);
  const items = [{ to: T.norra, kind: 'akaravrakning', payload: { att: -48215 }, title: 'Ny avräkning', body: 'Oktober är klar.' }, { to: T.limhamn, kind: 'akaravrakning', payload: { att: -31902.5 } }];
  const n = await as(U.sara, `select publish_period($1, 'avrakning', '2026-10', $2::jsonb) n`, [T.taxi, JSON.stringify(items)]);
  assert.equal(n[0].n, 2);
  const ahmed = await as(U.ahmed, `select to_tenant, payload from shares where to_tenant = $1`, [T.norra]);
  assert.equal(ahmed.length, 1);
  const lina = await as(U.lina, `select to_tenant from shares`);
  assert.deepEqual(lina.map(x => x.to_tenant), [T.limhamn], 'Limhamn ser bara sin egen');
  const notis = await as(U.ahmed, `select title from notifications where tenant_id = $1`, [T.norra]);
  assert.equal(notis[0].title, 'Ny avräkning');
  await assert.rejects(as(U.forare, `select approve_period($1, 'kassan', '2026-10')`, [T.norra]), /behörighet/);
});

test('en publicerad avräkning kan inte ändras, rättelse kräver orsak', async () => {
  await assert.rejects(as(U.sara, `select publish_period($1, 'avrakning', '2026-10', '[]'::jsonb)`, [T.taxi]), /kräver en orsak/);
  await assert.rejects(as(U.ahmed, `update shares set payload = '{}' where to_tenant = $1`, [T.norra]), /kan inte ändras/);
  const ok = await as(U.ahmed, `update shares set opened_at = now() where to_tenant = $1 returning id`, [T.norra]);
  assert.equal(ok.length, 1, 'åkaren kan markera som öppnad');
  await as(U.sara, `select publish_period($1, 'avrakning', '2026-10', $2::jsonb, 'Fel bropris')`, [T.taxi, JSON.stringify([{ to: T.norra, kind: 'akaravrakning', payload: { att: -48000 } }])]);
  const v = await as(U.ahmed, `select max(version) v from shares where to_tenant = $1`, [T.norra]);
  assert.equal(v[0].v, 2);
});

test('vad huvudkunden ser om en åkare', async () => {
  const L = await as(U.sara, `select * from network_overview($1, 'avrakning', '2026-10')`, [T.taxi]);
  assert.equal(L.length, 24);
  const norra = L.find(x => x.name === 'Åkeri Norra AB');
  assert.deepEqual(Object.keys(norra).sort(), ['apps', 'invited', 'last_login', 'name', 'opened_at', 'org_nr', 'owner_name', 'tenant_id']);
  assert.ok(norra.opened_at);
  assert.equal(L.filter(x => x.invited).length, 3);
  assert.equal((await as(U.lina, `select * from network_overview($1)`, [T.taxi])).length, 0, 'åkaren ser inte nätverket');
});

test('regel 4: support kräver godkännande och loggas synligt', async () => {
  assert.equal((await docs(U.admin, T.folie)).length, 0);
  await as(U.fia, `insert into support_access(tenant_id, granted_by, granted_until, reason) values ($1, $2, now() + interval '2 hours', 'SIE')`, [T.folie, U.fia]);
  assert.equal((await docs(U.admin, T.folie)).length, 1);
  await as(U.admin, `update documents set data = '{"id":"V-1042","status":"skickad"}' where tenant_id = $1`, [T.folie]);
  const log = await as(U.fia, `select action, via_support from audit_log where tenant_id = $1 and via_support`, [T.folie]);
  assert.ok(log.length >= 1);
  assert.equal((await docs(U.admin, T.norra)).length, 0, 'godkännandet gäller bara det kontot');
});

test('hemsidans formulär: alla kan boka, ingen utom plattformen kan läsa', async () => {
  await as(null, `insert into bookings(foretag, namn, telefon) values ('Taxi Exempel AB', 'Förnamn Efternamn', '070-000 00 00')`);
  await assert.rejects(as(null, `select * from bookings`), /permission denied/);
  assert.equal((await as(U.sara, `select * from bookings`)).length, 0);
  assert.equal((await as(U.admin, `select * from bookings`)).length, 1);
});

test('signering med pennan: föraren signerar bara sitt eget avtal', async () => {
  const v = { skapad: '2026-10-01', text: [{ h: 'Parter', p: ['x'] }], hash: 'abc', sign: {} };
  await db.query(`insert into documents(tenant_id, module_key, path, data) values ($1, 'kassan', 'avtal-100001', $2), ($1, 'kassan', 'avtal-100002', $2)`, [T.norra, JSON.stringify({ versioner: [v] })]);
  const sign = JSON.stringify({ namn: 'Förare A1', ort: 'Malmö', png: 'data:image/png;base64,AAA' });
  await assert.rejects(as(U.forare, `select sign_agreement($1, 'avtal-100002', $2::jsonb)`, [T.norra, sign]), /ditt eget avtal/);
  await assert.rejects(as(U.ahmed, `select sign_agreement($1, 'avtal-100001', $2::jsonb)`, [T.norra, sign]), /signerar först/);
  await as(U.forare, `select sign_agreement($1, 'avtal-100001', $2::jsonb)`, [T.norra, sign]);
  await assert.rejects(as(U.forare, `select sign_agreement($1, 'avtal-100001', $2::jsonb)`, [T.norra, sign]), /redan signerat/);
  await as(U.ahmed, `select sign_agreement($1, 'avtal-100001', $2::jsonb)`, [T.norra, JSON.stringify({ namn: 'Ahmed Exempel', ort: 'Malmö', png: 'data:x' })]);
  const d = await as(U.ahmed, `select data from documents where tenant_id = $1 and path = 'avtal-100001'`, [T.norra]);
  const s = d[0].data.versioner[0].sign;
  assert.equal(s.anst.namn, 'Förare A1'); assert.equal(s.arbg.namn, 'Ahmed Exempel');
  await assert.rejects(as(U.lina, `select sign_agreement($1, 'avtal-100002', $2::jsonb)`, [T.norra, sign]), /behörighet/);
});

test('e-postlänk: första inloggningen skapar användaren, inloggning uppdateras', async () => {
  const id = '00000000-0000-4000-8000-b00000000099';
  await db.query(`insert into auth.users(id, email, raw_user_meta_data) values ($1, 'Ny@Exempel.example', '{"name":"Ny Exempel"}')`, [id]);
  assert.deepEqual((await db.query('select email, name from users where id = $1', [id])).rows, [{ email: 'ny@exempel.example', name: 'Ny Exempel' }]);
  await db.query(`update auth.users set last_sign_in_at = '2026-10-10T08:00:00Z' where id = $1`, [id]);
  assert.ok((await db.query('select last_login_at from users where id = $1', [id])).rows[0].last_login_at);
  assert.equal((await as(id, 'select * from tenants')).length, 0);
});

test('arbetsdagar: bara plattformen ändrar en bokning', async () => {
  await as(U.sara, `update bookings set status = 'bokad'`);
  assert.equal((await db.query(`select count(*)::int n from bookings where status = 'bokad'`)).rows[0].n, 0);
  await as(U.admin, `update bookings set status = 'bokad', dag = '2026-11-14'`);
  assert.equal((await db.query(`select count(*)::int n from bookings where status = 'bokad'`)).rows[0].n, 1);
});
