-- =============================================================================
-- EnglishBrain · 001_schema.sql
-- Tablas, restricciones, índices y triggers del modelo de datos.
--
-- Ejecutar en Supabase → SQL Editor → New query → pegar todo → Run.
-- Ejecutar ANTES de 002_rls_queue_storage.sql.
-- Referencias: openspec/changes/bootstrap-englishbrain-platform/design.md (D3, D4)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Funciones comunes
-- -----------------------------------------------------------------------------

-- Mantiene updated_at al día en cada UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Modo Archivo (spec study-library): un registro activo en SRS sin fecha de
-- repaso queda vencido desde ahora. Archivar NO borra due_at ni el historial.
create or replace function public.srs_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_active_srs and new.due_at is null then
    new.due_at := now();
  end if;
  return new;
end;
$$;

-- true si el texto es una zona horaria IANA conocida por PostgreSQL.
create or replace function public.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- -----------------------------------------------------------------------------
-- profiles · un perfil por usuario (spec user-accounts)
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 60),
  timezone     text not null default 'UTC',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'Perfil de cada usuario: nombre visible y zona horaria IANA usada para rachas y check-ins.';

create or replace function public.validate_profile_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_valid_timezone(new.timezone) then
    raise exception 'Zona horaria inválida: %', new.timezone
      using errcode = '22023'; -- invalid_parameter_value
  end if;
  return new;
end;
$$;

create or replace trigger profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

create or replace trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea el perfil al registrarse. Lee display_name y timezone de los metadatos
-- que envía el Frontend en signUp. Nunca bloquea un registro: si la zona es
-- inválida usa 'UTC'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
  v_tz   text := new.raw_user_meta_data ->> 'timezone';
begin
  if v_tz is null or not public.is_valid_timezone(v_tz) then
    v_tz := 'UTC';
  end if;

  insert into public.profiles (id, display_name, timezone)
  values (new.id, left(v_name, 60), v_tz)
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles para usuarios que ya existieran antes de esta migración.
insert into public.profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- capture_tokens · tokens personales de la extensión (spec user-accounts)
-- Solo se guarda el SHA-256 del token; el token completo se muestra una vez.
-- -----------------------------------------------------------------------------

create table if not exists public.capture_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  label        text not null check (char_length(btrim(label)) between 1 and 50),
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  last4        text not null check (char_length(last4) = 4),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

comment on table public.capture_tokens is 'Tokens de la extensión de Chrome. token_hash = SHA-256 en hex del token ebk_…';

create index if not exists capture_tokens_user_idx on public.capture_tokens (user_id);

-- -----------------------------------------------------------------------------
-- vocabulary · términos capturados o creados a mano
-- (specs browser-capture, vocabulary-curation, srs-review)
-- -----------------------------------------------------------------------------

create table if not exists public.vocabulary (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  word             text not null check (char_length(btrim(word)) between 1 and 200),
  context_sentence text check (context_sentence is null or char_length(context_sentence) <= 2000),
  translation      text check (translation is null or char_length(translation) <= 500),
  definition       text check (definition is null or char_length(definition) <= 2000),
  type             text not null check (type in ('word', 'phrasal_verb', 'idiom_slang')),
  status           text not null default 'pending_curation'
                   check (status in ('pending_curation', 'learning', 'reviewing', 'mastered')),
  source           text not null default 'manual' check (source in ('extension', 'manual')),
  source_url       text check (source_url is null or char_length(source_url) <= 2048),
  -- SRS
  is_active_srs    boolean not null default true,
  due_at           timestamptz,
  interval_days    numeric(8, 2) not null default 0 check (interval_days >= 0),
  ease             numeric(4, 2) not null default 2.5 check (ease >= 1.3),
  repetitions      integer not null default 0 check (repetitions >= 0),
  lapses           integer not null default 0 check (lapses >= 0),
  retention_state  text not null default 'learning' check (retention_state in ('learning', 'reviewing', 'mastered')),
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Un término curado siempre tiene traducción.
  constraint vocabulary_curated_requires_translation
    check (status = 'pending_curation' or (translation is not null and char_length(btrim(translation)) > 0)),
  -- Una vez curado, status refleja el estado de retención del SRS.
  constraint vocabulary_status_matches_retention
    check (status = 'pending_curation' or status = retention_state)
);

comment on table public.vocabulary is 'Vocabulario. type ∈ {word, phrasal_verb, idiom_slang}. Las capturas de la extensión nacen en pending_curation.';

create index if not exists vocabulary_user_status_idx on public.vocabulary (user_id, status, created_at);
create index if not exists vocabulary_user_source_idx on public.vocabulary (user_id, source, created_at desc);
create index if not exists vocabulary_user_due_idx    on public.vocabulary (user_id, due_at) where is_active_srs;

-- -----------------------------------------------------------------------------
-- fossilized_errors · Muro de Errores Fosilizados (spec fossilized-errors)
-- Marcar un error como superado no lo saca del SRS: eso lo decide is_active_srs.
-- -----------------------------------------------------------------------------

create table if not exists public.fossilized_errors (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  incorrect_phrase text not null check (char_length(btrim(incorrect_phrase)) between 1 and 500),
  correct_phrase   text not null check (char_length(btrim(correct_phrase)) between 1 and 500),
  notes            text check (notes is null or char_length(notes) <= 2000),
  is_resolved      boolean not null default false,
  resolved_at      timestamptz,
  -- SRS
  is_active_srs    boolean not null default true,
  due_at           timestamptz,
  interval_days    numeric(8, 2) not null default 0 check (interval_days >= 0),
  ease             numeric(4, 2) not null default 2.5 check (ease >= 1.3),
  repetitions      integer not null default 0 check (repetitions >= 0),
  lapses           integer not null default 0 check (lapses >= 0),
  retention_state  text not null default 'learning' check (retention_state in ('learning', 'reviewing', 'mastered')),
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.fossilized_errors is 'Errores recurrentes: frase incorrecta, frase correcta nativa y nota mnemotécnica.';

create index if not exists fossilized_errors_user_resolved_idx on public.fossilized_errors (user_id, is_resolved);
create index if not exists fossilized_errors_user_due_idx      on public.fossilized_errors (user_id, due_at) where is_active_srs;

-- -----------------------------------------------------------------------------
-- speaking_logs · monólogos grabados (spec speaking-log)
-- El audio vive en Storage: speaking-audio/{user_id}/{id}.mp3
-- -----------------------------------------------------------------------------

create table if not exists public.speaking_logs (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  title                   text not null check (char_length(btrim(title)) between 1 and 200),
  storage_path            text not null unique,
  duration_seconds        integer not null check (duration_seconds between 1 and 600),
  size_bytes              integer check (size_bytes is null or size_bytes between 1 and 15728640),
  recording_limit_minutes smallint check (recording_limit_minutes is null or recording_limit_minutes in (3, 5, 10)),
  -- SRS
  is_active_srs           boolean not null default true,
  due_at                  timestamptz,
  interval_days           numeric(8, 2) not null default 0 check (interval_days >= 0),
  ease                    numeric(4, 2) not null default 2.5 check (ease >= 1.3),
  repetitions             integer not null default 0 check (repetitions >= 0),
  lapses                  integer not null default 0 check (lapses >= 0),
  retention_state         text not null default 'learning' check (retention_state in ('learning', 'reviewing', 'mastered')),
  last_reviewed_at        timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- La ruta del audio siempre está en la carpeta de su dueño.
  constraint speaking_logs_storage_path_format
    check (storage_path = user_id::text || '/' || id::text || '.mp3')
);

comment on table public.speaking_logs is 'Monólogos de hasta 10 minutos. storage_path = {user_id}/{id}.mp3 en el bucket speaking-audio.';

create index if not exists speaking_logs_user_created_idx on public.speaking_logs (user_id, created_at desc);
create index if not exists speaking_logs_user_due_idx     on public.speaking_logs (user_id, due_at) where is_active_srs;

-- -----------------------------------------------------------------------------
-- writing_logs + writing_versions · bitácora de textos (spec writing-log)
-- -----------------------------------------------------------------------------

create table if not exists public.writing_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 1 and 200),
  -- SRS
  is_active_srs    boolean not null default true,
  due_at           timestamptz,
  interval_days    numeric(8, 2) not null default 0 check (interval_days >= 0),
  ease             numeric(4, 2) not null default 2.5 check (ease >= 1.3),
  repetitions      integer not null default 0 check (repetitions >= 0),
  lapses           integer not null default 0 check (lapses >= 0),
  retention_state  text not null default 'learning' check (retention_state in ('learning', 'reviewing', 'mastered')),
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Destino de la FK compuesta de writing_versions.
  constraint writing_logs_id_user_key unique (id, user_id)
);

comment on table public.writing_logs is 'Entradas de writing. El texto vive en writing_versions (versión 1 = original).';

create index if not exists writing_logs_user_created_idx on public.writing_logs (user_id, created_at desc);
create index if not exists writing_logs_user_due_idx     on public.writing_logs (user_id, due_at) where is_active_srs;

create table if not exists public.writing_versions (
  id             uuid primary key default gen_random_uuid(),
  writing_id     uuid not null,
  user_id        uuid not null,
  version_number integer not null check (version_number >= 1),
  content        text not null check (char_length(btrim(content)) between 1 and 50000),
  created_at     timestamptz not null default now(),
  constraint writing_versions_number_key unique (writing_id, version_number),
  -- FK compuesta: una versión siempre pertenece al mismo usuario que su entrada.
  constraint writing_versions_writing_fkey
    foreign key (writing_id, user_id) references public.writing_logs (id, user_id) on delete cascade
);

comment on table public.writing_versions is 'Historial inmutable de versiones de cada entrada de writing.';

create index if not exists writing_versions_user_idx on public.writing_versions (user_id);

-- Asigna el siguiente número de versión de la entrada (1, 2, 3…).
create or replace function public.assign_writing_version_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Bloquea la entrada para numerar sin carreras entre inserciones simultáneas.
  perform 1 from public.writing_logs where id = new.writing_id for update;

  select coalesce(max(v.version_number), 0) + 1
    into new.version_number
    from public.writing_versions v
   where v.writing_id = new.writing_id;

  return new;
end;
$$;

create or replace trigger writing_versions_assign_number
  before insert on public.writing_versions
  for each row execute function public.assign_writing_version_number();

-- Las versiones anteriores nunca se sobrescriben.
create or replace function public.prevent_writing_version_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Las versiones de writing son inmutables; añade una versión nueva'
    using errcode = '55000'; -- object_not_in_prerequisite_state
end;
$$;

create or replace trigger writing_versions_immutable
  before update on public.writing_versions
  for each row execute function public.prevent_writing_version_update();

-- -----------------------------------------------------------------------------
-- listening_logs · retos de escucha (spec listening-log)
-- -----------------------------------------------------------------------------

create table if not exists public.listening_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 1 and 200),
  url              text not null check (url ~* '^https?://[^\s]+$' and char_length(url) <= 2048),
  start_seconds    integer check (start_seconds is null or start_seconds >= 0),
  transcription    text not null check (char_length(btrim(transcription)) between 1 and 20000),
  -- SRS
  is_active_srs    boolean not null default true,
  due_at           timestamptz,
  interval_days    numeric(8, 2) not null default 0 check (interval_days >= 0),
  ease             numeric(4, 2) not null default 2.5 check (ease >= 1.3),
  repetitions      integer not null default 0 check (repetitions >= 0),
  lapses           integer not null default 0 check (lapses >= 0),
  retention_state  text not null default 'learning' check (retention_state in ('learning', 'reviewing', 'mastered')),
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.listening_logs is 'Retos de escucha: enlace (http/https), inicio opcional y transcripción manual.';

create index if not exists listening_logs_user_created_idx on public.listening_logs (user_id, created_at desc);
create index if not exists listening_logs_user_due_idx     on public.listening_logs (user_id, due_at) where is_active_srs;

-- -----------------------------------------------------------------------------
-- review_events · cada calificación 1–4 de la sesión Anki (spec srs-review)
-- Sin FK al ítem (es polimórfico): los eventos sobreviven al borrado del ítem
-- para que las rachas pasadas no cambien.
-- -----------------------------------------------------------------------------

create table if not exists public.review_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  item_type       text not null check (item_type in ('vocabulary', 'fossilized_error', 'speaking', 'writing', 'listening')),
  item_id         uuid not null,
  grade           smallint not null check (grade between 1 and 4),
  interval_before numeric(8, 2) check (interval_before is null or interval_before >= 0),
  interval_after  numeric(8, 2) check (interval_after is null or interval_after >= 0),
  reviewed_at     timestamptz not null default now()
);

comment on table public.review_events is 'Historial de repasos. Alimenta rachas, mapa de calor y esfuerzo por habilidad.';

create index if not exists review_events_user_reviewed_idx on public.review_events (user_id, reviewed_at);
create index if not exists review_events_item_idx          on public.review_events (item_type, item_id);

-- -----------------------------------------------------------------------------
-- habit_checkins · check-in diario manual (spec habit-tracking)
-- date es la fecha LOCAL del usuario (según profiles.timezone).
-- -----------------------------------------------------------------------------

create table if not exists public.habit_checkins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  habit      text not null check (habit in ('reading_listening', 'speaking', 'writing')),
  created_at timestamptz not null default now(),
  constraint habit_checkins_user_date_habit_key unique (user_id, date, habit)
);

comment on table public.habit_checkins is 'Check-ins diarios de hábitos externos. Un registro por usuario, día local y hábito.';

-- -----------------------------------------------------------------------------
-- Triggers comunes de las tablas estudiables
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['vocabulary', 'fossilized_errors', 'speaking_logs', 'writing_logs', 'listening_logs']
  loop
    execute format(
      'create or replace trigger %I before update on public.%I
         for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);
    execute format(
      'create or replace trigger %I before insert or update of is_active_srs on public.%I
         for each row execute function public.srs_defaults()',
      t || '_srs_defaults', t);
  end loop;
end;
$$;

commit;
