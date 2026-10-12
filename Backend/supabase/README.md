# Base de datos de EnglishBrain (Supabase)

Esquema multiusuario: cada fila pertenece a un usuario (`user_id`) y nadie puede ver los datos de otro.

| Archivo | Qué hace |
|---|---|
| `migrations/001_schema.sql` | 10 tablas, restricciones, índices y triggers |
| `migrations/002_rls_queue_storage.sql` | Seguridad por filas (RLS), vista `srs_queue`, bucket `speaking-audio` y sus políticas |
| `checks/verify_schema.sql` | 28 comprobaciones PASS/FAIL. No deja datos |
| `rollback/002_down.sql`, `rollback/001_down.sql` | Deshacen las migraciones (⚠️ `001_down` borra todos los datos) |

## Aplicar (primera vez)

1. Abre tu proyecto en [supabase.com](https://supabase.com) → menú izquierdo → **SQL Editor** → **New query**.
2. Abre `migrations/001_schema.sql` en VS Code, copia **todo** el contenido, pégalo en el editor y pulsa **Run** (o `Ctrl+Enter`).
   - Resultado esperado: `Success. No rows returned`.
3. Pulsa **New query** otra vez, haz lo mismo con `migrations/002_rls_queue_storage.sql` y pulsa **Run**.
   - Resultado esperado: `Success. No rows returned`.
4. Pulsa **New query**, pega `checks/verify_schema.sql` y pulsa **Run**.
   - Resultado esperado: una tabla de 28 filas, todas con `PASS` en la columna `result`.

Si Supabase muestra un aviso de "destructive operation" o de "RLS", confirma con **Run this query**: es normal porque los scripts crean políticas y triggers.

Ambas migraciones se pueden volver a ejecutar sin romper nada (son idempotentes).

## Comprobar a ojo

- **Table Editor**: deben aparecer `profiles`, `capture_tokens`, `vocabulary`, `fossilized_errors`, `speaking_logs`, `writing_logs`, `writing_versions`, `listening_logs`, `review_events`, `habit_checkins`, todas con la etiqueta de RLS activado.
- **Storage**: debe existir el bucket `speaking-audio`, marcado como privado.
- **Authentication → Users**: si ya tenías usuarios, cada uno tiene su fila en `profiles`.

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| `relation "public.vocabulary" does not exist` al ejecutar 002 | Ejecuta primero `001_schema.sql` |
| `must be owner of table objects` al crear las políticas de Storage | Crea las 3 políticas desde **Storage → Policies → speaking-audio** con la condición `(storage.foldername(name))[1] = auth.uid()::text` para SELECT, INSERT y DELETE (rol `authenticated`) |
| Alguna fila de `verify_schema.sql` sale `FAIL` o `ERROR` | Copia la tabla completa y compártela |

## Deshacer

Ejecuta `rollback/002_down.sql` y después `rollback/001_down.sql` en el SQL Editor.
El bucket `speaking-audio` se borra a mano desde **Storage** (Supabase no permite borrarlo por SQL).

## Reglas clave que impone la base de datos

- `vocabulary.type` es obligatorio y solo admite `word`, `phrasal_verb` o `idiom_slang`.
- Un término curado (`status` distinto de `pending_curation`) siempre tiene traducción, y su `status` coincide con `retention_state`.
- `is_active_srs = true` sin fecha de repaso ⇒ el trigger pone `due_at = now()`. Archivar conserva `due_at`, pero la vista `srs_queue` excluye todo lo archivado.
- Audios: máximo 600 s, ruta obligatoria `{user_id}/{id}.mp3`, bucket privado de hasta 15 MB y solo `audio/mpeg`.
- Las versiones de writing se numeran solas (1, 2, 3…), nunca se modifican y siempre son del mismo dueño que su entrada.
- Un check-in por usuario, día y hábito.
- Al borrar una cuenta en `auth.users` se borran en cascada todos sus datos.
- `review_events` no tiene FK al ítem repasado, así las rachas pasadas se mantienen aunque borres un registro.
