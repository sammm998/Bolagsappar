// Gemensamt för Edge Functions: CORS, svar och klienter. Nycklar finns bara här på servern.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

export const cors = {
  // Ursprunget är bara schema och värd, aldrig sökvägen (APP_URL kan vara https://bolagsappar.se/app).
  'Access-Control-Allow-Origin': (() => { try { return new URL(Deno.env.get('APP_URL') || '').origin; } catch { return '*'; } })(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
export const fail = (status: number, code: string, error: string) => json({ code, error }, status);

/** Klient med service role. Används bara efter att anroparens behörighet är kontrollerad. */
export const adminClient = (): SupabaseClient => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

/** Anroparen från JWT i Authorization. */
export async function caller(req: Request, admin: SupabaseClient) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data.user || null;
}

export async function roleIn(admin: SupabaseClient, userId: string, tenant: string): Promise<string | null> {
  const { data } = await admin.from('memberships').select('role').eq('user_id', userId).eq('tenant_id', tenant).maybeSingle();
  return data?.role || null;
}

export async function isPlatform(admin: SupabaseClient, userId: string) {
  const { data } = await admin.from('memberships').select('role, tenant:tenants(type)').eq('user_id', userId);
  return (data || []).some((m: any) => m.tenant?.type === 'platform' && ['agare', 'admin'].includes(m.role));
}

export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return fail(405, 'method', 'Bara POST');
    try { return await fn(req); }
    catch (e) { console.error(e); return fail(500, 'server', 'Något gick fel. Försök igen.'); }
  };
}
