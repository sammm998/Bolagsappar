// AI för Skadeflöde. Nyckeln (ANTHROPIC_API_KEY) finns bara här. Utkast skickas aldrig automatiskt,
// skärmen visar texten och användaren granskar. Utan nyckel svarar funktionen ai_off och skärmen visar ett utkast utan AI.
import { adminClient, caller, fail, handler, json, roleIn } from '../_shared/http.ts';

const TASKS: Record<string, { module: string; max: number }> = {
  intag: { module: 'skadeflode', max: 1200 }, svar: { module: 'skadeflode', max: 900 },
  tillagg: { module: 'skadeflode', max: 900 }, kontroll: { module: 'skadeflode', max: 700 }
};
const PER_TIMME = Number(Deno.env.get('AI_PER_TIMME') || 60);

Deno.serve(handler(async req => {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return fail(503, 'ai_off', 'AI är inte påslaget.');
  const admin = adminClient();
  const me = await caller(req, admin);
  if (!me) return fail(401, 'not_signed_in', 'Logga in först.');
  const { tenant, task, prompt } = await req.json();
  const T = TASKS[task];
  if (!T) return fail(400, 'task', 'Okänd uppgift.');
  if (typeof prompt !== 'string' || prompt.length > 20000) return fail(400, 'prompt', 'Underlaget är för stort.');
  const role = await roleIn(admin, me.id, tenant);
  if (!role || role === 'las' || role === 'forare') return fail(403, 'not_granted', 'Du har inte behörighet.');
  const { data: lic } = await admin.from('licenses').select('status').eq('tenant_id', tenant).eq('module_key', T.module).maybeSingle();
  if (lic?.status !== 'aktiv') return fail(403, 'not_granted', 'Appen är inte aktiv för kontot.');
  const since = new Date(Date.now() - 3600e3).toISOString();
  const { count } = await admin.from('audit_log').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant).eq('action', 'ai').gte('at', since);
  if ((count || 0) >= PER_TIMME) return fail(429, 'rate_limited', 'För många förfrågningar just nu.');

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: Deno.env.get('AI_MODEL') || 'claude-sonnet-5-5', max_tokens: T.max, messages: [{ role: 'user', content: prompt }] })
  });
  if (r.status === 429) return fail(429, 'rate_limited', 'För många förfrågningar just nu.');
  if (!r.ok) { console.error('ai', r.status, await r.text()); return fail(502, 'ai_error', 'AI svarade inte.'); }
  const out = await r.json();
  const text = (out.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('').replace(/[–—]/g, ',');
  // Underlaget loggas inte, bara att AI användes.
  await admin.from('audit_log').insert({ tenant_id: tenant, actor: me.id, action: 'ai', target: task, detail: null });
  return json({ text });
}));
