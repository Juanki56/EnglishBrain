-- =============================================================================
-- EnglishBrain · 002_rls_queue_storage.sql
-- Seguridad por filas (RLS), vista de la cola de repasos y bucket de audios.
--
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 001_schema.sql.
-- Referencias: design.md D3 (aislamiento en dos capas), D4 (srs_queue), D6 (audio)
--
-- Nota: el Backend usa la secret key, que omite RLS; su filtro por user_id es la
-- capa 1. Estas políticas son la capa 2: protegen ante cualquier acceso con la
-- publishable key o un error en el Backend.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- RLS en todas las tablas. Sin políticas para anon ⇒ anon no ve nada.
-- -----------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.capture_tokens    enable row level security;
alter table public.vocabulary        enable row level security;
alter table public.fossilized_errors enable row level security;
alter table public.speaking_logs     enable row level security;
alter table public.writing_logs      enable row level security;
alter table public.writing_versions  enable row level security;
alter table public.listening_logs    enable row level security;
alter table public.review_events     enable row level security;
alter table public.habit_checkins    enable row level security;

-- Tablas de datos: el usuario autenticado gestiona solo sus filas.
-- (select auth.uid()) se evalúa una vez por consulta (recomendación de Supabase).
do $$
declare
  t text;
begin
  foreach t in array array['vocabulary', 'fossilized_errors', 'speaking_logs', 'writing_logs',
                           'listening_logs', 'review_events', 'habit_checkins']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_owner_all', t);
  end loop;
end;
$$;

-- profiles: leer y editar el propio perfil. El alta la hace el trigger
-- on_auth_user_created y el borrado ocurre en cascada desde auth.users.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- capture_tokens: solo lectura de los propios. Crear y revocar lo hace el Backend.
drop policy if exists capture_tokens_select_own on public.capture_tokens;
create policy capture_tokens_select_own on public.capture_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

-- writing_versions: leer e insertar las propias. Sin UPDATE (inmutables);
-- se borran en cascada con su entrada.
drop policy if exists writing_versions_select_own on public.writing_versions;
create policy writing_versions_select_own on public.writing_versions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists writing_versions_insert_own on public.writing_versions;
create policy writing_versions_insert_own on public.writing_versions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- srs_queue · registros vencidos de las cinco categorías estudiables
-- (spec srs-review "Cola de vencidos", spec study-library "Exclusión total").
-- security_invoker: aplica el RLS de quien consulta, no el del dueño de la vista.
-- -----------------------------------------------------------------------------

create or replace view public.srs_queue
with (security_invoker = true)
as
  select user_id, 'vocabulary'::text as item_type, id as item_id, due_at
    from public.vocabulary
   where is_active_srs and due_at <= now() and status <> 'pending_curation'
  union all
  select user_id, 'fossilized_error'::text, id, due_at
    from public.fossilized_errors
   where is_active_srs and due_at <= now()
  union all
  select user_id, 'speaking'::text, id, due_at
    from public.speaking_logs
   where is_active_srs and due_at <= now()
  union all
  select user_id, 'writing'::text, id, due_at
    from public.writing_logs
   where is_active_srs and due_at <= now()
  union all
  select user_id, 'listening'::text, id, due_at
    from public.listening_logs
   where is_active_srs and due_at <= now();

comment on view public.srs_queue is 'Cola de repasos: activos en SRS, vencidos y ya curados. Filtrar siempre por user_id y ordenar por due_at.';

revoke all on public.srs_queue from anon;

-- -----------------------------------------------------------------------------
-- Storage · bucket privado de audios de speaking (design D6)
-- Ruta de cada archivo: {user_id}/{speaking_id}.mp3
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('speaking-audio', 'speaking-audio', false, 15728640, array['audio/mpeg'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada usuario solo accede a la carpeta que lleva su id.
drop policy if exists speaking_audio_select_own on storage.objects;
create policy speaking_audio_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'speaking-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists speaking_audio_insert_own on storage.objects;
create policy speaking_audio_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'speaking-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists speaking_audio_delete_own on storage.objects;
create policy speaking_audio_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'speaking-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
