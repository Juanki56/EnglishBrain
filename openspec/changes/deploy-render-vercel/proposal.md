# Proposal

## Why

EnglishBrain ya está completo, pero solo funciona mientras el PC del usuario tiene encendidos el Backend y el Frontend. Para usarlo desde cualquier sitio, y para que la extensión capture aunque el PC esté apagado, hay que publicar la app en internet. Se hace sin coste: Backend en el plan gratuito de Render y Frontend en Vercel.

## What Changes

- **Backend publicado en Render (plan gratuito)** con un Blueprint (`render.yaml`):
  - compila con `npm run build` y arranca con `npm start`
  - Render comprueba la salud con `/api/health`
  - la secret key de Supabase y los orígenes de CORS se escriben en el panel de Render y nunca están en el repositorio
- **Frontend publicado en Vercel** con un `vercel.json` que sirve `index.html` en cualquier ruta. Así se puede recargar o abrir directamente `/inbox`, `/review`… y funcionan los enlaces de los correos (`/auth/callback`, `/reset-password`).
- **Aviso de servidor despertando.** El plan gratuito de Render apaga el Backend tras 15 min sin uso y tarda unos 50 s en volver. Ese aviso se muestra en dos sitios:
  - **App:** si una petición tarda más de 4 s, aparece una franja «Despertando el servidor…» hasta que responde.
  - **Extensión:** espera hasta 70 s (antes 8 s) y, pasados 4 s, avisa de que la palabra se guardará en cuanto el servidor responda. «Probar conexión» también explica la espera.
- **Configuración guiada** de los paneles:
  - Render y Vercel.
  - Supabase Auth: Site URL y Redirect URLs con el dominio de Vercel, sin quitar las de localhost.
  - La extensión apuntando a la dirección de Render.
- **Documentación de despliegue** en los README: pasos, variables por entorno y límites del plan gratuito.
- Cada `push` a `main` redespliega Render y Vercel automáticamente.

Fuera de alcance: correo propio (SMTP) para los emails de Supabase, dominio propio, planes de pago y publicar la extensión en la Chrome Web Store.

## Capabilities

### New Capabilities
- `public-hosting`: la app accesible desde una dirección pública. Cubre:
  - rutas directas de la app web
  - comprobación de salud del Backend
  - secretos solo en los paneles de los proveedores
  - CORS limitado al dominio publicado
  - despliegue automático
  - aviso al usuario mientras el servidor despierta

### Modified Capabilities
- `browser-capture`: el requisito «Envío no intrusivo» pasa a tolerar un Backend que tarda en despertar: espera prolongada con aviso de espera, en lugar de fallar a los pocos segundos.

## Impact

- **Nuevos archivos**: `render.yaml` (raíz) y `Frontend/vercel.json`.
- **Frontend**:
  - `src/lib/api.ts` (`createApiClient` con avisos de petición lenta)
  - `src/hooks/useApi.ts`
  - nuevo `src/lib/serverWake.ts`
  - nuevo `src/components/ui/ServerWakeNotice.tsx`, montado en `src/App.tsx`
  - pruebas asociadas
- **Extensión**: `config.js` (tiempo de espera), `background.js` (aviso de espera), `content.js` (duración del aviso) y `options.js` (mensaje al probar).
- **Backend**: sin cambios de código; ya lee `PORT` y valida sus variables al arrancar.
- **Documentación**: `README.md` raíz, `Backend/README.md`, `Frontend/README.md` y `Extension/README.md`.
- **Servicios externos**: cuentas gratuitas de Render y Vercel conectadas al repositorio de GitHub; cambios de URL en Supabase Auth.
- **Coste**: 0 USD. El plan gratuito de Supabase pausa el proyecto tras 7 días sin actividad; se documenta.
