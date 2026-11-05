-- ============================================================================
-- Wayio — Migración: gastos del grupo con «Pagó» y «Entre quiénes»
-- ----------------------------------------------------------------------------
-- Hasta ahora cada gasto lo pagaba quien lo apuntaba (pagado_por = auth.uid()
-- por RLS) y se repartía entre todos los miembros. Ahora:
--
--   A. Columnas: pagado_por pasa a ser «quién pagó» (cualquier miembro del
--      viaje; por defecto quien registra), registrado_por guarda quién lo
--      apuntó y participantes (uuid[]) dice «entre quiénes» se reparte, a
--      partes iguales. entre_todos queda como dato derivado: true si el gasto
--      incluye a todos los miembros.
--   B. Backfill de los gastos antiguos: registrado_por = pagado_por y
--      participantes = los miembros actuales (como se calculaban hasta hoy) o
--      solo quien pagó si no era «entre todos». Así sus saldos no cambian y
--      dejan de depender de quién se une después.
--   C. Restricciones (NOT VALID): participantes sin nulos (1-200) y monto
--      mayor que cero.
--   D. Trigger BEFORE INSERT: fija registrado_por = auth.uid(), valida que el
--      pagador y cada participante son miembros del viaje (trip_members),
--      quita duplicados, toma el nombre del pagador de trip_members y, si el
--      cliente no manda participantes (clientes viejos), los rellena con
--      todos los miembros (entre_todos) o solo con quien pagó.
--   E. RLS: registrar = ser miembro (registrado_por = tú); borrar = quien lo
--      apuntó o quien figura como pagador.
--
-- Realtime ya publica group_expenses: las columnas nuevas llegan en los
-- eventos sin tocar la publicación.
--
-- Idempotente: se puede correr varias veces. Válida para Postgres 15
-- (Supabase). Todo lo que hay aquí está replicado en supabase/schema.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. COLUMNAS NUEVAS
-- ----------------------------------------------------------------------------
alter table public.group_expenses
  add column if not exists registrado_por uuid
    references public.profiles(id) on delete set null;
alter table public.group_expenses
  add column if not exists participantes uuid[];

-- Por defecto, quien registra es quien pagó (contrato de los clientes viejos)
alter table public.group_expenses
  alter column pagado_por set default auth.uid();
alter table public.group_expenses
  alter column registrado_por set default auth.uid();

-- ----------------------------------------------------------------------------
-- B. BACKFILL DE LOS GASTOS ANTIGUOS
-- ----------------------------------------------------------------------------
-- Solo filas sin participantes: al volver a correr no toca nada. Va antes de
-- las restricciones (NOT VALID también revisa las filas que se actualizan).
update public.group_expenses e
   set registrado_por = coalesce(e.registrado_por, e.pagado_por),
       participantes = case
         when e.entre_todos then coalesce(
           (select array_agg(m.user_id order by m.joined_at, m.user_id)
              from public.trip_members m
             where m.trip_id = e.trip_id),
           array[e.pagado_por]
         )
         else array[e.pagado_por]
       end
 where e.participantes is null;

-- ----------------------------------------------------------------------------
-- C. RESTRICCIONES (NOT VALID: no revisan las filas viejas)
-- ----------------------------------------------------------------------------
alter table public.group_expenses
  drop constraint if exists group_expenses_participantes_validos;
alter table public.group_expenses
  add constraint group_expenses_participantes_validos
  check (
    participantes is null
    or (
      cardinality(participantes) between 1 and 200
      and array_position(participantes, null) is null
    )
  ) not valid;

alter table public.group_expenses
  drop constraint if exists group_expenses_monto_positivo;
alter table public.group_expenses
  add constraint group_expenses_monto_positivo
  check (monto > 0) not valid;

-- ----------------------------------------------------------------------------
-- D. VALIDACIÓN AL INSERTAR (pagador y participantes = miembros del viaje)
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER para leer trip_members sin depender de su RLS. Errores
-- (message), con errcode 23514 (check_violation → HTTP 400 en PostgREST):
-- pagador_no_miembro, participante_no_miembro, sin_participantes.
create or replace function public.group_expenses_preparar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_miembros uuid[];
  v_nombre   text;
begin
  -- Quien registra es SIEMPRE el usuario de la sesión. Sin sesión (service
  -- role, SQL Editor) vale lo que venga o, si no, el pagador.
  if v_uid is not null then
    new.registrado_por := v_uid;
  end if;
  new.pagado_por := coalesce(new.pagado_por, new.registrado_por);
  new.registrado_por := coalesce(new.registrado_por, new.pagado_por);

  select coalesce(array_agg(m.user_id order by m.joined_at, m.user_id), '{}')
    into v_miembros
    from public.trip_members m
   where m.trip_id = new.trip_id;

  if new.pagado_por is null or not (new.pagado_por = any (v_miembros)) then
    raise exception 'pagador_no_miembro'
      using errcode = '23514',
            hint = 'Quien pagó tiene que ser miembro del viaje.';
  end if;

  if new.participantes is null then
    -- Clientes viejos: «entre todos» = los miembros de ahora; si no, solo
    -- quien pagó.
    new.participantes := case
      when coalesce(new.entre_todos, true) then v_miembros
      else array[new.pagado_por]
    end;
  else
    new.participantes := array(
      select distinct p
        from unnest(new.participantes) as p
       where p is not null
       order by p
    );
  end if;

  if cardinality(new.participantes) = 0 then
    raise exception 'sin_participantes'
      using errcode = '23514',
            hint = 'El gasto tiene que repartirse entre al menos una persona.';
  end if;

  if not (new.participantes <@ v_miembros) then
    raise exception 'participante_no_miembro'
      using errcode = '23514',
            hint = 'Solo se puede repartir entre miembros del viaje.';
  end if;

  new.entre_todos := v_miembros <@ new.participantes;

  select m.nombre
    into v_nombre
    from public.trip_members m
   where m.trip_id = new.trip_id
     and m.user_id = new.pagado_por;
  new.nombre_pagador := coalesce(nullif(btrim(v_nombre), ''), new.nombre_pagador);

  return new;
end;
$$;

drop trigger if exists trg_group_expenses_preparar on public.group_expenses;
create trigger trg_group_expenses_preparar
  before insert on public.group_expenses
  for each row execute function public.group_expenses_preparar();

-- ----------------------------------------------------------------------------
-- E. RLS: registra cualquier miembro; borra quien lo apuntó o quien pagó
-- ----------------------------------------------------------------------------
-- WITH CHECK se evalúa DESPUÉS de los triggers BEFORE, así que registrado_por
-- ya es auth.uid().
drop policy if exists "expenses_insert"     on public.group_expenses;
drop policy if exists "expenses_delete_own" on public.group_expenses;
create policy "expenses_insert" on public.group_expenses
  for insert with check (
    registrado_por = (select auth.uid()) and public.is_trip_member(trip_id)
  );
create policy "expenses_delete_own" on public.group_expenses
  for delete using (
    registrado_por = (select auth.uid()) or pagado_por = (select auth.uid())
  );

-- Que PostgREST vea ya las columnas nuevas
notify pgrst, 'reload schema';
