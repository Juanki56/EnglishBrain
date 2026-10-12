-- =============================================================================
-- EnglishBrain · verify_schema.sql
-- Comprueba que 001 y 002 se aplicaron bien. Devuelve una tabla
-- "check_name | result" donde todo debe salir PASS.
--
-- NO deja datos: crea dos usuarios de prueba y registros dentro de un bloque
-- que se revierte por completo al terminar.
-- Ejecutar en Supabase → SQL Editor después de 001 y 002.
-- =============================================================================

create or replace function pg_temp.eb_run_checks()
returns table (check_name text, result text)
language plpgsql
as $$
declare
  res         text[] := '{}';
  ua          uuid := gen_random_uuid();  -- usuario A
  ub          uuid := gen_random_uuid();  -- usuario B
  v_word      uuid;
  v_archived  uuid;
  w_id        uuid;
  s_id        uuid := gen_random_uuid();
  v_txt       text;
  v_txt2      text;
  v_ts        timestamptz;
  v_bool      boolean;
  v_int       integer;
  v_int2      integer;
  v_arr       integer[];
begin
  begin
    -- -------------------------------------------------------------------------
    -- Cuentas y perfiles
    -- -------------------------------------------------------------------------
    insert into auth.users (id, email, aud, role, raw_user_meta_data) values
      (ua, 'eb-check-a@example.invalid', 'authenticated', 'authenticated',
       '{"display_name": "Usuario A", "timezone": "America/Bogota"}'::jsonb),
      (ub, 'eb-check-b@example.invalid', 'authenticated', 'authenticated',
       '{"timezone": "Mars/Olympus"}'::jsonb);

    select timezone, display_name into v_txt, v_txt2 from public.profiles where id = ua;
    res := res || ('Perfil creado al registrarse (nombre y zona)|'
                   || case when v_txt = 'America/Bogota' and v_txt2 = 'Usuario A' then 'PASS' else 'FAIL' end);

    select timezone into v_txt from public.profiles where id = ub;
    res := res || ('Zona inválida en el registro ⇒ UTC|' || case when v_txt = 'UTC' then 'PASS' else 'FAIL' end);

    begin
      update public.profiles set timezone = 'Nowhere/City' where id = ua;
      res := res || 'Cambiar perfil a zona inválida rechazado|FAIL'::text;
    exception when invalid_parameter_value then
      res := res || 'Cambiar perfil a zona inválida rechazado|PASS'::text;
    end;

    -- -------------------------------------------------------------------------
    -- Vocabulario: type obligatorio y curación
    -- -------------------------------------------------------------------------
    begin
      insert into public.vocabulary (user_id, word, type) values (ua, 'x', 'slang');
      res := res || 'type fuera de word/phrasal_verb/idiom_slang rechazado|FAIL'::text;
    exception when check_violation then
      res := res || 'type fuera de word/phrasal_verb/idiom_slang rechazado|PASS'::text;
    end;

    begin
      insert into public.vocabulary (user_id, word, type) values (ua, 'x', null);
      res := res || 'type nulo rechazado|FAIL'::text;
    exception when not_null_violation then
      res := res || 'type nulo rechazado|PASS'::text;
    end;

    insert into public.vocabulary (user_id, word, context_sentence, type, source, source_url)
    values (ua, 'bite the bullet', 'They had to bite the bullet and lay off workers.',
            'idiom_slang', 'extension', 'https://example.com/article')
    returning id into v_word;

    select status into v_txt from public.vocabulary where id = v_word;
    res := res || ('Captura nace en pending_curation sin traducción|'
                   || case when v_txt = 'pending_curation' then 'PASS' else 'FAIL' end);

    begin
      update public.vocabulary set status = 'learning' where id = v_word;
      res := res || 'Curar sin traducción rechazado|FAIL'::text;
    exception when check_violation then
      res := res || 'Curar sin traducción rechazado|PASS'::text;
    end;

    update public.vocabulary set status = 'learning', translation = 'afrontar algo difícil' where id = v_word;
    res := res || 'Curar con traducción pasa a learning|PASS'::text;

    begin
      update public.vocabulary set status = 'mastered' where id = v_word;
      res := res || 'status curado distinto de retention_state rechazado|FAIL'::text;
    exception when check_violation then
      res := res || 'status curado distinto de retention_state rechazado|PASS'::text;
    end;

    -- -------------------------------------------------------------------------
    -- Modo Archivo (is_active_srs) y fecha de repaso
    -- -------------------------------------------------------------------------
    select due_at into v_ts from public.vocabulary where id = v_word;
    res := res || ('Registro activo en SRS recibe due_at|' || case when v_ts is not null then 'PASS' else 'FAIL' end);

    insert into public.vocabulary (user_id, word, translation, type, status, is_active_srs)
    values (ua, 'serendipity', 'casualidad afortunada', 'word', 'learning', false)
    returning id, due_at into v_archived, v_ts;
    res := res || ('Registro archivado no recibe due_at|' || case when v_ts is null then 'PASS' else 'FAIL' end);

    update public.vocabulary set is_active_srs = true where id = v_archived;
    select due_at into v_ts from public.vocabulary where id = v_archived;
    res := res || ('Reactivar archivado sin programación ⇒ vencido hoy|' || case when v_ts is not null then 'PASS' else 'FAIL' end);

    -- Se vuelve a archivar: conserva due_at pero debe quedar fuera de la cola.
    update public.vocabulary set is_active_srs = false where id = v_archived;

    -- Pendiente de curación (fuera de la cola) y término con repaso futuro (fuera de la cola).
    insert into public.vocabulary (user_id, word, type) values (ua, 'pending one', 'word');
    insert into public.vocabulary (user_id, word, translation, type, status, due_at)
    values (ua, 'future one', 'futuro', 'word', 'learning', now() + interval '1 day');

    -- -------------------------------------------------------------------------
    -- Speaking y Listening
    -- -------------------------------------------------------------------------
    begin
      insert into public.speaking_logs (id, user_id, title, storage_path, duration_seconds)
      values (s_id, ua, 'Resumen de mi día', ua::text || '/' || s_id::text || '.mp3', 601);
      res := res || 'Audio de más de 10 minutos rechazado|FAIL'::text;
    exception when check_violation then
      res := res || 'Audio de más de 10 minutos rechazado|PASS'::text;
    end;

    begin
      insert into public.speaking_logs (id, user_id, title, storage_path, duration_seconds)
      values (s_id, ua, 'Resumen de mi día', ub::text || '/' || s_id::text || '.mp3', 120);
      res := res || 'Audio fuera de la carpeta de su dueño rechazado|FAIL'::text;
    exception when check_violation then
      res := res || 'Audio fuera de la carpeta de su dueño rechazado|PASS'::text;
    end;

    begin
      insert into public.listening_logs (user_id, title, url, transcription)
      values (ua, 'Podcast', 'ftp://example.com/audio', 'hello');
      res := res || 'URL de listening no http/https rechazada|FAIL'::text;
    exception when check_violation then
      res := res || 'URL de listening no http/https rechazada|PASS'::text;
    end;

    -- -------------------------------------------------------------------------
    -- Writing: numeración, inmutabilidad y mismo dueño
    -- -------------------------------------------------------------------------
    insert into public.writing_logs (user_id, title) values (ua, 'Email a cliente') returning id into w_id;
    insert into public.writing_versions (writing_id, user_id, content) values (w_id, ua, 'Dear client, I write you for...');
    insert into public.writing_versions (writing_id, user_id, content) values (w_id, ua, 'Dear client, I am writing to...');

    select array_agg(version_number order by version_number) into v_arr
      from public.writing_versions where writing_id = w_id;
    res := res || ('Versiones de writing numeradas 1, 2|' || case when v_arr = array[1, 2] then 'PASS' else 'FAIL' end);

    begin
      update public.writing_versions set content = 'reescrito' where writing_id = w_id and version_number = 1;
      res := res || 'Modificar una versión de writing bloqueado|FAIL'::text;
    exception when object_not_in_prerequisite_state then
      res := res || 'Modificar una versión de writing bloqueado|PASS'::text;
    end;

    begin
      insert into public.writing_versions (writing_id, user_id, content) values (w_id, ub, 'intruso');
      res := res || 'Versión con dueño distinto al de la entrada rechazada|FAIL'::text;
    exception when foreign_key_violation then
      res := res || 'Versión con dueño distinto al de la entrada rechazada|PASS'::text;
    end;

    -- -------------------------------------------------------------------------
    -- Check-in diario
    -- -------------------------------------------------------------------------
    insert into public.habit_checkins (user_id, date, habit) values (ua, current_date, 'speaking');
    begin
      insert into public.habit_checkins (user_id, date, habit) values (ua, current_date, 'speaking');
      res := res || 'Check-in duplicado (mismo día y hábito) rechazado|FAIL'::text;
    exception when unique_violation then
      res := res || 'Check-in duplicado (mismo día y hábito) rechazado|PASS'::text;
    end;

    -- -------------------------------------------------------------------------
    -- Cola de repasos
    -- A: 'bite the bullet' (vencido) + 'Email a cliente' (vencido) = 2.
    -- Fuera: archivado vencido, pendiente de curación y repaso futuro.
    -- -------------------------------------------------------------------------
    insert into public.vocabulary (user_id, word, translation, type, status)
    values (ub, 'secret of B', 'secreto de B', 'word', 'learning');

    select count(*) into v_int from public.srs_queue where user_id = ua;
    res := res || ('srs_queue excluye archivados, futuros y pendientes|'
                   || case when v_int = 2 then 'PASS' else 'FAIL (' || v_int || ' en vez de 2)' end);

    -- -------------------------------------------------------------------------
    -- Actividad diaria (003): base de la racha y del mapa de calor.
    -- A tiene zona America/Bogota (UTC−5).
    -- -------------------------------------------------------------------------
    select coalesce(sum(vocabulary_count), 0), coalesce(sum(checkin_count), 0)
      into v_int, v_int2
      from public.daily_activity where user_id = ua;
    res := res || ('daily_activity cuenta el vocabulario y los check-ins de A|'
                   || case when v_int = (select count(*) from public.vocabulary where user_id = ua) and v_int2 = 1
                           then 'PASS' else 'FAIL' end);

    -- 03:30 UTC del 10 de enero = 22:30 del 9 de enero en Bogotá.
    insert into public.review_events (user_id, item_type, item_id, grade, reviewed_at)
    values (ua, 'writing', w_id, 3, '2026-01-10 03:30:00+00');
    select coalesce(sum(review_count), 0) into v_int
      from public.daily_activity where user_id = ua and day = date '2026-01-09';
    res := res || ('daily_activity usa el día local del usuario (22:30 en Bogotá ≠ día siguiente UTC)|'
                   || case when v_int = 1 then 'PASS' else 'FAIL' end);

    -- -------------------------------------------------------------------------
    -- RLS: actuar como el usuario A con la publishable key
    -- -------------------------------------------------------------------------
    select count(*) into v_int2 from public.vocabulary where user_id = ua;

    perform set_config('request.jwt.claims',
                       json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    set local role authenticated;

    select count(*) into v_int from public.vocabulary;
    res := res || ('RLS: A ve solo su vocabulario|'
                   || case when v_int = v_int2 then 'PASS' else 'FAIL' end);

    select count(*) into v_int from public.vocabulary where user_id = ub;
    res := res || ('RLS: A no ve el vocabulario de B|' || case when v_int = 0 then 'PASS' else 'FAIL' end);

    select count(*) into v_int from public.srs_queue;
    res := res || ('RLS: la cola de A no incluye registros de B|' || case when v_int = 2 then 'PASS' else 'FAIL' end);

    select count(*) into v_int from public.profiles;
    res := res || ('RLS: A ve solo su perfil|' || case when v_int = 1 then 'PASS' else 'FAIL' end);

    select count(*) into v_int from public.daily_activity where user_id = ua;
    res := res || ('RLS: A ve su propia actividad diaria|' || case when v_int > 0 then 'PASS' else 'FAIL' end);

    select count(*) into v_int from public.daily_activity where user_id = ub;
    res := res || ('RLS: A no ve la actividad diaria de B|' || case when v_int = 0 then 'PASS' else 'FAIL' end);

    begin
      insert into public.vocabulary (user_id, word, translation, type, status)
      values (ub, 'inyectado', 'x', 'word', 'learning');
      res := res || 'RLS: A no puede crear registros a nombre de B|FAIL'::text;
    exception when insufficient_privilege then
      res := res || 'RLS: A no puede crear registros a nombre de B|PASS'::text;
    end;

    reset role;

    -- Visitante sin sesión (anon).
    begin
      set local role anon;
      select count(*) into v_int from public.vocabulary;
      reset role;
      res := res || ('RLS: un visitante sin sesión no ve nada|' || case when v_int = 0 then 'PASS' else 'FAIL' end);
    exception when insufficient_privilege then
      reset role;
      res := res || 'RLS: un visitante sin sesión no ve nada|PASS'::text;
    end;

    -- -------------------------------------------------------------------------
    -- Storage y borrado en cascada
    -- -------------------------------------------------------------------------
    select public into v_bool from storage.buckets where id = 'speaking-audio';
    res := res || ('Bucket speaking-audio existe y es privado|'
                   || case when v_bool = false then 'PASS' else 'FAIL' end);

    delete from auth.users where id = ub;
    select (select count(*) from public.vocabulary where user_id = ub)
         + (select count(*) from public.profiles where id = ub)
      into v_int;
    res := res || ('Borrar una cuenta borra todos sus datos|' || case when v_int = 0 then 'PASS' else 'FAIL' end);

    -- Revierte TODO lo anterior.
    raise exception 'eb_rollback' using errcode = 'EB000';
  exception
    when sqlstate 'EB000' then
      null;
    when others then
      res := res || ('Error inesperado (revisa que 001 y 002 se ejecutaron)|ERROR: ' || sqlerrm);
  end;

  return query
    select split_part(t.x, '|', 1), split_part(t.x, '|', 2)
      from unnest(res) with ordinality as t(x, n)
     order by t.n;
end;
$$;

select * from pg_temp.eb_run_checks();
