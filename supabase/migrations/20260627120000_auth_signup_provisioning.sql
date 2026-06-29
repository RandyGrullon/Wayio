-- ============================================================================
-- Wayio — Migración: aprovisionamiento al registrarse (login/register)
-- ----------------------------------------------------------------------------
-- Extiende handle_new_user para que, al crear la cuenta (web o mobile), el
-- usuario quede listo de inmediato:
--   1. profiles  → ya lo hacía la migración inicial.
--   2. subscriptions → fila 'free' (evita el SELECT vacío en AuthContext).
--   3. referrals → un código único para invitar amigos desde el primer día.
--
-- Idempotente: se puede correr varias veces. No toca usuarios existentes salvo
-- el backfill final, que solo rellena lo que falte (on conflict do nothing).
-- ============================================================================

-- Genera un código de referido corto y legible a partir del uid.
create or replace function public.gen_referral_code(uid uuid)
returns text
language sql
immutable
as $$
  select 'WAY' || upper(substr(replace(uid::text, '-', ''), 1, 6));
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Perfil (espejo de auth.users)
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  -- 2. Suscripción gratuita por defecto
  insert into public.subscriptions (user_id, plan_id, tier, status)
  values (new.id, 'free', 'free', 'active')
  on conflict (user_id) do nothing;

  -- 3. Código de referido propio
  insert into public.referrals (user_id, code)
  values (new.id, public.gen_referral_code(new.id))
  on conflict (code) do nothing;

  return new;
end;
$$;

-- El trigger ya existe (migración inicial); recrearlo es inocuo y garantiza
-- que apunte a la versión nueva de la función.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Backfill: usuarios que ya existían se quedan con suscripción + referido.
-- ----------------------------------------------------------------------------
insert into public.subscriptions (user_id, plan_id, tier, status)
select id, 'free', 'free', 'active'
from public.profiles
on conflict (user_id) do nothing;

insert into public.referrals (user_id, code)
select id, public.gen_referral_code(id)
from public.profiles
on conflict (code) do nothing;
