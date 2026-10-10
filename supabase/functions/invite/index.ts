// Inbjudningar. Ingen BankID: den inbjudna får en inloggningslänk med e-post.
//  kind 'sub':    huvudkunden bjuder in en åkare. Kontot skapas direkt med modulerna huvudkunden betalar för.
//  kind 'member': ägare eller admin lägger till en användare i sitt eget konto (t.ex. ekonomi eller förare).
import { adminClient, caller, fail, handler, json, roleIn, isPlatform } from '../_shared/http.ts';
import { sendMail } from '../_shared/mail.ts';

const APP = Deno.env.get('APP_URL') || 'https://app.bolagsappar.se';
const slug = (s: string) => s.toLowerCase().replace(/å|ä/g, 'a').replace(/ö/g, 'o').replace(/\b(ab|hb|kb)\b/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ROLES = ['agare', 'admin', 'ekonomi', 'forare', 'las'];

Deno.serve(handler(async req => {
  const admin = adminClient();
  const me = await caller(req, admin);
  if (!me) return fail(401, 'not_signed_in', 'Logga in först.');
  const body = await req.json();
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, 'email', 'Ogiltig e-postadress.');

  if (body.kind === 'sub') {
    const parent = String(body.parent);
    const role = await roleIn(admin, me.id, parent);
    if (!['agare', 'admin', 'ekonomi'].includes(role || '')) return fail(403, 'not_granted', 'Du har inte behörighet att bjuda in.');
    const { data: p } = await admin.from('tenants').select('id, name, type').eq('id', parent).single();
    if (p?.type !== 'main') return fail(400, 'type', 'Bara huvudkunder bjuder in underkunder.');
    const name = String(body.name || '').trim();
    if (!name) return fail(400, 'name', 'Ange företagets namn.');
    const { data: t, error: te } = await admin.from('tenants').insert({ parent_id: parent, type: 'sub', name, org_nr: body.org_nr || null, slug: slug(name) + '-' + crypto.randomUUID().slice(0, 4) }).select().single();
    if (te) throw te;
    const modules: string[] = Array.isArray(body.modules) && body.modules.length ? body.modules : ['avrakning'];
    const { data: inv, error: ie } = await admin.from('invites').insert({ parent_id: parent, tenant_id: t.id, org_nr: body.org_nr || null, name, email, modules }).select().single();
    if (ie) throw ie;
    await admin.from('licenses').insert(modules.map(m => ({ tenant_id: t.id, module_key: m, variant: 'sub', status: 'aktiv', paid_by: parent })));
    await admin.from('audit_log').insert({ tenant_id: parent, actor: me.id, action: 'bjud in', target: email, detail: { name, modules } });
    const redirectTo = `${APP}/inbjudan/${inv.token}`;
    const { error: ae } = await admin.auth.admin.inviteUserByEmail(email, { data: { name: '' }, redirectTo });
    if (ae) {
      // Användaren finns redan: skicka en inloggningslänk i stället.
      await admin.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
      await sendMail({ to: [email], subject: `${p.name} bjuder in dig till Bolagsappar`, text: `${p.name} har bjudit in ${name}. Logga in med länken i det andra mejlet, eller öppna ${redirectTo}.` });
    }
    return json(inv);
  }

  if (body.kind === 'member') {
    const tenant = String(body.tenant);
    const role = String(body.role || 'las');
    if (!ROLES.includes(role)) return fail(400, 'role', 'Okänd roll.');
    const mine = await roleIn(admin, me.id, tenant);
    if (!['agare', 'admin'].includes(mine || '') && !(await isPlatform(admin, me.id))) return fail(403, 'not_granted', 'Bara ägare och admin lägger till användare.');
    let { data: u } = await admin.from('users').select('*').eq('email', email).maybeSingle();
    if (!u) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { name: body.name || '' }, redirectTo: APP + '/valj-bolag' });
      if (error) throw error;
      u = { id: data.user.id, email, name: body.name || '' };
      await admin.from('users').upsert({ id: u.id, email, name: body.name || '' });
    }
    await admin.from('memberships').upsert({ user_id: u.id, tenant_id: tenant, role, forare_id: body.forare_id || null });
    await admin.from('audit_log').insert({ tenant_id: tenant, actor: me.id, action: 'lägg till användare', target: email, detail: { role } });
    return json(u);
  }
  return fail(400, 'kind', 'Okänd typ av inbjudan.');
}));
