# EnglishBrain · Extensión de Chrome

Selecciona una palabra o frase en cualquier página en inglés y envíala a tu Inbox con su párrafo de contexto, sin dejar de leer:

- Clic derecho → **Enviar a mi Cerebro de Inglés**, o
- **Alt+S**

La palabra llega al **Inbox** de la app como pendiente de curar (sin traducción), con el párrafo donde la encontraste y la URL de la página.

## Instalación (modo desarrollador)

No hace falta descargar nada ni pasar por la Chrome Web Store: Chrome carga la carpeta directamente.

1. Abre `chrome://extensions` en Chrome.
2. Activa **Modo de desarrollador** (interruptor arriba a la derecha).
3. Pulsa **Cargar descomprimida** y elige la carpeta `EnglishBrain/Extension`.
4. Se abre la pantalla de **opciones** de la extensión (más tarde también se abre haciendo clic en su icono; fíjalo con la chincheta 📌 del menú de extensiones).

### Conectarla con tu cuenta

1. En la app (`http://localhost:5173`), ve a **Perfil → Tokens de la extensión de Chrome**, escribe un nombre (p. ej. «Chrome del portátil») y pulsa **Generar token**. Cópialo: solo se muestra una vez.
2. En las opciones de la extensión:
   - **Dirección del Backend**: `http://localhost:3000` mientras trabajas en tu PC.
   - **Token personal**: pega el token (`ebk_…`).
3. Pulsa **Probar conexión**. Debe decir «Conexión correcta: el token es válido y quedó guardado».

El Backend tiene que estar encendido (`npm run dev` en `Backend/`) para capturar.

### Actualizar la extensión

Si cambia algún archivo de esta carpeta, pulsa el botón de recargar (↻) de EnglishBrain en `chrome://extensions`. No hace falta volver a instalarla ni a pegar el token.

## Con la app publicada (Render)

- Cambia la **Dirección del Backend** en las opciones por la de Render (p. ej. `https://englishbrain-api.onrender.com`) y pulsa **Guardar**. Chrome preguntará si permites el acceso a esa dirección: elige **Permitir**. `localhost` no lo pregunta porque viene permitido de serie.
- El token sigue sirviendo (vive en tu cuenta de Supabase, no en tu PC). Así capturas aunque tu PC no tenga nada encendido.
- **«Despertando el servidor…»**: el plan gratuito de Render apaga el Backend tras 15 min sin uso. Si el envío tarda más de 4 s verás ese aviso; la palabra se guarda en cuanto el servidor responde (suele tardar unos 50 s la primera vez). La extensión espera hasta 70 s antes de dar error. **Probar conexión** también puede tardar ese minuto.
- Para volver a usar el Backend de tu PC, pon otra vez `http://localhost:3000`.
- Para que otras personas la usen: pueden cargar esta carpeta igual que tú, o se publica en la Chrome Web Store (pago único de 5 USD, política de privacidad y revisión de Google). Cada persona genera **su propio token** en su perfil: sus palabras van solo a su Inbox.

## Seguridad y privacidad

- El token solo permite **crear palabras pendientes** en tu cuenta: no puede leer, editar ni borrar nada. Si lo pierdes, revócalo en tu perfil y deja de funcionar al instante.
- Se guarda en `chrome.storage.local`: queda en este navegador y no se sincroniza con tu cuenta de Google.
- La extensión **no corre en todas las páginas**: solo entra en la pestaña en el momento en que capturas (permiso `activeTab`). No lee tu historial ni otras pestañas.
- Solo envía datos a la dirección del Backend que tú configuras.

## Limitaciones

- Chrome no deja usar extensiones en `chrome://…`, en la Chrome Web Store ni en el visor de PDF de Chrome. Ahí, **Alt+S** marca el icono con «!» y explica el motivo; el **menú contextual** guarda al menos la palabra (sin párrafo).
- Si el párrafo supera 2000 caracteres se envía solo la oración que contiene la palabra. Puedes editar el contexto en el Inbox.
- Si **Alt+S** choca con un atajo de alguna web, cámbialo en `chrome://extensions/shortcuts` (también hay un enlace en las opciones).

## Archivos

| Archivo | Qué hace |
|---|---|
| `manifest.json` | Ficha para Chrome (Manifest V3): permisos `contextMenus`, `storage`, `activeTab`, `scripting`; atajo Alt+S; `localhost` permitido y otras direcciones como permiso opcional |
| `background.js` | Service worker: menú contextual, atajo, envío `POST /api/capture` con el token y badge ✓ / ! en el icono |
| `content.js` | Se inyecta al capturar: lee la selección y su párrafo (ancestro de bloque más cercano, recortado a 2000 caracteres con respaldo a la oración) y muestra el aviso efímero |
| `options.html` · `options.js` · `options.css` | Opciones: dirección del Backend, token y **Probar conexión** (`GET /api/capture/check`, que no crea nada) |
| `config.js` | Validaciones, llamadas al Backend y mensajes en español compartidos por `background.js` y las opciones |
| `icons/` | Iconos de 16, 32, 48 y 128 px |

JavaScript sin dependencias ni compilación (design D7).

## Checklist de prueba manual

Con el Backend y el Frontend encendidos y la extensión cargada:

**Instalación**
- [ ] `chrome://extensions` muestra EnglishBrain sin el botón rojo «Errores».
- [ ] Al instalarla se abre la pantalla de opciones.

**Opciones**
- [ ] Token vacío o `abc` → error bajo el campo, sin llamar al Backend.
- [ ] Un token inventado con formato válido (`ebk_` + 43 caracteres) → «Token inválido o revocado».
- [ ] El token real → «Conexión correcta…».
- [ ] Con el Backend apagado → «No se pudo conectar con el Backend… Comprueba que está encendido y que la dirección es correcta».

**Captura** (en un artículo real, p. ej. BBC News o Wikipedia en inglés)
- [ ] Selecciona una expresión → clic derecho → **Enviar a mi Cerebro de Inglés** → aviso «… guardada en tu Inbox» abajo a la derecha (≈ 2 s) y ✓ verde en el icono. La página no se mueve ni se abre ninguna pestaña.
- [ ] Lo mismo con **Alt+S**.
- [ ] **Alt+S** sin seleccionar nada → «Selecciona una palabra primero».
- [ ] En el **Inbox** de la app aparecen las capturas con su párrafo completo y el enlace a la página.

**Errores**
- [ ] Revoca el token en el Perfil y captura → «Token inválido o revocado…».
- [ ] Apaga el Backend y captura → «No se pudo conectar…»; la página sigue intacta.
- [ ] En `chrome://extensions`, **Alt+S** → icono con «!» (Chrome no permite extensiones ahí).
