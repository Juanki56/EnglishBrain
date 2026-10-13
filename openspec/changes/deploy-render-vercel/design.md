# Design

## Context

Hoy todo corre en local:
- **Backend**: Express + TypeScript en `Backend/`. `npm run build` compila a `dist/` con `tsconfig.build.json` y `npm start` ejecuta `node dist/server.js`. Lee `PORT`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y `CORS_ORIGINS`, y no arranca si faltan.
- **Frontend**: Vite + React con `BrowserRouter` en `Frontend/`. Las variables `VITE_*` se incrustan en el momento del build.
- **Extensión**: Chrome MV3 en `Extension/`, configurable desde sus opciones. `localhost` está permitido de serie y las demás direcciones son un permiso opcional que se pide al guardar.
- **Base de datos**: Supabase ya es un servicio en la nube y no cambia.

Restricciones que fijan el enfoque (ver proposal.md, Why):
- Coste 0.
- Un monólogo de 10 min a 64 kbps pesa ~4,8 MB y el Backend lo recibe en una sola petición `multipart`.
- Los secretos nunca van al repositorio.

## Goals / Non-Goals

**Goals:**
- Publicar Backend y Frontend desde el mismo repositorio (`Juanki56/EnglishBrain`, rama `main`), con despliegue automático en cada push.
- Que el desarrollo local siga funcionando igual (`localhost:3000` y `localhost:5173`).
- Que la espera del plan gratuito se entienda: el usuario ve un aviso en lugar de una pantalla colgada o un error.

**Non-Goals:**
- Evitar que el servidor se duerma (pings periódicos o un plan de pago).
- Vistas previas de Vercel funcionando contra el Backend: sus dominios cambian en cada despliegue y no se añaden a CORS.
- Correo propio (SMTP) y dominio propio.
- Cambios en la base de datos o en las migraciones.

## Decisions

### D1. Backend en Render (plan gratuito) con Blueprint `render.yaml`
- Un servicio web: `runtime: node`, `rootDir: Backend`, `plan: free`, `buildCommand: npm ci && npm run build`, `startCommand: npm start`, `healthCheckPath: /api/health`.
- La región se elige la más cercana al proyecto de Supabase; ver Open Questions.
- Variables:
  - `NODE_VERSION=22`, para fijar una versión con soporte largo.
  - `SUPABASE_URL` con su valor, que no es secreto.
  - `SUPABASE_SECRET_KEY` y `CORS_ORIGINS` con `sync: false`: Render las pide en el panel al crear el servicio y no se guardan en el repositorio.
- `PORT` lo inyecta Render y `server.ts` ya lo usa, así que **no hay cambios de código en el Backend**.
- *Por qué Blueprint y no configurarlo a mano en el panel*: la configuración queda versionada y documentada. Si se rehace el servicio, se repite igual.
- *Alternativas*:
  - **Vercel Functions**: descartado. Su límite de cuerpo de 4,5 MB impide subir monólogos de 10 min y obligaría a cambiar la subida a Storage directo desde el navegador.
  - **Railway, Fly.io, Render de pago**: siempre encendidos, pero con coste; el usuario eligió el gratuito.

### D2. Frontend en Vercel con `Frontend/vercel.json`
- El proyecto de Vercel apunta a la carpeta `Frontend` (Root Directory) y detecta Vite: `npm run build` → `dist/`.
- `vercel.json` reescribe todas las rutas a `/index.html`. Vercel sirve primero los archivos estáticos que existen (JS, CSS, iconos), así que la reescritura solo afecta a las rutas de la app.
- Las variables `VITE_API_URL` (la URL de Render), `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` se configuran en el panel de Vercel. Como se incrustan al compilar, cambiarlas exige un nuevo despliegue.
- *Alternativa*: `HashRouter` (`/#/inbox`) evitaría la reescritura, pero cambia todas las URLs y los enlaces de los correos. Descartado.

### D3. Aviso de servidor lento en la app: temporizador por petición en el cliente de la API
- `createApiClient` acepta `onSlowStart` y `onSlowEnd`.
  - Cada petición arranca un temporizador de 4 s.
  - Si vence antes de la respuesta, llama a `onSlowStart`.
  - Al terminar (con éxito, error o cancelación), si había avisado, llama a `onSlowEnd`.
- `lib/serverWake.ts` lleva un contador de peticiones lentas en curso con suscriptores. `ServerWakeNotice` lo lee con `useSyncExternalStore` y se muestra mientras el contador sea mayor que 0.
- `useApi` conecta las dos funciones al contador. Así todas las pantallas lo heredan sin tocarlas.
- El aviso es una franja fija arriba al centro (`role="status"`, `aria-live="polite"`). Se monta una vez en `App.tsx`, por encima de los layouts, con un `z-index` mayor que la sesión Anki a pantalla completa.
- Las llamadas de Supabase Auth (login, registro) no pasan por este cliente: van a Supabase, que no se duerme.
- *Por qué 4 s*: una petición normal responde en menos de 1 s, así que 4 s indica arranque en frío sin mostrar el aviso por una red lenta puntual.
- *Alternativa*: hacer un ping a `/api/health` al abrir la app y bloquear la pantalla hasta que responda. Descartado: retrasa siempre la entrada, incluso con el servidor despierto.

### D4. Extensión tolerante al arranque en frío
- `TIMEOUT_MS` sube de 8 s a 70 s, por encima de los ~50 s que tarda Render en despertar.
- `background.js` arranca un temporizador de 4 s al enviar. Si vence, inyecta el aviso «Despertando el servidor… la palabra se guardará en cuanto responda». La confirmación o el error final lo sustituyen.
- `content.js` añade un tipo de aviso `wait` que no se oculta solo y queda reemplazado por el siguiente. Los demás conservan su duración (≤ 2 s éxito, 4 s error).
- El service worker de MV3 sigue vivo mientras haya un `fetch` en curso, así que la espera de 70 s no lo suspende.
- «Probar conexión» en las opciones muestra «Probando… si el servidor estaba dormido puede tardar hasta un minuto» y usa el mismo tiempo de espera.

### D5. CORS y Supabase Auth en producción
- `CORS_ORIGINS` en Render = dominio de Vercel + `http://localhost:5173`. Así se puede desarrollar en local contra el Backend publicado si hiciera falta.
- En Supabase Auth, el Site URL pasa al dominio de Vercel. Se añaden sus `/auth/callback` y `/reset-password` a las Redirect URLs, sin quitar las de localhost.
- El código ya construye los enlaces con `window.location.origin`, así que no cambia.

## Risks / Trade-offs

- **Render gratis se duerme a los 15 min**: la primera petición tarda ~50 s. → Avisos D3 y D4. Si molesta, se pasa a un plan de pago desde el panel sin tocar el código.
- **Render gratis tiene 750 h/mes de instancia**: un solo servicio no las agota.
- **Supabase gratis pausa el proyecto tras 7 días sin actividad**: la app deja de funcionar hasta reactivarlo desde el panel de Supabase. → Se documenta; usar la app al menos una vez por semana lo evita.
- **Subir 4,8 MB a un servidor recién despertado** puede acercarse al límite de 70 s con mala conexión. → La subida de Speaking ya conserva el audio local hasta confirmar, así que el usuario puede reintentar sin perder la grabación.
- **Las variables `VITE_*` se fijan al compilar**: si cambia la URL de Render, la app sigue llamando a la antigua. → Documentar «cambiar la variable y redesplegar» en Vercel.
- **Un push a `main` publica directamente** en producción. → Mantener la regla actual: typecheck y pruebas en verde antes de subir (skill `subir-cambios`).
- **La secret key queda en el panel de Render.** Quien tenga acceso a esa cuenta la ve. → Cuenta de Render protegida (inicio de sesión con GitHub y 2FA); si se filtra, rotarla en Supabase y actualizarla en Render.

## Migration Plan

1. Subir `render.yaml`, `vercel.json`, los avisos y la documentación a `main`, con las pruebas en verde.
2. **Render**: New → Blueprint con el repositorio. Escribir `SUPABASE_SECRET_KEY` y, de momento, `CORS_ORIGINS=http://localhost:5173`. Esperar a que `/api/health` responda.
3. **Vercel**: importar el repositorio con Root Directory `Frontend` y las tres variables `VITE_*`; `VITE_API_URL` es la URL de Render. Desplegar.
4. **Render**: `CORS_ORIGINS` = dominio de Vercel + localhost.
5. **Supabase Auth**: Site URL y Redirect URLs del dominio de Vercel.
6. **Extensión**: dirección = URL de Render → Guardar → Permitir → Probar conexión.
7. Verificar en producción (ver tasks.md).

**Rollback**: Render y Vercel guardan los despliegues anteriores y se puede volver a uno desde su panel. Si hubiera que retirar la publicación, se suspenden los servicios y se devuelve el Site URL de Supabase a `http://localhost:5173`. El uso local no depende de nada de esto.

## Open Questions

- ~~Región de Render~~ **Resuelta**: Supabase está en `ca-central-1` (Montreal); Render no tiene región en Canadá y se usa `virginia`, la más cercana.
