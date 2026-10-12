# EnglishBrain · Backend

API REST de EnglishBrain: Node.js + TypeScript + Express sobre Supabase.
Es el único componente que habla con la base de datos; el Frontend y la extensión de Chrome solo hablan con esta API.

## Requisitos

- **Node.js 20 o superior** (`node -v`)
- Un proyecto de **Supabase** con las migraciones aplicadas (ver abajo)

## Puesta en marcha desde cero

### 1. Base de datos (una sola vez)

Sigue [supabase/README.md](supabase/README.md): ejecutar `001_schema.sql` y `002_rls_queue_storage.sql` en el SQL Editor de Supabase y comprobar con `checks/verify_schema.sql` que todo sale PASS.

### 2. Instalar dependencias

```bash
cd Backend
npm install
```

### 3. Variables de entorno

Copia la plantilla y rellénala:

```bash
cp .env.example .env        # en PowerShell: Copy-Item .env.example .env
```

| Variable | Obligatoria | Dónde se obtiene | Ejemplo |
|---|---|---|---|
| `SUPABASE_URL` | Sí | Supabase → Settings → Data API → Project URL | `https://ujipnxeaipreyjcnoean.supabase.co` |
| `SUPABASE_SECRET_KEY` | Sí | Supabase → Settings → API Keys → **Secret keys** | `sb_secret_…` |
| `CORS_ORIGINS` | Sí | Direcciones del Frontend que pueden llamar a la API, separadas por coma | `http://localhost:5173` |
| `PORT` | No (3000) | Puerto donde escucha la API | `3000` |

> ⚠️ La **secret key** da acceso total a la base de datos. Solo va en `Backend/.env`, que nunca se sube (está en `.gitignore`). La **publishable key** no se usa aquí: va en el `.env` del Frontend.

Si falta una variable o tiene un formato incorrecto, el servidor no arranca y dice cuál es.

### 4. Arrancar

```bash
npm run dev
```

Debe aparecer `EnglishBrain API escuchando en http://localhost:3000`. Deja esa terminal abierta (`Ctrl+C` para apagar).

### 5. Comprobar

Abre <http://localhost:3000/api/health> en el navegador. Respuesta esperada:

```json
{ "status": "ok", "service": "englishbrain-backend", "timestamp": "…" }
```

`http://localhost:3000` a secas responde 404: la API no tiene página de inicio, solo rutas `/api/…`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca en modo desarrollo y se reinicia al guardar cambios |
| `npm test` | Ejecuta las pruebas (Vitest) |
| `npm run test:watch` | Pruebas en modo vigilancia |
| `npm run typecheck` | Comprueba los tipos de TypeScript sin compilar |
| `npm run build` | Compila `src/` a `dist/` |
| `npm start` | Arranca la versión compilada (`dist/server.js`) |

## Estructura

```
Backend/
├── src/
│   ├── server.ts            # punto de entrada: carga .env, valida config y arranca
│   ├── app.ts               # construye la app Express (rutas + middlewares)
│   ├── config.ts            # lectura y validación de variables de entorno
│   ├── errors.ts            # HttpError y atajos (badRequest, notFound, …)
│   ├── validation.ts        # parse(schema, datos): validación con zod
│   ├── controllers/         # reciben la petición y devuelven la respuesta
│   ├── services/            # lógica de negocio y acceso a Supabase
│   ├── routes/              # asocian URLs con controllers
│   └── middlewares/         # errores, autenticación, …
├── tests/                   # pruebas de Vitest + supertest
└── supabase/                # migraciones SQL, verificación y rollback
```

## Convenciones de la API

**Formato de error**: toda respuesta de error tiene la misma forma.

```json
{ "error": { "code": "validation_error", "message": "Los datos enviados no son válidos",
             "details": [{ "field": "type", "message": "…" }] } }
```

| Código | Estado | Cuándo |
|---|---|---|
| `validation_error` | 400 | Los datos no cumplen el esquema (`details` indica cada campo) |
| `invalid_json` | 400 | El cuerpo no es JSON válido |
| `bad_request` | 400 | Petición incorrecta por otro motivo |
| `unauthorized` | 401 | Falta la sesión o no es válida |
| `forbidden` | 403 | Sin permiso para la acción |
| `not_found` | 404 | No existe, **o pertenece a otro usuario** |
| `conflict` | 409 | Choca con datos existentes |
| `payload_too_large` | 413 | Cuerpo de más de 100 KB |
| `internal_error` | 500 | Error inesperado (el detalle solo se registra en la consola del servidor) |
| `service_unavailable` | 503 | Supabase Auth no respondió; reintentar |

**Mensajes**: siempre en español y en lenguaje claro, pensados para mostrarse bajo cada campo del formulario.
- `details[].field` es el nombre del campo; los errores que no son de un campo concreto usan `_general`.
- Se distingue campo ausente ("La palabra es obligatoria") de tipo incorrecto ("La palabra debe ser un texto").
- Usa los ayudantes de `validation.ts` (`requiredText`, `optionalText`, `choice`, `isActiveSrsField`, `queryInt`, `paginationFields`, `searchField`) para que todos los endpoints hablen igual.
- zod está configurado en español como red de seguridad, y `tests/messages.test.ts` falla si algún mensaje de la API sale en inglés.

**Validación en un controller**:

```ts
const body = parse(createWordSchema, req.body); // lanza 400 validation_error si no es válido
```

**Supabase**: el cliente compartido está en `req.app.locals.supabase` (creado en `services/supabase.ts`). Usa la secret key, que **omite RLS**: cualquier consulta de datos de usuario debe filtrar por `user_id`.

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/health` | No | Comprueba que la API está viva |
| GET | `/api/me` | Sesión | Perfil: `id`, `email`, `display_name`, `timezone` |
| PATCH | `/api/me` | Sesión | Cambia `display_name` (1–60 o `null`) y/o `timezone` (IANA) |
| GET | `/api/me/capture-tokens` | Sesión | Lista los tokens de la extensión (sin el token completo) |
| POST | `/api/me/capture-tokens` | Sesión | Crea un token `{ label }`; la respuesta incluye `token` **una sola vez** |
| DELETE | `/api/me/capture-tokens/:id` | Sesión | Revoca un token (204) |
| POST | `/api/capture` | Token `ebk_` | Captura de la extensión `{ word, context_sentence?, source_url? }` → `pending_curation` con tipo provisional (1 término = `word`, varios = `idiom_slang`). El contexto se recorta a 2000 caracteres |
| GET | `/api/vocabulary` | Sesión | Lista `{ items, total }`. Filtros: `status`, `type`, `source`, `q` (busca en palabra, contexto y traducción), `limit` (1–200, por defecto 50), `offset`. Con `status=pending_curation` ordena del más antiguo al más reciente; si no, al revés |
| POST | `/api/vocabulary` | Sesión | Creación manual `{ word, translation, type, context_sentence?, definition?, is_active_srs? }` → `learning`, origen `manual` |
| GET | `/api/vocabulary/:id` | Sesión | Una palabra |
| PATCH | `/api/vocabulary/:id` | Sesión | Edita `word`, `context_sentence`, `translation`, `definition`, `type` (no cambia estado ni SRS) |
| DELETE | `/api/vocabulary/:id` | Sesión | Borra; también descarta capturas del Inbox (204) |
| PATCH | `/api/vocabulary/:id/curate` | Sesión | Inbox → `learning` `{ translation, type, definition?, word?, context_sentence?, is_active_srs? }`. Activa en SRS ⇒ vence ahora. Ya curada ⇒ `409` |
| GET | `/api/errors` | Sesión | Muro de errores `{ items, total }`. Filtros: `status` (`active` / `resolved`), `q` (frases y nota), `limit`, `offset` |
| POST | `/api/errors` | Sesión | `{ incorrect_phrase, correct_phrase, notes?, is_active_srs? }` → nace activo |
| GET / DELETE | `/api/errors/:id` | Sesión | Ver o borrar un error |
| PATCH | `/api/errors/:id` | Sesión | Edita frases o nota; `{ is_resolved: true }` lo marca superado (guarda `resolved_at`, no lo saca de Anki) |
| GET | `/api/writing` | Sesión | Entradas con `version_count`, `latest_version_number`, `latest_version_at` y `excerpt` (200 caracteres de la última versión). Filtro `q` (título) |
| POST | `/api/writing` | Sesión | `{ title, content, is_active_srs? }` → entrada + versión 1 (el original) |
| GET | `/api/writing/:id` | Sesión | Entrada con todas sus `versions` (1, 2, 3…) |
| PATCH | `/api/writing/:id` | Sesión | Solo cambia `title` |
| POST | `/api/writing/:id/versions` | Sesión | Añade una versión corregida `{ content }`; se numera sola y nunca se modifica |
| DELETE | `/api/writing/:id` | Sesión | Borra la entrada con todas sus versiones (no hay borrado de versiones sueltas) |
| GET | `/api/listening` | Sesión | Retos de escucha con `open_url`. Filtro `q` (título y transcripción) |
| POST | `/api/listening` | Sesión | `{ title, url (http/https), start_seconds?, transcription, is_active_srs? }` |
| GET / PATCH / DELETE | `/api/listening/:id` | Sesión | Ver, editar (cualquier campo; `start_seconds: null` lo quita) o borrar. `open_url` salta al segundo de inicio en YouTube |
| GET | `/api/speaking` | Sesión | Monólogos `{ items, total }` (sin la ruta interna del audio). Filtro `q` (título) |
| POST | `/api/speaking` | Sesión | **multipart/form-data**: `audio` (MP3 real, ≤ 15 MB), `title`, `duration_seconds` (1–600, debe cuadrar con el tamaño), `recording_limit_minutes?` (3/5/10), `is_active_srs?` (`true`/`false`). Sube a `speaking-audio/{user_id}/{id}.mp3` y crea la ficha; si la ficha falla, borra el audio. Si la subida falla → `503` y no se crea nada |
| GET | `/api/speaking/:id` | Sesión | Una ficha |
| PATCH | `/api/speaking/:id` | Sesión | Solo cambia `title` |
| GET | `/api/speaking/:id/audio-url` | Sesión | `{ url, expires_at }`: enlace firmado de 5 minutos para reproducir (solo el dueño) |
| DELETE | `/api/speaking/:id` | Sesión | Borra la ficha y su audio (204) |

*(La tabla crece con cada grupo de tareas.)*

## Autenticación

| Tipo | Cabecera | Quién la usa | Middleware |
|---|---|---|---|
| **Sesión** | `Authorization: Bearer <access token de Supabase>` | Frontend | `requireAuth` |
| **Token de extensión** | `Authorization: Bearer ebk_…` | Extensión de Chrome, solo en rutas de captura | `requireCaptureToken` |

- La sesión se valida contra Supabase Auth en cada petición: un logout se respeta al instante.
- Los tokens `ebk_` se guardan solo como SHA-256; el valor completo se muestra una vez al crearlo. Un token no sirve como sesión ni al revés.
- **Aislamiento**: toda consulta de datos de usuario pasa por `scoped(supabase, tabla, userId)` (`services/scoped.ts`), que filtra por `user_id` y lo fuerza al insertar. Un registro de otro usuario responde `404`, como si no existiera.

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| `✖ Faltan variables de entorno: …` | Rellena en `.env` la variable indicada y guarda |
| `✖ Variables de entorno inválidas` | El mensaje dice qué variable y por qué; corrígela |
| PowerShell: *la ejecución de scripts está deshabilitada* | Usa `npm.cmd run dev` o una terminal Command Prompt |
| `Missing script: "dev"` | No estás dentro de `Backend/` |
| `No se pudo arrancar en el puerto 3000` | Otro programa usa el puerto: cambia `PORT` en `.env` |
| El navegador dice `ERR_CONNECTION_REFUSED` | El servidor no está encendido: ejecuta `npm run dev` |
