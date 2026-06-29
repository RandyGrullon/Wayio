-- ============================================================================
-- Wayio — Esquema completo de base de datos (Supabase / PostgreSQL)
-- ============================================================================
-- Pega TODO este archivo en Supabase → SQL Editor → Run.
-- Es idempotente: se puede correr varias veces sin romper nada.
--
-- Incluye:
--   1. Tablas de la app (trips, grupos, suscripciones, referidos, caché)
--   2. Tablas del panel de administración (perfiles+rol, logs de IA,
--      feature flags, anuncios, tokens de push, auditoría, settings)
--   3. RLS (row level security), funciones, triggers, índices y seed.
--
-- Al final hay una línea comentada para convertirte en admin.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Funciones auxiliares
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

-- ¿El usuario actual (o el dado) es admin? (SECURITY DEFINER para usarse en RLS)
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

-- Crea automáticamente un perfil cuando alguien se registra
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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. VIAJES
-- ----------------------------------------------------------------------------

create table if not exists public.trips (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles(id) on delete cascade,
  data                   jsonb not null,
  paquete                text not null check (paquete in ('basico', 'confort', 'premium')),
  grupo_link             text,
  estado                 text not null default 'planificando'
                           check (estado in ('planificando', 'en_viaje', 'completado')),
  actividades_pendientes jsonb not null default '[]'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

drop trigger if exists trg_trips_updated_at on public.trips;
create trigger trg_trips_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- Caché de generación (la usa el route /api/generate con service role)
create table if not exists public.trip_cache (
  key        text primary key,
  data       text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. GRUPOS (miembros, mensajes, gastos, votos)
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

-- ----------------------------------------------------------------------------
-- 4. SUSCRIPCIONES Y REFERIDOS
-- ----------------------------------------------------------------------------

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references public.profiles(id) on delete cascade,
  plan_id                text not null default 'free',
  tier                   text not null default 'free' check (tier in ('free', 'pro', 'grupo')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  stripe_price_id        text,
  status                 text not null default 'active'
                           check (status in ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now()
);

create table if not exists public.referrals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  code        text not null unique,
  conversions integer not null default 0,
  created_at  timestamptz not null default now()
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

-- ----------------------------------------------------------------------------
-- 6. ÍNDICES
-- ----------------------------------------------------------------------------

create index if not exists idx_trips_user_id        on public.trips (user_id);
create index if not exists idx_trips_estado         on public.trips (estado);
create index if not exists idx_trips_created_at      on public.trips (created_at desc);
create index if not exists idx_members_trip          on public.trip_members (trip_id);
create index if not exists idx_votes_trip            on public.activity_votes (trip_id);
create index if not exists idx_messages_trip         on public.group_messages (trip_id);
create index if not exists idx_expenses_trip         on public.group_expenses (trip_id);
create index if not exists idx_subs_user             on public.subscriptions (user_id);
create index if not exists idx_subs_status           on public.subscriptions (status);
create index if not exists idx_subs_tier             on public.subscriptions (tier);
create index if not exists idx_ai_logs_created       on public.ai_logs (created_at desc);
create index if not exists idx_ai_logs_provider      on public.ai_logs (provider);
create index if not exists idx_announcements_active  on public.announcements (active);
create index if not exists idx_audit_created         on public.admin_audit_log (created_at desc);
create index if not exists idx_profiles_role         on public.profiles (role);

-- ----------------------------------------------------------------------------
-- 7. RLS (Row Level Security)
-- ----------------------------------------------------------------------------
-- Nota: el panel admin usa la SERVICE ROLE key, que IGNORA RLS por completo.
-- Estas políticas protegen el acceso de usuarios normales (anon/authenticated).

alter table public.profiles        enable row level security;
alter table public.trips           enable row level security;
alter table public.trip_cache      enable row level security;
alter table public.trip_members    enable row level security;
alter table public.activity_votes  enable row level security;
alter table public.group_messages  enable row level security;
alter table public.group_expenses  enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.referrals       enable row level security;
alter table public.ai_logs         enable row level security;
alter table public.feature_flags   enable row level security;
alter table public.announcements   enable row level security;
alter table public.device_tokens   enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.app_settings    enable row level security;

-- profiles: cada quien ve/edita el suyo; admin ve todos
drop policy if exists "profiles_select_own"  on public.profiles;
drop policy if exists "profiles_update_own"  on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- trips: dueño hace CRUD del suyo; admin ve todos
drop policy if exists "trips_select" on public.trips;
drop policy if exists "trips_insert" on public.trips;
drop policy if exists "trips_update" on public.trips;
drop policy if exists "trips_delete" on public.trips;
create policy "trips_select" on public.trips
  for select using (user_id = auth.uid() or public.is_admin());
create policy "trips_insert" on public.trips
  for insert with check (user_id = auth.uid());
create policy "trips_update" on public.trips
  for update using (user_id = auth.uid());
create policy "trips_delete" on public.trips
  for delete using (user_id = auth.uid());

-- Tablas de grupo: modelo abierto entre usuarios autenticados (igual que la app actual)
drop policy if exists "members_all"  on public.trip_members;
drop policy if exists "votes_all"    on public.activity_votes;
drop policy if exists "messages_all" on public.group_messages;
drop policy if exists "expenses_all" on public.group_expenses;
create policy "members_all"  on public.trip_members
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "votes_all"    on public.activity_votes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "messages_all" on public.group_messages
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "expenses_all" on public.group_expenses
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- subscriptions / referrals: el usuario ve lo suyo; admin todo
drop policy if exists "subs_select"      on public.subscriptions;
drop policy if exists "referrals_select" on public.referrals;
drop policy if exists "referrals_insert" on public.referrals;
create policy "subs_select" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());
create policy "referrals_select" on public.referrals
  for select using (user_id = auth.uid() or public.is_admin());
create policy "referrals_insert" on public.referrals
  for insert with check (user_id = auth.uid());

-- device_tokens: el usuario gestiona los suyos
drop policy if exists "devices_all" on public.device_tokens;
create policy "devices_all" on public.device_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

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

-- ai_logs, admin_audit_log: SIN políticas → solo accesibles vía service role (admin)
-- (RLS habilitado + sin policy = denegado para anon/authenticated)

-- ----------------------------------------------------------------------------
-- 8. SEED (valores por defecto)
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

-- Backfill: crea perfiles para usuarios que ya existían antes de este esquema
insert into public.profiles (id, email, full_name, avatar_url)
select id, email, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do nothing;

-- ============================================================================
-- HAZTE ADMIN: descomenta y pon tu email (el que usaste para registrarte)
-- ----------------------------------------------------------------------------
-- update public.profiles set role = 'admin' where email = 'tu-email@ejemplo.com';
-- ============================================================================
