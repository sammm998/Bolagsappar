// Skriver supabase/seed.sql från packages/api/src/seed.js så att Supabase och den lokala backenden har samma grunddata.
import fs from 'node:fs';
import { buildSeed } from '../packages/api/src/seed.js';

const S = buildSeed();
const q = v => v == null ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : Array.isArray(v) ? `array[${v.map(q).join(',')}]::text[]` : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`;
const ins = (table, rows, cols) => rows.length ? `insert into public.${table} (${cols.join(', ')}) values\n` + rows.map(r => '  (' + cols.map(c => q(r[c])).join(', ') + ')').join(',\n') + '\non conflict do nothing;\n' : '';
// Föräldrar före barn
const tenants = [...S.tenants].sort((a, b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0));
let sql = `-- Genererad av scripts/gen-seed-sql.mjs. Ändra i packages/api/src/seed.js och kör om.
-- Påhittade personer och bolag (utom Taxi Malmö och Bolagsappar). Inloggning sker med e-postlänk.
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    insert into auth.users (id, email) values
${S.users.map(u => `      (${q(u.id)}, ${q(u.email)})`).join(',\n')}
    on conflict do nothing;
  end if;
end $$;
`;
sql += ins('users', S.users, ['id', 'name', 'email', 'last_login_at']);
sql += ins('tenants', tenants, ['id', 'parent_id', 'type', 'name', 'slug', 'org_nr', 'brand', 'settings']);
sql += ins('memberships', S.memberships.map(m => ({ forare_id: null, ...m })), ['user_id', 'tenant_id', 'role', 'forare_id']);
sql += ins('modules', S.modules, ['key', 'name', 'version', 'manifest']);
sql += ins('licenses', S.licenses, ['tenant_id', 'module_key', 'variant', 'status', 'paid_by', 'price', 'started_at']);
sql += ins('offers', S.offers, ['parent_id', 'module_key', 'variant', 'mode', 'paid_by', 'price', 'auto_enable']);
sql += ins('invites', S.invites, ['id', 'parent_id', 'tenant_id', 'org_nr', 'name', 'email', 'modules', 'status', 'token', 'expires_at', 'created_at']);
sql += ins('tax_rates', S.tax_rates, ['id', 'kind', 'valid_from', 'valid_to', 'data']);
sql += ins('support_tickets', S.support_tickets, ['id', 'tenant_id', 'subject', 'status', 'created_at']);
fs.writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql);
console.log('supabase/seed.sql skriven');
