# Tasks

> Agrupadas por carpeta del workspace: **Backend** (grupos 1â€“8), **Frontend** (grupos 9â€“17), **Extension** (grupo 18) e integraciÃ³n final (grupo 19).

## 1. Backend â€” Scaffolding y Supabase

- [x] 1.1 Crear `Backend/` con `package.json`, `tsconfig.json` (strict), Express, `@supabase/supabase-js`, `zod`, `multer`, `cors`, `dotenv`, Vitest y `supertest`; verificar que `npm install` y `npm run build` terminan sin errores
- [x] 1.2 Crear la jerarquÃ­a `Backend/src/{controllers,services,routes,middlewares}/` y `Backend/src/server.ts` con `GET /api/health`; verificar que `npm run dev` responde 200 en `/api/health`
- [x] 1.3 AÃ±adir `Backend/.env.example` con `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CORS_ORIGINS`, `PORT`, un `Backend/.gitignore` que excluya `.env`, y un mÃ³dulo de configuraciÃ³n que falle al arrancar si falta alguna variable; verificar con una prueba unitaria
- [x] 1.4 Escribir migraciÃ³n `Backend/supabase/migrations/001_schema.sql` (up/down) con `profiles` + trigger `on_auth_user_created`, `capture_tokens`, `vocabulary`, `fossilized_errors`, `speaking_logs`, `writing_logs`, `writing_versions`, `listening_logs`, `review_events`, `habit_checkins`, todas con `user_id` (FK a `auth.users`, ON DELETE CASCADE) e Ã­ndices por usuario, columnas SRS comunes y CHECKs de `type`, `status`, `retention_state` y `habit` (design D3/D4); verificar aplicÃ¡ndola en Supabase, comprobando que un INSERT con `type='slang'` falla y que registrar un usuario crea su fila en `profiles`
- [x] 1.5 AÃ±adir migraciÃ³n `002_rls_queue_storage.sql` con RLS activado y polÃ­ticas `user_id = auth.uid()` en todas las tablas, la vista `srs_queue` (`security_invoker`), el bucket privado `speaking-audio` y su polÃ­tica por carpeta `{auth.uid()}/`; verificar con una consulta que la vista excluye archivados y `pending_curation`, y que con la publishable key sin sesiÃ³n no se lee ninguna fila
- [x] 1.6 Crear cliente Supabase compartido, middleware de errores uniforme `{error:{code,message}}` y helper de validaciÃ³n `zod`; verificar con prueba de que un body invÃ¡lido produce 400 con ese formato
- [x] 1.7 Documentar en `Backend/README.md` la configuraciÃ³n de Supabase, variables y comandos; verificar que los pasos reproducen el arranque desde cero

## 2. Backend â€” Cuentas y aislamiento por usuario

- [x] 2.1 Implementar `middlewares/auth.ts` que valida el access token con `supabase.auth.getUser` y fija `req.userId`; verificar con pruebas de token vÃ¡lido, ausente, invÃ¡lido y expirado (401)
- [x] 2.2 Implementar el helper `scoped(table, userId)` en `services/` que filtra por `user_id` en lecturas/updates/deletes e inyecta `user_id` en inserts; verificar con pruebas de que un registro de B es invisible para A (404) y de que un insert de A queda con su `user_id`
- [x] 2.3 Implementar `GET/PATCH /api/me` (nombre visible y zona horaria IANA validada); verificar con pruebas de spec user-accounts (perfil inicial, zona invÃ¡lida â†’ 400)
- [x] 2.4 Implementar `GET/POST /api/me/capture-tokens` y `DELETE /api/me/capture-tokens/:id` (token `ebk_â€¦` mostrado una sola vez, se guarda solo SHA-256 + `last4`, revocar marca `revoked_at`); verificar con pruebas de generaciÃ³n, listado sin token completo, revocaciÃ³n y aislamiento entre usuarios
- [x] 2.5 Implementar `middlewares/captureToken.ts` que resuelve el usuario por hash, rechaza revocados, actualiza `last_used_at` y fija `req.userId`; verificar con pruebas de token ausente, incorrecto y revocado (401)

## 3. Backend â€” Captura y vocabulario

> Todos los endpoints de los grupos 3â€“7 usan `auth` + `scoped()` y cada uno incluye su prueba de aislamiento entre dos usuarios.

- [x] 3.1 Implementar `POST /api/capture` (route + controller + `vocabulary.service`) que crea, en la cuenta del dueÃ±o del token, el registro `pending_curation` con `translation/definition` NULL, `source='extension'`, `source_url` y `type` provisional (1 tÃ©rmino â†’ `word`, varios â†’ `idiom_slang`); verificar con pruebas de spec browser-capture (201, 400 sin `word` o > 200 chars, 401, captura de A no aparece en el Inbox de B)
- [x] 3.2 Implementar CRUD `/api/vocabulary` con filtros `status`, `type`, `source`, `q`, `limit` y validaciÃ³n estricta de `type`; verificar con pruebas de spec vocabulary-curation (tipo vÃ¡lido/ invÃ¡lido)
- [x] 3.3 Implementar `PATCH /api/vocabulary/:id/curate` que exige `translation` y `type`, pasa a `learning` y programa `due_at` si `is_active_srs`; verificar con pruebas (traducciÃ³n vacÃ­a â†’ 400; archivado â†’ sin `due_at`)
- [x] 3.4 Implementar creaciÃ³n manual (`source='manual'`, `status='learning'`) y `DELETE` para descartar capturas; verificar con pruebas

## 4. Backend â€” Errores, Writing y Listening

- [x] 4.1 Implementar CRUD `/api/errors` con `is_resolved` y filtro activos/superados; verificar con pruebas de spec fossilized-errors
- [x] 4.2 Implementar `/api/writing` (crear con versiÃ³n 1) y `POST /api/writing/:id/versions` con numeraciÃ³n incremental inmutable; verificar con prueba de que la versiÃ³n 1 no cambia tras aÃ±adir la 2
- [x] 4.3 Implementar CRUD `/api/listening` con validaciÃ³n de URL http/https y `start_seconds` opcional; verificar con pruebas de URL invÃ¡lida

## 5. Backend â€” Speaking y almacenamiento de audio

- [ ] 5.1 Implementar `POST /api/speaking` (multipart, multer â‰¤ 15 MB, `title` requerido, `duration_seconds` â‰¤ 600, solo `audio/mpeg`) que sube a `speaking-audio/{user_id}/{id}.mp3` y crea la ficha; verificar con pruebas (Ã©xito, > 600 s rechazado, sin tÃ­tulo rechazado)
- [ ] 5.2 Implementar `GET /api/speaking/:id/audio-url` con URL firmada de 5 min solo para el dueÃ±o y `DELETE` que elimina ficha y archivo; verificar con pruebas sobre el cliente simulado, incluido que B recibe 404 al pedir el audio de A

## 6. Backend â€” Motor SRS

- [ ] 6.1 Implementar `services/srs.service.ts` como funciÃ³n pura (design D5) con derivaciÃ³n de `retention_state`; verificar con pruebas unitarias: orden de intervalos 2<3<4, reinicio con 1, promociÃ³n a `mastered` (â‰¥ 21 dÃ­as) y degradaciÃ³n a `learning`
- [ ] 6.2 Implementar `GET /api/srs/queue` sobre `srs_queue` ordenada por `due_at`, devolviendo contenido renderizable por `item_type`; verificar con la prueba de composiciÃ³n de cola (14 activos vencidos, excluidos futuros, archivados y pendientes)
- [ ] 6.3 Implementar `POST /api/srs/review` que aplica la calificaciÃ³n, actualiza columnas SRS (y `status` en vocabulario) e inserta `review_events`; verificar con prueba de integraciÃ³n
- [ ] 6.4 Implementar `PATCH /api/items/:type/:id/srs-toggle` (reactivar sin programaciÃ³n â†’ `due_at = now`; archivar conserva historial); verificar con pruebas de spec study-library

## 7. Backend â€” HÃ¡bitos y estadÃ­sticas

- [ ] 7.1 Implementar `GET/PUT /api/habits/today` (marcar/desmarcar por `habit` en la fecha local segÃºn la zona horaria del perfil); verificar con pruebas
- [ ] 7.2 Implementar `habit.service` con dÃ­as activos del usuario (tÃ©rmino creado âˆ¨ repaso âˆ¨ check-in), racha y mapa de 30 dÃ­as en su zona horaria; verificar con pruebas de spec habit-tracking (hoy pendiente â†’ 2, racha rota â†’ 0, activo solo por check-in, check-in a las 23:30 en `America/Bogota` cuenta para el dÃ­a local)
- [ ] 7.3 Implementar `GET /api/stats/overview` (total curado y distribuciÃ³n learning/reviewing/mastered, errores crÃ­ticos activos, nÃºmero de vencidos) y `GET /api/stats/effort` (design D9); verificar con pruebas de los escenarios del spec dashboard (20 / 50-25-25 %, 4 errores, habilidad dominante)

## 8. Backend â€” Cierre

- [ ] 8.1 Configurar CORS para `CORS_ORIGINS` (Frontend) y el origen `chrome-extension://`; verificar con prueba de preflight
- [ ] 8.2 Documentar los endpoints en `Backend/README.md` (tabla mÃ©todo/ruta/auth/cuerpo); verificar que `npm test` pasa completo

## 9. Frontend â€” Scaffolding

- [ ] 9.1 Crear `Frontend/` con Vite + React + TypeScript + Tailwind + React Router + Vitest + Testing Library; verificar que `npm run dev` y `npm run build` funcionan
- [ ] 9.2 Crear la jerarquÃ­a `Frontend/src/{components/ui,components/dashboard,components/anki,components/speaking,hooks,views}/`; verificar la presencia de las carpetas
- [ ] 9.3 Configurar Tailwind Desktop-First (ancho mÃ­nimo 1280 px, sin breakpoints mÃ³viles) y el layout base con navegaciÃ³n lateral; verificar visualmente a 1280 px y documentar en `Frontend/README.md`
- [ ] 9.4 Crear componentes base en `components/ui/` (Button, Input, Textarea, Toggle SRS, Table, Modal, Toast, ArchiveBadge "ðŸ”´ Archivo / Solo Almacenamiento"); verificar con pruebas de render del Toggle y el Badge

## 10. Frontend â€” Cuentas de usuario y cliente API

- [ ] 10.1 Configurar el cliente Supabase con `VITE_SUPABASE_PUBLISHABLE_KEY` (solo Auth), `hooks/useSession.ts` y el componente de ruta protegida; verificar que sin sesiÃ³n cualquier vista privada redirige a `/login`
- [ ] 10.2 Implementar `views/RegisterView.tsx` (email, contraseÃ±a â‰¥ 8, nombre visible; envÃ­a la zona horaria del navegador en metadata) y la pantalla "Revisa tu email"; verificar con pruebas de contraseÃ±a corta y envÃ­o correcto
- [ ] 10.3 Implementar `views/LoginView.tsx` con mensaje genÃ©rico de error y aviso de email sin confirmar, `views/AuthCallbackView.tsx` (`/auth/callback`) y botÃ³n "Cerrar sesiÃ³n" en el layout; verificar con pruebas y manualmente el ciclo registro â†’ confirmaciÃ³n â†’ login â†’ logout
- [ ] 10.4 Implementar `views/ForgotPasswordView.tsx` (respuesta idÃ©ntica exista o no el email) y `views/ResetPasswordView.tsx` (`/reset-password`); verificar manualmente que tras restablecer solo funciona la contraseÃ±a nueva
- [ ] 10.5 Implementar `views/ProfileView.tsx`: ediciÃ³n de nombre y zona horaria, y gestiÃ³n de tokens de extensiÃ³n (generar con etiqueta mostrando el token una sola vez con botÃ³n copiar, listar con `last4` y Ãºltimo uso, revocar); verificar con pruebas
- [ ] 10.6 Implementar `hooks/useApi.ts` que adjunta el access token vigente, normaliza errores `{error}` y redirige a `/login` ante 401; verificar con prueba unitaria
- [ ] 10.7 Implementar `hooks/useHotkeys.ts` (ignora inputs salvo combinaciones permitidas); verificar con pruebas de teclado
- [ ] 10.8 Documentar en `Frontend/README.md` la configuraciÃ³n de Site URL / Redirect URLs de Supabase Auth; verificar que siguiendo los pasos llegan los enlaces correctos

## 11. Frontend â€” Inbox y creaciÃ³n manual

- [ ] 11.1 Implementar `views/InboxView.tsx` con lista superior de pendientes (mÃ¡s antiguo primero) y estado vacÃ­o; verificar con prueba
- [ ] 11.2 Implementar el panel de curaciÃ³n a dos columnas (palabra + contexto | traducciÃ³n, definiciÃ³n, `type`, Toggle SRS) con foco inicial en traducciÃ³n; verificar con prueba
- [ ] 11.3 Implementar `Ctrl+Enter` â†’ curar y avanzar al siguiente, validaciÃ³n de traducciÃ³n vacÃ­a y botÃ³n Descartar; verificar con pruebas de los escenarios del spec vocabulary-curation
- [ ] 11.4 Implementar `views/NewWordView.tsx` con auto-focus, campos requeridos y "Guardar y Crear Otra" que limpia y re-enfoca; verificar con prueba

## 12. Frontend â€” Muro de Errores

- [ ] 12.1 Implementar `views/ErrorsView.tsx` con formulario a dos columnas + notas + Toggle SRS, listado lado a lado, filtro activos/superados y acciÃ³n "Marcar como superado"; verificar con pruebas

## 13. Frontend â€” Speaking

- [ ] 13.1 Implementar `hooks/useRecorder.ts` (MediaRecorder, lÃ­mite 3/5/10 min, autostop, manejo de permiso denegado); verificar con pruebas usando MediaRecorder simulado
- [ ] 13.2 Implementar el Web Worker de codificaciÃ³n MP3 (`@breezystack/lamejs`, mono 64 kbps) con progreso; verificar que un audio de prueba produce un Blob `audio/mpeg`
- [ ] 13.3 Implementar `components/speaking/` (selector de duraciÃ³n, temporizador, previsualizaciÃ³n, Subir/Descartar, tÃ­tulo requerido, reintento sin perder buffer, guardia `beforeunload`) y `views/SpeakingView.tsx`; verificar con pruebas de descarte y reintento
- [ ] 13.4 Implementar `components/speaking/AudioPlayer.tsx` que obtiene la URL firmada; verificar reproducciÃ³n manual de una grabaciÃ³n subida

## 14. Frontend â€” Writing y Listening

- [ ] 14.1 Implementar `views/WritingView.tsx` (crear entrada, aÃ±adir versiÃ³n corregida, comparaciÃ³n original vs. versiÃ³n seleccionada); verificar con pruebas
- [ ] 14.2 Implementar `views/ListeningView.tsx` (formulario con URL, inicio opcional, transcripciÃ³n; botÃ³n "Escuchar" en pestaÃ±a nueva con marca de tiempo para YouTube); verificar con pruebas

## 15. Frontend â€” Biblioteca

- [ ] 15.1 Implementar `views/LibraryView.tsx` con pestaÃ±as por categorÃ­a, bÃºsqueda y filtros (SRS activo/archivo, `type`, retenciÃ³n); verificar con pruebas de filtro
- [ ] 15.2 Implementar Toggle SRS por fila con actualizaciÃ³n optimista y reversiÃ³n en error, ediciÃ³n y eliminaciÃ³n con confirmaciÃ³n; verificar con pruebas

## 16. Frontend â€” Modo Anki

- [ ] 16.1 Implementar `hooks/useAnkiKeyboard.ts` (Espacio voltea, 1â€“4 solo tras voltear, Esc sale); verificar con pruebas de los escenarios del spec srs-review
- [ ] 16.2 Implementar `components/anki/` con tarjetas por `item_type` (vocabulario, error, speaking, writing, listening), reinserciÃ³n al final tras calificar 1 y resumen de fin de sesiÃ³n; verificar con pruebas
- [ ] 16.3 Implementar `views/AnkiSessionView.tsx` a pantalla completa (Fullscreen API) sin controles que requieran ratÃ³n; verificar manualmente una sesiÃ³n completa solo con teclado

## 17. Frontend â€” Dashboard

- [ ] 17.1 Implementar `views/DashboardView.tsx` con layout de tres columnas; verificar visualmente a 1280 px
- [ ] 17.2 Implementar en `components/dashboard/` el widget superior: racha + mapa de calor 30 dÃ­as, barra segmentada roja/amarilla/verde, contador de errores crÃ­ticos y distribuciÃ³n de esfuerzo; verificar con pruebas de render con datos fijos
- [ ] 17.3 Implementar la cola del dÃ­a ("Tienes N tÃ©rminos vencidos para hoy") y el CTA deshabilitado con felicitaciÃ³n cuando N = 0; verificar con pruebas
- [ ] 17.4 Implementar la barra lateral: historial de los 5 Ãºltimos manuales con ediciÃ³n rÃ¡pida en modal y widget de check-in con 3 casillas que encienden la celda de hoy sin recargar; verificar con pruebas

## 18. Extension â€” Chrome MV3

- [ ] 18.1 Crear `Extension/manifest.json` (MV3, `contextMenus`, `storage`, `activeTab`, `scripting`, comando `Alt+S`, `host_permissions` al Backend, `options_ui`); verificar que Chrome lo carga como unpacked sin errores
- [ ] 18.2 Implementar `Extension/content.js`: selecciÃ³n + ancestro de bloque mÃ¡s cercano, recorte a 2 000 caracteres con fallback a la oraciÃ³n, aviso de selecciÃ³n vacÃ­a y toast efÃ­mero; verificar manualmente en un artÃ­culo real
- [ ] 18.3 Implementar `Extension/background.js`: menÃº "Enviar a mi Cerebro de InglÃ©s", comando `Alt+S`, POST a `/api/capture` con el token personal leÃ­do de `chrome.storage`, badge de Ã©xito/error y aviso especÃ­fico ante 401 (token invÃ¡lido o revocado); verificar que la fila aparece en `pending_curation` en la cuenta del dueÃ±o del token sin abrir pestaÃ±as
- [ ] 18.4 Implementar `Extension/options.html` (+ script) para URL del Backend y el token personal generado en el perfil de la app, con botÃ³n "Probar conexiÃ³n"; verificar que un token incorrecto o revocado muestra error
- [ ] 18.5 Documentar instalaciÃ³n y checklist de prueba manual en `Extension/README.md`; verificar siguiendo el checklist

## 19. IntegraciÃ³n end-to-end

- [ ] 19.1 Flujo completo: registrarse â†’ confirmar email â†’ generar token en el perfil â†’ configurar la extensiÃ³n â†’ capturar con la extensiÃ³n â†’ curar en Inbox con `Ctrl+Enter` â†’ forzar vencimiento â†’ repasar en Anki â†’ ver cambio de racha y barra en Dashboard; verificar ejecutÃ¡ndolo y anotando el resultado en `README.md` raÃ­z
- [ ] 19.2 Verificar que un registro archivado (`is_active_srs=false`) de cada categorÃ­a nunca aparece en cola ni contador tras forzar su `due_at` al pasado
- [ ] 19.3 Aislamiento real con dos cuentas: el usuario B no ve en su app, cola, Dashboard ni audios nada de lo creado por A, y el token de A no crea registros en B; verificar ejecutÃ¡ndolo contra Supabase real
- [ ] 19.4 Crear `README.md` raÃ­z con la estructura Backend/Frontend/Extension y el orden de arranque; verificar arrancando desde un clon limpio

## Workflow follow-up

- Archivar el cambio con `/opsx:archive` tras revisar la implementaciÃ³n.
