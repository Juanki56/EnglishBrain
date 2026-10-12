-- =============================================================================
-- EnglishBrain · 003_daily_activity.sql
-- Vista de actividad diaria por usuario: base de la racha y del mapa de calor.
--
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 001 y 002.
-- Referencias: design.md D8 (racha y zona horaria), spec habit-tracking.
--
-- Por qué una vista: la racha necesita saber qué días hubo actividad, a veces
-- meses atrás. Leer cada repaso uno a uno choca con el límite de 1000 filas de
-- la API de Supabase; la vista devuelve UNA fila por día.
-- =============================================================================

begin;

-- Un día es activo si hubo al menos una de estas tres cosas (spec habit-tracking):
-- un término de vocabulario registrado, un repaso en la sesión Anki o un check-in.
-- Las marcas de tiempo se convierten al día LOCAL de cada usuario según su
-- profiles.timezone; los check-ins ya se guardan con la fecha local.
create or replace view public.daily_activity
with (security_invoker = true)
as
  with events as (
    select v.user_id, (v.created_at at time zone p.timezone)::date as day, 'vocabulary'::text as kind
      from public.vocabulary v
      join public.profiles p on p.id = v.user_id
    union all
    select r.user_id, (r.reviewed_at at time zone p.timezone)::date, 'review'::text
      from public.review_events r
      join public.profiles p on p.id = r.user_id
    union all
    select h.user_id, h.date, 'checkin'::text
      from public.habit_checkins h
  )
  select
    user_id,
    day,
    (count(*) filter (where kind = 'vocabulary'))::integer as vocabulary_count,
    (count(*) filter (where kind = 'review'))::integer     as review_count,
    (count(*) filter (where kind = 'checkin'))::integer    as checkin_count,
    count(*)::integer                                      as total
  from events
  group by user_id, day;

comment on view public.daily_activity is 'Actividad por usuario y día local (vocabulario creado, repasos, check-ins). Filtrar siempre por user_id.';

revoke all on public.daily_activity from anon;

commit;
