-- =============================================================================
-- EnglishBrain · 002_down.sql
-- Revierte 002_rls_queue_storage.sql. Ejecutar ANTES de 001_down.sql.
--
-- El bucket speaking-audio NO se borra aquí: Supabase no permite borrar
-- directamente filas de storage.buckets. Si quieres eliminarlo, vacíalo y
-- bórralo desde Storage en el panel.
-- =============================================================================

begin;

drop policy if exists speaking_audio_select_own on storage.objects;
drop policy if exists speaking_audio_insert_own on storage.objects;
drop policy if exists speaking_audio_delete_own on storage.objects;

drop view if exists public.srs_queue;

drop policy if exists writing_versions_insert_own on public.writing_versions;
drop policy if exists writing_versions_select_own on public.writing_versions;
drop policy if exists capture_tokens_select_own   on public.capture_tokens;
drop policy if exists profiles_update_own         on public.profiles;
drop policy if exists profiles_select_own         on public.profiles;

do $$
declare
  t text;
begin
  foreach t in array array['vocabulary', 'fossilized_errors', 'speaking_logs', 'writing_logs',
                           'listening_logs', 'review_events', 'habit_checkins']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
  end loop;
end;
$$;

alter table public.profiles          disable row level security;
alter table public.capture_tokens    disable row level security;
alter table public.vocabulary        disable row level security;
alter table public.fossilized_errors disable row level security;
alter table public.speaking_logs     disable row level security;
alter table public.writing_logs      disable row level security;
alter table public.writing_versions  disable row level security;
alter table public.listening_logs    disable row level security;
alter table public.review_events     disable row level security;
alter table public.habit_checkins    disable row level security;

commit;
