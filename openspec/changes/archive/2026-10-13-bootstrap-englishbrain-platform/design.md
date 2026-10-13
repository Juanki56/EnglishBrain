# Design

## Context

Proyecto greenfield: el workspace solo contiene `openspec/` y `openspec.initial.md`. Ver proposal.md (Why) para la motivación y `specs/` para los requisitos. Restricciones fijadas por el contexto inicial:

- Tres carpetas desacopladas en un único workspace, con jerarquía obligatoria:
  - `Backend/src/` → `controllers/`, `services/`, `routes/`, `middlewares/`, `server.ts`
  - `Frontend/src/` → `components/ui/`, `components/dashboard/`, `components/anki/`, `components/speaking/`, `hooks/`, `views/`
  - `Extension/` → `manifest.json`, `background.js`, `content.js`
- Supabase como única persistencia y proveedor de identidad (Auth + PostgreSQL + Storage para .mp3). El proyecto usa el formato nuevo de claves: *publishable* (`sb_publishable_…`) y *secret* (`sb_secret_…`).
- Multiusuario con datos privados por usuario, Desktop-First sin soporte móvil, cero IA externa.

## Goals / Non-Goals

**Goals:**
- Un único punto de acceso a datos (Backend) que concentre validación, reglas de negocio (SRS, racha, `is_active_srs`), aislamiento por usuario y credenciales.
- Aislamiento por usuario en dos capas: filtro obligatorio en el Backend y RLS en PostgreSQL/Storage.
- Modelo de datos donde todas las categorías estudiables comparten la misma maquinaria SRS.
- Interacciones críticas (Inbox, Anki) 100 % operables por teclado.

**Non-Goals:**
- Login social (Google u otros), roles de administrador, panel de administración.
- Cuotas o límites de almacenamiento/peticiones por usuario.
- Contenido compartido entre usuarios (mazos comunes, profesor/alumno).
- Eliminación de cuenta self-service (se hace manualmente desde Supabase; el borrado en cascada ya lo soporta).
- Layout responsive / móvil, PWA u offline completo.
- Traducción, definición o evaluación automática (IA, diccionarios externos).
- Publicación de la extensión en Chrome Web Store (se carga como "unpacked").
- Despliegue productivo en la nube (se documenta ejecución local; despliegue queda para un cambio posterior).

## Decisions

### D1. Frontend: React + Vite + TypeScript + Tailwind + React Router
La estructura exigida usa `src/views/` y `src/hooks/`, que encaja con una SPA y no con el árbol `app/` de Next.js App Router. No se necesita SSR (todo el contenido está tras login).
- *Alternativa*: Next.js App Router — descartada porque obligaría a duplicar `app/` además de `views/` y añade un servidor innecesario.

### D2. Backend como gateway único hacia Supabase
Todos los **datos** pasan por la API REST de Express. El Backend usa `@supabase/supabase-js` con la *secret key* (`SUPABASE_SECRET_KEY`, solo en `Backend/.env`). El Frontend usa la *publishable key* exclusivamente para Supabase Auth (registro, login, confirmación, recuperación, refresco de sesión); nunca consulta tablas ni Storage directamente.
- *Alternativa*: Frontend/Extension contra Supabase directo con RLS — descartada: el contexto describe el envío "directo a Supabase", pero eso exigiría exponer claves en la extensión y repartir reglas de negocio (SRS, validación de `type`) en tres clientes. El efecto observable para el usuario es el mismo (POST en segundo plano, fila en `vocabulary`).
- *Alternativa*: implementar registro/login propio en Express — descartada: Supabase Auth ya resuelve hash de contraseñas, emails de confirmación y recuperación, y rotación de sesiones.

### D3. Autenticación multiusuario y aislamiento
- **Flujos de cuenta** (registro, confirmación, login, logout, recuperación): `supabase.auth.*` en el Frontend. Los enlaces de email redirigen a `/auth/callback` y `/reset-password` del Frontend.
- **Sesión en la API**: el Frontend envía el access token como `Authorization: Bearer`; `middlewares/auth.ts` lo valida con `supabase.auth.getUser(token)` y fija `req.userId`. Sin token válido → 401.
- **Aislamiento en el Backend (capa 1)**: como la *secret key* omite RLS, todo acceso a tablas pasa por un helper `scoped(table, userId)` en `services/` que añade `.eq('user_id', userId)` a SELECT/UPDATE/DELETE e inyecta `user_id` en INSERT. Un registro ajeno se trata como inexistente (404). Queda prohibido usar el cliente Supabase sin el helper fuera de él.
- **RLS (capa 2)**: todas las tablas con RLS activado y políticas `user_id = auth.uid()` para el rol `authenticated`; Storage con política por prefijo de carpeta `{auth.uid()}/`. Protege ante un uso futuro de la publishable key o un error en el Backend.
- **Extension**: tokens personales en `capture_tokens (id, user_id, label, token_hash, last4, created_at, last_used_at, revoked_at)`. Formato `ebk_` + 32 bytes aleatorios en base64url; solo se guarda el SHA-256. `middlewares/captureToken.ts` busca por hash, rechaza revocados y fija `req.userId`. El token solo autoriza `POST /api/capture`.
- *Alternativa*: login completo dentro de la extensión — más fricción para el usuario y gestión de refresco de sesión en un service worker que se suspende.

### D4. Modelo de datos: tablas por categoría + columnas SRS comunes
Tablas `vocabulary`, `fossilized_errors`, `speaking_logs`, `writing_logs` (+ `writing_versions`), `listening_logs`. **Todas** las tablas de datos (incluidas las transversales) llevan `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` e índice compuesto que empieza por `user_id` (p. ej. `(user_id, due_at)`, `(user_id, status)`). Cada tabla estudiable incluye además:

| columna | tipo | nota |
|---|---|---|
| `is_active_srs` | boolean default true | Modo Archivo |
| `due_at` | timestamptz null | null si archivado sin programar |
| `interval_days` | numeric default 0 | |
| `ease` | numeric default 2.5 | |
| `repetitions` | int default 0 | |
| `lapses` | int default 0 | |
| `retention_state` | text check in (learning, reviewing, mastered) | derivado al calificar |

`vocabulary` añade `word`, `context_sentence`, `translation`, `definition`, `type` (CHECK `word|phrasal_verb|idiom_slang`, NOT NULL), `status` (CHECK `pending_curation|learning|reviewing|mastered`), `source` (`extension|manual`), `source_url`.
Tablas transversales: `review_events (id, user_id, item_type, item_id, grade 1–4, reviewed_at)` y `habit_checkins (user_id, date, habit CHECK reading_listening|speaking|writing, UNIQUE(user_id, date, habit))`.
Tablas de cuenta: `profiles (id uuid PK = auth.users.id, display_name, timezone text NOT NULL DEFAULT 'UTC', created_at)`, creada por un trigger `on_auth_user_created` que toma `display_name` y `timezone` de `raw_user_meta_data` (el Frontend los envía en `signUp`); y `capture_tokens` (ver D3).
La cola se expone mediante una vista SQL `srs_queue` (`security_invoker = true`; UNION ALL de las cinco tablas con `user_id`, `item_type`, `item_id`, `due_at`) filtrando `is_active_srs = true AND due_at <= now()` y, en vocabulario, `status <> 'pending_curation'`; el Backend siempre la consulta con `user_id = req.userId`.
- *Alternativa*: tabla polimórfica única `study_items` con JSONB — descartada: pierde restricciones (CHECK de `type`, NOT NULL) que son reglas de negocio estrictas.

Detalles adicionales fijados al implementar el esquema:
- Bloque SRS con `last_reviewed_at`; `review_events` guarda `interval_before`/`interval_after` y **no** tiene FK al ítem (polimórfico), así las rachas pasadas no cambian al borrar un registro.
- Trigger `srs_defaults`: si `is_active_srs = true` y `due_at` es null ⇒ `due_at = now()`. Archivar conserva `due_at`; la exclusión la hace `srs_queue`.
- `writing_versions` usa FK compuesta `(writing_id, user_id)` → `writing_logs(id, user_id)` (mismo dueño garantizado), numeración automática por trigger y UPDATE bloqueado (inmutables).
- `speaking_logs.storage_path` está forzado por CHECK a `{user_id}/{id}.mp3`.
- `vocabulary`: CHECKs "curado ⇒ traducción no vacía" y "curado ⇒ `status = retention_state`".
- Marcar un error fosilizado como superado no lo saca del SRS; eso lo decide `is_active_srs`.

Migraciones SQL en `Backend/supabase/migrations/` (rollback en `rollback/`, verificación en `checks/verify_schema.sql`), aplicadas desde el SQL Editor de Supabase.

### D5. Algoritmo SRS: SM-2 simplificado con 4 botones
Implementado como función pura en `Backend/src/services/srs.service.ts`:
- **1 Otra vez**: `repetitions = 0`, `lapses += 1`, `ease = max(1.3, ease − 0.2)`, `interval = 0`, `due_at = now + 10 min` (el Frontend reinserta la tarjeta al final de la sesión).
- **2 Difícil**: `interval = max(1, interval × 1.2)`, `ease −= 0.15`.
- **3 Bien**: `interval = 1` si `repetitions = 0`, `3` si `= 1`, si no `interval × ease`.
- **4 Fácil**: intervalo de "Bien" × 1.3, `ease += 0.15`.
- `retention_state`: `learning` si `interval < 7` o la calificación fue 1; `reviewing` si `7 ≤ interval < 21`; `mastered` si `≥ 21`. En vocabulario, `status` copia `retention_state`.
Se garantiza el orden 2 < 3 < 4 forzando `interval(3) ≥ interval(2) + 1` y `interval(4) ≥ interval(3) + 1`.
- *Alternativa*: FSRS — más preciso pero excesivo para un MVP personal; puede sustituirse después sin cambiar los specs.

### D6. Audio: MediaRecorder → MP3 en el navegador
`components/speaking/` usa `MediaRecorder` (Opus/WebM) y, al detener, decodifica con `AudioContext` y codifica a MP3 mono 64 kbps con `@breezystack/lamejs` en un Web Worker. 10 min ≈ 4,8 MB. El Blob queda en memoria (buffer local) hasta "Subir"; un `beforeunload` protege contra pérdida. La subida es `multipart/form-data` a `POST /api/speaking` (multer, límite 15 MB); el Backend valida duración ≤ 600 s y guarda en el bucket privado `speaking-audio/{user_id}/{id}.mp3`. La reproducción usa URLs firmadas de 5 minutos (`GET /api/speaking/:id/audio-url`), emitidas solo tras comprobar que la ficha pertenece a `req.userId`.
- *Alternativa*: subir WebM y convertir en servidor con ffmpeg — añade dependencia binaria al Backend.

### D7. Extensión Chrome MV3
- `manifest.json`: permisos `contextMenus`, `storage`, `activeTab`, `scripting`; `commands` con `Alt+S`; `host_permissions` al origen del Backend; `options_ui` → `options.html` (archivo adicional mínimo para URL del Backend y el token personal que el usuario genera en su perfil de la app).
- `content.js`: obtiene `window.getSelection()`, sube por el DOM hasta el ancestro de bloque más cercano (`p, li, blockquote, td, div`) y devuelve `innerText` recortado a 2 000 caracteres; muestra el toast efímero.
- `background.js` (service worker): registra menú contextual y comando, pide la captura al content script, hace `fetch` POST a `/api/capture` y actualiza el badge.
- Vanilla JS sin bundler para cumplir la estructura exigida.

### D8. Racha y zona horaria
*Detalle fijado al implementar:* la actividad por día local la calcula la vista `daily_activity` (migración `003_daily_activity.sql`, una fila por usuario y día), para no chocar con el límite de 1000 filas de la API al leer meses de repasos.

`habit.service.ts` calcula días activos (D-activo = término creado ∨ `review_event` ∨ check-in) del usuario autenticado, agrupando por fecha en la `timezone` de su perfil (IANA). La fecha "hoy" del check-in también se resuelve con esa zona en el Backend, nunca con la hora del servidor. Endpoint `GET /api/stats/streak` devuelve `{ streak, heatmap: [{date, count}] × 30 }`. El contexto inicial da dos definiciones parciales de racha; se adopta su unión (ver spec habit-tracking).

### D9. Esfuerzo por habilidad
`GET /api/stats/effort` cuenta en 30 días: Vocabulario/Reading = términos creados + repasos de vocabulario/errores + check-ins `reading_listening` repartidos 50/50 con Listening; Listening, Speaking y Writing = registros creados + repasos + check-ins de su hábito. Devuelve conteos y proporciones.

### D10. API REST (resumen)
`/api/health` (GET, público), `/api/me` (GET/PATCH perfil), `/api/me/capture-tokens` (GET/POST) y `/api/me/capture-tokens/:id` (DELETE = revocar), `/api/capture` (POST, token de extensión), `/api/vocabulary` (CRUD, `?status=pending_curation`, `?source=manual&limit=5`), `/api/vocabulary/:id/curate` (PATCH), `/api/errors`, `/api/speaking`, `/api/writing` + `/api/writing/:id/versions`, `/api/listening`, `/api/srs/queue` (GET), `/api/srs/review` (POST `{item_type, item_id, grade}`), `/api/items/:type/:id/srs-toggle` (PATCH), `/api/habits/today` (GET/PUT), `/api/stats/{overview,streak,effort}`. Validación con `zod` en controllers; errores uniformes `{ error: { code, message } }`.

### D11. Teclado
Hooks `useHotkeys` (genérico) y `useAnkiKeyboard` en `Frontend/src/hooks/`. `Ctrl+Enter` en Inbox; `Space`/`1–4`/`Esc` en Anki; los atajos se ignoran mientras el foco está en un input salvo `Ctrl+Enter`.

### D12. Pruebas
Vitest en ambos proyectos. Backend: unitarias de `srs.service`, `habit.service`, `stats.service` y de integración de rutas con `supertest` sobre un cliente Supabase simulado. **Cada endpoint de datos tiene una prueba de aislamiento** con dos usuarios (A no puede leer, modificar ni borrar lo de B; listados y estadísticas solo cuentan lo propio). Frontend: Vitest + Testing Library para hooks de teclado, Inbox y sesión Anki. Extension: prueba manual guiada (checklist) cargando como unpacked.

## Risks / Trade-offs

- [Codificación MP3 de 10 min en el navegador puede tardar varios segundos] → Web Worker + indicador de progreso; el buffer no se libera hasta confirmar la subida.
- [Service worker MV3 se suspende y pierde estado] → `background.js` no guarda estado en memoria; lee configuración de `chrome.storage` en cada envío.
- [Páginas con DOM atípico producen párrafos de contexto enormes o vacíos] → recorte a 2 000 caracteres y fallback a la oración que rodea la selección; el usuario puede editar el contexto en el Inbox.
- [Olvidar el filtro `user_id` en una consulta y exponer datos de otro usuario] → helper `scoped()` obligatorio, prueba de aislamiento por endpoint y RLS como red de seguridad.
- [Token de extensión filtrado] → solo permite crear pendientes en la cuenta de su dueño; el usuario lo revoca desde su perfil y se almacena solo su hash.
- [El SMTP integrado de Supabase tiene un límite muy bajo de emails por hora y no es apto para producción] → suficiente en desarrollo; configurar un SMTP propio (p. ej. Resend) en Supabase Auth antes de abrir la app a otras personas.
- [Registro abierto atrae cuentas basura] → la confirmación de email obligatoria lo mitiga; CAPTCHA y cuotas quedan para un cambio posterior.
- [Secret key expuesta durante la configuración inicial] → rotarla en Supabase antes de guardar datos reales.
- [Tablas separadas complican la cola unificada] → vista `srs_queue` centraliza la lógica; los servicios usan `item_type` para despachar.
- [Heurística de `type` provisional (1 término vs. varios) equivocada] → el Inbox exige confirmar el tipo antes de pasar a `learning`.

## Migration Plan

Greenfield, sin datos previos. Orden de puesta en marcha local:
1. Proyecto Supabase existente (`ujipnxeaipreyjcnoean`). Aplicar las migraciones de `Backend/supabase/migrations/` desde el SQL Editor (crean tablas, trigger de perfiles, políticas RLS, bucket privado `speaking-audio` y sus políticas).
2. En Supabase Auth: proveedor Email activado con "Confirm email" activo, registros abiertos, *Site URL* `http://localhost:5173` y *Redirect URLs* `http://localhost:5173/auth/callback` y `http://localhost:5173/reset-password`.
3. Configurar `Backend/.env` (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CORS_ORIGINS`, `PORT`) y `Frontend/.env` (`VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
4. Arrancar Backend y Frontend, registrarse desde la app, generar un token en el perfil, cargar `Extension/` como unpacked y pegar el token en sus opciones.
Rollback: al ser local, basta con revertir migraciones (`down` SQL incluido en cada archivo).

## Open Questions

- Proveedores de enlaces de listening además de YouTube para el salto a marca de tiempo (se puede ampliar sin cambiar specs).
- Ajuste fino de los multiplicadores SM-2 tras unas semanas de uso.
- Proveedor SMTP definitivo y dominio de envío para cuando la app se abra a otras personas.
