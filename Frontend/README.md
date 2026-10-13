# EnglishBrain · Frontend

App web de EnglishBrain: React + TypeScript + Vite + Tailwind CSS + React Router.
**Solo escritorio**: diseñada para monitores de 1280 px o más; no tiene versión móvil.

## Requisitos

- **Node.js 20 o superior**
- El **Backend** funcionando en `http://localhost:3000` (ver [../Backend/README.md](../Backend/README.md))

## Puesta en marcha

```bash
cd Frontend
npm install
cp .env.example .env        # en PowerShell: Copy-Item .env.example .env
npm run dev
```

Abre <http://localhost:5173>. El puerto es fijo porque el Backend solo acepta peticiones de ese origen (`CORS_ORIGINS`).

### Variables de entorno (`.env`)

| Variable | Dónde se obtiene |
|---|---|
| `VITE_API_URL` | Dirección del Backend (`http://localhost:3000`) |
| `VITE_SUPABASE_URL` | Supabase → Settings → Data API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API Keys → **Publishable key** (`sb_publishable_…`) |

> ⚠️ Todo lo que empieza por `VITE_` llega al navegador. Aquí **nunca** va la secret key.

### Configurar Supabase Auth (una sola vez)

Los correos de confirmación y de recuperación de contraseña llevan a la app. Supabase solo redirige a direcciones de su lista blanca:

1. Supabase → **Authentication → URL Configuration**
   - **Site URL**: `http://localhost:5173`
   - **Redirect URLs** (Add URL): `http://localhost:5173/auth/callback` y `http://localhost:5173/reset-password`
2. Supabase → **Authentication → Sign In / Providers → Email**: activados **Enable Email provider** y **Confirm email**; **Allow new users to sign up** activado.

Al publicar la app se **añaden** las mismas rutas con el dominio real (sin borrar las de localhost) y el Site URL pasa a ser ese dominio. El código no cambia: los enlaces usan siempre la dirección desde donde se abrió la app (`window.location.origin`).

> El correo gratuito de Supabase envía muy pocos correos por hora: si te registras varias veces seguidas probando, puede tardar. Antes de abrir la app a otras personas, configura un SMTP propio.

## Publicación en Vercel

La app publicada vive en Vercel (proyecto con **Root Directory = `Frontend`**; Vercel detecta Vite y ejecuta `npm run build` → `dist/`). Pasos completos en el [README raíz](../README.md#despliegue).

| Variable (panel de Vercel → Settings → Environment Variables) | Valor en producción |
|---|---|
| `VITE_API_URL` | Dirección del Backend en Render, p. ej. `https://englishbrain-api.onrender.com` |
| `VITE_SUPABASE_URL` | La misma que en local |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | La misma que en local (`sb_publishable_…`) |

- Las variables `VITE_` se **incrustan al compilar**: si cambias una, vuelve a desplegar (Deployments → ⋯ → Redeploy).
- [`vercel.json`](vercel.json) sirve `index.html` en cualquier ruta, para que recargar `/inbox` o abrir los enlaces de los correos (`/auth/callback`, `/reset-password`) no dé 404.
- **«Despertando el servidor…»**: el Backend gratuito de Render se duerme tras 15 min sin uso. Si una petición tarda más de 4 s, aparece arriba esa franja (`components/ui/ServerWakeNotice.tsx`) hasta que responde; suele tardar unos 50 s la primera vez.

## Cuentas de usuario

| Ruta | Pantalla |
|---|---|
| `/register` | Registro (nombre opcional, email, contraseña ≥ 8). Envía la zona horaria del navegador para el perfil |
| `/register/check-email` | "Revisa tu email para confirmar tu cuenta", con botón para reenviar |
| `/login` | Login con mensaje genérico de error y aviso si el email no está confirmado (con reenvío) |
| `/auth/callback` | Destino del enlace de confirmación: canjea el código y entra al Panel |
| `/forgot-password` | Pide el enlace de recuperación; responde igual exista o no el email |
| `/reset-password` | Destino del enlace de recuperación: nueva contraseña |
| `/profile` | Nombre, zona horaria y tokens de la extensión (crear mostrando el token una sola vez, listar, revocar) |

- Todas las demás pantallas exigen sesión: sin ella, llevan al login y después vuelven a donde querías ir.
- **Cerrar sesión** está al pie del menú lateral.
- Si el Backend rechaza la sesión (401), la app la cierra y el login avisa: "Tu sesión ha caducado; vuelve a entrar".
- `hooks/useApi()` llama al Backend con el token de la sesión; `fieldErrors(error)` da el mensaje de cada campo para pasarlo al `error` de los `Input`.
- `hooks/useHotkeys()` registra atajos de teclado (`'ctrl+Enter'`, `'Space'`, `'1'`…) que se ignoran mientras se escribe en un campo, salvo los permitidos en `allowInInputs`.

## Panel (`/`)

Tres columnas de escritorio. Cada bloque carga por su cuenta: si uno falla, muestra **Reintentar** y el resto sigue funcionando.

- **Métricas** (izquierda): racha con mapa de calor de 30 días (la celda se oscurece con la actividad del día; hoy va recuadrada), vocabulario curado con barra **Learning / Reviewing / Mastered** (rojo, amarillo, verde; los pendientes del Inbox no cuentan y se enlazan aparte), errores sin superar y esfuerzo por habilidad en 30 días con tu foco destacado.
- **Hoy** (centro): «Tienes N términos vencidos para hoy» y **Empezar repaso**, que abre la sesión Anki a pantalla completa y empieza directamente. Sin vencidos, el botón se deshabilita y te felicita.
- **Barra lateral** (derecha): check-in de hoy con 3 casillas (se guardan al instante y encienden la celda de hoy sin recargar; si fallan, vuelven a su estado) y las 5 últimas palabras añadidas a mano, que se editan en una ventana sin salir del Panel.

## Vocabulario: Inbox y Nueva palabra

- **`/inbox`**: arriba, las capturas de la extensión pendientes de curar (de la más antigua a la más reciente). Se abre sola la primera; al elegir otra, la pantalla se divide en dos columnas:
  - izquierda: la palabra en grande, el párrafo de contexto con la palabra resaltada y el enlace a la web de origen;
  - derecha: traducción (con el foco), definición propia, tipo (viene elegido el sugerido) e interruptor de repasos.
  - **Ctrl+Enter** (⌘+Enter en Mac) guarda y abre la siguiente. **Descartar** borra la captura tras confirmar.
- **`/words/new`**: formulario manual. El tipo se sugiere según la palabra hasta que eliges uno; **Guardar y crear otra** (o Ctrl+Enter) guarda, limpia los campos y vuelve a "Palabra / Frase". El interruptor de repasos se mantiene entre palabras.
- Componentes compartidos en `components/vocabulary/`: `TypePicker` (Palabra / Phrasal verb / Idiom-slang) y `HighlightedContext`.

## Muro de Errores (`/errors`)

- Arriba, el registro a dos columnas: **❌ Frase incorrecta** | **✅ Frase correcta nativa**, la nota con tu regla y el interruptor de repasos. **Añadir al muro** (o Ctrl+Enter) guarda y vuelve a la frase incorrecta.
- Debajo, el muro: cada error con las dos frases lado a lado y su nota. Filtros **Activos / Superados / Todos** y búsqueda en frases y nota (se busca al dejar de escribir).
- **Marcar como superado** guarda la fecha y lo saca de "Activos"; superado no lo quita de los repasos (eso lo decide el interruptor). También se puede editar (ventana) y borrar (con confirmación).

## Speaking (`/speaking`)

1. Eliges la duración máxima (**3, 5 o 10 min**) y pulsas **Grabar**. El navegador pide permiso para el micrófono la primera vez. El temporizador avanza y la grabación se detiene sola al llegar al límite (o con **Detener**).
2. Al terminar, el audio se convierte a **MP3 dentro del navegador** (mono, 64 kbps ≈ 8 KB por segundo) en un Web Worker, con barra de progreso, sin congelar la pantalla.
3. Lo escuchas, le pones **título** y decides **Subir** o **Descartar** (con confirmación). Nada sale del navegador antes de "Subir". Si la subida falla, el audio sigue ahí y el botón pasa a **Reintentar subida**.
4. Mientras haya una grabación sin subir, cerrar o recargar la pestaña pide confirmación.

Debajo, **Tus monólogos**: título, duración y fecha. **Escuchar** pide al Backend un enlace temporal de 5 minutos (el audio es privado); si caduca, el siguiente clic pide otro. También se pueden borrar.

Piezas: `hooks/useRecorder.ts` (micrófono, límite, permiso denegado), `components/speaking/mp3.ts` + `mp3.worker.ts` + `encodeMp3.ts` (conversión), `Recorder.tsx` y `AudioPlayer.tsx`.

> Navegar a otra sección de la app con una grabación sin subir la pierde (el aviso solo cubre cerrar o recargar la pestaña).

## Writing (`/writing`)

- Izquierda: tus textos con extracto de la última versión y número de versiones. Derecha: el texto abierto (va en la URL, `?id=…`; `?new=1` para uno nuevo).
- **Nuevo texto**: título y texto (con contador de palabras); se guarda como **versión 1, el original**.
- El texto abierto muestra el **Original** al lado de la versión elegida en **Comparar con** (por defecto, la última).
- **Añadir versión corregida** parte del último texto para corregir encima; las versiones anteriores nunca se modifican. Si no cambias nada, no se guarda. También se puede cambiar el título y borrar el texto entero (no versiones sueltas).

## Listening (`/listening`)

- Formulario: título, enlace (http/https), **Empieza en** (opcional, `1:32`, `1:02:03` o segundos) y tu transcripción. **Guardar reto** o Ctrl+Enter.
- Cada reto muestra el origen, el inicio y la transcripción. **Escuchar** abre el enlace en otra pestaña, en el segundo exacto si es YouTube. Búsqueda en título y transcripción; editar (ventana) y borrar.

## Biblioteca (`/library`)

- Pestañas **Vocabulario, Errores, Speaking, Writing, Listening** (la pestaña y los filtros van en la URL: `?tab=writing&srs=archived`).
- En todas: búsqueda y filtro **Todos / En repasos / Archivo** (`srs=active|archived` en el Backend). En Vocabulario, además, **Tipo** y **Estado** (por curar, learning, reviewing, mastered), con los colores del Panel.
- Cada fila tiene el interruptor **Repasos** (Modo Archivo): cambia al instante y, si el Backend falla, vuelve a su estado y avisa.
- Vocabulario se edita en una ventana; el resto se abre en su propia pantalla (**Abrir**). Todo se puede borrar con confirmación (Speaking borra también el audio; Writing, todas las versiones).

## Repasar · modo Anki (`/review`)

- Pantalla completa (Fullscreen API), fuera del menú lateral. Pide hasta **100** tarjetas vencidas (las más atrasadas primero); si hay más, el resumen ofrece **Seguir con N más**.
- Se usa entera con el teclado: **Enter** empieza, **Espacio** voltea, **1–4** califican (Otra vez, Difícil, Bien, Fácil; solo tras voltear), **Esc** sale. También hay botones para el ratón.
- **Otra vez (1)** devuelve la tarjeta al final de la sesión. Cada calificación se guarda en segundo plano; si falla, avisa y la tarjeta vuelve a la cola.
- Cada tipo tiene su tarjeta: vocabulario (palabra + contexto → traducción, definición, tipo), error (frase incorrecta → correcta + notas), speaking (reproducir el audio y calificar la fluidez), writing (título → texto y enlace para añadir versión corregida) y listening (**Escuchar** en el segundo exacto → tu transcripción).
- Al terminar: tarjetas repasadas y distribución de calificaciones. Sin vencidas: **¡Estás al día!**

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca en `http://localhost:5173` y recarga al guardar |
| `npm test` | Pruebas (Vitest + Testing Library) |
| `npm run typecheck` | Comprueba los tipos de TypeScript |
| `npm run build` | Comprueba tipos y genera `dist/` para publicar (no hace falta para desarrollar) |

## Estructura

```
Frontend/src/
├── main.tsx              # punto de entrada (router + estilos)
├── App.tsx               # rutas de la app
├── navigation.ts         # secciones del menú: ruta, texto, icono
├── index.css             # Tailwind y el tema (colores, fuente)
├── components/
│   ├── ui/               # piezas reutilizables y estructura base (AppLayout)
│   ├── dashboard/        # widgets del Panel
│   ├── anki/             # tarjetas y sesión de repaso
│   └── speaking/         # grabación y reproducción de monólogos
├── hooks/                # lógica reutilizable (teclado, API, sesión…)
└── views/                # una pantalla por ruta
```

## Diseño

**Solo escritorio (Desktop-First)**
- Ancho mínimo de **1280 px** (`html { min-width: 1280px }` y `<meta name="viewport" content="width=1280">`).
- Los breakpoints responsive de Tailwind (`sm:`, `md:`, `lg:`…) están **desactivados** en `index.css`: no se pueden usar por accidente.
- Estructura base: menú lateral fijo de 240 px a la izquierda y contenido centrado (máximo 1152 px) a la derecha.

**Tema claro y paleta** (tokens de Tailwind definidos en `index.css`)

| Token | Color | Uso |
|---|---|---|
| `brand-100` | `#C8F0D6` | Color base de la marca: fondos destacados, sección activa, chips |
| `brand-600` | `#1F7A4D` | Botones principales y enlaces (texto blanco, contraste 5,3:1) |
| `brand-700` | `#17633E` | Hover de botones |
| `brand-900` | `#14532D` | Texto sobre `brand-100` (contraste 7,3:1) |
| `learning` / `reviewing` / `mastered` | rojo / ámbar / verde | Estados del vocabulario en el Panel |

Regla: el texto siempre con contraste de al menos 4,5:1. El menta `#C8F0D6` nunca lleva texto blanco encima.

**Comprobación visual**: la estructura base se revisó con capturas a exactamente 1280 × 800 px.

## Componentes base (`components/ui/`)

| Componente | Para qué | Detalles |
|---|---|---|
| `Button` | Acciones | Variantes `primary`, `secondary`, `ghost`, `danger`; `loading` lo desactiva y muestra un indicador |
| `Input`, `Textarea` | Campos de formulario | `label` obligatorio, `required` pinta el asterisco, `error` muestra el mensaje del Backend bajo el campo (conectado con `aria-describedby`), `hint` para ayuda |
| `SrsToggle` | Interruptor del Modo Archivo | Texto del spec "¿Añadir a la cola de repasos diarios (Anki)?", explica qué pasa en cada estado; `compact` para filas de tabla; funciona con teclado |
| `ArchiveBadge` | Etiqueta de registro archivado | "🔴 Archivo / Solo Almacenamiento" |
| `Table` | Listados | Columnas con `render` opcional, mensaje vacío, filas clicables que también se activan con Enter |
| `Modal` | Ventanas emergentes | Se cierra con Esc, con la X o clic fuera; pone el foco en el primer campo |
| `ToastProvider` + `useToast()` | Avisos breves | `toast.show('Guardado')` o `{ variant: 'error' }`; desaparecen a los 4 s |

En desarrollo, **<http://localhost:5173/dev/ui>** muestra todos los componentes juntos (esa ruta no existe en la versión publicada).

## Rutas

| Ruta | Pantalla | Grupo |
|---|---|---|
| `/` | Panel | 17 |
| `/review` | Repasar (sesión Anki) | 16 |
| `/inbox` | Inbox | 11 |
| `/words/new` | Nueva palabra | 11 |
| `/library` | Biblioteca | 15 |
| `/errors` | Muro de Errores | 12 |
| `/speaking` | Speaking | 13 |
| `/writing` | Writing | 14 |
| `/listening` | Listening | 14 |
| `/profile` | Perfil | 10 |

Todas las pantallas del menú están construidas; `ComingSoonView` queda para secciones futuras.
