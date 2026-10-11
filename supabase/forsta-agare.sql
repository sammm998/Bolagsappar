-- Genererad av scripts/gen-setup-sql.mjs. Kör efter setup.sql.
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

  insert into public.tenants (type, name, slug, brand, settings) values ('platform', 'Bolagsappar', 'admin', '{"initialer":"BA","accent":"#0E1E35","text":"#FFFFFF"}'::jsonb, '{}'::jsonb) on conflict (slug) do nothing;
  select id into pl from public.tenants where slug = 'admin';
  insert into public.tenants (type, name, slug, brand, settings) values ('main', 'Taxi Malmö', 'taxi-malmo', '{"initialer":"TM","accent":"#F5B301","text":"#0E1E35","akarOrd":"åkare"}'::jsonb, '{"centralNamn":"Taxi Malmö AB","ort":"Malmö","utbDag":5,"kontakt":"040-911 911"}'::jsonb) on conflict (slug) do nothing;
  select id into tm from public.tenants where slug = 'taxi-malmo';

  insert into public.memberships (user_id, tenant_id, role) values (u, pl, 'agare'), (u, tm, 'agare') on conflict do nothing;
  insert into public.licenses (tenant_id, module_key, variant, status, paid_by) values (tm, 'avrakning', 'main', 'aktiv', tm) on conflict do nothing;
  insert into public.licenses (tenant_id, module_key, variant, status, paid_by) values (tm, 'forarlista', 'main', 'aktiv', tm) on conflict do nothing;
  insert into public.offers (parent_id, module_key, variant, mode, paid_by, price, auto_enable) values (tm, 'avrakning', 'sub', 'ingar', 'parent', null, true) on conflict do nothing;
  insert into public.offers (parent_id, module_key, variant, mode, paid_by, price, auto_enable) values (tm, 'kassan', 'sub', 'tillval', 'self', null, false) on conflict do nothing;
  insert into public.offers (parent_id, module_key, variant, mode, paid_by, price, auto_enable) values (tm, 'forarlista', 'sub', 'ingar', 'parent', null, true) on conflict do nothing;
  insert into public.offers (parent_id, module_key, variant, mode, paid_by, price, auto_enable) values (tm, 'skadeflode', 'sub', 'av', 'self', null, false) on conflict do nothing;
  raise notice 'Klart. Logga in med % på /app/logga-in.', epost;
end $$;
