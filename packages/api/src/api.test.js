// Den lokala backenden ska följa samma regler som radsäkerheten i databasen.
import { describe, it, expect, beforeAll } from 'vitest';
import { createLocalBackend } from './local.js';
import { seedDemo } from './demo.js';
import { docApi } from './docs.js';
import { T, U, subId, ownerId } from './seed.js';

let b;
beforeAll(async () => { b = createLocalBackend({ storage: null, now: () => new Date('2026-10-10T08:00:00Z') }); await seedDemo(b); });

describe('konton och roller', () => {
  it('Sara ser bara Taxi Malmö, Ahmed ser två bolag', async () => {
    await b.signInAsDemo(U.sara);
    expect((await b.myAccounts()).map(a => a.tenant.name)).toEqual(['Taxi Malmö']);
    await b.signInAsDemo(U.ahmed);
    expect((await b.myAccounts()).map(a => [a.tenant.name, a.role])).toEqual([['Taxi Malmö', 'ekonomi'], ['Åkeri Norra AB', 'agare']]);
  });
  it('huvudkunden ser åkarna men bara namn, appar, inloggning och öppnad', async () => {
    await b.signInAsDemo(U.sara);
    const L = await b.networkOverview(T.taxi, 'avrakning', '2026-09');
    expect(L).toHaveLength(24);
    const norra = L.find(x => x.name === 'Åkeri Norra AB');
    expect(Object.keys(norra).sort()).toEqual(['apps', 'bilar', 'invited', 'last_login', 'name', 'opened_at', 'org_nr', 'owner_name', 'slug', 'tenant_id'].sort());
    expect(norra.apps).toEqual(['avrakning', 'forarlista', 'kassan']);
    expect(L.filter(x => x.invited)).toHaveLength(3);
    expect(L.find(x => x.name === 'Kust Taxi AB').opened_at).toBeNull();
  });
});

describe('regel 1 och 3: konto A kan aldrig läsa konto B', () => {
  it('Taxi Malmö kan inte läsa åkarens lön och personal', async () => {
    await b.signInAsDemo(U.sara);
    await expect(b.getDoc(subId(0), 'kassan', 'settings')).rejects.toThrow('Du har inte behörighet');
    await expect(b.listDocs(subId(0), 'kassan', '')).rejects.toThrow();
  });
  it('en åkare kan inte läsa en annan åkare eller centralens avräkning', async () => {
    await b.signInAsDemo(ownerId(1)); // Limhamn Trafik AB
    await expect(b.getDoc(subId(0), 'kassan', 'settings')).rejects.toThrow();
    await expect(b.getDoc(T.taxi, 'avrakning', 'months/2026-09')).rejects.toThrow();
    expect(await b.tenant(subId(0))).toBeNull();
    expect((await b.tenant(T.taxi)).name).toBe('Taxi Malmö');
  });
  it('föraren kan läsa men inte skriva', async () => {
    await b.signInAsDemo(U.forare);
    expect(await b.getDoc(subId(0), 'kassan', 'settings')).toBeTruthy();
    await expect(b.setDoc(subId(0), 'kassan', 'settings', {})).rejects.toThrow('Du har inte behörighet');
  });
  it('supportinloggning kräver kundens godkännande och loggas', async () => {
    await b.signInAsDemo(U.admin);
    await expect(b.getDoc(T.folie, 'verkstad', 'installningar/foretag')).rejects.toThrow();
    await b.signInAsDemo(U.fia);
    await b.grantSupport(T.folie, 2, 'Hjälp med SIE');
    await b.signInAsDemo(U.admin);
    expect(await b.getDoc(T.folie, 'verkstad', 'installningar/foretag')).toBeTruthy();
    await b.setDoc(T.folie, 'verkstad', 'installningar/foretag', { namn: 'Folieringsfirman' }, { merge: true });
    await b.signInAsDemo(U.fia);
    const log = await b.auditLog(T.folie);
    expect(log.some(l => l.via_support)).toBe(true);
    await b.revokeSupport(T.folie);
  });
});

describe('regel 2: publicering nedåt', () => {
  it('åkaren ser bara det som publicerats till just den', async () => {
    await b.signInAsDemo(U.ahmed);
    const S = await b.sharesTo(subId(0), 'avrakning');
    expect(S.map(s => s.period)).toEqual(['2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04']);
    expect(S.every(s => s.payload.namn === 'Åkeri Norra AB')).toBe(true);
  });
  it('månaden måste godkännas och en rättelse kräver orsak', async () => {
    await b.signInAsDemo(U.sara);
    await expect(b.publish(T.taxi, 'avrakning', '2026-10', [])).rejects.toThrow('Månaden måste godkännas');
    await expect(b.publish(T.taxi, 'avrakning', '2026-09', [{ to: subId(0), kind: 'akaravrakning', payload: {} }])).rejects.toThrow('kräver en orsak');
    const n = await b.publish(T.taxi, 'avrakning', '2026-09', [{ to: subId(0), kind: 'akaravrakning', payload: { namn: 'Åkeri Norra AB', att: -1 } }], 'Fel bropris');
    expect(n).toBe(1);
    const p = await b.getPeriod(T.taxi, 'avrakning', '2026-09');
    expect(p.version).toBe(2);
    await expect(b.publish(T.taxi, 'avrakning', '2026-09', [{ to: T.folie, kind: 'x', payload: {} }], 'test')).rejects.toThrow('inte en underkund');
  });
  it('föraren kan inte publicera', async () => {
    await b.signInAsDemo(U.forare);
    await expect(b.approvePeriod(subId(0), 'kassan', '2026-09')).rejects.toThrow();
  });
});

describe('doc/collection som claude-shim', () => {
  it('get, set, update, collection och onSnapshot', async () => {
    await b.signInAsDemo(U.fia);
    const db = docApi(b, T.folie, 'verkstad');
    const s = await db.collection('arenden').get();
    expect(s.size).toBe(8);
    expect(Object.isFrozen(s.docs[0].data())).toBe(true);
    await db.doc('arenden/V-9999').set({ id: 'V-9999', reg: 'QXX 11A' });
    await db.doc('arenden/V-9999').update({ status: 'utkast' });
    expect((await db.doc('arenden/V-9999').get()).data()).toEqual({ id: 'V-9999', reg: 'QXX 11A', status: 'utkast' });
    const seen = [];
    const un = db.collection('arenden').onSnapshot(x => seen.push(x.size));
    await new Promise(r => setTimeout(r, 10));
    await db.doc('arenden/V-9999').delete();
    await new Promise(r => setTimeout(r, 10));
    un();
    expect(seen).toEqual([9, 8]);
  });
});

describe('demodata', () => {
  it('Åkeri Norra har signerade avtal och en godkänd lön i augusti', async () => {
    await b.signInAsDemo(U.ahmed);
    const a1 = await b.getDoc(subId(0), 'kassan', 'avtal-100001');
    expect(a1.versioner[0].sign.anst.namn).toBe('Förare A1');
    const m = await b.getDoc(subId(0), 'kassan', 'm-2026-08');
    expect(Object.keys(m.lonekorning.rader).length).toBeGreaterThan(0);
  });
  it('oktober hos Taxi Malmö har 7 inlästa filer utan Bambora', async () => {
    await b.signInAsDemo(U.sara);
    const runs = await b.fileRuns(T.taxi, 'avrakning', '2026-10');
    expect(runs.map(r => r.kind).sort()).toEqual(['app', 'bro', 'resk', 'sturup', 'tc', 'visma']);
  });
});
