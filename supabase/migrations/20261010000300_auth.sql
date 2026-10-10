-- Inloggning med e-postlänk (ingen BankID). En rad i public.users skapas när någon loggar in första gången
-- eller bjuds in. Namnet kommer från inbjudan (raw_user_meta_data.name).
create or replace function app.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, name)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function app.handle_new_user();

-- Senaste inloggning visas för huvudkunden under Åkare (aktiva senaste 30 dagarna).
create or replace function app.handle_login() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.users set last_login_at = new.last_sign_in_at where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_login on auth.users;
create trigger on_auth_user_login after update on auth.users for each row execute function app.handle_login();
