---
name: migracion-supabase
description: Receta para cambiar el esquema de la base de datos de EnglishBrain (Supabase/Postgres) - crear migración SQL numerada, su rollback y nuevas comprobaciones en verify_schema.sql, probarla antes con PGlite en el scratchpad y guiar al usuario para aplicarla en el SQL Editor de Supabase. Úsala cuando haga falta una tabla, columna, CHECK, trigger, índice, vista, política RLS o cambio en Storage.
---

# Migración de Supabase en EnglishBrain

El usuario **no tiene CLI de Supabase, Docker ni psql**: aplica el SQL a mano en el SQL Editor. Habla español y quiere pasos detallados. **Explica primero el cambio de esquema y espera su "dale"** antes de escribir archivos.

## 0. Contexto

- Carpeta: `Backend/supabase/` — `migrations/NNN_<nombre>.sql`, `rollback/NNN_down.sql`, `checks/verify_schema.sql`, `README.md`.
- Lee las migraciones existentes y el `design.md` del change activo o, si no hay, el del plan inicial en `openspec/changes/archive/2026-10-13-bootstrap-englishbrain-platform/design.md` (decisiones D3 aislamiento, D4 SRS, D6 audio y la sección de detalles del esquema).
- **No edites migraciones ya aplicadas** (001, 002…): crea la siguiente numerada (`003_<nombre>.sql`).

## 1. Convenciones del SQL

- Cabecera con el bloque de `=====` igual que las existentes: nombre del archivo, qué hace, cuándo ejecutarlo, referencias a design.md.
- Todo dentro de `begin; … commit;`.
- **Idempotente** (se puede ejecutar dos veces): `create table if not exists`, `create or replace function`, `create or replace trigger`, `drop policy if exists` antes de `create policy`, `add column if not exists`, `create index if not exists`.
- Tablas de usuario: `user_id uuid not null references auth.users(id) on delete cascade`, `created_at`/`updated_at` con el trigger `set_updated_at`.
- Seguridad en dos capas: el Backend filtra por `user_id` (capa 1); la migración **siempre** activa RLS y crea la política `<tabla>_owner_all` con `auth.uid() = user_id` (capa 2).
- Ítems con SRS: columnas del bloque SRS y trigger `srs_defaults`, como las tablas existentes.
- Reglas de negocio en la base cuando se pueda: CHECKs con nombre claro, FKs compuestas `(id, user_id)` para garantizar mismo dueño.
- Comentarios en español explicando el porqué de cada regla no obvia.

## 2. Rollback

`rollback/NNN_down.sql`: deshace exactamente la migración, en orden inverso, con `drop … if exists`, dentro de `begin/commit`. Indica en la cabecera el orden de ejecución y si borra datos (⚠️).

## 3. Comprobaciones

Añade casos a `checks/verify_schema.sql` dentro de `pg_temp.eb_run_checks()` siguiendo el patrón:
- Cada check añade `'Descripción en español|PASS'` o `'…|FAIL'` a `res`.
- Para comprobar que algo se rechaza: bloque `begin … exception when <error> then … end;`.
- Prueba también el aislamiento entre los usuarios `ua` y `ub` cuando aplique.
- Todo se revierte al final con `raise exception 'eb_rollback' using errcode = 'EB000'` (no deja datos).
- Actualiza el número total de comprobaciones donde aparezca (README y cabecera).

## 4. Probar antes con PGlite (en el scratchpad, nunca en el repo)

1. En el scratchpad: `npm init -y` y `npm install @electric-sql/pglite`.
2. Script Node que cree un "stub" mínimo de lo que da Supabase: esquemas `auth` y `storage`, tabla `auth.users`, función `auth.uid()`, roles `authenticated`/`anon`, tablas `storage.buckets`/`storage.objects` y `storage.foldername()` si se usan.
3. Ejecutar en orden 001, 002, … la nueva migración, luego ejecutarla **otra vez** (idempotencia), luego `verify_schema.sql` y comprobar que todo es PASS.
4. Ejecutar el rollback y volver a aplicar la migración.
5. Si PGlite no soporta algo propio de Supabase, dilo claramente y explica qué queda sin probar.

## 5. Actualizar el resto

- `Backend/supabase/README.md`: fila nueva en la tabla de archivos, pasos de aplicación, reglas clave nuevas, síntomas de error conocidos.
- `Backend/tests/helpers/fakeSupabase.ts`: imitar los nuevos defaults, triggers o CHECKs que importen en las pruebas.
- `design.md`: si se fijó un detalle nuevo del esquema, añadirlo en la sección de detalles.

## 6. Guiar al usuario para aplicarla

Dale los pasos exactos, numerados:
1. supabase.com → su proyecto → **SQL Editor** → **New query**.
2. Abrir `Backend/supabase/migrations/NNN_….sql` en VS Code, copiar todo, pegar, **Run**. Esperado: `Success. No rows returned`. Si sale el aviso de "destructive operation"/RLS, **Run this query**.
3. **New query** → pegar `checks/verify_schema.sql` → **Run**. Esperado: N filas, todas `PASS`.
4. Si algo sale FAIL/ERROR, que copie la tabla completa y la comparta.

Espera a que confirme el resultado antes de dar la tarea por hecha.
