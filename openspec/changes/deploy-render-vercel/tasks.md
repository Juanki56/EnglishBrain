# Tasks

## 1. Configuración de despliegue en el repositorio

- [x] 1.1 Crear `render.yaml` en la raíz (servicio `englishbrain-api`, `rootDir: Backend`, plan `free`, `npm ci && npm run build`, `npm start`, `healthCheckPath: /api/health`, `NODE_VERSION=22`, `SUPABASE_URL` con valor, `SUPABASE_SECRET_KEY` y `CORS_ORIGINS` con `sync: false`); verificar que no contiene ningún secreto y que `npm ci && npm run build && npm start` funciona en una copia limpia del Backend en el scratchpad con `PORT` distinto (sin dejar `dist/` en el proyecto)
- [x] 1.2 Crear `Frontend/vercel.json` con la reescritura de todas las rutas a `/index.html`; verificar con un build en el scratchpad que `dist/` contiene `index.html` y los recursos, y que el JSON es válido

## 2. Aviso de servidor despertando en la app

- [x] 2.1 Añadir `onSlowStart`/`onSlowEnd` a `createApiClient` en `src/lib/api.ts` (temporizador de 4 s por petición; fin en éxito, error o cancelación); verificar con pruebas en `lib/api.test.ts` con temporizadores falsos: respuesta rápida sin aviso, lenta con aviso y fin, error lento retira el aviso
- [x] 2.2 Crear `src/lib/serverWake.ts` (contador con suscriptores), conectarlo en `useApi` y crear `components/ui/ServerWakeNotice.tsx` montado una vez en `App.tsx`; verificar con una prueba de render: petición lenta muestra «Despertando el servidor…» y desaparece al responder, y se ve también durante la sesión Anki
- [x] 2.3 Documentar el aviso y las variables de producción en `Frontend/README.md`; verificar con `npm run typecheck` y `npm test` en verde (dos ejecuciones completas)

## 3. Extensión tolerante al arranque en frío

- [x] 3.1 Subir `TIMEOUT_MS` a 70 s en `Extension/config.js` y añadir el aviso `wait` persistente a `toast()` en `content.js`; verificar con `content.test.mjs` (jsdom) que el aviso de espera no se oculta solo y el siguiente lo sustituye
- [x] 3.2 En `background.js`, mostrar el aviso de espera si el envío tarda más de 4 s y sustituirlo por el resultado; en `options.js`, el mensaje «Probando… si el servidor estaba dormido puede tardar hasta un minuto»; verificar con `extension-real.mts` añadiendo un Backend lento simulado (respuesta a los 6 s: aviso de espera y luego «guardada en tu Inbox») y los 22 casos anteriores en verde
- [ ] 3.3 Documentar en `Extension/README.md` cómo apuntar a la dirección de Render y qué significa el aviso de espera; verificar recargando la extensión en Chrome sin errores (usuario)

## 4. Documentación de despliegue

- [x] 4.1 Reescribir la sección «Despliegue» del `README.md` raíz (arquitectura publicada, pasos de Render, Vercel y Supabase Auth, variables por entorno, límites del plan gratuito: Render se duerme, Supabase pausa a los 7 días, vistas previas de Vercel sin CORS, rollback) y añadir las variables de producción a `Backend/README.md`; verificar que cada paso coincide con `render.yaml`, `vercel.json` y design.md
- [x] 4.2 Subir los grupos 1–4 a `main` con la skill `subir-cambios`; verificar que no van `.env` ni `dist/` y que `main` coincide con `origin/main`

## 5. Publicación guiada (paneles; los hace el usuario con mi guía)

- [ ] 5.1 Render: New → Blueprint con `Juanki56/EnglishBrain`, región según Supabase, `SUPABASE_SECRET_KEY` y `CORS_ORIGINS=http://localhost:5173`; verificar que `GET https://<servicio>.onrender.com/api/health` responde `status: "ok"` y anotar la URL
- [ ] 5.2 Vercel: importar el repositorio con Root Directory `Frontend` y las variables `VITE_API_URL` (URL de Render), `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`; verificar que el despliegue termina en verde y anotar el dominio `*.vercel.app`
- [ ] 5.3 Render: `CORS_ORIGINS` = dominio de Vercel + `http://localhost:5173`; verificar que el servicio se redespliega y que la app publicada carga el Panel tras iniciar sesión
- [ ] 5.4 Supabase → Authentication → URL Configuration: Site URL = dominio de Vercel y Redirect URLs con su `/auth/callback` y `/reset-password` (sin quitar las de localhost); verificar que un correo de recuperación lleva a `https://<dominio>.vercel.app/reset-password`
- [ ] 5.5 Extensión: dirección = URL de Render → Guardar → Permitir → Probar conexión; verificar «Conexión correcta» y una captura real que aparece en el Inbox de la app publicada

## 6. Verificación en producción

- [ ] 6.1 Con el servidor dormido (más de 15 min sin uso): abrir la app publicada y capturar con la extensión; verificar que aparecen los avisos de espera y que todo termina bien, y anotar cuánto tardó en despertar
- [ ] 6.2 Recargar `/inbox` y `/review` y abrir una ruta inexistente en el dominio de Vercel; verificar que no hay 404 del servidor (la app muestra su pantalla o su propia página 404)
- [ ] 6.3 Ejecutar el recorrido por la API (`flow-real.mts` con la URL pública de Render como base) y una petición a la API desde un origen no permitido; verificar 13/13, el bloqueo de CORS y que la cuenta temporal se borra; anotar el resultado en el `README.md` raíz y subirlo con `subir-cambios`

## Workflow follow-up

- Archivar el change con `/opsx:archive` cuando la verificación en producción esté completa.
