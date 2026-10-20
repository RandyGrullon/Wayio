-- ============================================================================
-- Wayio — Esquema completo de base de datos (Supabase / PostgreSQL 15)
-- ============================================================================
-- Pega TODO este archivo en Supabase → SQL Editor → Run.
-- Es idempotente: se puede correr varias veces sin romper nada, tanto en un
-- proyecto vacío como en uno que ya tenía una versión anterior del esquema.
--
-- Es la fuente completa: equivale a aplicar, en orden, todas las migraciones
-- de supabase/migrations (la última: 20261017130000_cupos_y_rentabilidad.sql).
--
-- Incluye:
--   1. Tablas de la app (perfiles, viajes, grupos, suscripciones, referidos,
--      reservas, estados de actividad, cupos mensuales, caché)
--   2. Tablas del panel de administración (logs de IA, feature flags,
--      anuncios, tokens de push, auditoría, settings públicos y privados)
--   3. Funciones y RPC (membresía, unirse por link, vista pública, referidos,
--      dispositivos, plan efectivo, gasto diario de IA, cupos del plan
--      Gratis), triggers e índices
--   4. Privilegios por columna + RLS (row level security) por membresía
--   5. Publicación de Realtime para las tablas de grupo
--   6. Seed y backfills
--
-- Al final hay una línea comentada para convertirte en admin.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 0. FUNCIONES AUXILIARES SIN DEPENDENCIAS
-- ----------------------------------------------------------------------------

-- Mantiene updated_at al día
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

-- Código de referido determinista a partir del uid: 'WAY' + 8 hex.
create or replace function public.gen_referral_code(uid uuid)
returns text
language sql
immutable
as $$
  select 'WAY' || upper(substr(replace(uid::text, '-', ''), 1, 8));
$$;

-- ----------------------------------------------------------------------------
-- 1. PERFILES (espejo de auth.users con rol de admin)
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  is_banned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Defensa en profundidad (DA-01): anon/authenticated nunca pueden cambiar id,
-- role, is_banned, email ni created_at, aunque alguien vuelva a abrir los
-- privilegios por error. El panel admin usa la service role y no se ve
-- afectado.
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

-- LEGADO: ¿el usuario dado es admin? Acepta cualquier uid, así que ya NO se
-- usa en RLS y anon/authenticated no la pueden ejecutar (final de la sección
-- 10). Se conserva para scripts del dueño y la service role.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'admin'
  );
$$;

-- ¿El usuario ACTUAL es admin? Sin parámetros: es la que usan todas las RLS.
-- Ejecutable por anon (devuelve false). Un admin baneado deja de serlo.
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

-- ----------------------------------------------------------------------------
-- 2. VIAJES
-- ----------------------------------------------------------------------------

create table if not exists public.trips (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles(id) on delete cascade,
  data                   jsonb not null,
  paquete                text not null check (paquete in ('basico', 'confort', 'premium')),
  -- Token de invitación al grupo: lo genera la BD (único, ver índices)
  grupo_link             text default gen_random_uuid()::text,
  -- El dueño decide si el viaje se ve en /viaje-compartido/<id>
  is_public              boolean not null default false,
  estado                 text not null default 'planificando'
                           check (estado in ('planificando', 'en_viaje', 'completado')),
  actividades_pendientes jsonb not null default '[]'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Proyectos con una versión anterior del esquema
alter table public.trips
  add column if not exists is_public boolean not null default false;
alter table public.trips
  alter column grupo_link set default gen_random_uuid()::text;

drop trigger if exists trg_trips_updated_at on public.trips;
create trigger trg_trips_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- Links vacíos o débiles (el fallback antiguo de mobile usaba Date.now(), que
-- es adivinable) y duplicados: se regeneran antes del índice único.
update public.trips
   set grupo_link = gen_random_uuid()::text
 where grupo_link is null
    or length(grupo_link) < 32;

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

-- Defensa extra contra datos basura o gigantes guardados directamente por
-- PostgREST. NOT VALID: no revisa filas viejas, solo nuevas y actualizadas.
alter table public.trips drop constraint if exists trips_data_valida;
alter table public.trips add constraint trips_data_valida
  check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 2000000)
  not valid;

-- Caché de generación (la usa el route /api/generate con service role)
create table if not exists public.trip_cache (
  key        text primary key,
  data       text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. GRUPOS (miembros, mensajes, gastos, votos) Y ESTADOS DE ACTIVIDAD
-- ----------------------------------------------------------------------------

create table if not exists public.trip_members (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references public.trips(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  nombre            text not null,
  avatar_url        text,
  lat_actual        double precision,
  lng_actual        double precision,
  ultima_ubicacion  timestamptz,
  joined_at         timestamptz not null default now(),
  unique (trip_id, user_id)
);

create table if not exists public.activity_votes (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  activity_id text not null,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  voto        boolean not null,
  created_at  timestamptz not null default now(),
  unique (trip_id, activity_id, user_id)
);

create table if not exists public.group_messages (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  nombre_usuario text not null,
  mensaje        text not null,
  tipo           text not null default 'mensaje' check (tipo in ('mensaje', 'sistema', 'alerta')),
  created_at     timestamptz not null default now()
);

create table if not exists public.group_expenses (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips(id) on delete cascade,
  pagado_por     uuid not null references public.profiles(id) on delete cascade,
  nombre_pagador text not null,
  concepto       text not null,
  monto          numeric(12, 2) not null,
  entre_todos    boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Estado de cada actividad por usuario (sync offline de mobile, geofencing).
-- Mobile hace upsert con onConflict 'trip_id,activity_id,user_id'.
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

-- ----------------------------------------------------------------------------
-- 4. SUSCRIPCIONES, PAGOS Y REFERIDOS
-- ----------------------------------------------------------------------------

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references public.profiles(id) on delete cascade,
  plan_id                text not null default 'free',
  tier                   text not null default 'free' check (tier in ('free', 'pro', 'grupo')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  stripe_price_id        text,
  status                 text not null default 'active',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  -- 'system' = free del alta, 'stripe' = pagado, 'admin' = concedido a mano
  source                 text not null default 'system',
  created_at             timestamptz not null default now()
);

alter table public.subscriptions
  add column if not exists source text not null default 'system';

-- Estados: el webhook mapea a los 5 clásicos, pero se admiten también los
-- nuevos de Stripe para que una escritura directa no falle en silencio.
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in (
    'active', 'canceled', 'past_due', 'trialing', 'incomplete',
    'incomplete_expired', 'unpaid', 'paused'
  ));
alter table public.subscriptions drop constraint if exists subscriptions_source_check;
alter table public.subscriptions add constraint subscriptions_source_check
  check (source in ('system', 'stripe', 'admin'));

-- Backfill de source para filas creadas antes de existir la columna
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

create table if not exists public.referrals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  code        text not null unique,
  conversions integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Canjes de referidos: un usuario solo canjea UN código (la PK lo garantiza)
create table if not exists public.referral_redemptions (
  referred_user_id uuid primary key references public.profiles(id) on delete cascade,
  referrer_id      uuid not null references public.profiles(id) on delete cascade,
  referral_id      uuid not null references public.referrals(id) on delete cascade,
  code             text not null,
  created_at       timestamptz not null default now()
);

-- Depósitos de reserva cobrados por Stripe (solo escribe el webhook).
-- amount_total va en la unidad mínima de la moneda (centavos).
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

-- Idempotencia del webhook de Stripe: cada event.id se procesa una vez
create table if not exists public.stripe_events (
  id           text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);

-- Uso mensual de las acciones de IA con cupo (plan Gratis), por usuario y mes
-- natural de RD (periodo = día 1 del mes). Solo la escribe el servidor con
-- las RPC consumir_cupo / devolver_cupo (src/lib/planes/cupo.ts); se cuentan
-- todos los planes (Pro con un límite enorme) para el panel admin.
create table if not exists public.usage_counters (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  periodo    date not null,
  accion     text not null check (accion in ('generar', 'ajustar', 'analizar')),
  usados     integer not null default 0 check (usados >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, periodo, accion)
);

-- ----------------------------------------------------------------------------
-- 5. PANEL ADMIN: logs de IA, feature flags, anuncios, push, auditoría, settings
-- ----------------------------------------------------------------------------

-- Cada llamada a la IA (web + mobile vía API) se registra aquí
create table if not exists public.ai_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles(id) on delete set null,
  provider          text not null,
  model             text not null,
  endpoint          text,
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens      integer not null default 0,
  cost_usd          numeric(12, 6) not null default 0,
  latency_ms        integer not null default 0,
  success           boolean not null default true,
  error             text,
  created_at        timestamptz not null default now()
);

-- Remote config: ambas apps (web + mobile) leen esto vía /api/config
create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  value       jsonb not null default '{}'::jsonb,
  description text,
  platform    text not null default 'all' check (platform in ('all', 'web', 'mobile')),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

drop trigger if exists trg_flags_updated_at on public.feature_flags;
create trigger trg_flags_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

-- Anuncios / banners para usuarios (web + mobile)
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  level      text not null default 'info' check (level in ('info', 'warning', 'critical')),
  platform   text not null default 'all' check (platform in ('all', 'web', 'mobile')),
  active     boolean not null default true,
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

-- Tokens de dispositivos para notificaciones push (mobile)
create table if not exists public.device_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null unique,
  platform   text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now()
);

-- Registro de auditoría de acciones de admin
create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.profiles(id) on delete set null,
  admin_email text,
  action      text not null,
  target_type text,
  target_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Settings globales (modo mantenimiento, proveedor de IA, etc.)
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_settings_updated_at on public.app_settings;
create trigger trg_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- Settings PRIVADOS del panel admin (calculadora de rentabilidad). A
-- diferencia de app_settings no tienen lectura pública: solo service role.
create table if not exists public.admin_private_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

drop trigger if exists trg_admin_private_settings_updated_at
  on public.admin_private_settings;
create trigger trg_admin_private_settings_updated_at
  before update on public.admin_private_settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. ÍNDICES
-- ----------------------------------------------------------------------------

create index if not exists idx_trips_user_id        on public.trips (user_id);
create index if not exists idx_trips_estado         on public.trips (estado);
create index if not exists idx_trips_created_at      on public.trips (created_at desc);
create unique index if not exists idx_trips_grupo_link on public.trips (grupo_link);
create index if not exists idx_members_trip          on public.trip_members (trip_id);
create index if not exists idx_votes_trip            on public.activity_votes (trip_id);
create index if not exists idx_messages_trip         on public.group_messages (trip_id);
create index if not exists idx_expenses_trip         on public.group_expenses (trip_id);
create index if not exists idx_activity_states_user  on public.activity_states (user_id);
create index if not exists idx_subs_user             on public.subscriptions (user_id);
create index if not exists idx_subs_status           on public.subscriptions (status);
create index if not exists idx_subs_tier             on public.subscriptions (tier);
create index if not exists idx_subs_stripe_subscription on public.subscriptions (stripe_subscription_id);
create index if not exists idx_subs_stripe_customer  on public.subscriptions (stripe_customer_id);
create index if not exists idx_redemptions_referrer  on public.referral_redemptions (referrer_id);
create index if not exists idx_reservations_user     on public.reservations (user_id);
create index if not exists idx_reservations_trip     on public.reservations (trip_id);
create index if not exists idx_ai_logs_created       on public.ai_logs (created_at desc);
create index if not exists idx_ai_logs_provider      on public.ai_logs (provider);
create index if not exists idx_ai_logs_user_created  on public.ai_logs (user_id, created_at);
create index if not exists idx_announcements_active  on public.announcements (active);
create index if not exists idx_audit_created         on public.admin_audit_log (created_at desc);
create index if not exists idx_profiles_role         on public.profiles (role);

-- ----------------------------------------------------------------------------
-- 7. FUNCIONES, RPC Y TRIGGERS QUE DEPENDEN DE LAS TABLAS
-- ----------------------------------------------------------------------------

-- ¿El usuario actual es dueño o miembro del viaje? SECURITY DEFINER para que
-- las políticas de trip_members puedan consultar trip_members sin recursión.
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

-- El dueño entra como miembro al crear el viaje (web, mobile o lo que sea)
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

-- RPC join_trip: valida el grupo_link y da de alta al usuario actual como
-- miembro; devuelve el id del viaje. Errores (message): not_authenticated,
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

-- RPC get_shared_trip: SOLO si el dueño marcó el viaje como público. Devuelve
-- el itinerario (data), el destino y las fechas; nunca grupo_link ni user_id.
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

-- Devuelve el código de referido del usuario y, si no tiene, lo crea (ante
-- una colisión prueba códigos aleatorios). Único generador de códigos.
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

-- RPC para la app: mi código de invitación (lo crea si falta)
create or replace function public.my_referral_code()
returns text
language sql
security definer
set search_path = public
as $$
  select public.ensure_referral_code(auth.uid());
$$;

-- RPC apply_referral: canjea un código para el usuario actual. Devuelve:
--   ok | not_authenticated | invalid_code | self_referral | already_redeemed
--   | not_eligible (cuentas de más de 30 días: un referido es alguien nuevo).
-- El incremento de conversions es atómico (misma transacción que el canje).
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
  -- Referido cruzado (A invita a B y B intenta "invitar" a A)
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

-- RPC register_device: si el mismo token ya era de otra cuenta (cambio de
-- sesión en el mismo teléfono), pasa a la cuenta actual en vez de fallar.
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

-- RPC my_effective_tier: plan efectivo del usuario actual. Las suscripciones
-- recurrentes confían en el estado de Stripe (past_due conserva el acceso
-- mientras Stripe reintenta el cobro); los planes de pago único y los
-- concedidos con fecha caducan al llegar current_period_end.
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

-- RPC ai_gasto_desde: suma ai_logs.cost_usd desde un instante. La usa el
-- servidor (src/lib/ai/presupuesto.ts, service role) para el tope global de
-- gasto diario AI_DAILY_BUDGET_USD: pasa las 00:00 de hoy en hora de RD.
-- Usa el índice idx_ai_logs_created. Solo service_role (ver sección 9).
create or replace function public.ai_gasto_desde(p_desde timestamptz)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cost_usd), 0)::numeric
    from public.ai_logs
   where created_at >= p_desde;
$$;

-- RPC consumir_cupo: suma 1 al uso del mes si quedan unidades y devuelve el
-- nuevo total; agotado (o p_limite <= 0) no toca nada y devuelve null. Una
-- sola sentencia atómica: dos peticiones a la vez nunca pasan del límite.
-- La usa src/lib/planes/cupo.ts con la service role (ver sección 9).
create or replace function public.consumir_cupo(
  p_user uuid,
  p_accion text,
  p_periodo date,
  p_limite integer
)
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.usage_counters (user_id, periodo, accion, usados)
  select p_user, p_periodo, p_accion, 1
   where p_limite > 0
  on conflict (user_id, periodo, accion) do update
     set usados     = usage_counters.usados + 1,
         updated_at = now()
   where usage_counters.usados < p_limite
  returning usados;
$$;

-- RPC devolver_cupo: reembolsa 1 (generación fallida, cancelada, de la caché
-- o del modo demo) sin bajar nunca de 0. Solo service_role.
create or replace function public.devolver_cupo(
  p_user uuid,
  p_accion text,
  p_periodo date
)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.usage_counters
     set usados     = greatest(usados - 1, 0),
         updated_at = now()
   where user_id = p_user
     and periodo = p_periodo
     and accion  = p_accion
     and usados  > 0;
$$;

-- Al registrarse (web o mobile): crea perfil + suscripción free + código de
-- referido, para que la cuenta quede lista de inmediato. El código de
-- referido nunca puede impedir el alta.
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

-- ----------------------------------------------------------------------------
-- 8. PRIVILEGIOS POR TABLA / COLUMNA
-- ----------------------------------------------------------------------------
-- Supabase da por defecto todos los privilegios a anon y authenticated; RLS
-- filtra las filas, pero las COLUMNAS se controlan aquí.

-- profiles: el usuario solo puede editar su nombre y su avatar (DA-01: antes
-- podía ponerse role='admin' desde el navegador).
revoke update on table public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;

-- trip_members: sin INSERT directo (solo join_trip o el trigger del dueño);
-- cada uno edita SOLO su nombre/avatar/ubicación (no puede mover su fila a
-- otro trip_id para colarse en un grupo ajeno).
revoke insert, update on table public.trip_members from anon, authenticated;
grant update (nombre, avatar_url, lat_actual, lng_actual, ultima_ubicacion)
  on table public.trip_members to authenticated;

-- mensajes y gastos: no se editan (solo se crean y se borran los propios)
revoke update on table public.group_messages from anon, authenticated;
revoke update on table public.group_expenses from anon, authenticated;

-- activity_states: solo usuarios con sesión
revoke all on table public.activity_states from anon;
grant select, insert, update, delete on table public.activity_states to authenticated;

-- referral_redemptions y reservations: solo lectura para el usuario (las
-- escriben apply_referral y el webhook con service role)
revoke all on table public.referral_redemptions from anon;
revoke insert, update, delete on table public.referral_redemptions from authenticated;
grant select on table public.referral_redemptions to authenticated;

revoke all on table public.reservations from anon;
revoke insert, update, delete on table public.reservations from authenticated;
grant select on table public.reservations to authenticated;

-- stripe_events y admin_private_settings: solo service role
revoke all on table public.stripe_events from anon, authenticated;
revoke all on table public.admin_private_settings from anon, authenticated;

-- usage_counters: el usuario solo LEE sus filas (las escriben las RPC de
-- cupos con la service role)
revoke all on table public.usage_counters from anon, authenticated;
grant select on table public.usage_counters to authenticated;

-- ----------------------------------------------------------------------------
-- 9. EJECUCIÓN DE FUNCIONES (RPC)
-- ----------------------------------------------------------------------------
-- Las funciones nacen ejecutables por PUBLIC: se cierra todo y se abre solo
-- lo necesario. Las que usan las RLS deben poder ejecutarlas anon y
-- authenticated (si no, sus consultas fallarían con "permission denied").
-- is_admin(uuid) se cierra al FINAL de la sección 10, cuando ya ninguna
-- política la usa (en una base con el esquema antiguo, cerrarla antes dejaría
-- rotas las consultas si el script se cortara a medias).

revoke execute on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin()
  to anon, authenticated, service_role;

revoke execute on function public.is_trip_member(uuid) from public;
grant execute on function public.is_trip_member(uuid)
  to anon, authenticated, service_role;

revoke execute on function public.join_trip(text) from public, anon;
grant execute on function public.join_trip(text) to authenticated, service_role;

revoke execute on function public.get_shared_trip(uuid) from public;
grant execute on function public.get_shared_trip(uuid)
  to anon, authenticated, service_role;

revoke execute on function public.ensure_referral_code(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_referral_code(uuid) to service_role;

revoke execute on function public.my_referral_code() from public, anon;
grant execute on function public.my_referral_code() to authenticated, service_role;

revoke execute on function public.apply_referral(text) from public, anon;
grant execute on function public.apply_referral(text) to authenticated, service_role;

revoke execute on function public.register_device(text, text) from public, anon;
grant execute on function public.register_device(text, text)
  to authenticated, service_role;

revoke execute on function public.my_effective_tier() from public, anon;
grant execute on function public.my_effective_tier() to authenticated, service_role;

revoke execute on function public.ai_gasto_desde(timestamptz)
  from public, anon, authenticated;
grant execute on function public.ai_gasto_desde(timestamptz) to service_role;

revoke execute on function public.consumir_cupo(uuid, text, date, integer)
  from public, anon, authenticated;
grant execute on function public.consumir_cupo(uuid, text, date, integer)
  to service_role;

revoke execute on function public.devolver_cupo(uuid, text, date)
  from public, anon, authenticated;
grant execute on function public.devolver_cupo(uuid, text, date)
  to service_role;

-- ----------------------------------------------------------------------------
-- 10. RLS (Row Level Security)
-- ----------------------------------------------------------------------------
-- Nota: el panel admin y el webhook de Stripe usan la SERVICE ROLE key, que
-- IGNORA RLS por completo. Estas políticas protegen el acceso de usuarios
-- normales (anon/authenticated). (select auth.uid()) se evalúa una vez por
-- consulta en vez de una vez por fila.

alter table public.profiles             enable row level security;
alter table public.trips                enable row level security;
alter table public.trip_cache           enable row level security;
alter table public.trip_members         enable row level security;
alter table public.activity_votes       enable row level security;
alter table public.group_messages       enable row level security;
alter table public.group_expenses       enable row level security;
alter table public.activity_states      enable row level security;
alter table public.subscriptions        enable row level security;
alter table public.referrals            enable row level security;
alter table public.referral_redemptions enable row level security;
alter table public.reservations         enable row level security;
alter table public.stripe_events        enable row level security;
alter table public.ai_logs              enable row level security;
alter table public.feature_flags        enable row level security;
alter table public.announcements        enable row level security;
alter table public.device_tokens        enable row level security;
alter table public.admin_audit_log      enable row level security;
alter table public.app_settings         enable row level security;
alter table public.usage_counters       enable row level security;
alter table public.admin_private_settings enable row level security;

-- profiles: cada quien ve/edita el suyo (solo nombre y avatar); admin ve todos
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = (select auth.uid()) or public.current_user_is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- trips: el dueño hace CRUD; los miembros del grupo lo ven; admin ve todos
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

-- Tablas de grupo: SOLO los miembros del viaje (antes: cualquier usuario con
-- sesión podía leer/escribir el chat, los gastos y la ubicación de todos).
drop policy if exists "members_all"         on public.trip_members;
drop policy if exists "votes_all"           on public.activity_votes;
drop policy if exists "messages_all"        on public.group_messages;
drop policy if exists "expenses_all"        on public.group_expenses;

-- trip_members: ver = miembro; editar = tu fila; borrar = salir o que el dueño
-- saque a alguien; sin INSERT (join_trip / trigger)
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
create policy "members_delete" on public.trip_members
  for delete using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.trips t
       where t.id = trip_members.trip_id
         and t.user_id = (select auth.uid())
    )
  );

-- activity_votes: votan los miembros, cada uno con su voto
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

-- group_messages: escriben los miembros a su nombre; los 'sistema' solo el
-- servidor; cada uno borra los suyos
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

-- group_expenses: solo puedes registrar gastos que pagaste tú
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

-- activity_states: los miembros ven el progreso; cada uno escribe el suyo
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

-- subscriptions: el usuario ve la suya; solo escribe el servidor (service role)
drop policy if exists "subs_select" on public.subscriptions;
create policy "subs_select" on public.subscriptions
  for select using (
    user_id = (select auth.uid()) or public.current_user_is_admin()
  );

-- referrals: el usuario ve el suyo; sin INSERT directo (antes se podía crear
-- una fila con conversions arbitrario): los códigos los crea la BD
drop policy if exists "referrals_select" on public.referrals;
drop policy if exists "referrals_insert" on public.referrals;
create policy "referrals_select" on public.referrals
  for select using (
    user_id = (select auth.uid()) or public.current_user_is_admin()
  );

-- referral_redemptions: lo ven el invitado y quien invitó
drop policy if exists "redemptions_select" on public.referral_redemptions;
create policy "redemptions_select" on public.referral_redemptions
  for select using (
    referred_user_id = (select auth.uid())
    or referrer_id = (select auth.uid())
    or public.current_user_is_admin()
  );

-- reservations: el usuario ve las suyas
drop policy if exists "reservations_select_own" on public.reservations;
create policy "reservations_select_own" on public.reservations
  for select using (
    user_id = (select auth.uid()) or public.current_user_is_admin()
  );

-- device_tokens: el usuario gestiona los suyos (alta vía register_device)
drop policy if exists "devices_all" on public.device_tokens;
create policy "devices_all" on public.device_tokens
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- feature_flags / announcements / app_settings: LECTURA PÚBLICA (la usan web+mobile)
drop policy if exists "flags_read"         on public.feature_flags;
drop policy if exists "announcements_read" on public.announcements;
drop policy if exists "settings_read"      on public.app_settings;
create policy "flags_read" on public.feature_flags
  for select using (true);
create policy "announcements_read" on public.announcements
  for select using (true);
create policy "settings_read" on public.app_settings
  for select using (true);

-- usage_counters: cada usuario ve su uso del mes (GET /api/cupo); sin
-- escritura (solo las RPC de cupos con la service role)
drop policy if exists "usage_counters_select_own" on public.usage_counters;
create policy "usage_counters_select_own" on public.usage_counters
  for select using (user_id = (select auth.uid()));

-- ai_logs, admin_audit_log, trip_cache, stripe_events, admin_private_settings:
-- SIN políticas → solo accesibles vía service role (RLS habilitado + sin
-- policy = denegado)

-- Cierre de is_admin(uuid) (DA-24): ya ninguna política la usa (todas usan
-- current_user_is_admin()), así que anon/authenticated dejan de poder
-- ejecutarla (antes servía para averiguar si OTRO usuario es admin).
revoke execute on function public.is_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_admin(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 11. REALTIME
-- ----------------------------------------------------------------------------
-- Sin esto, postgres_changes no emite ningún evento de las tablas de grupo
-- (chat, votos, gastos y miembros en vivo). Realtime respeta la política
-- SELECT de cada tabla, así que solo los miembros reciben los cambios.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  -- Una publicación FOR ALL TABLES ya incluye todo y no admite ADD TABLE
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
-- 12. SEED (valores por defecto) Y BACKFILLS
-- ----------------------------------------------------------------------------

insert into public.app_settings (key, value) values
  ('maintenance_mode', '{"enabled": false, "message": "Estamos en mantenimiento, volvemos pronto."}'::jsonb),
  ('ai_provider',      '{"provider": "groq"}'::jsonb)
on conflict (key) do nothing;

insert into public.feature_flags (key, enabled, description, platform) values
  ('video_analysis',      true, 'Recrear viaje desde video', 'all'),
  ('group_trips',         true, 'Viajes en grupo y chat',    'all'),
  ('live_tracking',       true, 'GPS en vivo y geofencing',  'all'),
  ('paywall',             true, 'Mostrar muro de pago',      'all'),
  ('surprise_destination', true, 'Destino sorpresa',         'all')
on conflict (key) do nothing;

-- Perfiles para usuarios que ya existían antes de este esquema
insert into public.profiles (id, email, full_name, avatar_url)
select id, email, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do nothing;

-- Suscripción free para usuarios existentes
insert into public.subscriptions (user_id, plan_id, tier, status)
select id, 'free', 'free', 'active'
from public.profiles
on conflict (user_id) do nothing;

-- Código de referido para quien no tenga (incluidos los que se quedaron sin
-- código por una colisión del generador antiguo)
do $$
begin
  perform public.ensure_referral_code(p.id)
     from public.profiles p
    where not exists (select 1 from public.referrals r where r.user_id = p.id);
end;
$$;

-- Los dueños de viajes existentes pasan a ser miembros de su grupo
insert into public.trip_members (trip_id, user_id, nombre, avatar_url)
select t.id, p.id, public.nombre_visible(p.full_name, p.email), p.avatar_url
  from public.trips t
  join public.profiles p on p.id = t.user_id
on conflict (trip_id, user_id) do nothing;

-- Que PostgREST vea ya las funciones y columnas nuevas
notify pgrst, 'reload schema';

-- ============================================================================
-- HAZTE ADMIN: descomenta y pon tu email (el que usaste para registrarte)
-- ----------------------------------------------------------------------------
-- update public.profiles set role = 'admin' where email = 'tu-email@ejemplo.com';
--
-- Revisa después que no haya admins que no deban serlo:
-- select id, email from public.profiles where role = 'admin';
-- ============================================================================
