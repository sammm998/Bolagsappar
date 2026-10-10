-- Vem får godkänna och publicera (öppen fråga 07). Standard enligt specen: ägare, admin och ekonomi.
-- Ett konto kan begränsa det i tenants.settings.godkannande.roller. Ägaren får alltid, läs och förare aldrig.
-- Samma regel som packages/core/src/behorighet.js.
create or replace function app.godkann_roller(t uuid) returns text[] language sql stable security definer set search_path = public as $$
  select array['agare'] || coalesce(
    (select array_agg(r) from jsonb_array_elements_text(tn.settings->'godkannande'->'roller') r where r in ('admin', 'ekonomi')),
    case when tn.settings->'godkannande'->'roller' is null then array['admin', 'ekonomi'] else array[]::text[] end)
  from public.tenants tn where tn.id = t
$$;
create or replace function app.kan_godkanna(t uuid) returns boolean language sql stable as $$
  select app.has_role(t, coalesce(app.godkann_roller(t), array['agare']))
$$;

create or replace function public.approve_period(tenant uuid, module_key text, period text)
returns void language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not app.kan_godkanna(approve_period.tenant) then raise exception 'Du har inte behörighet att godkänna'; end if;
  insert into public.periods as x (tenant_id, module_key, period, status, approved_by, approved_at)
    values (approve_period.tenant, approve_period.module_key, approve_period.period, 'godkand', auth.uid(), now())
  on conflict (tenant_id, module_key, period) do update set status = case when x.status = 'publicerad' then 'publicerad' else 'godkand' end, approved_by = auth.uid(), approved_at = now();
  insert into public.audit_log(tenant_id, actor, action, target) values (approve_period.tenant, auth.uid(), 'godkann', approve_period.module_key || ':' || approve_period.period);
end $$;

create or replace function public.publish_period(from_tenant uuid, module_key text, period text, items jsonb, reason text default null)
returns integer language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  p public.periods;
  v integer;
  it jsonb;
  n integer := 0;
begin
  if not app.kan_godkanna(publish_period.from_tenant) then
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
