# Tasks

> Agrupadas por carpeta del workspace: **Backend** (grupos 1–8), **Frontend** (grupos 9–17), **Extension** (grupo 18) e integración final (grupo 19).

## 1. Backend — Scaffolding y Supabase

- [x] 1.1 Crear `Backend/` con `package.json`, `tsconfig.json` (strict), Express, `@supabase/supabase-js`, `zod`, `multer`, `cors`, `dotenv`, Vitest y `supertest`; verificar que `npm install` y `npm run build` terminan sin errores
- [x] 1.2 Crear la jerarquía `Backend/src/{controllers,services,routes,middlewares}/` y `Backend/src/server.ts` con `GET /api/health`; verificar que `npm run dev` responde 200 en `/api/health`
- [x] 1.3 Añadir `Backend/.env.example` con `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CORS_ORIGINS`, `PORT`, un `Backend/.gitignore` que excluya `.env`, y un módulo de configuración que falle al arrancar si falta alguna variable; verificar con una prueba unitaria
- [x] 1.4 Escribir migración `Backend/supabase/migrations/001_schema.sql` (up/down) con `profiles` + trigger `on_auth_user_created`, `capture_tokens`, `vocabulary`, `fossilized_errors`, `speaking_logs`, `writing_logs`, `writing_versions`, `listening_logs`, `review_events`, `habit_checkins`, todas con `user_id` (FK a `auth.users`, ON DELETE CASCADE) e índices por usuario, columnas SRS comunes y CHECKs de `type`, `status`, `retention_state` y `habit` (design D3/D4); verificar aplicándola en Supabase, comprobando que un INSERT con `type='slang'` falla y que registrar un usuario crea su fila en `profiles`
- [x] 1.5 Añadir migración `002_rls_queue_storage.sql` con RLS activado y políticas `user_id = auth.uid()` en todas las tablas, la vista `srs_queue` (`security_invoker`), el bucket privado `speaking-audio` y su política por carpeta `{auth.uid()}/`; verificar con una consulta que la vista excluye archivados y `pending_curation`, y que con la publishable key sin sesión no se lee ninguna fila
- [x] 1.6 Crear cliente Supabase compartido, middleware de errores uniforme `{error:{code,message}}` y helper de validación `zod`; verificar con prueba de que un body inválido produce 400 con ese formato
- [x] 1.7 Documentar en `Backend/README.md` la configuración de Supabase, variables y comandos; verificar que los pasos reproducen el arranque desde cero

## 2. Backend — Cuentas y aislamiento por usuario

- [x] 2.1 Implementar `middlewares/auth.ts` que valida el access token con `supabase.auth.getUser` y fija `req.userId`; verificar con pruebas de token válido, ausente, inválido y expirado (401)
- [x] 2.2 Implementar el helper `scoped(table, userId)` en `services/` que filtra por `user_id` en lecturas/updates/deletes e inyecta `user_id` en inserts; verificar con pruebas de que un registro de B es invisible para A (404) y de que un insert de A queda con su `user_id`
- [x] 2.3 Implementar `GET/PATCH /api/me` (nombre visible y zona horaria IANA validada); verificar con pruebas de spec user-accounts (perfil inicial, zona inválida → 400)
- [x] 2.4 Implementar `GET/POST /api/me/capture-tokens` y `DELETE /api/me/capture-tokens/:id` (token `ebk_…` mostrado una sola vez, se guarda solo SHA-256 + `last4`, revocar marca `revoked_at`); verificar con pruebas de generación, listado sin token completo, revocación y aislamiento entre usuarios
- [x] 2.5 Implementar `middlewares/captureToken.ts` que resuelve el usuario por hash, rechaza revocados, actualiza `last_used_at` y fija `req.userId`; verificar con pruebas de token ausente, incorrecto y revocado (401)

## 3. Backend — Captura y vocabulario

> Todos los endpoints de los grupos 3–7 usan `auth` + `scoped()` y cada uno incluye su prueba de aislamiento entre dos usuarios.

- [x] 3.1 Implementar `POST /api/capture` (route + controller + `vocabulary.service`) que crea, en la cuenta del dueño del token, el registro `pending_curation` con `translation/definition` NULL, `source='extension'`, `source_url` y `type` provisional (1 término → `word`, varios → `idiom_slang`); verificar con pruebas de spec browser-capture (201, 400 sin `word` o > 200 chars, 401, captura de A no aparece en el Inbox de B)
- [x] 3.2 Implementar CRUD `/api/vocabulary` con filtros `status`, `type`, `source`, `q`, `limit` y validación estricta de `type`; verificar con pruebas de spec vocabulary-curation (tipo válido/ inválido)
- [x] 3.3 Implementar `PATCH /api/vocabulary/:id/curate` que exige `translation` y `type`, pasa a `learning` y programa `due_at` si `is_active_srs`; verificar con pruebas (traducción vacía → 400; archivado → sin `due_at`)
- [x] 3.4 Implementar creación manual (`source='manual'`, `status='learning'`) y `DELETE` para descartar capturas; verificar con pruebas

## 4. Backend — Errores, Writing y Listening

- [x] 4.1 Implementar CRUD `/api/errors` con `is_resolved` y filtro activos/superados; verificar con pruebas de spec fossilized-errors
- [x] 4.2 Implementar `/api/writing` (crear con versión 1) y `POST /api/writing/:id/versions` con numeración incremental inmutable; verificar con prueba de que la versión 1 no cambia tras añadir la 2
- [x] 4.3 Implementar CRUD `/api/listening` con validación de URL http/https y `start_seconds` opcional; verificar con pruebas de URL inválida

## 5. Backend — Speaking y almacenamiento de audio

- [x] 5.1 Implementar `POST /api/speaking` (multipart, multer ≤ 15 MB, `title` requerido, `duration_seconds` ≤ 600, solo `audio/mpeg`) que sube a `speaking-audio/{user_id}/{id}.mp3` y crea la ficha; verificar con pruebas (éxito, > 600 s rechazado, sin título rechazado)
- [x] 5.2 Implementar `GET /api/speaking/:id/audio-url` con URL firmada de 5 min solo para el dueño y `DELETE` que elimina ficha y archivo; verificar con pruebas sobre el cliente simulado, incluido que B recibe 404 al pedir el audio de A

## 6. Backend — Motor SRS

- [x] 6.1 Implementar `services/srs.service.ts` como función pura (design D5) con derivación de `retention_state`; verificar con pruebas unitarias: orden de intervalos 2<3<4, reinicio con 1, promoción a `mastered` (≥ 21 días) y degradación a `learning`
- [x] 6.2 Implementar `GET /api/srs/queue` sobre `srs_queue` ordenada por `due_at`, devolviendo contenido renderizable por `item_type`; verificar con la prueba de composición de cola (14 activos vencidos, excluidos futuros, archivados y pendientes)
- [x] 6.3 Implementar `POST /api/srs/review` que aplica la calificación, actualiza columnas SRS (y `status` en vocabulario) e inserta `review_events`; verificar con prueba de integración
- [x] 6.4 Implementar `PATCH /api/items/:type/:id/srs-toggle` (reactivar sin programación → `due_at = now`; archivar conserva historial); verificar con pruebas de spec study-library

## 7. Backend — Hábitos y estadísticas

- [x] 7.1 Implementar `GET/PUT /api/habits/today` (marcar/desmarcar por `habit` en la fecha local según la zona horaria del perfil); verificar con pruebas
- [x] 7.2 Implementar `habit.service` con días activos del usuario (término creado ∨ repaso ∨ check-in), racha y mapa de 30 días en su zona horaria; verificar con pruebas de spec habit-tracking (hoy pendiente → 2, racha rota → 0, activo solo por check-in, check-in a las 23:30 en `America/Bogota` cuenta para el día local)
- [x] 7.3 Implementar `GET /api/stats/overview` (total curado y distribución learning/reviewing/mastered, errores críticos activos, número de vencidos) y `GET /api/stats/effort` (design D9); verificar con pruebas de los escenarios del spec dashboard (20 / 50-25-25 %, 4 errores, habilidad dominante)

## 8. Backend — Cierre

- [x] 8.1 Configurar CORS para `CORS_ORIGINS` (Frontend) y el origen `chrome-extension://`; verificar con prueba de preflight
- [x] 8.2 Documentar los endpoints en `Backend/README.md` (tabla método/ruta/auth/cuerpo); verificar que `npm test` pasa completo

## 9. Frontend — Scaffolding

- [x] 9.1 Crear `Frontend/` con Vite + React + TypeScript + Tailwind + React Router + Vitest + Testing Library; verificar que `npm run dev` y `npm run build` funcionan
- [x] 9.2 Crear la jerarquía `Frontend/src/{components/ui,components/dashboard,components/anki,components/speaking,hooks,views}/`; verificar la presencia de las carpetas
- [x] 9.3 Configurar Tailwind Desktop-First (ancho mínimo 1280 px, sin breakpoints móviles) y el layout base con navegación lateral; verificar visualmente a 1280 px y documentar en `Frontend/README.md`
- [x] 9.4 Crear componentes base en `components/ui/` (Button, Input, Textarea, Toggle SRS, Table, Modal, Toast, ArchiveBadge "🔴 Archivo / Solo Almacenamiento"); verificar con pruebas de render del Toggle y el Badge

## 10. Frontend — Cuentas de usuario y cliente API

- [x] 10.1 Configurar el cliente Supabase con `VITE_SUPABASE_PUBLISHABLE_KEY` (solo Auth), `hooks/useSession.ts` y el componente de ruta protegida; verificar que sin sesión cualquier vista privada redirige a `/login`
- [x] 10.2 Implementar `views/RegisterView.tsx` (email, contraseña ≥ 8, nombre visible; envía la zona horaria del navegador en metadata) y la pantalla "Revisa tu email"; verificar con pruebas de contraseña corta y envío correcto
- [x] 10.3 Implementar `views/LoginView.tsx` con mensaje genérico de error y aviso de email sin confirmar, `views/AuthCallbackView.tsx` (`/auth/callback`) y botón "Cerrar sesión" en el layout; verificar con pruebas y manualmente el ciclo registro → confirmación → login → logout
- [x] 10.4 Implementar `views/ForgotPasswordView.tsx` (respuesta idéntica exista o no el email) y `views/ResetPasswordView.tsx` (`/reset-password`); verificar manualmente que tras restablecer solo funciona la contraseña nueva
- [x] 10.5 Implementar `views/ProfileView.tsx`: edición de nombre y zona horaria, y gestión de tokens de extensión (generar con etiqueta mostrando el token una sola vez con botón copiar, listar con `last4` y último uso, revocar); verificar con pruebas
- [x] 10.6 Implementar `hooks/useApi.ts` que adjunta el access token vigente, normaliza errores `{error}` y redirige a `/login` ante 401; verificar con prueba unitaria
- [x] 10.7 Implementar `hooks/useHotkeys.ts` (ignora inputs salvo combinaciones permitidas); verificar con pruebas de teclado
- [x] 10.8 Documentar en `Frontend/README.md` la configuración de Site URL / Redirect URLs de Supabase Auth; verificar que siguiendo los pasos llegan los enlaces correctos

## 11. Frontend — Inbox y creación manual

- [x] 11.1 Implementar `views/InboxView.tsx` con lista superior de pendientes (más antiguo primero) y estado vacío; verificar con prueba
- [x] 11.2 Implementar el panel de curación a dos columnas (palabra + contexto | traducción, definición, `type`, Toggle SRS) con foco inicial en traducción; verificar con prueba
- [x] 11.3 Implementar `Ctrl+Enter` → curar y avanzar al siguiente, validación de traducción vacía y botón Descartar; verificar con pruebas de los escenarios del spec vocabulary-curation
- [x] 11.4 Implementar `views/NewWordView.tsx` con auto-focus, campos requeridos y "Guardar y Crear Otra" que limpia y re-enfoca; verificar con prueba

## 12. Frontend — Muro de Errores

- [x] 12.1 Implementar `views/ErrorsView.tsx` con formulario a dos columnas + notas + Toggle SRS, listado lado a lado, filtro activos/superados y acción "Marcar como superado"; verificar con pruebas

## 13. Frontend — Speaking

- [x] 13.1 Implementar `hooks/useRecorder.ts` (MediaRecorder, límite 3/5/10 min, autostop, manejo de permiso denegado); verificar con pruebas usando MediaRecorder simulado
- [x] 13.2 Implementar el Web Worker de codificación MP3 (`@breezystack/lamejs`, mono 64 kbps) con progreso; verificar que un audio de prueba produce un Blob `audio/mpeg`
- [x] 13.3 Implementar `components/speaking/` (selector de duración, temporizador, previsualización, Subir/Descartar, título requerido, reintento sin perder buffer, guardia `beforeunload`) y `views/SpeakingView.tsx`; verificar con pruebas de descarte y reintento
- [ ] 13.4 Implementar `components/speaking/AudioPlayer.tsx` que obtiene la URL firmada; verificar reproducción manual de una grabación subida

## 14. Frontend — Writing y Listening

- [x] 14.1 Implementar `views/WritingView.tsx` (crear entrada, añadir versión corregida, comparación original vs. versión seleccionada); verificar con pruebas
- [x] 14.2 Implementar `views/ListeningView.tsx` (formulario con URL, inicio opcional, transcripción; botón "Escuchar" en pestaña nueva con marca de tiempo para YouTube); verificar con pruebas

## 15. Frontend — Biblioteca

- [x] 15.1 Implementar `views/LibraryView.tsx` con pestañas por categoría, búsqueda y filtros (SRS activo/archivo, `type`, retención); verificar con pruebas de filtro
- [x] 15.2 Implementar Toggle SRS por fila con actualización optimista y reversión en error, edición y eliminación con confirmación; verificar con pruebas

## 16. Frontend — Modo Anki

- [ ] 16.1 Implementar `hooks/useAnkiKeyboard.ts` (Espacio voltea, 1–4 solo tras voltear, Esc sale); verificar con pruebas de los escenarios del spec srs-review
- [ ] 16.2 Implementar `components/anki/` con tarjetas por `item_type` (vocabulario, error, speaking, writing, listening), reinserción al final tras calificar 1 y resumen de fin de sesión; verificar con pruebas
- [ ] 16.3 Implementar `views/AnkiSessionView.tsx` a pantalla completa (Fullscreen API) sin controles que requieran ratón; verificar manualmente una sesión completa solo con teclado

## 17. Frontend — Dashboard

- [ ] 17.1 Implementar `views/DashboardView.tsx` con layout de tres columnas; verificar visualmente a 1280 px
- [ ] 17.2 Implementar en `components/dashboard/` el widget superior: racha + mapa de calor 30 días, barra segmentada roja/amarilla/verde, contador de errores críticos y distribución de esfuerzo; verificar con pruebas de render con datos fijos
- [ ] 17.3 Implementar la cola del día ("Tienes N términos vencidos para hoy") y el CTA deshabilitado con felicitación cuando N = 0; verificar con pruebas
- [ ] 17.4 Implementar la barra lateral: historial de los 5 últimos manuales con edición rápida en modal y widget de check-in con 3 casillas que encienden la celda de hoy sin recargar; verificar con pruebas

## 18. Extension — Chrome MV3

- [ ] 18.1 Crear `Extension/manifest.json` (MV3, `contextMenus`, `storage`, `activeTab`, `scripting`, comando `Alt+S`, `host_permissions` al Backend, `options_ui`); verificar que Chrome lo carga como unpacked sin errores
- [ ] 18.2 Implementar `Extension/content.js`: selección + ancestro de bloque más cercano, recorte a 2 000 caracteres con fallback a la oración, aviso de selección vacía y toast efímero; verificar manualmente en un artículo real
- [ ] 18.3 Implementar `Extension/background.js`: menú "Enviar a mi Cerebro de Inglés", comando `Alt+S`, POST a `/api/capture` con el token personal leído de `chrome.storage`, badge de éxito/error y aviso específico ante 401 (token inválido o revocado); verificar que la fila aparece en `pending_curation` en la cuenta del dueño del token sin abrir pestañas
- [ ] 18.4 Implementar `Extension/options.html` (+ script) para URL del Backend y el token personal generado en el perfil de la app, con botón "Probar conexión"; verificar que un token incorrecto o revocado muestra error
- [ ] 18.5 Documentar instalación y checklist de prueba manual en `Extension/README.md`; verificar siguiendo el checklist

## 19. Integración end-to-end

- [ ] 19.1 Flujo completo: registrarse → confirmar email → generar token en el perfil → configurar la extensión → capturar con la extensión → curar en Inbox con `Ctrl+Enter` → forzar vencimiento → repasar en Anki → ver cambio de racha y barra en Dashboard; verificar ejecutándolo y anotando el resultado en `README.md` raíz
- [ ] 19.2 Verificar que un registro archivado (`is_active_srs=false`) de cada categoría nunca aparece en cola ni contador tras forzar su `due_at` al pasado
- [ ] 19.3 Aislamiento real con dos cuentas: el usuario B no ve en su app, cola, Dashboard ni audios nada de lo creado por A, y el token de A no crea registros en B; verificar ejecutándolo contra Supabase real
- [ ] 19.4 Crear `README.md` raíz con la estructura Backend/Frontend/Extension y el orden de arranque; verificar arrancando desde un clon limpio

## Workflow follow-up

- Archivar el cambio con `/opsx:archive` tras revisar la implementación.
