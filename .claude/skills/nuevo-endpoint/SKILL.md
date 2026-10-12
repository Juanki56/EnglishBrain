---
name: nuevo-endpoint
description: Receta para añadir o modificar un recurso/endpoint REST en el Backend de EnglishBrain (Express + TypeScript + Supabase) siguiendo las convenciones del proyecto - route → controller → service con scoped(), validación zod con mensajes en español, tests con fakeSupabase y cierre de grupo (typecheck, tests, sin dist, tasks.md). Úsala al implementar tareas de los grupos de Backend de OpenSpec (speaking, SRS, hábitos, estadísticas…) o cuando el usuario pida "un endpoint nuevo", "una ruta nueva" o "cerrar el grupo".
---

# Nuevo endpoint en el Backend de EnglishBrain

El usuario habla español y quiere explicaciones detalladas paso a paso. **Antes de escribir código**, explica qué vas a crear (rutas, campos, archivos) y espera su "dale". Implementa solo las tareas que apruebe.

## 0. Contexto antes de empezar

1. Lee la tarea en `openspec/changes/<change>/tasks.md` y la spec correspondiente en `openspec/changes/<change>/specs/`.
2. Revisa en `design.md` las decisiones que afecten (aislamiento D3, SRS D4, audio D6…).
3. Mira la tabla en `Backend/supabase/migrations/001_schema.sql`: columnas, CHECKs y triggers. Si falta algo en el esquema, usa la skill `migracion-supabase` primero.
4. Usa como plantilla un recurso existente parecido: `listening` (CRUD simple), `writing` (hijos inmutables), `vocabulary` (filtros + curación), `captureTokens` (token propio).

## 1. Archivos (uno por capa, nombres en inglés, comentarios en español)

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Route | `src/routes/<recurso>.routes.ts` | `Router()`, `router.use(requireAuth)`, mapear verbos → controllers. Comentario `/** /api/<recurso>/... · descripción */` |
| Controller | `src/controllers/<recurso>.controller.ts` | Esquemas zod + `parse(schema, req.body/req.query)`, llamar al service con `getSupabase(req)` y `getUserId(req)`, elegir status (201 al crear, 204 al borrar con `res.status(204).end()`) |
| Service | `src/services/<recurso>.service.ts` | Acceso a datos. Interfaz de la fila, constante `COLUMNS`, helper `const x = (supabase, userId) => scoped(supabase, '<tabla>', userId)` |
| App | `src/app.ts` | `app.use('/api/<recurso>', <recurso>Router)` antes de `notFoundHandler` |

Imports con extensión `.js` (ESM): `from '../services/scoped.js'`.

## 2. Reglas obligatorias

**Aislamiento por usuario (design D3):** el cliente usa la secret key y omite RLS, así que TODA consulta a datos de usuario pasa por `scoped()` de `src/services/scoped.ts`. Nunca `supabase.from(...)` directo sobre tablas con `user_id`.
- Leer/editar/borrar por id: primero `findById(id, 'id')` (da 404 si no existe, no es del usuario o no es uuid), luego la operación con `.eq('id', id)`.
- Un registro de otro usuario responde **404**, nunca 403.
- Comprueba errores con `throwIfError(error)` de `src/services/db.ts`.

**Validación y mensajes (en español humano, por campo):**
- Usa los helpers de `src/validation.ts`: `requiredText(label, max, 'f'|'m')`, `optionalText`, `choice(values, mensaje)`, `isActiveSrsField`, `queryInt`, `paginationFields`, `searchField`. El `label` lleva artículo: "El título", "La URL".
- Mensajes distinguen ausente ("X es obligatorio/a") de tipo incorrecto ("X debe ser un texto"). Nada de nombres técnicos ("is_active_srs…") ni inglés.
- PATCH: todos los campos `.optional()` y `.refine(... , { error: 'Envía al menos un campo para editar' })`.
- Errores con los constructores de `src/errors.ts` (`notFound`, `conflict`, `badRequest`…). Formato de salida: `{ error: { code, message, details? } }`.

**Listados:** devuelven `{ items, total }` con `select(COLUMNS, { count: 'exact' })`, `order('created_at', { ascending: false })` y `range(offset, offset + limit - 1)`.

## 3. Tests (`Backend/tests/<recurso>.test.ts`)

- `supertest` + `createApp({ supabase })` con `createTwoUserSupabase()` de `tests/helpers/fakeSupabase.ts`; cabeceras `asA`/`asB` con `SESSION_A`/`SESSION_B`.
- Nombres de los `it(...)` en español describiendo el comportamiento.
- Cubre: caso feliz, campos obligatorios (400 con `details[].field`), límites, **aislamiento** (B no ve/edita/borra lo de A ⇒ 404 y los datos de A siguen intactos), 401 sin sesión.
- Si el fake no soporta un método del query builder, una regla CHECK o un trigger que necesitas, amplía `fakeSupabase.ts` imitando la base real (`001_schema.sql`).
- Añade los casos inválidos de cada endpoint nuevo a `INVALID_CASES` en `tests/messages.test.ts` (comprueba que ningún mensaje sale en inglés).

## 4. Verificación y cierre

Desde `Backend/`:
1. `npm run typecheck` — sin errores.
2. `npm test` — todo verde; reporta el número total de tests.
3. **No dejes `Backend/dist/`**: no uses `npm run build` en el proyecto; si apareció `dist/`, bórralo.
4. Marca las tareas hechas en `tasks.md` (`- [x]`).
5. Si cambian rutas o el uso, actualiza `Backend/README.md`.
6. Propón al usuario la skill `prueba-real` para probar contra su Supabase.
7. Termina explicando qué se hizo, el resultado de tests y qué viene después; espera aprobación.

**Nunca** imprimas valores de `Backend/.env`; como mucho, nombres de variables.
