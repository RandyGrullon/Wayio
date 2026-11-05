-- ============================================================================
-- Wayio — Migración: cobro con Creem (proveedor configurable)
-- ----------------------------------------------------------------------------
-- El cobro web pasa a Creem (merchant of record que paga a bancos de RD) y
-- Stripe queda como alternativa (PAYMENTS_PROVIDER=creem|stripe).
--
--   A. subscriptions.source admite 'creem'. Las columnas stripe_customer_id,
--      stripe_subscription_id y stripe_price_id guardan los ids del proveedor
--      que indica source (con Creem: cust_…, sub_…, prod_…). No se renombran
--      porque la RPC my_effective_tier, el panel admin y las versiones ya
--      publicadas de la app móvil las leen por ese nombre.
--   B. payment_events: idempotencia de los webhooks de cualquier proveedor
--      (provider + id del evento). stripe_events se queda tal cual para el
--      webhook de Stripe.
--
-- Idempotente: se puede correr varias veces. Válida para Postgres 15
-- (Supabase). Todo lo que hay aquí está replicado en supabase/schema.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. ORIGEN DEL PLAN: 'creem'
-- ----------------------------------------------------------------------------
-- 'system' = free del alta, 'stripe' / 'creem' = pagado con ese proveedor,
-- 'admin' = concedido a mano desde el panel (no cuenta en el MRR).
alter table public.subscriptions
  add column if not exists source text not null default 'system';
-- El CHECK se reescribe SUMANDO a los valores que ya admita (p. ej. los de
-- otra migración del mismo día, como los orígenes de las tiendas de apps), no
-- sustituyéndolos: así el orden en que se apliquen las migraciones da igual.
do $$
declare
  valores text[];
begin
  select coalesce(array_agg(m[1]), '{}')
    into valores
    from pg_constraint c,
         regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g') as m
   where c.conname = 'subscriptions_source_check'
     and c.conrelid = 'public.subscriptions'::regclass;
  valores := array(
    select distinct v
      from unnest(valores || array['system', 'stripe', 'creem', 'admin']) as v
     order by v
  );
  alter table public.subscriptions drop constraint if exists subscriptions_source_check;
  execute format(
    'alter table public.subscriptions add constraint subscriptions_source_check check (source in (%s))',
    (select string_agg(quote_literal(v), ', ') from unnest(valores) as v)
  );
end $$;

-- Filas que el webhook de Creem escribió antes de esta migración (sin poder
-- poner source): se reconocen por el prefijo del cliente de Creem.
update public.subscriptions
   set source = 'creem'
 where source = 'system'
   and stripe_customer_id like 'cust\_%';

comment on column public.subscriptions.source is
  'Origen del plan: system (alta gratuita), stripe o creem (pagado con ese proveedor), admin (concedido a mano).';
comment on column public.subscriptions.stripe_customer_id is
  'Id del cliente en el proveedor de cobro de source (Stripe cus_…, Creem cust_…).';
comment on column public.subscriptions.stripe_subscription_id is
  'Id de la suscripción recurrente en el proveedor de cobro (null en pases de pago único y planes concedidos).';
comment on column public.subscriptions.stripe_price_id is
  'Precio (Stripe price_…) o producto (Creem prod_…) cobrado.';

-- ----------------------------------------------------------------------------
-- B. EVENTOS DE PAGO (idempotencia de webhooks)
-- ----------------------------------------------------------------------------
-- Cada (provider, id) se procesa una vez. RLS sin políticas = solo la service
-- role (el webhook) puede leer o escribir.
create table if not exists public.payment_events (
  provider     text not null check (provider in ('stripe', 'creem')),
  id           text not null,
  type         text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, id)
);

alter table public.payment_events enable row level security;
revoke all on table public.payment_events from anon, authenticated;
