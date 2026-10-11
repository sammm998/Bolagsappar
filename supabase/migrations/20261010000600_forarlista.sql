-- Förarlistan delas till åkarna och live-uppdateringar.
-- 1. share_list: huvudkunden delar en lista (i dag bara förarlistan) till sina åkare. Ingen månad att godkänna,
--    varje inläsning blir en ny version. Avräkningar går aldrig den här vägen, de kräver godkännande.
-- 2. Tabellerna som skärmarna lyssnar på läggs i supabase_realtime, så ändringar syns direkt hos andra
--    inloggade. RLS gäller även här: ingen får en händelse för en rad den inte får läsa.

create or replace function public.share_list(from_tenant uuid, module_key text, kind text, items jsonb)
returns integer language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  it jsonb;
  n integer := 0;
  per text := to_char(now() at time zone 'Europe/Stockholm', 'YYYY-MM');
  v integer;
begin
  if share_list.module_key not in ('forarlista') then
    raise exception 'Den här appen delas bara via godkännandet';
  end if;
  if not app.can_write(share_list.from_tenant) then
    raise exception 'Du har inte behörighet att dela';
  end if;
  for it in select * from jsonb_array_elements(share_list.items) loop
    if app.parent_of((it->>'to')::uuid) is distinct from share_list.from_tenant then
      raise exception 'Mottagaren är inte en underkund till kontot';
    end if;
    select coalesce(max(s.version), 0) + 1 into v from public.shares s
      where s.from_tenant = share_list.from_tenant and s.to_tenant = (it->>'to')::uuid
        and s.module_key = share_list.module_key and s.period = per and s.kind = share_list.kind;
    insert into public.shares(from_tenant, to_tenant, module_key, period, kind, payload, version)
      values (share_list.from_tenant, (it->>'to')::uuid, share_list.module_key, per, share_list.kind, it->'payload', v);
    n := n + 1;
  end loop;
  insert into public.audit_log(tenant_id, actor, action, target, detail)
    values (share_list.from_tenant, auth.uid(), 'dela', share_list.module_key, jsonb_build_object('mottagare', n));
  return n;
end $$;
revoke all on function public.share_list from public, anon;
grant execute on function public.share_list to authenticated;

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['documents', 'periods', 'shares', 'notifications', 'licenses', 'memberships', 'file_runs'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
