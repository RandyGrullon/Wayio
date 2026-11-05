-- ============================================================================
-- Wayio — Migración: compras integradas de la app (App Store y Google Play)
-- ----------------------------------------------------------------------------
--   A. subscriptions.source admite además 'app_store' y 'play_store': el plan
--      lo cobró la tienda a través de RevenueCat (webhook
--      /api/revenuecat/webhook). Conserva los valores que ya hubiera.
--   B. Columnas de la tienda en subscriptions: producto, transacción original
--      y entorno (SANDBOX = pruebas, revisión de Apple y testers; no es
--      dinero real).
--   C. revenuecat_events: idempotencia del webhook (cada event.id de
--      RevenueCat se procesa una sola vez), como stripe_events. Solo la
--      service role.
--   D. my_effective_tier reconoce los planes de la tienda: dan acceso hasta
--      current_period_end más un margen de 3 horas, que cubre la demora de
--      la renovación y los reintentos del webhook de RevenueCat. El fin del
--      periodo lo escribe siempre el webhook (renovación, cancelación,
--      reembolso o caducidad).
--
-- Idempotente: se puede correr varias veces. Válida para Postgres 15
-- (Supabase). Todo lo que hay aquí está replicado en supabase/schema.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. ORIGEN DEL PLAN
-- ----------------------------------------------------------------------------
-- ADITIVO: conserva los valores que ya admita el CHECK (p. ej. 'creem' de la
-- migración del cobro web, que va antes) y les suma 'app_store' y
-- 'play_store'. Así no importa en qué orden se apliquen ni se pierde nada.
do $$
declare
  permitidos text[] := array['system', 'stripe', 'admin'];
  definicion text;
begin
  select pg_get_constraintdef(c.oid)
    into definicion
    from pg_constraint c
   where c.conrelid = 'public.subscriptions'::regclass
     and c.conname = 'subscriptions_source_check';
  -- Valores entre comillas de la definición actual; admite las dos formas
  -- en que Postgres la escribe: ARRAY['a'::text, …] y '{a,b}'::text[].
  if definicion is not null then
    permitidos := permitidos || array(
      select btrim(trozo, ' {}"')
        from regexp_matches(definicion, '''([^'']+)''', 'g') as m,
             unnest(string_to_array(m[1], ',')) as trozo
    );
  end if;
  permitidos := array(
    select distinct v
      from unnest(permitidos || array['app_store', 'play_store']) as v
     where v <> ''
     order by v
  );
  alter table public.subscriptions drop constraint if exists subscriptions_source_check;
  execute format(
    'alter table public.subscriptions add constraint subscriptions_source_check check (source in (%s))',
    (select string_agg(quote_literal(v), ', ') from unnest(permitidos) as v)
  );
end $$;

-- ----------------------------------------------------------------------------
-- B. DATOS DE LA TIENDA
-- ----------------------------------------------------------------------------
-- store_product_id: id del producto en la tienda (en Google Play las
-- suscripciones llegan como 'suscripcion:plan_base').
-- store_transaction_id: transacción ORIGINAL (la misma en cada renovación);
-- con ella se distingue un evento viejo de otra compra.
alter table public.subscriptions
  add column if not exists store_product_id text,
  add column if not exists store_transaction_id text,
  add column if not exists store_environment text;
alter table public.subscriptions drop constraint if exists subscriptions_store_environment_check;
alter table public.subscriptions add constraint subscriptions_store_environment_check
  check (store_environment is null or store_environment in ('SANDBOX', 'PRODUCTION'));

create index if not exists idx_subs_store_transaction
  on public.subscriptions (store_transaction_id);

-- ----------------------------------------------------------------------------
-- C. IDEMPOTENCIA DEL WEBHOOK DE REVENUECAT
-- ----------------------------------------------------------------------------
-- RLS activada SIN políticas + sin privilegios para anon/authenticated:
-- solo la service role (el webhook).
create table if not exists public.revenuecat_events (
  id           text primary key,
  type         text not null,
  app_user_id  text,
  environment  text,
  processed_at timestamptz not null default now()
);

alter table public.revenuecat_events enable row level security;
revoke all on table public.revenuecat_events from anon, authenticated;

-- ----------------------------------------------------------------------------
-- D. PLAN EFECTIVO
-- ----------------------------------------------------------------------------
-- - Tienda (app_store, play_store): acceso hasta current_period_end + 3 h.
-- - Stripe recurrente (stripe_subscription_id): manda el estado de Stripe
--   (past_due conserva el acceso mientras Stripe reintenta el cobro).
-- - Pago único o concedido a mano: caduca al llegar current_period_end.
create or replace function public.my_effective_tier()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select case
             when s.status not in ('active', 'trialing', 'past_due')
             then 'free'
             when s.source in ('app_store', 'play_store')
             then case
                    when s.current_period_end is not null
                     and s.current_period_end + interval '3 hours' > now()
                    then s.tier
                    else 'free'
                  end
             when s.stripe_subscription_id is not null
               or s.current_period_end is null
               or s.current_period_end > now()
             then s.tier
             else 'free'
           end
      from public.subscriptions s
     where s.user_id = auth.uid()
  ), 'free');
$$;

revoke execute on function public.my_effective_tier() from public, anon;
grant execute on function public.my_effective_tier() to authenticated, service_role;

-- Que PostgREST vea ya la tabla, las columnas y la función nuevas.
notify pgrst, 'reload schema';
