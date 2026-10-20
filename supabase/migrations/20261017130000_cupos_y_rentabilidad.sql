-- ============================================================================
-- Wayio — Migración: cupos del plan Gratis y piezas de rentabilidad
-- ----------------------------------------------------------------------------
--   A. usage_counters: uso mensual de las acciones de IA con cupo (generar,
--      ajustar, analizar) por usuario y mes natural de RD. La escribe SOLO el
--      servidor (src/lib/planes/cupo.ts) con la service role, a través de las
--      RPC de abajo; el usuario puede leer sus propias filas (GET /api/cupo).
--      Se cuentan TODOS los planes (en Pro con un límite enorme) para que el
--      panel admin tenga conteos reales.
--   B. RPC consumir_cupo / devolver_cupo: suman o restan una unidad de forma
--      atómica (insert ... on conflict con condición), así dos peticiones a la
--      vez nunca pasan del límite. Solo service_role.
--   C. admin_private_settings: ajustes PRIVADOS del panel admin (la
--      calculadora de rentabilidad). A diferencia de app_settings, que tiene
--      lectura pública, aquí no entra nadie salvo la service role.
--   D. Índice de ai_logs por usuario y fecha (consumo por cuenta del admin).
--
-- Idempotente: se puede correr varias veces. Válida para Postgres 15
-- (Supabase). Todo lo que hay aquí está replicado en supabase/schema.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. USO MENSUAL POR ACCIÓN
-- ----------------------------------------------------------------------------
-- periodo = día 1 del mes natural de RD ('2026-10-01'); el cupo se renueva el
-- día 1 a las 00:00 de RD.
create table if not exists public.usage_counters (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  periodo    date not null,
  accion     text not null check (accion in ('generar', 'ajustar', 'analizar')),
  usados     integer not null default 0 check (usados >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, periodo, accion)
);

alter table public.usage_counters enable row level security;

-- El usuario solo LEE sus filas; nadie escribe salvo la service role (RPC).
revoke all on table public.usage_counters from anon, authenticated;
grant select on table public.usage_counters to authenticated;

drop policy if exists "usage_counters_select_own" on public.usage_counters;
create policy "usage_counters_select_own" on public.usage_counters
  for select using (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- B. RPC consumir_cupo / devolver_cupo (solo service_role)
-- ----------------------------------------------------------------------------
-- consumir_cupo: suma 1 si quedan unidades y devuelve el nuevo total; si el
-- cupo está agotado (o p_limite <= 0) no toca nada y devuelve null. El WHERE
-- del DO UPDATE hace la comprobación y la suma en una sola sentencia atómica.
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

-- devolver_cupo: reembolsa 1 (generación fallida, cancelada, de la caché o
-- del modo demo) sin bajar nunca de 0.
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

revoke execute on function public.consumir_cupo(uuid, text, date, integer)
  from public, anon, authenticated;
grant execute on function public.consumir_cupo(uuid, text, date, integer)
  to service_role;

revoke execute on function public.devolver_cupo(uuid, text, date)
  from public, anon, authenticated;
grant execute on function public.devolver_cupo(uuid, text, date)
  to service_role;

-- ----------------------------------------------------------------------------
-- C. AJUSTES PRIVADOS DEL PANEL ADMIN
-- ----------------------------------------------------------------------------
-- RLS activada SIN políticas + sin privilegios para anon/authenticated (como
-- stripe_events): solo la service role, desde el panel con requireAdmin().
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

alter table public.admin_private_settings enable row level security;
revoke all on table public.admin_private_settings from anon, authenticated;

-- ----------------------------------------------------------------------------
-- D. ÍNDICE DE ai_logs POR USUARIO
-- ----------------------------------------------------------------------------
create index if not exists idx_ai_logs_user_created
  on public.ai_logs (user_id, created_at);

-- Que PostgREST vea ya las tablas y funciones nuevas.
notify pgrst, 'reload schema';
