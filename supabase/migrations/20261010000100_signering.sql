-- Signering med pennan. Föraren får inte skriva i kontots dokument (radsäkerheten), men får signera
-- sitt eget anställningsavtal. Texten och kontrollsumman kan inte ändras här, bara underskriften läggs till.
create or replace function public.sign_agreement(tenant uuid, path text, sign jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  m public.memberships;
  d public.documents;
  vs jsonb;
  last jsonb;
  role text;
begin
  select * into m from public.memberships where user_id = auth.uid() and tenant_id = sign_agreement.tenant;
  if m is null then raise exception 'Du har inte behörighet'; end if;
  if m.role = 'forare' then
    if sign_agreement.path not in ('avtal-' || m.forare_id, 'avtal-tp:' || m.forare_id) then raise exception 'Du kan bara signera ditt eget avtal'; end if;
    role := 'anst';
  elsif m.role in ('agare', 'admin') then
    role := 'arbg';
  else
    raise exception 'Du har inte behörighet att signera';
  end if;
  select * into d from public.documents where tenant_id = sign_agreement.tenant and module_key = 'kassan' and path = sign_agreement.path for update;
  if d is null then raise exception 'Avtalet finns inte'; end if;
  vs := d.data->'versioner';
  last := vs->(jsonb_array_length(vs) - 1);
  if last->'sign' ? role then raise exception 'Avtalet är redan signerat'; end if;
  if role = 'arbg' and not (last->'sign' ? 'anst') then raise exception 'Arbetstagaren signerar först'; end if;
  if coalesce(trim(sign->>'namn'), '') = '' or coalesce(sign->>'png', '') = '' then raise exception 'Underskrift och namn krävs'; end if;
  last := jsonb_set(last, array['sign', role], jsonb_build_object('namn', sign->>'namn', 'ort', sign->>'ort', 'tid', now(), 'png', sign->>'png', 'ua', left(coalesce(sign->>'ua', ''), 120)));
  vs := jsonb_set(vs, array[(jsonb_array_length(vs) - 1)::text], last);
  update public.documents set data = jsonb_set(d.data, '{versioner}', vs), version = d.version + 1, updated_by = auth.uid(), updated_at = now()
    where tenant_id = d.tenant_id and module_key = d.module_key and path = d.path;
  insert into public.audit_log(tenant_id, actor, action, target) values (sign_agreement.tenant, auth.uid(), 'signera avtal', sign_agreement.path || ':' || role);
  return last;
end $$;
grant execute on function public.sign_agreement to authenticated;
