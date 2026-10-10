// Efter publicering (publish_period i databasen): notis och mejl till varje mottagare.
// Mejlet innehåller ingen siffra, bara en länk. Avräkningen läses inloggad.
import { adminClient, caller, fail, handler, json, roleIn } from '../_shared/http.ts';
import { sendMail, manadAr } from '../_shared/mail.ts';

const APP = Deno.env.get('APP_URL') || 'https://app.bolagsappar.se';

Deno.serve(handler(async req => {
  const admin = adminClient();
  const me = await caller(req, admin);
  if (!me) return fail(401, 'not_signed_in', 'Logga in först.');
  const { tenant, module_key, period } = await req.json();
  if (!['agare', 'admin', 'ekonomi'].includes((await roleIn(admin, me.id, tenant)) || '')) return fail(403, 'not_granted', 'Du har inte behörighet.');
  const { data: per } = await admin.from('periods').select('version, status').eq('tenant_id', tenant).eq('module_key', module_key).eq('period', period).single();
  if (per?.status !== 'publicerad') return fail(409, 'not_published', 'Månaden är inte publicerad.');
  const { data: from } = await admin.from('tenants').select('name').eq('id', tenant).single();
  const { data: shares } = await admin.from('shares').select('to_tenant, reason, to:tenants!shares_to_tenant_fkey(slug, name)').eq('from_tenant', tenant).eq('module_key', module_key).eq('period', period).eq('version', per.version);
  const mottagare = [...new Map((shares || []).map((s: any) => [s.to_tenant, s])).values()];
  const rattelse = per.version > 1;
  let skickade = 0;
  for (const s of mottagare as any[]) {
    const title = rattelse ? `Rättad avräkning för ${manadAr(period)}` : `Avräkningen för ${manadAr(period)} är klar`;
    const link = `/${s.to.slug}/min-avrakning/${period}`;
    await admin.from('notifications').insert({ tenant_id: s.to_tenant, title, body: rattelse ? `${from?.name} har rättat avräkningen. Orsak: ${s.reason || ''}` : `${from?.name} har publicerat avräkningen.`, link });
    const { data: ms } = await admin.from('memberships').select('role, user:users(email)').eq('tenant_id', s.to_tenant).in('role', ['agare', 'admin', 'ekonomi']);
    const to = (ms || []).map((m: any) => m.user?.email).filter(Boolean);
    const r = await sendMail({ to, subject: title, text: `Hej,\n\n${from?.name} har ${rattelse ? 'rättat' : 'publicerat'} avräkningen för ${manadAr(period)}.\n\nLogga in och läs den här:\n${APP}${link}\n\nBolagsappar` });
    if (r.sent) skickade++;
  }
  return json({ mottagare: mottagare.length, skickade });
}));
