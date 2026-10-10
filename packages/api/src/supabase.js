// Backend mot Supabase (EU). Samma gränssnitt som createLocalBackend. Radsäkerheten i databasen
// gör behörighetskontrollen. Inloggning med e-postlänk (ingen BankID).
import { createClient } from '@supabase/supabase-js';

const one = ({ data, error }) => { if (error) throw toErr(error); return data; };
function toErr(e) { const x = new Error(e.message || String(e)); x.code = e.code === '42501' ? 'not_granted' : e.code; return x; }

/**
 * @param {{ url: string, anonKey: string, redirectTo?: string, client?: any }} cfg
 */
export function createSupabaseBackend(cfg) {
  const sb = cfg.client || createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
  const listeners = new Set();
  let channel = null;
  const emit = evt => { for (const l of listeners) { try { l(evt); } catch (e) { console.error(e); } } };
  const uid = async () => (await sb.auth.getUser()).data.user?.id || null;

  const api = {
    kind: 'supabase',
    client: sb,

    async getUser() {
      const id = await uid(); if (!id) return null;
      const { data } = await sb.from('users').select('*').eq('id', id).maybeSingle();
      return data || { id, name: '', email: (await sb.auth.getUser()).data.user?.email };
    },
    async signInWithEmail(email) {
      one(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: cfg.redirectTo || (typeof location !== 'undefined' ? location.origin + '/valj-bolag' : undefined), shouldCreateUser: false } }));
      return { sent: true, demo: false };
    },
    async signInAsDemo() { throw new Error('Demoinloggning finns bara lokalt'); },
    async signOut() { await sb.auth.signOut(); },
    onAuthChange(cb) { const { data } = sb.auth.onAuthStateChange(async () => cb(await api.getUser())); return () => data.subscription.unsubscribe(); },
    demoLogins() { return []; },

    async myAccounts() {
      const id = await uid();
      const ms = one(await sb.from('memberships').select('role, forare_id, tenant:tenants!inner(*)').eq('user_id', id));
      const parents = [...new Set(ms.map(m => m.tenant.parent_id).filter(Boolean))];
      const P = parents.length ? one(await sb.from('tenants').select('*').in('id', parents)) : [];
      const order = { platform: 0, main: 1, direct: 2, sub: 3 };
      return ms.map(m => ({ role: m.role, forare_id: m.forare_id, tenant: m.tenant, parent: P.find(p => p.id === m.tenant.parent_id) || null }))
        .sort((a, b) => order[a.tenant.type] - order[b.tenant.type] || a.tenant.name.localeCompare(b.tenant.name, 'sv'));
    },
    async tenant(idOrSlug) {
      const col = /^[0-9a-f-]{36}$/.test(idOrSlug) ? 'id' : 'slug';
      return one(await sb.from('tenants').select('*').eq(col, idOrSlug).maybeSingle());
    },
    async updateTenant(t, patch) { return one(await sb.from('tenants').update(patch).eq('id', t).select().single()); },
    async children(parentId) { return one(await sb.from('tenants').select('*').eq('parent_id', parentId).order('name')); },
    async networkOverview(parentId, moduleKey = 'avrakning', period = null) {
      return one(await sb.rpc('network_overview', { parent: parentId, module_key: moduleKey, period }));
    },
    async members(t) { return one(await sb.from('memberships').select('*, user:users(*)').eq('tenant_id', t)); },
    async addMember(t, body) { const r = await fetchFn(sb, 'invite', { tenant: t, ...body, kind: 'member' }); return r; },

    async getDoc(t, m, path) { const d = one(await sb.from('documents').select('data').eq('tenant_id', t).eq('module_key', m).eq('path', path).maybeSingle()); return d ? d.data : null; },
    async setDoc(t, m, path, data, { merge = false } = {}) {
      let body = data;
      if (merge) { const cur = await api.getDoc(t, m, path); body = { ...(cur || {}), ...data }; }
      one(await sb.from('documents').upsert({ tenant_id: t, module_key: m, path, data: body, updated_by: await uid(), updated_at: new Date().toISOString() }));
      emit({ table: 'documents', tenant_id: t, module_key: m, path });
    },
    async deleteDoc(t, m, path) { one(await sb.from('documents').delete().eq('tenant_id', t).eq('module_key', m).eq('path', path)); emit({ table: 'documents', tenant_id: t, module_key: m, path }); },
    async listDocs(t, m, prefix = '') {
      const pre = prefix ? prefix.replace(/\/?$/, '/') : '';
      const L = one(await sb.from('documents').select('path, data, updated_at').eq('tenant_id', t).eq('module_key', m).like('path', pre.replace(/[%_]/g, '\\$&') + '%'));
      return L.filter(x => !x.path.slice(pre.length).includes('/')).map(x => ({ path: x.path, id: x.path.slice(pre.length), data: x.data, updated_at: x.updated_at })).sort((a, b) => a.id.localeCompare(b.id));
    },

    async getPeriod(t, m, p) { return one(await sb.from('periods').select('*').eq('tenant_id', t).eq('module_key', m).eq('period', p).maybeSingle()); },
    async listPeriods(t, m) { return one(await sb.from('periods').select('*').eq('tenant_id', t).eq('module_key', m).order('period', { ascending: false })); },
    async approvePeriod(t, m, p) { one(await sb.rpc('approve_period', { tenant: t, module_key: m, period: p })); emit({ table: 'periods', tenant_id: t, module_key: m }); return api.getPeriod(t, m, p); },
    async reopenPeriod(t, m, p) { one(await sb.from('periods').update({ status: 'oppen' }).eq('tenant_id', t).eq('module_key', m).eq('period', p).eq('status', 'godkand')); emit({ table: 'periods', tenant_id: t, module_key: m }); return api.getPeriod(t, m, p); },
    async publish(t, m, p, items, reason = null) {
      const n = one(await sb.rpc('publish_period', { from_tenant: t, module_key: m, period: p, items, reason }));
      // Mejl skickas av Edge Function publish (nyckeln finns bara på servern)
      try { await fetchFn(sb, 'publish', { tenant: t, module_key: m, period: p }); } catch (e) { console.warn('Mejlen kunde inte skickas', e); }
      emit({ table: 'shares' }); emit({ table: 'periods', tenant_id: t, module_key: m });
      return n;
    },
    async sharesTo(t, m = null) {
      let q = sb.from('shares').select('*').eq('to_tenant', t); if (m) q = q.eq('module_key', m);
      const L = one(await q.order('version', { ascending: false }));
      const latest = new Map(); for (const s of L) { const k = s.module_key + '|' + s.period + '|' + s.kind; if (!latest.has(k)) latest.set(k, s); }
      return [...latest.values()].sort((a, b) => b.period.localeCompare(a.period));
    },
    async sharesFrom(t, m, p = null) { let q = sb.from('shares').select('*').eq('from_tenant', t).eq('module_key', m); if (p) q = q.eq('period', p); return one(await q); },
    async markOpened(id) { one(await sb.from('shares').update({ opened_at: new Date().toISOString() }).eq('id', id).is('opened_at', null)); },

    async licenses(t) { return one(await sb.from('licenses').select('*').eq('tenant_id', t)); },
    async childLicenses(parent) { const kids = (await api.children(parent)).map(x => x.id); return kids.length ? one(await sb.from('licenses').select('*').in('tenant_id', kids)) : []; },
    async setLicense(t, moduleKey, patch) { return one(await sb.from('licenses').upsert({ tenant_id: t, module_key: moduleKey, variant: 'sub', ...patch }).select().single()); },
    async offers(parent) { return one(await sb.from('offers').select('*').eq('parent_id', parent)); },
    async setOffer(parent, moduleKey, patch) { return one(await sb.from('offers').upsert({ parent_id: parent, module_key: moduleKey, ...patch }).select().single()); },
    async modules() { return one(await sb.from('modules').select('*')); },

    async invites(parent) { return one(await sb.from('invites').select('*').eq('parent_id', parent)); },
    async createInvite(parent, body) { return fetchFn(sb, 'invite', { parent, ...body, kind: 'sub' }); },
    async acceptInvite(token) { return one(await sb.rpc('accept_invite', { invite_token: token })); },

    async fileRuns(t, m, p = null) { let q = sb.from('file_runs').select('*').eq('tenant_id', t).eq('module_key', m); if (p) q = q.eq('period', p); return one(await q.order('created_at', { ascending: false })); },
    async addFileRun(row) { return one(await sb.from('file_runs').insert({ ...row, created_by: await uid() }).select().single()); },
    async deleteFileRun(id) { one(await sb.from('file_runs').delete().eq('id', id)); },
    async guideProgress(t, m) { return one(await sb.from('guide_progress').select('*').eq('tenant_id', t).eq('module_key', m).eq('user_id', await uid())); },
    async accountProgress(t, m) { return one(await sb.from('guide_progress').select('*').eq('tenant_id', t).eq('module_key', m)); },
    async setGuideStep(t, m, step, done = true) {
      const user_id = await uid();
      if (done) one(await sb.from('guide_progress').upsert({ user_id, tenant_id: t, module_key: m, step_key: step }));
      else one(await sb.from('guide_progress').delete().eq('user_id', user_id).eq('tenant_id', t).eq('module_key', m).eq('step_key', step));
      emit({ table: 'guide_progress', tenant_id: t });
    },
    async auditLog(t) { return one(await sb.from('audit_log').select('*').eq('tenant_id', t).order('at', { ascending: false }).limit(200)); },
    async log(t, action, target, detail) { one(await sb.from('audit_log').insert({ tenant_id: t, actor: await uid(), action, target, detail })); },
    async notifications(t) { return one(await sb.from('notifications').select('*').eq('tenant_id', t).order('created_at', { ascending: false }).limit(50)); },
    async markRead(id) { one(await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)); },

    async supportAccess(t) { return one(await sb.from('support_access').select('*').eq('tenant_id', t)); },
    async grantSupport(t, hours = 24, reason = '') { return one(await sb.from('support_access').insert({ tenant_id: t, granted_by: await uid(), granted_until: new Date(Date.now() + hours * 36e5).toISOString(), reason }).select().single()); },
    async revokeSupport(t) { one(await sb.from('support_access').delete().eq('tenant_id', t)); },
    async tickets(t = null) { let q = sb.from('support_tickets').select('*, tenant:tenants(*)'); if (t) q = q.eq('tenant_id', t); return one(await q.order('created_at', { ascending: false })); },
    async createTicket(t, subject) { return one(await sb.from('support_tickets').insert({ tenant_id: t, subject, created_by: await uid() }).select().single()); },
    async setTicket(id, status) { one(await sb.from('support_tickets').update({ status }).eq('id', id)); },

    async allTenants() { return one(await sb.from('tenants').select('*')); },
    async allLicenses() { return one(await sb.from('licenses').select('*')); },
    async guideStats() { return one(await sb.from('guide_progress').select('tenant_id, module_key, step_key, user_id, done_at')); },
    async allMemberships() { return one(await sb.from('memberships').select('*')); },
    async bookings() { return one(await sb.from('bookings').select('*').order('created_at', { ascending: false })); },
    async createBooking(b) { one(await sb.from('bookings').insert(b)); return { ok: true }; },
    async createTenant(t) { return one(await sb.from('tenants').insert(t).select().single()); },
    async taxRates() { return one(await sb.from('tax_rates').select('*')); },

    subscribe(cb) {
      listeners.add(cb);
      if (!channel) {
        channel = sb.channel('db').on('postgres_changes', { event: '*', schema: 'public' }, payload => {
          const r = payload.new && Object.keys(payload.new).length ? payload.new : payload.old || {};
          emit({ table: payload.table, tenant_id: r.tenant_id || r.to_tenant, module_key: r.module_key, path: r.path });
        }).subscribe();
      }
      return () => listeners.delete(cb);
    }
  };
  return api;
}

async function fetchFn(sb, name, body) {
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) throw toErr(error);
  return data;
}
