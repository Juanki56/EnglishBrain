# EnglishBrain

Tu **cerebro de inglés**: capturas palabras mientras lees, las curas, las repasas con repetición espaciada (modo Anki) y llevas un registro de tu speaking, writing y listening, con racha y estadísticas.

Es una app **multiusuario**: cada persona se registra con su email y solo ve sus propios datos.

## Qué incluye

| Parte | Qué hace |
|---|---|
| **Captura** | Extensión de Chrome: seleccionas una palabra en cualquier web, pulsas `Alt+S` y llega a tu Inbox con su párrafo de contexto |
| **Inbox** | Curas cada captura (traducción, definición, tipo) con `Ctrl+Enter` para pasar a la siguiente |
| **Repasar** | Sesión Anki a pantalla completa, solo con el teclado (`Espacio` voltea, `1–4` califica). Mezcla palabras, errores, audios, textos y retos de escucha |
| **Habilidades** | Muro de errores fosilizados, monólogos grabados (MP3), textos con versiones corregidas y retos de listening con tu transcripción |
| **Biblioteca** | Todo lo guardado, con búsqueda, filtros y **Modo Archivo** (sacar algo de los repasos sin borrarlo) |
| **Panel** | Racha y mapa de calor de 30 días, estado del vocabulario, errores pendientes, esfuerzo por habilidad, check-in diario y lo que toca repasar hoy |

Solo escritorio (1280 px o más) y en español.

## Estructura

```
EnglishBrain/
├── Backend/      API REST: Node + TypeScript + Express + Supabase   → Backend/README.md
│   └── supabase/   migraciones SQL, rollback y comprobaciones         → Backend/supabase/README.md
├── Frontend/     App web: React + Vite + Tailwind + React Router     → Frontend/README.md
├── Extension/    Extensión de Chrome (Manifest V3, JavaScript)       → Extension/README.md
└── openspec/     Especificación, diseño y tareas del proyecto
```

```
 Extensión ──(token ebk_)──┐
                           ▼
 Frontend ──(sesión)──▶ Backend ──(secret key)──▶ Supabase (Postgres + Auth + Storage)
     │                                                ▲
     └────────── solo Auth: login, registro ──────────┘
```

- Todos los datos pasan por el **Backend**, que filtra siempre por el usuario de la sesión. Supabase tiene además RLS como segunda barrera.
- El Frontend usa Supabase **solo para las cuentas** (registro, login, confirmación por email, recuperar contraseña).
- La extensión usa un **token personal** que cada usuario genera en su perfil; solo sirve para crear capturas en su propia cuenta.

## Requisitos

- **Node.js 20 o superior** (desarrollado con Node 24) y npm
- **Google Chrome** (para la extensión)
- Un proyecto de **Supabase** (el plan gratuito sirve)

## Puesta en marcha desde cero

El orden importa: base de datos → Backend → Frontend → extensión.

### 1. Base de datos (una sola vez)

En Supabase → **SQL Editor**, ejecuta en este orden los archivos de `Backend/supabase/migrations/`:

1. `001_schema.sql`
2. `002_rls_queue_storage.sql`
3. `003_daily_activity.sql`

Después ejecuta `Backend/supabase/checks/verify_schema.sql`: todo debe salir **PASS**. Detalles en [Backend/supabase/README.md](Backend/supabase/README.md).

### 2. Backend → `http://localhost:3000`

```bash
cd Backend
npm install
cp .env.example .env        # en PowerShell: Copy-Item .env.example .env
```

Rellena `Backend/.env` con `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y `CORS_ORIGINS=http://localhost:5173`. Luego:

```bash
npm run dev
```

Comprueba <http://localhost:3000/api/health> → `{ "status": "ok", … }`. Más en [Backend/README.md](Backend/README.md).

### 3. Frontend → `http://localhost:5173`

En otra terminal:

```bash
cd Frontend
npm install
cp .env.example .env        # en PowerShell: Copy-Item .env.example .env
```

Rellena `Frontend/.env` con `VITE_API_URL=http://localhost:3000`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Configura una vez en Supabase → **Authentication → URL Configuration** el Site URL y las Redirect URLs (están en [Frontend/README.md](Frontend/README.md)). Luego:

```bash
npm run dev
```

Abre <http://localhost:5173>, **regístrate** y confirma el email.

### 4. Extensión de Chrome

1. En la app: **Perfil → Tokens de la extensión de Chrome → Generar token** y cópialo.
2. En Chrome: `chrome://extensions` → **Modo de desarrollador** → **Cargar descomprimida** → elige la carpeta `Extension`.
3. En las opciones que se abren: dirección `http://localhost:3000`, pega el token y pulsa **Probar conexión**.

Guía y checklist en [Extension/README.md](Extension/README.md).

> Si `npm install` en `Backend/` avisa de que `esbuild` tiene un script de instalación sin aprobar (`npm warn install-scripts`), es inofensivo: el binario ya se instala por otra vía y `npm run dev` funciona igual.

### Uso diario

Dos terminales: `npm run dev` en `Backend/` y `npm run dev` en `Frontend/`. La extensión solo necesita que el Backend esté encendido.

## Variables de entorno y secretos

| Archivo | Variables | ¿Secreto? |
|---|---|---|
| `Backend/.env` | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CORS_ORIGINS`, `PORT` | **Sí**: la secret key da acceso total a la base de datos |
| `Frontend/.env` | `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | No: todo `VITE_` llega al navegador. Aquí **nunca** va la secret key |

Los `.env` están en el `.gitignore` de cada carpeta y nunca se suben; en el repositorio solo están las plantillas `.env.example`.

## Pruebas

| Dónde | Comando | Qué cubre |
|---|---|---|
| `Backend/` | `npm test` · `npm run typecheck` | Rutas, validaciones y mensajes en español, motor SRS, racha y estadísticas, y **aislamiento entre usuarios en cada endpoint** (Supabase simulado en memoria) |
| `Frontend/` | `npm test` · `npm run typecheck` | Pantallas, atajos de teclado, sesión Anki y Panel (Vitest + Testing Library) |
| `Extension/` | Checklist manual | Ver [Extension/README.md](Extension/README.md) |

Además, cada grupo de tareas se verificó contra el Supabase real con cuentas temporales que se borran al terminar. Las últimas comprobaciones de integración (grupo 19):

- **Modo Archivo**: un registro archivado de cualquiera de las 5 categorías nunca aparece en la cola de Anki ni en el contador del Panel, aunque su fecha de repaso ya haya pasado; sigue visible en la Biblioteca y vuelve a la cola al reactivarlo.
- **Aislamiento con dos cuentas**: B no ve nada de A en listas, Inbox, cola, Panel, racha, check-ins ni audios; no puede leer, editar, borrar, archivar ni repasar lo de A (404); el token de extensión de A solo crea en la cuenta de A; y aun consultando Supabase directamente con su sesión, B ve 0 filas de A (RLS).
- **Extensión**: la captura llega como pendiente de curar a la cuenta del dueño del token, con su párrafo y URL; token revocado, Backend apagado y selección vacía muestran su aviso.

### Recorrido completo de punta a punta

Registrarse → confirmar email → generar token → configurar la extensión → capturar → curar en el Inbox con `Ctrl+Enter` → forzar el vencimiento → repasar en Anki → ver la racha y la barra del Panel.

**Resultado (2026-10-12): 13/13 PASS** recorriéndolo por la API contra el Supabase real con una cuenta nueva (borrada al terminar): el Panel parte de cero; la captura llega al Inbox con su párrafo y no cuenta hasta curarla; tras curarla, «Tienes 1 término vencido para hoy» y la barra muestra 1 en Learning; la sesión Anki la recibe con anverso y reverso; al calificar «Bien» se programa a 2 días, el Panel pasa a 0 vencidos y la racha a 1 con la celda de hoy encendida.

Las piezas que dependen del navegador se verificaron a mano por separado: registro y confirmación por email (grupo 10) y la extensión cargada en Chrome capturando en páginas reales (grupo 18). El recorrido completo en una sola pasada manual, la sesión Anki solo con teclado y la reproducción de un monólogo subido quedaron aceptados por el usuario sin repetirlos a mano.

## Despliegue

Pendiente. Al publicar: Backend en un servicio de Node con HTTPS, Frontend en un hosting estático (p. ej. Vercel), `CORS_ORIGINS` y las URLs de Supabase Auth con el dominio real, un SMTP propio en Supabase para los correos, y la extensión apuntando a la dirección pública del Backend (desde sus opciones; Chrome pide permiso una vez).

## Documentación

- [Backend/README.md](Backend/README.md): endpoints, autenticación, motor de repasos, CORS y problemas frecuentes
- [Backend/supabase/README.md](Backend/supabase/README.md): esquema, migraciones, rollback y verificación
- [Frontend/README.md](Frontend/README.md): pantallas, atajos, diseño y componentes
- [Extension/README.md](Extension/README.md): instalación, privacidad y checklist
- `openspec/changes/bootstrap-englishbrain-platform/`: propuesta, especificaciones, diseño y tareas
