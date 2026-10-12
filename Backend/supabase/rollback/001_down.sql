-- =============================================================================
-- EnglishBrain · 001_down.sql
-- Revierte 001_schema.sql. Ejecutar DESPUÉS de 002_down.sql.
-- ⚠️ BORRA TODOS LOS DATOS de EnglishBrain (no toca las cuentas de auth.users).
-- =============================================================================

begin;

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.habit_checkins;
drop table if exists public.review_events;
drop table if exists public.listening_logs;
drop table if exists public.writing_versions;
drop table if exists public.writing_logs;
drop table if exists public.speaking_logs;
drop table if exists public.fossilized_errors;
drop table if exists public.vocabulary;
drop table if exists public.capture_tokens;
drop table if exists public.profiles;

drop function if exists public.handle_new_user();
drop function if exists public.validate_profile_timezone();
drop function if exists public.prevent_writing_version_update();
drop function if exists public.assign_writing_version_number();
drop function if exists public.srs_defaults();
drop function if exists public.set_updated_at();
drop function if exists public.is_valid_timezone(text);

commit;
