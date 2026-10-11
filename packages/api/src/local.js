// Lokal backend i webbläsaren (eller i minnet i testerna). Samma gränssnitt som Supabase-backenden
// och samma regler som radsäkerheten i supabase/migrations. Används för utveckling, demo och tester.
// Data sparas i localStorage under en nyckel. Inget lämnar datorn.
import { godkannRoller } from '@bolagsappar/core/behorighet';
import { buildSeed, DEMO_LOGINS } from './seed.js';

const KEY = 'bolagsappar:lokal:v1';
const clone = x => x == null ? x : JSON.parse(JSON.stringify(x));
const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'x' + Math.random().toString(16).slice(2) + Date.now().toString(16));

export class AccessError extends Error { constructor(msg = 'Du har inte behörighet') { super(msg); this.code = 'not_granted'; } }

/**
 * @param {{ storage?: Storage|null, initial?: object|null, persist?: (db: object) => void, now?: () => Date, seed?: object }} opts
 * storage: synkron lagring (localStorage). initial + persist: asynkron lagring (IndexedDB), se createBackend.
 */
export function createLocalBackend(opts = {}) {
  const storage = opts.storage === undefined ? (typeof localStorage !== 'undefined' ? localStorage : null) : opts.storage;
  const now = opts.now || (() => new Date());
  let db = load();
  let session = db.session || null;
  const listeners = new Set();
  const authListeners = new Set();

  function fresh() {
    const s = clone(opts.seed || buildSeed(now()));
    return { ...s, documents: [], periods: [], shares: [], file_runs: [], guide_progress: [], audit_log: [], notifications: [], support_access: [], bookings: [], session: null, seededDemo: false };
  }
  function load() {
    if (opts.initial) return opts.initial;
    if (storage && !opts.persist) { try { const s = storage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {} }
    return fresh();
  }
  let saveT = null;
  function save() {
    if (!opts.persist && !storage) return;
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      if (opts.persist) { opts.persist({ ...db, session }); return; }
      try { storage.setItem(KEY, JSON.stringify({ ...db, session })); } catch (e) { console.warn('[lokal] kunde inte spara', e); }
    }, 80);
  }
  function emit(evt) { for (const l of listeners) { try { l(evt); } catch (e) { console.error(e); } } }

  // ------------------------------------------------ regler (samma som RLS)
  const uid = () => session?.user_id || null;
  const myTenants = () => new Set(db.memberships.filter(m => m.user_id === uid()).map(m => m.tenant_id));
  const roleIn = t => db.memberships.find(m => m.user_id === uid() && m.tenant_id === t)?.role || null;
  const hasRole = (t, roles) => roles.includes(roleIn(t));
  const tenant = t => db.tenants.find(x => x.id === t) || null;
  const parentOf = t => tenant(t)?.parent_id || null;
  const isPlatform = () => db.memberships.some(m => m.user_id === uid() && tenant(m.tenant_id)?.type === 'platform' && ['agare', 'admin'].includes(m.role));
  const supportGranted = t => isPlatform() && db.support_access.some(s => s.tenant_id === t && new Date(s.granted_until) > now());
  const canRead = t => myTenants().has(t) || supportGranted(t);
  const canWrite = t => hasRole(t, ['agare', 'admin', 'ekonomi']) || supportGranted(t);
  const need = ok => { if (!uid()) throw new AccessError('Du är inte inloggad'); if (!ok) throw new AccessError(); };
  const audit = (tenant_id, action, target, detail, via_support = false) => { db.audit_log.push({ id: db.audit_log.length + 1, tenant_id, actor: uid(), action, target, detail: detail || null, via_support, at: now().toISOString() }); };
  const logSupport = (t, action, target) => { if (isPlatform() && !myTenants().has(t)) audit(t, action, target, null, true); };
  const tenantVisible = x => { const mine = myTenants(); return mine.has(x.id) || mine.has(x.parent_id) || [...mine].some(m => parentOf(m) === x.id) || isPlatform(); };

  const api = {
    kind: 'lokal',

    // ------------------------------------------------ inloggning (e-postlänk, ingen BankID)
    async getUser() { const u = db.users.find(x => x.id === uid()); return u ? clone(u) : null; },
    async signInWithEmail(email) {
      const u = db.users.find(x => x.email.toLowerCase() === String(email).trim().toLowerCase());
      // Lokalt (demoläge) finns ingen e-posttjänst. Säg det i stället för att låtsas att ett mejl skickats.
      if (!u) { const e = new Error('Demoläge: inga mejl skickas. Logga in med en demoroll nedan. För riktig inloggning med e-post kopplas Supabase in.'); e.code = 'demo_ingen_epost'; throw e; }
      // Lokalt öppnas länken direkt
      return api.signInAsDemo(u.id);
    },
    async signInAsDemo(userId) {
      const u = db.users.find(x => x.id === userId); if (!u) throw new Error('Okänd användare');
      session = { user_id: u.id, at: now().toISOString() }; u.last_login_at = now().toISOString(); save();
      for (const l of authListeners) l(clone(u));
      return { sent: true, demo: true, user: clone(u) };
    },
    async signOut() { session = null; save(); for (const l of authListeners) l(null); },
    onAuthChange(cb) { authListeners.add(cb); return () => authListeners.delete(cb); },
    demoLogins() { return DEMO_LOGINS.map(d => ({ ...d, ...clone(db.users.find(u => u.id === d.user)) })); },
    async resetDemo() { db = fresh(); session = null; save(); emit({ table: '*' }); },

    // ------------------------------------------------ konton
    async myAccounts() {
      need(true);
      return db.memberships.filter(m => m.user_id === uid()).map(m => ({ role: m.role, forare_id: m.forare_id || null, tenant: clone(tenant(m.tenant_id)), parent: clone(tenant(tenant(m.tenant_id)?.parent_id)) }))
        .sort((a, b) => ({ platform: 0, main: 1, direct: 2, sub: 3 }[a.tenant.type] - { platform: 0, main: 1, direct: 2, sub: 3 }[b.tenant.type]) || a.tenant.name.localeCompare(b.tenant.name, 'sv'));
    },
    async tenant(idOrSlug) {
      need(true);
      const t = db.tenants.find(x => x.id === idOrSlug || x.slug === idOrSlug);
      return t && tenantVisible(t) ? clone(t) : null;
    },
    async updateTenant(t, patch) {
      need(hasRole(t, ['agare', 'admin']) || isPlatform());
      const x = tenant(t); Object.assign(x, clone(patch)); audit(t, 'ändra konto', t); save(); emit({ table: 'tenants', tenant_id: t });
      return clone(x);
    },
    async children(parentId) { need(true); return db.tenants.filter(x => x.parent_id === parentId && tenantVisible(x)).map(clone).sort((a, b) => a.name.localeCompare(b.name, 'sv')); },
    /** Det huvudkunden ser om en åkare. Inget mer. */
    async networkOverview(parentId, moduleKey = 'avrakning', period = null) {
      need(hasRole(parentId, ['agare', 'admin', 'ekonomi', 'las']));
      return db.tenants.filter(x => x.parent_id === parentId).map(t => {
        const ms = db.memberships.filter(m => m.tenant_id === t.id);
        const owner = ms.find(m => m.role === 'agare');
        const ou = owner && db.users.find(u => u.id === owner.user_id);
        const logins = ms.map(m => db.users.find(u => u.id === m.user_id)?.last_login_at).filter(Boolean).sort();
        const opened = db.shares.filter(s => s.to_tenant === t.id && s.from_tenant === parentId && s.module_key === moduleKey && (!period || s.period === period)).map(s => s.opened_at).filter(Boolean).sort();
        return { tenant_id: t.id, name: t.name, org_nr: t.org_nr, slug: t.slug, owner_name: ou?.name || null, apps: db.licenses.filter(l => l.tenant_id === t.id && l.status === 'aktiv').map(l => l.module_key).sort(), last_login: logins[logins.length - 1] || null, opened_at: opened[opened.length - 1] || null, invited: !ms.length, bilar: t.settings?.bilar ?? null };
      }).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    },
    async members(t) {
      need(canRead(t));
      const ms = db.memberships.filter(m => m.tenant_id === t && (m.user_id === uid() || hasRole(t, ['agare', 'admin']) || isPlatform()));
      return ms.map(m => ({ ...clone(m), user: clone(db.users.find(u => u.id === m.user_id)) }));
    },
    async addMember(t, { email, name, role, forare_id }) {
      need(hasRole(t, ['agare', 'admin']) || isPlatform());
      let u = db.users.find(x => x.email.toLowerCase() === email.toLowerCase());
      if (!u) { u = { id: uuid(), name: name || '', email, last_login_at: null }; db.users.push(u); }
      if (!db.memberships.some(m => m.user_id === u.id && m.tenant_id === t)) db.memberships.push({ user_id: u.id, tenant_id: t, role, forare_id: forare_id || null });
      audit(t, 'lägg till användare', email); save(); emit({ table: 'memberships', tenant_id: t });
      return clone(u);
    },

    // ------------------------------------------------ dokument (doc/collection)
    async getDoc(t, m, path) {
      need(canRead(t));
      const d = db.documents.find(x => x.tenant_id === t && x.module_key === m && x.path === path);
      return d ? clone(d.data) : null;
    },
    async setDoc(t, m, path, data, { merge = false } = {}) {
      need(canWrite(t));
      let d = db.documents.find(x => x.tenant_id === t && x.module_key === m && x.path === path);
      if (!d) { d = { tenant_id: t, module_key: m, path, data: {}, version: 0 }; db.documents.push(d); }
      d.data = merge ? { ...(d.data || {}), ...clone(data) } : clone(data); d.version++; d.updated_by = uid(); d.updated_at = now().toISOString();
      logSupport(t, 'ändra', 'documents:' + path);
      save(); emit({ table: 'documents', tenant_id: t, module_key: m, path });
    },
    async deleteDoc(t, m, path) {
      need(canWrite(t));
      db.documents = db.documents.filter(x => !(x.tenant_id === t && x.module_key === m && x.path === path));
      save(); emit({ table: 'documents', tenant_id: t, module_key: m, path });
    },
    async listDocs(t, m, prefix = '') {
      need(canRead(t));
      const pre = prefix ? prefix.replace(/\/?$/, '/') : '';
      return db.documents.filter(x => x.tenant_id === t && x.module_key === m && x.path.startsWith(pre) && !x.path.slice(pre.length).includes('/'))
        .map(x => ({ path: x.path, id: x.path.slice(pre.length), data: clone(x.data), updated_at: x.updated_at })).sort((a, b) => a.id.localeCompare(b.id));
    },

    /** Signera avtal med pennan (sign_agreement i databasen). Föraren kan bara signera sitt eget. */
    /** AI körs bara på servern (edge function "ai"). Lokalt finns ingen nyckel, skärmen visar då ett utkast utan AI. */
    async ai(t) { need(canRead(t)); const e = new Error('AI är inte påslaget lokalt'); e.code = 'ai_off'; throw e; },
    async signAgreement(t, path, sign) {
      const m = db.memberships.find(x => x.user_id === uid() && x.tenant_id === t); need(!!m);
      let role;
      if (m.role === 'forare') { if (![`avtal-${m.forare_id}`, `avtal-tp:${m.forare_id}`].includes(path)) throw new AccessError('Du kan bara signera ditt eget avtal'); role = 'anst'; }
      else if (['agare', 'admin'].includes(m.role)) role = 'arbg';
      else throw new AccessError('Du har inte behörighet att signera');
      const d = db.documents.find(x => x.tenant_id === t && x.module_key === 'kassan' && x.path === path);
      if (!d) throw new Error('Avtalet finns inte');
      const v = d.data.versioner[d.data.versioner.length - 1];
      if (v.sign?.[role]) throw new Error('Avtalet är redan signerat');
      if (role === 'arbg' && !v.sign?.anst) throw new Error('Arbetstagaren signerar först');
      if (!String(sign.namn || '').trim() || !sign.png) throw new Error('Underskrift och namn krävs');
      v.sign = { ...(v.sign || {}), [role]: { namn: String(sign.namn).trim(), ort: sign.ort || '', tid: now().toISOString(), png: sign.png, ua: String(sign.ua || '').slice(0, 120) } };
      d.version++; d.updated_by = uid(); d.updated_at = now().toISOString();
      audit(t, 'signera avtal', path + ':' + role); save(); emit({ table: 'documents', tenant_id: t, module_key: 'kassan', path });
      return clone(v);
    },

    // ------------------------------------------------ perioder och publicering
    async getPeriod(t, m, p) { need(canRead(t)); return clone(db.periods.find(x => x.tenant_id === t && x.module_key === m && x.period === p) || null); },
    async listPeriods(t, m) { need(canRead(t)); return db.periods.filter(x => x.tenant_id === t && x.module_key === m).map(clone).sort((a, b) => b.period.localeCompare(a.period)); },
    async approvePeriod(t, m, p) {
      need(hasRole(t, godkannRoller(tenant(t))));
      let x = db.periods.find(y => y.tenant_id === t && y.module_key === m && y.period === p);
      if (!x) { x = { tenant_id: t, module_key: m, period: p, status: 'oppen', version: 1 }; db.periods.push(x); }
      if (x.status !== 'publicerad') x.status = 'godkand';
      x.approved_by = uid(); x.approved_at = now().toISOString();
      audit(t, 'godkann', m + ':' + p); save(); emit({ table: 'periods', tenant_id: t, module_key: m });
      return clone(x);
    },
    async reopenPeriod(t, m, p) {
      need(hasRole(t, ['agare', 'admin', 'ekonomi']));
      const x = db.periods.find(y => y.tenant_id === t && y.module_key === m && y.period === p);
      if (x && x.status === 'godkand') { x.status = 'oppen'; audit(t, 'öppna igen', m + ':' + p); save(); emit({ table: 'periods', tenant_id: t, module_key: m }); }
      return clone(x);
    },
    /** Rättelse: öppna en publicerad månad som en ny version. Den publicerade versionen ligger kvar hos åkarna. */
    async reopenForCorrection(t, m, p) {
      need(hasRole(t, ['agare', 'admin', 'ekonomi']));
      const x = db.periods.find(y => y.tenant_id === t && y.module_key === m && y.period === p);
      if (!x || x.status !== 'publicerad') throw new Error('Bara en publicerad månad kan rättas');
      x.status = 'oppen'; x.version = (x.version || 1) + 1;
      audit(t, 'rättelse påbörjad', m + ':' + p, { version: x.version }); save(); emit({ table: 'periods', tenant_id: t, module_key: m });
      return clone(x);
    },
    /** items: [{ to, kind, payload, title, body, link }] */
    async publish(t, m, p, items, reason = null) {
      need(hasRole(t, godkannRoller(tenant(t))));
      const x = db.periods.find(y => y.tenant_id === t && y.module_key === m && y.period === p);
      if (!x || x.status === 'oppen') throw new Error('Månaden måste godkännas innan den publiceras');
      if (x.status === 'publicerad' && !String(reason || '').trim()) throw new Error('Månaden är redan publicerad. En rättelse kräver en orsak.');
      const v = x.status === 'publicerad' ? x.version + 1 : x.version;
      for (const it of items) {
        if (parentOf(it.to) !== t) throw new Error('Mottagaren är inte en underkund till kontot');
        db.shares.push({ id: uuid(), from_tenant: t, to_tenant: it.to, module_key: m, period: p, kind: it.kind, payload: clone(it.payload), version: v, reason, created_at: now().toISOString(), opened_at: null });
        if (it.title) db.notifications.push({ id: uuid(), tenant_id: it.to, user_id: null, title: it.title, body: it.body || null, link: it.link || null, created_at: now().toISOString(), read_at: null });
      }
      Object.assign(x, { status: 'publicerad', version: v, published_by: uid(), published_at: now().toISOString() });
      audit(t, 'publicera', m + ':' + p, { mottagare: items.length, version: v, orsak: reason });
      save(); emit({ table: 'shares' }); emit({ table: 'periods', tenant_id: t, module_key: m });
      return items.length;
    },
    /** Det som publicerats till kontot (senaste versionen per period och typ). */
    async sharesTo(t, m = null) {
      need(myTenants().has(t));
      const L = db.shares.filter(s => s.to_tenant === t && (!m || s.module_key === m));
      const latest = new Map(); for (const s of L) { const k = s.module_key + '|' + s.period + '|' + s.kind; if (!latest.has(k) || latest.get(k).version < s.version) latest.set(k, s); }
      return [...latest.values()].map(clone).sort((a, b) => b.period.localeCompare(a.period));
    },
    async sharesFrom(t, m, p = null) {
      need(myTenants().has(t));
      return db.shares.filter(s => s.from_tenant === t && s.module_key === m && (!p || s.period === p)).map(clone);
    },
    async markOpened(shareId) {
      const s = db.shares.find(x => x.id === shareId); need(s && myTenants().has(s.to_tenant));
      if (!s.opened_at) { s.opened_at = now().toISOString(); save(); emit({ table: 'shares' }); }
    },

    // ------------------------------------------------ appar
    async licenses(t) { need(canRead(t) || myTenants().has(parentOf(t)) || isPlatform()); return db.licenses.filter(l => l.tenant_id === t).map(clone); },
    async childLicenses(parent) { need(myTenants().has(parent)); const kids = new Set(db.tenants.filter(x => x.parent_id === parent).map(x => x.id)); return db.licenses.filter(l => kids.has(l.tenant_id)).map(clone); },
    async setLicense(t, moduleKey, patch) {
      need(hasRole(t, ['agare', 'admin']) || hasRole(parentOf(t), ['agare', 'admin', 'ekonomi']) || isPlatform());
      let l = db.licenses.find(x => x.tenant_id === t && x.module_key === moduleKey);
      if (!l) { l = { tenant_id: t, module_key: moduleKey, variant: tenant(t).type === 'direct' ? 'direct' : tenant(t).type === 'main' ? 'main' : 'sub', status: 'aktiv', paid_by: t, price: null, started_at: now().toISOString().slice(0, 10) }; db.licenses.push(l); }
      Object.assign(l, clone(patch)); audit(t, 'licens', moduleKey, patch); save(); emit({ table: 'licenses', tenant_id: t });
      return clone(l);
    },
    async offers(parent) { need(myTenants().has(parent) || [...myTenants()].some(m => parentOf(m) === parent) || isPlatform()); return db.offers.filter(o => o.parent_id === parent).map(clone); },
    async setOffer(parent, moduleKey, patch) {
      need(hasRole(parent, ['agare', 'admin', 'ekonomi']));
      let o = db.offers.find(x => x.parent_id === parent && x.module_key === moduleKey);
      if (!o) { o = { parent_id: parent, module_key: moduleKey, variant: 'sub', mode: 'av', paid_by: 'parent', price: null, auto_enable: false }; db.offers.push(o); }
      Object.assign(o, clone(patch)); audit(parent, 'erbjudande', moduleKey, patch); save(); emit({ table: 'offers', tenant_id: parent });
      return clone(o);
    },
    async modules() { return db.modules.map(clone); },

    // ------------------------------------------------ inbjudningar
    async invites(parent) { need(canRead(parent)); return db.invites.filter(i => i.parent_id === parent).map(clone); },
    async createInvite(parent, { name, org_nr, email, modules = ['avrakning'] }) {
      need(canWrite(parent));
      const t = { id: uuid(), parent_id: parent, type: 'sub', name, slug: String(name).toLowerCase().replace(/å|ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 5), org_nr, brand: {}, settings: {} };
      db.tenants.push(t);
      const inv = { id: uuid(), parent_id: parent, tenant_id: t.id, org_nr, name, email, modules, status: 'skickad', token: Math.random().toString(36).slice(2), expires_at: new Date(now().getTime() + 30 * 864e5).toISOString(), created_at: now().toISOString() };
      db.invites.push(inv);
      for (const m of modules) db.licenses.push({ tenant_id: t.id, module_key: m, variant: 'sub', status: 'aktiv', paid_by: parent, price: null, started_at: now().toISOString().slice(0, 10) });
      audit(parent, 'bjud in', email, { name, modules }); save(); emit({ table: 'invites', tenant_id: parent });
      return clone(inv);
    },
    async acceptInvite(token) {
      need(true);
      const i = db.invites.find(x => x.token === token && x.status === 'skickad' && new Date(x.expires_at) > now());
      if (!i) throw new Error('Inbjudan finns inte eller har gått ut');
      if (!db.memberships.some(m => m.user_id === uid() && m.tenant_id === i.tenant_id)) db.memberships.push({ user_id: uid(), tenant_id: i.tenant_id, role: 'agare' });
      i.status = 'accepterad'; audit(i.tenant_id, 'inbjudan accepterad', i.id); save(); emit({ table: 'invites' });
      return i.tenant_id;
    },

    // ------------------------------------------------ filer, guide, logg, notiser
    async fileRuns(t, m, p = null) { need(canRead(t)); return db.file_runs.filter(f => f.tenant_id === t && f.module_key === m && (!p || f.period === p)).map(clone).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async addFileRun(row) { need(canWrite(row.tenant_id)); const r = { id: uuid(), created_by: uid(), created_at: now().toISOString(), ...clone(row) }; db.file_runs.push(r); save(); emit({ table: 'file_runs', tenant_id: row.tenant_id }); return clone(r); },
    async deleteFileRun(id) { const r = db.file_runs.find(x => x.id === id); need(r && canWrite(r.tenant_id)); db.file_runs = db.file_runs.filter(x => x.id !== id); save(); emit({ table: 'file_runs', tenant_id: r.tenant_id }); },
    async guideProgress(t, m) { need(myTenants().has(t)); return db.guide_progress.filter(g => g.user_id === uid() && g.tenant_id === t && g.module_key === m).map(clone); },
    /** Kom-igång-listan delas av kontot (sidan 16): alla i kontot ser samma bockar. */
    async accountProgress(t, m) { need(myTenants().has(t)); return db.guide_progress.filter(g => g.tenant_id === t && g.module_key === m && !String(g.step_key).startsWith('welcome')).map(clone); },
    async setGuideStep(t, m, step, done = true) {
      need(myTenants().has(t));
      db.guide_progress = db.guide_progress.filter(g => !(g.user_id === uid() && g.tenant_id === t && g.module_key === m && g.step_key === step));
      if (done) db.guide_progress.push({ user_id: uid(), tenant_id: t, module_key: m, step_key: step, done_at: now().toISOString() });
      save(); emit({ table: 'guide_progress', tenant_id: t });
    },
    async auditLog(t) { need(hasRole(t, ['agare', 'admin']) || isPlatform()); return db.audit_log.filter(a => a.tenant_id === t).map(clone).sort((a, b) => b.at.localeCompare(a.at)); },
    async log(t, action, target, detail) { need(myTenants().has(t) || isPlatform()); audit(t, action, target, detail); save(); },
    async notifications(t) { need(myTenants().has(t)); return db.notifications.filter(n => n.tenant_id === t && (!n.user_id || n.user_id === uid())).map(clone).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async markRead(id) { const n = db.notifications.find(x => x.id === id); need(n && myTenants().has(n.tenant_id)); n.read_at = now().toISOString(); save(); emit({ table: 'notifications', tenant_id: n.tenant_id }); },

    // ------------------------------------------------ support (regel 4)
    async supportAccess(t) { need(myTenants().has(t) || isPlatform()); return db.support_access.filter(s => s.tenant_id === t).map(clone); },
    async grantSupport(t, hours = 24, reason = '') {
      need(hasRole(t, ['agare', 'admin']));
      const s = { tenant_id: t, granted_by: uid(), granted_until: new Date(now().getTime() + hours * 36e5).toISOString(), reason, created_at: now().toISOString() };
      db.support_access.push(s); audit(t, 'godkänn supportinloggning', String(hours) + ' timmar', { reason }); save(); emit({ table: 'support_access', tenant_id: t });
      return clone(s);
    },
    async revokeSupport(t) { need(hasRole(t, ['agare', 'admin'])); db.support_access = db.support_access.filter(s => s.tenant_id !== t); audit(t, 'återkalla supportinloggning', t); save(); emit({ table: 'support_access', tenant_id: t }); },
    async tickets(t = null) { need(t ? myTenants().has(t) || isPlatform() : isPlatform()); return db.support_tickets.filter(x => !t || x.tenant_id === t).map(x => ({ ...clone(x), tenant: clone(tenant(x.tenant_id)) })).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async createTicket(t, subject) { need(myTenants().has(t)); const x = { id: uuid(), tenant_id: t, subject, status: 'ny', created_by: uid(), created_at: now().toISOString() }; db.support_tickets.push(x); save(); emit({ table: 'support_tickets' }); return clone(x); },
    async setTicket(id, status) { need(isPlatform()); const x = db.support_tickets.find(y => y.id === id); x.status = status; save(); emit({ table: 'support_tickets' }); },

    // ------------------------------------------------ admin
    async allTenants() { need(isPlatform()); return db.tenants.map(clone); },
    async allLicenses() { need(isPlatform()); return db.licenses.map(clone); },
    async guideStats() {
      need(isPlatform());
      return db.guide_progress.map(g => ({ tenant_id: g.tenant_id, module_key: g.module_key, step_key: g.step_key, user_id: g.user_id, done_at: g.done_at }));
    },
    async allMemberships() { need(isPlatform()); return db.memberships.map(clone); },
    async bookings() { need(isPlatform()); return db.bookings.map(clone); },
    async setBooking(id, patch) { need(isPlatform()); const x = db.bookings.find(y => y.id === id); Object.assign(x, clone(patch)); save(); emit({ table: 'bookings' }); },
    async createBooking(b) { const x = { id: uuid(), status: 'ny', created_at: now().toISOString(), ...clone(b) }; db.bookings.push(x); save(); return { id: x.id }; },
    async createTenant(t) {
      need(isPlatform());
      const x = { id: uuid(), parent_id: null, brand: {}, settings: {}, created_at: now().toISOString(), ...clone(t) };
      db.tenants.push(x); audit(x.id, 'nytt konto', x.name); save(); emit({ table: 'tenants' }); return clone(x);
    },
    async taxRates() { return db.tax_rates.map(clone); },

    // ------------------------------------------------ prenumeration
    subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },

    // Intern, för demo-data och tester
    _raw: () => db,
    _save: save,
    _uid: uid,
    _emit: emit
  };
  return api;
}
