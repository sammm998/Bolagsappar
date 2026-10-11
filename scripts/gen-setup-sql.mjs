// Skriver supabase/setup.sql: alla migrationer i ordning plus grunddata som alltid behövs (moduler och
// skattesatser). Ingen demodata. Klistras in i Supabase, SQL Editor, i ett nytt projekt.
import fs from 'node:fs';
import { buildSeed } from '../packages/api/src/seed.js';

const dir = new URL('../supabase/', import.meta.url);
const S = buildSeed();
const q = v => v == null ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`;
const ins = (table, rows, cols) => `insert into public.${table} (${cols.join(', ')}) values\n` + rows.map(r => '  (' + cols.map(c => q(r[c])).join(', ') + ')').join(',\n') + '\non conflict do nothing;\n';

let sql = `-- Genererad av scripts/gen-setup-sql.mjs. Kör den i ett nytt Supabase-projekt (SQL Editor, Run).
-- Skapar tabeller, radsäkerhet, funktioner, moduler och skattesatser. Ingen demodata.
-- Därefter: supabase/forsta-agare.sql för att göra dig till ägare.\n\n`;
for (const f of fs.readdirSync(new URL('migrations/', dir)).sort()) sql += `-- ================================================ ${f}\n` + fs.readFileSync(new URL('migrations/' + f, dir), 'utf8') + '\n';
sql += '-- ================================================ grunddata\n';
sql += ins('modules', S.modules, ['key', 'name', 'version', 'manifest']);
sql += ins('tax_rates', S.tax_rates, ['id', 'kind', 'valid_from', 'valid_to', 'data']);
sql += "select setval(pg_get_serial_sequence('public.tax_rates', 'id'), (select max(id) from public.tax_rates));\n";
fs.writeFileSync(new URL('setup.sql', dir), sql);

// Första ägaren: Bolagsappar (adminportalen) och Taxi Malmö som huvudkund, med samma inställningar som demot.
const T = id => S.tenants.find(t => t.id === id);
const plat = S.tenants.find(t => t.type === 'platform'), taxi = S.tenants.find(t => t.slug === 'taxi-malmo');
const lic = S.licenses.filter(l => l.tenant_id === taxi.id), off = S.offers.filter(o => o.parent_id === taxi.id);
const agare = `-- Genererad av scripts/gen-setup-sql.mjs. Kör efter setup.sql.
-- 1. Skapa först dig själv i Supabase: Authentication, Users, Add user, Create new user (bocka i Auto Confirm User).
-- 2. Byt e-postadressen nedan till samma adress och kör filen (SQL Editor, Run).
-- Du blir ägare av Bolagsappar (adminportalen, /app/admin) och av Taxi Malmö (huvudkund).
do $$
declare
  epost text := 'din@epost.se';
  u uuid; pl uuid; tm uuid;
begin
  select id into u from auth.users where lower(email) = lower(epost);
  if u is null then raise exception 'Hittar ingen användare med %. Skapa den först under Authentication, Users.', epost; end if;
  insert into public.users (id, email, name) values (u, lower(epost), '') on conflict (id) do nothing;

  insert into public.tenants (type, name, slug, brand, settings) values ('platform', ${q(plat.name)}, ${q(plat.slug)}, ${q(plat.brand)}, ${q(plat.settings)}) on conflict (slug) do nothing;
  select id into pl from public.tenants where slug = ${q(plat.slug)};
  insert into public.tenants (type, name, slug, brand, settings) values ('main', ${q(taxi.name)}, ${q(taxi.slug)}, ${q(taxi.brand)}, ${q(taxi.settings)}) on conflict (slug) do nothing;
  select id into tm from public.tenants where slug = ${q(taxi.slug)};

  insert into public.memberships (user_id, tenant_id, role) values (u, pl, 'agare'), (u, tm, 'agare') on conflict do nothing;
${lic.map(l => `  insert into public.licenses (tenant_id, module_key, variant, status, paid_by) values (tm, ${q(l.module_key)}, ${q(l.variant)}, ${q(l.status)}, tm) on conflict do nothing;`).join('\n')}
${off.map(o => `  insert into public.offers (parent_id, module_key, variant, mode, paid_by, price, auto_enable) values (tm, ${q(o.module_key)}, ${q(o.variant)}, ${q(o.mode)}, ${q(o.paid_by)}, null, ${q(o.auto_enable)}) on conflict do nothing;`).join('\n')}
  raise notice 'Klart. Logga in med % på /app/logga-in.', epost;
end $$;
`;
fs.writeFileSync(new URL('forsta-agare.sql', dir), agare);
console.log('supabase/setup.sql och supabase/forsta-agare.sql skrivna');
