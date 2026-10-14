-- ============================================================================
-- Wayio — Migración: seguridad de datos y flujos
-- (perfiles, viajes en grupo, compartir, referidos, reservas, pagos, push)
-- ----------------------------------------------------------------------------
-- Cierra los huecos de seguridad detectados en la auditoría y crea las piezas
-- que faltaban para que funcionen los flujos de grupo, compartir, referidos,
-- reservas y la sincronización offline de mobile.
--
--   A. Admin: función sin parámetros para las RLS (DA-24).
--   B. Perfiles: nadie puede cambiarse el rol ni el baneo (DA-01).
--   C. Viajes: is_public, grupo_link único y por defecto en la BD (DA-04/20).
--   D. Membresía: is_trip_member() + RLS por membresía en las tablas de grupo
--      (DA-02, M09) + el dueño entra como miembro automáticamente.
--   E. RPC join_trip (unirse por link) y get_shared_trip (vista pública).
--   F. Referidos: tabla de canjes + RPC apply_referral / my_referral_code
--      (DA-10, DA-21).
--   G. activity_states para la sync offline de mobile (DA-11, M04).
--   H. Pagos: reservations, stripe_events, CHECK de estados ampliado y
--      columna source para separar planes concedidos a mano (MON-02, DA-17,
--      MON-13).
--   I. Dispositivos: RPC register_device (DA-22).
--   J. Realtime: tablas de grupo en la publicación supabase_realtime (DA-05).
--   K. Cierre: is_admin(uuid) deja de ser ejecutable por anon/authenticated.
--
-- Idempotente: se puede correr varias veces. Válida para Postgres 15
-- (Supabase). Todo lo que hay aquí está replicado en supabase/schema.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. ADMIN SIN PARÁMETROS (DA-24)
-- ----------------------------------------------------------------------------
-- is_admin(uid uuid default auth.uid()) acepta cualquier uid y se puede llamar
-- por RPC para averiguar si OTRO usuario es admin. Las políticas RLS la usan,
-- así que no se le puede quitar el EXECUTE a anon sin romper sus consultas
-- (Postgres comprueba el permiso de la función aunque el OR no llegue a
-- evaluarla). Por eso: creamos una variante SIN parámetro que solo habla del
-- usuario actual, reescribimos todas las políticas para usarla y, al final del
-- archivo (bloque K), revocamos is_admin(uuid) a anon y authenticated.
-- Un admin baneado deja de contar como admin.
create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.profiles
     where id = auth.uid()
       and role = 'admin'
       and not is_banned
  );
$$;

revoke execute on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin()
  to anon, authenticated, service_role;

-- Nombre visible de un usuario para las tablas de grupo: el nombre completo o,
-- si no hay, la parte local del email (nunca el email completo).
create or replace function public.nombre_visible(p_full_name text, p_email text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(btrim(p_full_name), ''),
    nullif(split_part(coalesce(p_email, ''), '@', 1), ''),
    'Viajero'
  );
$$;

-- ----------------------------------------------------------------------------
-- B. PERFILES: sin escalada a admin (DA-01)
-- ----------------------------------------------------------------------------
-- Antes, profiles_update_own dejaba hacer UPDATE de cualquier columna de la
-- fila propia, incluida role → cualquiera podía hacerse admin desde el
-- navegador. Ahora:
--   1. Solo se puede actualizar full_name y avatar_url (privilegios por
--      columna). El trigger set_updated_at no necesita permiso de columna.
--   2. Un trigger de defensa en profundidad rechaza cambios de id, role,
--      is_banned, email o created_at hechos por anon/authenticated (el panel
--      admin usa la service role y no se ve afectado).
revoke update on table public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') and (
       new.id         is distinct from old.id
    or new.role       is distinct from old.role
    or new.is_banned  is distinct from old.is_banned
    or new.email      is distinct from old.email
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'No puedes modificar estos datos del perfil'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect on public.profiles;
create trigger trg_profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = (select auth.uid()) or public.current_user_is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- C. VIAJES: is_public, grupo_link y tamaño de data (DA-04, DA-20, API-04)
-- ----------------------------------------------------------------------------
-- is_public: el dueño decide si el viaje se ve en /viaje-compartido/<id>.
alter table public.trips
  add column if not exists is_public boolean not null default false;

-- grupo_link es el token de invitación: lo genera la BD (no el cliente).
alter table public.trips
  alter column grupo_link set default gen_random_uuid()::text;

-- Links vacíos o débiles: el fallback antiguo de mobile usaba Date.now(), que
-- es adivinable. Se regeneran (los links antiguos de esos viajes dejan de
-- valer, a propósito).
update public.trips
   set grupo_link = gen_random_uuid()::text
 where grupo_link is null
    or length(grupo_link) < 32;

-- Duplicados (si los hubiera) antes de crear el índice único.
with dup as (
  select id,
         row_number() over (partition by grupo_link order by created_at, id) as rn
    from public.trips
)
update public.trips t
   set grupo_link = gen_random_uuid()::text
  from dup
 where dup.id = t.id
   and dup.rn > 1;

create unique index if not exists idx_trips_grupo_link
  on public.trips (grupo_link);

-- Defensa extra contra datos basura o gigantes guardados directamente por
-- PostgREST (mobile escribe sin pasar por /api/trips). NOT VALID: no revisa
-- las filas viejas, solo las nuevas y las que se actualicen.
alter table public.trips drop constraint if exists trips_data_valida;
alter table public.trips add constraint trips_data_valida
  check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 2000000)
  not valid;

-- ----------------------------------------------------------------------------
-- D. MEMBRESÍA Y RLS DE GRUPOS (DA-02, M09)
-- ----------------------------------------------------------------------------
-- ¿El usuario actual es dueño o miembro del viaje? SECURITY DEFINER para que
-- las políticas de trip_members puedan consultar trip_members sin recursión.
-- Ejecutable por anon (devuelve false) para no romper consultas anónimas.
create or replace function public.is_trip_member(p_trip uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.trips t
       where t.id = p_trip and t.user_id = auth.uid()
    )
    or exists (
      select 1 from public.trip_members m
       where m.trip_id = p_trip and m.user_id = auth.uid()
    )
  );
$$;

revoke execute on function public.is_trip_member(uuid) from public;
grant execute on function public.is_trip_member(uuid)
  to anon, authenticated, service_role;

-- trips: el dueño hace CRUD; los miembros lo ven; admin ve todos.
drop policy if exists "trips_select" on public.trips;
drop policy if exists "trips_insert" on public.trips;
drop policy if exists "trips_update" on public.trips;
drop policy if exists "trips_delete" on public.trips;
create policy "trips_select" on public.trips
  for select using (
    user_id = (select auth.uid())
    or public.is_trip_member(id)
    or public.current_user_is_admin()
  );
create policy "trips_insert" on public.trips
  for insert with check (user_id = (select auth.uid()));
create policy "trips_update" on public.trips
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "trips_delete" on public.trips
  for delete using (user_id = (select auth.uid()));

-- El dueño entra como miembro al crear el viaje (web, mobile o lo que sea).
create or replace function public.add_trip_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trip_members (trip_id, user_id, nombre, avatar_url)
  select new.id, p.id, public.nombre_visible(p.full_name, p.email), p.avatar_url
    from public.profiles p
   where p.id = new.user_id
  on conflict (trip_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_trips_owner_member on public.trips;
create trigger trg_trips_owner_member
  after insert on public.trips
  for each row execute function public.add_trip_owner_as_member();

-- Backfill: los dueños de viajes existentes pasan a ser miembros.
insert into public.trip_members (trip_id, user_id, nombre, avatar_url)
select t.id, p.id, public.nombre_visible(p.full_name, p.email), p.avatar_url
  from public.trips t
  join public.profiles p on p.id = t.user_id
on conflict (trip_id, user_id) do nothing;

-- trip_members: sin INSERT directo (solo vía join_trip o el trigger). Cada uno
-- edita SOLO su nombre/avatar/ubicación (privilegios por columna: así nadie
-- puede mover su fila a otro trip_id y colarse en un grupo ajeno).
revoke insert, update on table public.trip_members from anon, authenticated;
grant update (nombre, avatar_url, lat_actual, lng_actual, ultima_ubicacion)
  on table public.trip_members to authenticated;

drop policy if exists "members_all"        on public.trip_members;
drop policy if exists "members_select"     on public.trip_members;
drop policy if exists "members_update_own" on public.trip_members;
drop policy if exists "members_delete"     on public.trip_members;
create policy "members_select" on public.trip_members
  for select using (
    public.is_trip_member(trip_id) or public.current_user_is_admin()
  );
create policy "members_update_own" on public.trip_members
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- Salir del grupo (fila propia) o que el dueño del viaje saque a alguien.
create policy "members_delete" on public.trip_members
  for delete using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.trips t
       where t.id = trip_members.trip_id
         and t.user_id = (select auth.uid())
    )
  );

-- activity_votes: votan los miembros, cada uno con su voto.
drop policy if exists "votes_all"    on public.activity_votes;
drop policy if exists "votes_select" on public.activity_votes;
drop policy if exists "votes_insert" on public.activity_votes;
drop policy if exists "votes_update" on public.activity_votes;
drop policy if exists "votes_delete" on public.activity_votes;
create policy "votes_select" on public.activity_votes
  for select using (
    public.is_trip_member(trip_id) or public.current_user_is_admin()
  );
create policy "votes_insert" on public.activity_votes
  for insert with check (
    user_id = (select auth.uid()) and public.is_trip_member(trip_id)
  );
create policy "votes_update" on public.activity_votes
  for update using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid()) and public.is_trip_member(trip_id)
  );
create policy "votes_delete" on public.activity_votes
  for delete using (user_id = (select auth.uid()));

-- group_messages: escriben los miembros a su nombre; sin edición; cada uno
-- borra los suyos. Los mensajes 'sistema' solo los crea el servidor.
revoke update on table public.group_messages from anon, authenticated;
drop policy if exists "messages_all"        on public.group_messages;
drop policy if exists "messages_select"     on public.group_messages;
drop policy if exists "messages_insert"     on public.group_messages;
drop policy if exists "messages_delete_own" on public.group_messages;
create policy "messages_select" on public.group_messages
  for select using (
    public.is_trip_member(trip_id) or public.current_user_is_admin()
  );
create policy "messages_insert" on public.group_messages
  for insert with check (
    user_id = (select auth.uid())
    and public.is_trip_member(trip_id)
    and tipo in ('mensaje', 'alerta')
  );
create policy "messages_delete_own" on public.group_messages
  for delete using (user_id = (select auth.uid()));

-- group_expenses: solo puedes registrar gastos que pagaste tú.
revoke update on table public.group_expenses from anon, authenticated;
drop policy if exists "expenses_all"        on public.group_expenses;
drop policy if exists "expenses_select"     on public.group_expenses;
drop policy if exists "expenses_insert"     on public.group_expenses;
drop policy if exists "expenses_delete_own" on public.group_expenses;
create policy "expenses_select" on public.group_expenses
  for select using (
    public.is_trip_member(trip_id) or public.current_user_is_admin()
  );
create policy "expenses_insert" on public.group_expenses
  for insert with check (
    pagado_por = (select auth.uid()) and public.is_trip_member(trip_id)
  );
create policy "expenses_delete_own" on public.group_expenses
  for delete using (pagado_por = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- E. RPC: unirse por link (DA-03) y vista pública (DA-04)
-- ----------------------------------------------------------------------------
-- join_trip: valida el grupo_link y da de alta al usuario actual como miembro.
-- Devuelve el id del viaje. Errores (message): not_authenticated,
-- invalid_link, trip_not_found, banned.
create or replace function public.join_trip(p_link text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_trip uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_link is null or length(btrim(p_link)) < 8 or length(p_link) > 200 then
    raise exception 'invalid_link' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and is_banned) then
    raise exception 'banned' using errcode = '42501';
  end if;

  select id into v_trip from public.trips where grupo_link = btrim(p_link);
  if v_trip is null then
    raise exception 'trip_not_found' using errcode = 'P0002';
  end if;

  insert into public.trip_members (trip_id, user_id, nombre, avatar_url)
  select v_trip, p.id, public.nombre_visible(p.full_name, p.email), p.avatar_url
    from public.profiles p
   where p.id = v_uid
  on conflict (trip_id, user_id) do nothing;

  return v_trip;
end;
$$;

revoke execute on function public.join_trip(text) from public, anon;
grant execute on function public.join_trip(text) to authenticated, service_role;

-- get_shared_trip: SOLO si el dueño marcó el viaje como público. Devuelve el
-- itinerario (data), el destino y las fechas; nunca grupo_link ni user_id.
create or replace function public.get_shared_trip(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
           'data',         t.data,
           'destino',      t.data ->> 'destino',
           'fecha_inicio', t.data ->> 'fechaInicio',
           'fecha_fin',    t.data ->> 'fechaFin'
         )
    from public.trips t
   where t.id = p_id
     and t.is_public;
$$;

revoke execute on function public.get_shared_trip(uuid) from public;
grant execute on function public.get_shared_trip(uuid)
  to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- F. REFERIDOS (DA-10, DA-21)
-- ----------------------------------------------------------------------------
-- Código determinista a partir del uid: 'WAY' + 8 hex (antes 6, con muchas
-- colisiones). Solo afecta a los códigos nuevos.
create or replace function public.gen_referral_code(uid uuid)
returns text
language sql
immutable
as $$
  select 'WAY' || upper(substr(replace(uid::text, '-', ''), 1, 8));
$$;

-- Devuelve el código del usuario y, si no tiene, lo crea. Ante una colisión
-- prueba códigos aleatorios. Único generador de códigos (el de TS se eliminó).
create or replace function public.ensure_referral_code(p_uid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  i      integer;
begin
  if p_uid is null then
    return null;
  end if;

  select code into v_code
    from public.referrals
   where user_id = p_uid
   order by created_at
   limit 1;
  if v_code is not null then
    return v_code;
  end if;

  for i in 1..6 loop
    if i = 1 then
      v_code := public.gen_referral_code(p_uid);
    else
      v_code := 'WAY' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    end if;
    begin
      insert into public.referrals (user_id, code) values (p_uid, v_code);
      return v_code;
    exception when unique_violation then
      -- colisión de código: probamos otro
    end;
  end loop;

  return null;
end;
$$;

revoke execute on function public.ensure_referral_code(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_referral_code(uuid) to service_role;

-- RPC para la app: mi código de invitación (lo crea si falta).
create or replace function public.my_referral_code()
returns text
language sql
security definer
set search_path = public
as $$
  select public.ensure_referral_code(auth.uid());
$$;

revoke execute on function public.my_referral_code() from public, anon;
grant execute on function public.my_referral_code() to authenticated, service_role;

-- Aprovisionamiento al registrarse: perfil + suscripción free + código de
-- referido. El código usa ensure_referral_code y NUNCA puede impedir el alta.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, plan_id, tier, status)
  values (new.id, 'free', 'free', 'active')
  on conflict (user_id) do nothing;

  begin
    perform public.ensure_referral_code(new.id);
  exception when others then
    null; -- el código de referido es opcional; el registro sigue adelante
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Canjes: un usuario solo puede canjear UN código (la PK lo garantiza).
create table if not exists public.referral_redemptions (
  referred_user_id uuid primary key references public.profiles(id) on delete cascade,
  referrer_id      uuid not null references public.profiles(id) on delete cascade,
  referral_id      uuid not null references public.referrals(id) on delete cascade,
  code             text not null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_redemptions_referrer
  on public.referral_redemptions (referrer_id);

alter table public.referral_redemptions enable row level security;
revoke all on table public.referral_redemptions from anon;
revoke insert, update, delete on table public.referral_redemptions from authenticated;
grant select on table public.referral_redemptions to authenticated;

drop policy if exists "redemptions_select" on public.referral_redemptions;
create policy "redemptions_select" on public.referral_redemptions
  for select using (
    referred_user_id = (select auth.uid())
    or referrer_id = (select auth.uid())
    or public.current_user_is_admin()
  );

-- referrals: el usuario ve el suyo. Sin INSERT directo (antes se podía crear
-- una fila con conversions arbitrario): los códigos los crea la BD.
drop policy if exists "referrals_select" on public.referrals;
drop policy if exists "referrals_insert" on public.referrals;
create policy "referrals_select" on public.referrals
  for select using (
    user_id = (select auth.uid()) or public.current_user_is_admin()
  );

-- apply_referral: canjea un código para el usuario actual. Devuelve:
--   ok | not_authenticated | invalid_code | self_referral | already_redeemed
--   | not_eligible (cuentas de más de 30 días: un referido es alguien nuevo).
-- El incremento de conversions es atómico (UPDATE ... + 1 en la misma
-- transacción que el canje).
create or replace function public.apply_referral(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_code    text := upper(btrim(coalesce(p_code, '')));
  v_ref     public.referrals%rowtype;
  v_created timestamptz;
begin
  if v_uid is null then
    return 'not_authenticated';
  end if;
  if length(v_code) < 4 or length(v_code) > 32 then
    return 'invalid_code';
  end if;

  select * into v_ref from public.referrals where code = v_code;
  if not found then
    return 'invalid_code';
  end if;
  if v_ref.user_id = v_uid then
    return 'self_referral';
  end if;
  -- Referido cruzado (A invita a B y B intenta "invitar" a A).
  if exists (
    select 1 from public.referral_redemptions
     where referred_user_id = v_ref.user_id and referrer_id = v_uid
  ) then
    return 'self_referral';
  end if;

  select created_at into v_created from public.profiles where id = v_uid;
  if v_created is null or v_created < now() - interval '30 days' then
    return 'not_eligible';
  end if;

  insert into public.referral_redemptions (referred_user_id, referrer_id, referral_id, code)
  values (v_uid, v_ref.user_id, v_ref.id, v_ref.code)
  on conflict (referred_user_id) do nothing;
  if not found then
    return 'already_redeemed';
  end if;

  update public.referrals
     set conversions = conversions + 1
   where id = v_ref.id;

  return 'ok';
end;
$$;

revoke execute on function public.apply_referral(text) from public, anon;
grant execute on function public.apply_referral(text) to authenticated, service_role;

-- Backfill: usuarios que se quedaron sin código por una colisión.
do $$
begin
  perform public.ensure_referral_code(p.id)
     from public.profiles p
    where not exists (select 1 from public.referrals r where r.user_id = p.id);
end;
$$;

-- ----------------------------------------------------------------------------
-- G. ESTADOS DE ACTIVIDAD (sync offline de mobile) (DA-11, M04)
-- ----------------------------------------------------------------------------
-- Una fila por (viaje, actividad, usuario): mobile hace upsert con
-- onConflict 'trip_id,activity_id,user_id'. Los miembros ven el progreso del
-- grupo; cada uno escribe solo el suyo.
create table if not exists public.activity_states (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  activity_id  text not null check (length(activity_id) between 1 and 200),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  estado       text not null
                 check (estado in ('pendiente', 'en_curso', 'completada', 'perdida', 'recuperada')),
  hora_entrada timestamptz,
  hora_salida  timestamptz,
  updated_at   timestamptz not null default now(),
  unique (trip_id, activity_id, user_id)
);

create index if not exists idx_activity_states_user
  on public.activity_states (user_id);

alter table public.activity_states enable row level security;
revoke all on table public.activity_states from anon;
grant select, insert, update, delete on table public.activity_states to authenticated;

drop policy if exists "activity_states_select" on public.activity_states;
drop policy if exists "activity_states_insert" on public.activity_states;
drop policy if exists "activity_states_update" on public.activity_states;
drop policy if exists "activity_states_delete" on public.activity_states;
create policy "activity_states_select" on public.activity_states
  for select using (
    public.is_trip_member(trip_id) or public.current_user_is_admin()
  );
create policy "activity_states_insert" on public.activity_states
  for insert with check (
    user_id = (select auth.uid()) and public.is_trip_member(trip_id)
  );
create policy "activity_states_update" on public.activity_states
  for update using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid()) and public.is_trip_member(trip_id)
  );
create policy "activity_states_delete" on public.activity_states
  for delete using (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- H. PAGOS: reservas, eventos de Stripe y suscripciones (MON-02, DA-17, MON-13)
-- ----------------------------------------------------------------------------
-- Depósitos de reserva cobrados por Stripe. Solo escribe el webhook (service
-- role); el usuario ve las suyas. amount_total va en la unidad mínima de la
-- moneda (centavos), tal como lo manda Stripe.
create table if not exists public.reservations (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  trip_id                  uuid references public.trips(id) on delete set null,
  amount_total             bigint not null default 0,
  currency                 text not null,
  stripe_session_id        text not null unique,
  stripe_payment_intent_id text,
  payment_status           text not null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

drop trigger if exists trg_reservations_updated_at on public.reservations;
create trigger trg_reservations_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

create index if not exists idx_reservations_user on public.reservations (user_id);
create index if not exists idx_reservations_trip on public.reservations (trip_id);

alter table public.reservations enable row level security;
revoke all on table public.reservations from anon;
revoke insert, update, delete on table public.reservations from authenticated;
grant select on table public.reservations to authenticated;

drop policy if exists "reservations_select_own" on public.reservations;
create policy "reservations_select_own" on public.reservations
  for select using (
    user_id = (select auth.uid()) or public.current_user_is_admin()
  );

-- Idempotencia del webhook: cada event.id de Stripe se procesa una vez.
-- RLS sin políticas = solo service role.
create table if not exists public.stripe_events (
  id           text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
revoke all on table public.stripe_events from anon, authenticated;

-- Estados de Stripe: el webhook los mapea a los 5 clásicos, pero el CHECK
-- admite también los nuevos para que una escritura directa no falle en
-- silencio (incomplete_expired, unpaid, paused).
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in (
    'active', 'canceled', 'past_due', 'trialing', 'incomplete',
    'incomplete_expired', 'unpaid', 'paused'
  ));

-- source: de dónde viene el plan. 'system' = el free del alta, 'stripe' = lo
-- pagó, 'admin' = concedido a mano desde el panel (no cuenta en el MRR).
alter table public.subscriptions
  add column if not exists source text not null default 'system';
alter table public.subscriptions drop constraint if exists subscriptions_source_check;
alter table public.subscriptions add constraint subscriptions_source_check
  check (source in ('system', 'stripe', 'admin'));

update public.subscriptions
   set source = 'stripe'
 where source = 'system'
   and (stripe_subscription_id is not null
        or (stripe_customer_id is not null and plan_id <> 'free'));
update public.subscriptions
   set source = 'admin'
 where source = 'system'
   and plan_id <> 'free'
   and stripe_subscription_id is null
   and stripe_customer_id is null;

create index if not exists idx_subs_stripe_subscription
  on public.subscriptions (stripe_subscription_id);
create index if not exists idx_subs_stripe_customer
  on public.subscriptions (stripe_customer_id);

drop policy if exists "subs_select" on public.subscriptions;
create policy "subs_select" on public.subscriptions
  for select using (
    user_id = (select auth.uid()) or public.current_user_is_admin()
  );

-- Plan efectivo del usuario actual. Las suscripciones recurrentes confían en
-- el estado de Stripe (past_due conserva el acceso mientras Stripe reintenta
-- el cobro); los planes de pago único y los concedidos con fecha caducan al
-- llegar current_period_end.
create or replace function public.my_effective_tier()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select case
             when s.status in ('active', 'trialing', 'past_due')
              and (s.stripe_subscription_id is not null
                   or s.current_period_end is null
                   or s.current_period_end > now())
             then s.tier
             else 'free'
           end
      from public.subscriptions s
     where s.user_id = auth.uid()
  ), 'free');
$$;

revoke execute on function public.my_effective_tier() from public, anon;
grant execute on function public.my_effective_tier() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- I. DISPOSITIVOS PUSH (DA-22)
-- ----------------------------------------------------------------------------
-- Si el mismo token ya era de otra cuenta (cambio de sesión en el mismo
-- teléfono), pasa a la cuenta actual en vez de fallar por RLS.
create or replace function public.register_device(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_token is null or length(btrim(p_token)) = 0 or length(p_token) > 512 then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  if p_platform is null or p_platform not in ('ios', 'android', 'web') then
    raise exception 'invalid_platform' using errcode = '22023';
  end if;

  insert into public.device_tokens (user_id, token, platform)
  values (v_uid, btrim(p_token), p_platform)
  on conflict (token) do update
     set user_id    = excluded.user_id,
         platform   = excluded.platform,
         created_at = now();
end;
$$;

revoke execute on function public.register_device(text, text) from public, anon;
grant execute on function public.register_device(text, text)
  to authenticated, service_role;

-- Misma política de siempre, con auth.uid() evaluado una vez por consulta.
drop policy if exists "devices_all" on public.device_tokens;
create policy "devices_all" on public.device_tokens
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- J. REALTIME (DA-05, M08)
-- ----------------------------------------------------------------------------
-- Sin esto, postgres_changes no emite ningún evento de las tablas de grupo.
-- Realtime respeta la política SELECT de cada tabla (membresía, bloque D).
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  -- Una publicación FOR ALL TABLES ya incluye todo y no admite ADD TABLE.
  if exists (
    select 1 from pg_publication
     where pubname = 'supabase_realtime' and puballtables
  ) then
    return;
  end if;

  foreach t in array array['trip_members', 'group_messages', 'activity_votes', 'group_expenses']
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- K. CIERRE: is_admin(uuid) fuera del alcance de anon/authenticated (DA-24)
-- ----------------------------------------------------------------------------
-- Ninguna política la usa ya (todas usan current_user_is_admin()). Se conserva
-- para scripts/SQL del dueño y la service role.
revoke execute on function public.is_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_admin(uuid) to service_role;

-- Que PostgREST vea ya las funciones y columnas nuevas.
notify pgrst, 'reload schema';
