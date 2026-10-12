---
name: nueva-vista
description: Receta para construir o modificar una pantalla del Frontend de EnglishBrain (React + Vite + TypeScript + Tailwind + React Router) siguiendo las convenciones del proyecto - vista en views/ registrada en App.tsx y navigation.ts, datos con useApi, errores por campo con fieldErrors, componentes de components/ui, diseño solo escritorio 1280 px, textos en español y tests con renderApp/mockApi. Úsala al implementar los grupos de Frontend de OpenSpec (Inbox, Errores, Speaking, Writing, Listening, Biblioteca, Anki, Dashboard) o cuando el usuario pida "una pantalla", "una vista" o "una página" nueva.
---

# Nueva vista en el Frontend de EnglishBrain

El usuario habla español y quiere explicaciones detalladas paso a paso. **Antes de escribir código**, explica qué pantalla vas a construir (qué se ve, qué endpoints usa, qué atajos de teclado, qué archivos) y espera su "dale". Implementa solo las tareas que apruebe.

## 0. Contexto antes de empezar

1. Lee la tarea en `openspec/changes/<change>/tasks.md` y la spec de la pantalla en `openspec/changes/<change>/specs/`.
2. Lee en `Backend/README.md` la tabla de endpoints que vas a usar (ruta, cuerpo, respuesta). Si falta algo en el Backend, usa la skill `nuevo-endpoint` primero.
3. Toma como plantilla `src/views/ProfileView.tsx` (formularios, tabla, modal, toasts, errores por campo) y su test `ProfileView.test.tsx`.
4. Revisa `src/views/UiKitView.tsx` (ruta `/dev/ui` en desarrollo) para ver los componentes disponibles.

## 1. Archivos

| Qué | Dónde |
|---|---|
| Vista | `src/views/<Nombre>View.tsx`, exporta `function <Nombre>View()` con comentario `/** Pantalla (spec <spec>): … */` |
| Registro | `src/App.tsx`: añadir `'<ruta>': <<Nombre>View />` al mapa `VIEWS` (sustituye la página provisional `ComingSoonView`) |
| Menú | `src/navigation.ts`: la sección ya existe en `MAIN_SECTIONS`/`SKILL_SECTIONS`/`ACCOUNT_SECTIONS`; solo cambia su ruta, texto o icono si la spec lo pide. Una ruta nueva sin entrada de menú va como `<Route>` dentro de `AppLayout` |
| Componentes propios de la sección | `src/components/<seccion>/` (`dashboard/`, `anki/`, `speaking/`…) |
| Componentes reutilizables | `src/components/ui/` y exportarlos en `components/ui/index.ts` |
| Hooks | `src/hooks/use<Algo>.ts` |
| Test | `src/views/<Nombre>View.test.tsx` (y `*.test.tsx` junto a hooks o componentes con lógica) |

## 2. Reglas obligatorias

**Datos y errores:**
- Siempre `const api = useApi()` (adjunta el token y cierra la sesión ante un 401). Nunca `fetch` directo ni llamar al Backend con Supabase.
- Subidas de archivos con `formData` en las opciones del request.
- Errores: `fieldErrors(error)` para mostrarlos bajo cada campo (los mensajes del Backend ya vienen en español por campo) y `generalMessage(error)` en un `FormAlert` si no son de un campo concreto.
- Estados visibles: cargando, vacío (con un texto que diga qué hacer), error de carga y éxito (`useToast().show('…')`).

**Interfaz:**
- Usa los componentes de `components/ui/` antes de crear uno nuevo: `Button`, `Input`, `Textarea`, `Select`, `Field`, `FormAlert`, `Table`, `Modal`, `Toast`, `SrsToggle`, `ArchiveBadge`.
- Encabezado igual que las demás vistas: icono de la sección + `<h1 className="text-2xl font-semibold tracking-tight">`.
- **Solo escritorio**: ancho mínimo 1280 px, sin breakpoints móviles (`sm:`, `md:`…).
- Atajos de teclado con `useHotkeys` (`src/hooks/useHotkeys.ts`) cuando la spec los pida (Anki, Inbox…). Muestra el atajo en la interfaz.
- **Todos los textos en español**, cercanos y claros. Fechas con `Intl.DateTimeFormat('es', …)`.
- Accesible: cada campo con su `label`, botones con texto o `aria-label`, iconos decorativos con `aria-hidden`. Así los tests pueden buscar por rol y nombre.

## 3. Tests (Vitest + Testing Library)

- Al principio del archivo: `vi.mock('../lib/supabase', async () => (await import('../test/authMock')).supabaseModule);`
- `beforeEach`: `resetAuthMock(fakeSession('tok-…'))` y `vi.unstubAllGlobals()`.
- Monta la app real en la ruta con `renderApp('/ruta')` y simula el Backend con `mockApi({ 'GET /api/…': () => ({ json: … }) })`. Con `calls` comprueba qué se envió (método, ruta, cuerpo, token).
- Nombra los `describe` con el número de tarea (`'11.2 · Curación en el Inbox'`) y los `it` en español describiendo el comportamiento.
- Busca elementos por rol y nombre (`findByRole('button', { name: 'Guardar' })`), no por clases CSS.
- Cubre: carga y listado, estado vacío, crear/editar/borrar, errores 400 por campo mostrados bajo su campo, error de red, y los atajos de teclado si los hay.

## 4. Verificación y cierre

Desde `Frontend/`:
1. `npm run typecheck` — sin errores.
2. `npm test` — todo verde; reporta el número total de tests.
3. **No dejes `Frontend/dist/`**: `npm run build` lo genera. Para verificar basta con typecheck; si usaste build, borra `dist/`.
4. Comprobación visual opcional: propón al usuario abrir la pantalla con `npm run dev` (Backend encendido con `npm run dev` en `Backend/`) a 1280 px, o usa la skill `run` para hacer capturas.
5. Marca las tareas hechas en `tasks.md` (`- [x]`) y actualiza `Frontend/README.md` si cambia algo de uso.
6. Termina explicando qué se hizo, el resultado de los tests y qué viene después; espera aprobación.

**Nunca** imprimas valores de `Frontend/.env` ni de `Backend/.env`; como mucho, nombres de variables. En el Frontend solo puede ir la publishable key, nunca la secret key.
