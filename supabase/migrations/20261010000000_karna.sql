-- Bolagsappar, kärnan. Supabase (Postgres) i EU.
-- Fyra regler för data:
--  1. Varje rad har tenant_id. Radsäkerhet stoppar allt annat.
--  2. Huvudkunden publicerar data nedåt. Underkunden får en kopia i sitt eget konto (shares).
--  3. Underkundens lön, personal och bokföring syns aldrig uppåt.
--  4. Bolagsappars supportinloggning kräver kundens godkännande och loggas synligt.

create extension if not exists pgcrypto;
create schema if not exists app;

-- ---------------------------------------------------------------- tabeller
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.tenants(id) on delete restrict,
  type text not null check (type in ('platform', 'main', 'sub', 'direct')),
  name text not null,
  slug text not null unique,
  org_nr text,
  brand jsonb not null default '{}'::jsonb,       -- { logo, accent, initialer }
  domain text,
  settings jsonb not null default '{}'::jsonb,    -- t.ex. utbetalningsdag, ort
  created_at timestamptz not null default now(),
  constraint sub_har_foralder check ((type = 'sub') = (parent_id is not null) or type = 'platform'),
  constraint direct_utan_foralder check (type <> 'direct' or parent_id is null)
);
create index on public.tenants(parent_id);

create table public.users (
  id uuid primary key,                            -- = auth.users.id
  name text not null default '',
  email text not null unique,
  phone text,
  bankid_subject text,                            -- hash, används inte (inloggning med e-postlänk)
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid not null references public.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null check (role in ('agare', 'admin', 'ekonomi', 'forare', 'las')),
  forare_id text,                                 -- förarnummer i Megtax för rollen förare
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);
create index on public.memberships(tenant_id);

create table public.modules (
  key text primary key,
  name text not null,
  version text not null,
  manifest jsonb not null default '{}'::jsonb
);

create table public.licenses (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_key text not null references public.modules(key),
  variant text not null check (variant in ('main', 'sub', 'direct')),
  status text not null default 'aktiv' check (status in ('aktiv', 'av', 'kommer')),
  paid_by uuid references public.tenants(id),
  price numeric,
  started_at date not null default current_date,
  ends_at date,
  primary key (tenant_id, module_key)
);

create table public.offers (
  parent_id uuid not null references public.tenants(id) on delete cascade,
  module_key text not null references public.modules(key),
  variant text not null default 'sub',
  mode text not null default 'av' check (mode in ('ingar', 'tillval', 'av')),
  paid_by text not null default 'parent' check (paid_by in ('parent', 'self')),
  price numeric,
  auto_enable boolean not null default false,
  valid_from date,
  primary key (parent_id, module_key)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.tenants(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,  -- skapas direkt som underkund
  org_nr text,
  name text,
  email text not null,
  modules text[] not null default '{}',
  status text not null default 'skickad' check (status in ('skickad', 'accepterad', 'aterkallad', 'utgangen')),
  token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);

-- Ersätter claude.ai:s databas med samma gränssnitt (doc/collection) som claude-shim.js.
create table public.documents (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_key text not null,
  path text not null,
  data jsonb not null,
  version integer not null default 1,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, module_key, path)
);
create index documents_prefix on public.documents(tenant_id, module_key, path text_pattern_ops);

create table public.periods (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_key text not null,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  status text not null default 'oppen' check (status in ('oppen', 'godkand', 'publicerad')),
  version integer not null default 1,
  approved_by uuid, approved_at timestamptz,
  published_by uuid, published_at timestamptz,
  primary key (tenant_id, module_key, period)
);

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  from_tenant uuid not null references public.tenants(id) on delete cascade,
  to_tenant uuid not null references public.tenants(id) on delete cascade,
  module_key text not null,
  period text not null,
  kind text not null,
  payload jsonb not null,
  version integer not null default 1,
  reason text,                                    -- rättelse: ny version med orsak
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  unique (from_tenant, to_tenant, module_key, period, kind, version)
);
create index on public.shares(to_tenant, module_key, period);

create table public.file_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_key text not null,
  period text,
  kind text not null,
  filename text not null,
  sha256 text not null,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.file_runs(tenant_id, module_key, period);

create table public.guide_progress (
  user_id uuid not null references public.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_key text not null,
  step_key text not null,
  done_at timestamptz not null default now(),
  primary key (user_id, tenant_id, module_key, step_key)
);

create table public.audit_log (
  id bigserial primary key,
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor uuid,
  action text not null,
  target text,
  detail jsonb,
  via_support boolean not null default false,
  at timestamptz not null default now()
);
create index on public.audit_log(tenant_id, at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,  -- null = alla i kontot
  title text not null,
  body text,
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on public.notifications(tenant_id, created_at desc);

create table public.support_access (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  granted_by uuid not null,
  granted_until timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, granted_until)
);

-- Skatter och avgifter med giltighetsdatum (inte i koden)
create table public.tax_rates (
  id bigserial primary key,
  kind text not null check (kind in ('avgifter', 'moms')),
  valid_from text not null,
  valid_to text,
  data jsonb not null
);

-- Hemsidans formulär "Boka en arbetsdag"
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  bransch text, foretag text not null, namn text not null, telefon text, epost text, fritext text, dag date,
  created_at timestamptz not null default now(),
  status text not null default 'ny'
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subject text not null,
  status text not null default 'ny' check (status in ('ny', 'vantar', 'lost')),
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- hjälpfunktioner
-- security definer så att policies inte rekurserar via memberships
create or replace function app.my_tenants() returns setof uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.memberships where user_id = auth.uid()
$$;
create or replace function app.my_role(t uuid) returns text language sql stable security definer set search_path = public as $$
  select role from public.memberships where user_id = auth.uid() and tenant_id = t
$$;
create or replace function app.has_role(t uuid, roles text[]) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where user_id = auth.uid() and tenant_id = t and role = any(roles))
$$;
create or replace function app.is_platform() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m join public.tenants t on t.id = m.tenant_id
                 where m.user_id = auth.uid() and t.type = 'platform' and m.role in ('agare', 'admin'))
$$;
-- Supportinloggning: bara när kunden har godkänt och tiden inte har gått ut
create or replace function app.support_granted(t uuid) returns boolean language sql stable security definer set search_path = public as $$
  select app.is_platform() and exists (select 1 from public.support_access s where s.tenant_id = t and s.granted_until > now())
$$;
create or replace function app.parent_of(t uuid) returns uuid language sql stable security definer set search_path = public as $$
  select parent_id from public.tenants where id = t
$$;
-- Konton jag får läsa i: egna, eller med godkänd support
create or replace function app.can_read(t uuid) returns boolean language sql stable as $$
  select t in (select app.my_tenants()) or app.support_granted(t)
$$;
create or replace function app.can_write(t uuid) returns boolean language sql stable as $$
  select app.has_role(t, array['agare', 'admin', 'ekonomi']) or app.support_granted(t)
$$;

-- ---------------------------------------------------------------- radsäkerhet
alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.memberships enable row level security;
alter table public.modules enable row level security;
alter table public.licenses enable row level security;
alter table public.offers enable row level security;
alter table public.invites enable row level security;
alter table public.documents enable row level security;
alter table public.periods enable row level security;
alter table public.shares enable row level security;
alter table public.file_runs enable row level security;
alter table public.guide_progress enable row level security;
alter table public.audit_log enable row level security;
alter table public.notifications enable row level security;
alter table public.support_access enable row level security;
alter table public.tax_rates enable row level security;
alter table public.bookings enable row level security;
alter table public.support_tickets enable row level security;

-- tenants: egna konton, mina underkunder (namn, org.nr), min förälder (namn) och plattformen ser alla
create policy "tenants läs" on public.tenants for select using (
  id in (select app.my_tenants())
  or parent_id in (select app.my_tenants())
  or id in (select app.parent_of(x) from app.my_tenants() x)
  or app.is_platform()
);
create policy "tenants ändra" on public.tenants for update using (app.has_role(id, array['agare', 'admin']) or app.is_platform());
create policy "tenants skapa" on public.tenants for insert with check (app.is_platform());

-- users: jag själv, och användare i mina konton (för listor över användare)
create policy "users läs" on public.users for select using (
  id = auth.uid() or id in (select m.user_id from public.memberships m where m.tenant_id in (select app.my_tenants())) or app.is_platform()
);
create policy "users ändra själv" on public.users for update using (id = auth.uid());

-- memberships: mina egna, alla i konton där jag är ägare eller admin
create policy "memberships läs" on public.memberships for select using (
  user_id = auth.uid() or app.has_role(tenant_id, array['agare', 'admin']) or app.is_platform()
);
create policy "memberships hantera" on public.memberships for all using (app.has_role(tenant_id, array['agare', 'admin']) or app.is_platform())
  with check (app.has_role(tenant_id, array['agare', 'admin']) or app.is_platform());

create policy "modules läs" on public.modules for select using (true);
create policy "modules hantera" on public.modules for all using (app.is_platform()) with check (app.is_platform());

-- licenses: eget konto, föräldern ser vilka appar som är aktiva hos underkunden
create policy "licenses läs" on public.licenses for select using (
  app.can_read(tenant_id) or app.parent_of(tenant_id) in (select app.my_tenants()) or app.is_platform()
);
create policy "licenses hantera" on public.licenses for all using (
  app.has_role(tenant_id, array['agare', 'admin']) or app.has_role(app.parent_of(tenant_id), array['agare', 'admin', 'ekonomi']) or app.is_platform()
) with check (
  app.has_role(tenant_id, array['agare', 'admin']) or app.has_role(app.parent_of(tenant_id), array['agare', 'admin', 'ekonomi']) or app.is_platform()
);

-- offers: föräldern hanterar, underkunderna läser sin förälders erbjudanden
create policy "offers läs" on public.offers for select using (
  parent_id in (select app.my_tenants()) or parent_id in (select app.parent_of(x) from app.my_tenants() x) or app.is_platform()
);
create policy "offers hantera" on public.offers for all using (app.has_role(parent_id, array['agare', 'admin', 'ekonomi']))
  with check (app.has_role(parent_id, array['agare', 'admin', 'ekonomi']));

create policy "invites läs" on public.invites for select using (app.can_read(parent_id) or app.is_platform());
create policy "invites hantera" on public.invites for all using (app.can_write(parent_id)) with check (app.can_write(parent_id));

-- documents: bara det egna kontot (regel 1 och 3). Förare och läs kan inte skriva.
create policy "eget konto" on public.documents for select using (app.can_read(tenant_id));
create policy "eget konto skriv" on public.documents for insert with check (app.can_write(tenant_id));
create policy "eget konto ändra" on public.documents for update using (app.can_write(tenant_id)) with check (app.can_write(tenant_id));
create policy "eget konto ta bort" on public.documents for delete using (app.can_write(tenant_id));

create policy "periods läs" on public.periods for select using (app.can_read(tenant_id));
create policy "periods skriv" on public.periods for all using (app.can_write(tenant_id)) with check (app.can_write(tenant_id));

-- shares: underkunden läser bara det som publicerats till just den (regel 2)
create policy "publicerat till mig" on public.shares for select using (
  to_tenant in (select app.my_tenants()) or from_tenant in (select app.my_tenants())
);
-- Publicering sker via app.publish_period (security definer). Underkunden får markera som öppnad.
create policy "öppnad" on public.shares for update using (to_tenant in (select app.my_tenants())) with check (to_tenant in (select app.my_tenants()));

create policy "file_runs läs" on public.file_runs for select using (app.can_read(tenant_id));
create policy "file_runs skriv" on public.file_runs for insert with check (app.can_write(tenant_id));

create policy "guide egen" on public.guide_progress for all using (user_id = auth.uid() and tenant_id in (select app.my_tenants()))
  with check (user_id = auth.uid() and tenant_id in (select app.my_tenants()));
create policy "guide statistik" on public.guide_progress for select using (app.is_platform());

create policy "audit läs" on public.audit_log for select using (app.has_role(tenant_id, array['agare', 'admin']) or app.is_platform());
create policy "audit skriv" on public.audit_log for insert with check (tenant_id in (select app.my_tenants()) or app.is_platform());

create policy "notiser läs" on public.notifications for select using (tenant_id in (select app.my_tenants()) and (user_id is null or user_id = auth.uid()));
create policy "notiser läst" on public.notifications for update using (tenant_id in (select app.my_tenants()) and (user_id is null or user_id = auth.uid()));

create policy "support läs" on public.support_access for select using (tenant_id in (select app.my_tenants()) or app.is_platform());
create policy "support godkänn" on public.support_access for insert with check (app.has_role(tenant_id, array['agare', 'admin']));
create policy "support återkalla" on public.support_access for delete using (app.has_role(tenant_id, array['agare', 'admin']));

create policy "skatter läs" on public.tax_rates for select using (true);
create policy "skatter hantera" on public.tax_rates for all using (app.is_platform()) with check (app.is_platform());

create policy "bokning skapa" on public.bookings for insert with check (true);
create policy "bokning läs" on public.bookings for select using (app.is_platform());

create policy "ärenden läs" on public.support_tickets for select using (tenant_id in (select app.my_tenants()) or app.is_platform());
create policy "ärenden skapa" on public.support_tickets for insert with check (tenant_id in (select app.my_tenants()));
create policy "ärenden ändra" on public.support_tickets for update using (app.is_platform());

-- ---------------------------------------------------------------- funktioner
-- Supportinloggning loggas synligt i kundens granskningslogg (regel 4)
create or replace function app.log_support() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if app.is_platform() and not (new.tenant_id in (select app.my_tenants())) then
    insert into public.audit_log(tenant_id, actor, action, target, via_support) values (new.tenant_id, auth.uid(), tg_op, tg_table_name || ':' || coalesce(new.path, ''), true);
  end if;
  return new;
end $$;
create trigger documents_support after insert or update on public.documents for each row execute function app.log_support();

-- En publicerad avräkning kan inte ändras. Rättelser publiceras som ny version med orsak.
create or replace function app.shares_lock() returns trigger language plpgsql as $$
begin
  if (new.payload is distinct from old.payload) or (new.version <> old.version) or (new.from_tenant <> old.from_tenant) or (new.to_tenant <> old.to_tenant) then
    raise exception 'En publicerad avräkning kan inte ändras. Publicera en ny version med orsak.';
  end if;
  return new;
end $$;
create trigger shares_lock before update on public.shares for each row execute function app.shares_lock();

/*
  Publicera en period till underkunderna. items: [{ "to": uuid, "kind": text, "payload": jsonb, "title": text, "body": text }]
  Kräver rollen ägare, admin eller ekonomi i från-kontot, att varje mottagare är en underkund och att perioden är godkänd.
  En ny publicering av samma period kräver orsak och blir en ny version.
*/
create or replace function public.publish_period(from_tenant uuid, module_key text, period text, items jsonb, reason text default null)
returns integer language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  p public.periods;
  v integer;
  it jsonb;
  n integer := 0;
begin
  if not app.has_role(publish_period.from_tenant, array['agare', 'admin', 'ekonomi']) then
    raise exception 'Du har inte behörighet att publicera';
  end if;
  select * into p from public.periods x
    where x.tenant_id = publish_period.from_tenant and x.module_key = publish_period.module_key and x.period = publish_period.period for update;
  if p is null or p.status = 'oppen' then
    raise exception 'Månaden måste godkännas innan den publiceras';
  end if;
  if p.status = 'publicerad' and coalesce(trim(publish_period.reason), '') = '' then
    raise exception 'Månaden är redan publicerad. En rättelse kräver en orsak.';
  end if;
  v := case when p.status = 'publicerad' then p.version + 1 else p.version end;
  for it in select * from jsonb_array_elements(publish_period.items) loop
    if app.parent_of((it->>'to')::uuid) is distinct from publish_period.from_tenant then
      raise exception 'Mottagaren är inte en underkund till kontot';
    end if;
    insert into public.shares(from_tenant, to_tenant, module_key, period, kind, payload, version, reason)
      values (publish_period.from_tenant, (it->>'to')::uuid, publish_period.module_key, publish_period.period, it->>'kind', it->'payload', v, publish_period.reason);
    if it ? 'title' then
      insert into public.notifications(tenant_id, title, body, link) values ((it->>'to')::uuid, it->>'title', it->>'body', it->>'link');
    end if;
    n := n + 1;
  end loop;
  update public.periods x set status = 'publicerad', version = v, published_by = auth.uid(), published_at = now()
    where x.tenant_id = publish_period.from_tenant and x.module_key = publish_period.module_key and x.period = publish_period.period;
  insert into public.audit_log(tenant_id, actor, action, target, detail)
    values (publish_period.from_tenant, auth.uid(), 'publicera', publish_period.module_key || ':' || publish_period.period, jsonb_build_object('mottagare', n, 'version', v, 'orsak', publish_period.reason));
  return n;
end $$;

-- Godkänn månaden (låser den). Bara ägare, admin eller ekonomi.
create or replace function public.approve_period(tenant uuid, module_key text, period text)
returns void language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not app.has_role(approve_period.tenant, array['agare', 'admin', 'ekonomi']) then raise exception 'Du har inte behörighet att godkänna'; end if;
  insert into public.periods as x (tenant_id, module_key, period, status, approved_by, approved_at)
    values (approve_period.tenant, approve_period.module_key, approve_period.period, 'godkand', auth.uid(), now())
  on conflict (tenant_id, module_key, period) do update set status = case when x.status = 'publicerad' then 'publicerad' else 'godkand' end, approved_by = auth.uid(), approved_at = now();
  insert into public.audit_log(tenant_id, actor, action, target) values (approve_period.tenant, auth.uid(), 'godkann', approve_period.module_key || ':' || approve_period.period);
end $$;

-- Acceptera en inbjudan: skapar medlemskap i underkundens konto för den inloggade
create or replace function public.accept_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare i public.invites; t uuid;
begin
  select * into i from public.invites where token = invite_token and status = 'skickad' and expires_at > now();
  if i is null then raise exception 'Inbjudan finns inte eller har gått ut'; end if;
  t := i.tenant_id;
  if t is null then
    insert into public.tenants(parent_id, type, name, slug, org_nr) values (i.parent_id, 'sub', coalesce(i.name, i.email), lower(regexp_replace(coalesce(i.name, i.email), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(i.id::text, 1, 4), i.org_nr) returning id into t;
  end if;
  insert into public.memberships(user_id, tenant_id, role) values (auth.uid(), t, 'agare') on conflict do nothing;
  update public.invites set status = 'accepterad', tenant_id = t where id = i.id;
  insert into public.audit_log(tenant_id, actor, action, target) values (t, auth.uid(), 'inbjudan accepterad', i.id::text);
  return t;
end $$;

-- Det huvudkunden ser om en åkare: namn, org.nr, bilar, aktiva appar, senaste inloggning och om publicerad avräkning är öppnad. Inget mer.
create or replace function public.network_overview(parent uuid, module_key text default 'avrakning', period text default null)
returns table (tenant_id uuid, name text, org_nr text, owner_name text, apps text[], last_login timestamptz, opened_at timestamptz, invited boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.org_nr,
    (select u.name from public.memberships m join public.users u on u.id = m.user_id where m.tenant_id = t.id and m.role = 'agare' limit 1),
    coalesce((select array_agg(l.module_key order by l.module_key) from public.licenses l where l.tenant_id = t.id and l.status = 'aktiv'), '{}'),
    (select max(u.last_login_at) from public.memberships m join public.users u on u.id = m.user_id where m.tenant_id = t.id),
    (select max(s.opened_at) from public.shares s where s.to_tenant = t.id and s.from_tenant = parent and s.module_key = network_overview.module_key and (network_overview.period is null or s.period = network_overview.period)),
    not exists (select 1 from public.memberships m where m.tenant_id = t.id)
  from public.tenants t
  where t.parent_id = parent and app.has_role(parent, array['agare', 'admin', 'ekonomi', 'las'])
  order by t.name
$$;

-- ---------------------------------------------------------------- rättigheter
grant usage on schema public, app to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant insert on public.bookings to anon;
grant select on public.modules, public.tax_rates to anon;
grant execute on all functions in schema app to authenticated;
grant execute on function public.publish_period, public.approve_period, public.accept_invite, public.network_overview to authenticated;
