-- ============================================================================
-- Wayio — Migración: gasto diario de IA (tope global)
-- ----------------------------------------------------------------------------
-- RPC ai_gasto_desde(p_desde): suma ai_logs.cost_usd desde un instante. La
-- usa el servidor (src/lib/ai/presupuesto.ts) con la service role para
-- aplicar AI_DAILY_BUDGET_USD: pasa las 00:00 de hoy en hora de RD y recibe
-- lo gastado hoy, sin traer filas (PostgREST no tiene agregados activados).
-- La consulta usa el índice idx_ai_logs_created (rango por created_at).
--
-- Solo service_role: ai_logs no tiene políticas RLS y el gasto no se expone
-- a anon ni a authenticated.
--
-- Idempotente: se puede correr varias veces. Válida para Postgres 15
-- (Supabase). Todo lo que hay aquí está replicado en supabase/schema.sql.
-- ============================================================================

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

revoke execute on function public.ai_gasto_desde(timestamptz)
  from public, anon, authenticated;
grant execute on function public.ai_gasto_desde(timestamptz) to service_role;
