# Proposal

## Why

El aprendizaje de inglés de un estudiante autodidacta está disperso: palabras subrayadas en artículos que se pierden, errores corregidos que se repiten, monólogos y textos sin registro, y ninguna métrica de disciplina real. EnglishBrain unifica todo en una app web de escritorio donde cada usuario tiene su propio archivador privado con un sistema de repaso espaciado (SRS) opcional, alimentado por captura rápida desde el navegador y curación 100 % manual (sin IA externa).

## What Changes

Proyecto greenfield. Se crea desde cero un workspace con tres carpetas desacopladas (`Backend/`, `Frontend/`, `Extension/`) sobre Supabase:

- **Cuentas de usuario**: registro con email y contraseña confirmado por email, login, logout, recuperación de contraseña y perfil con zona horaria. Todos los datos (vocabulario, errores, audios, textos, hábitos) son privados de cada usuario.
- **Captura desde el navegador**: extensión Chrome (Manifest V3) que envía palabra/frase seleccionada + párrafo de contexto con clic derecho o `Alt+S`, sin abrir pestañas, autenticada con un token personal que el usuario genera en la app. El registro nace en estado `pending_curation`.
- **Inbox de curación** a dos columnas con guardado `Ctrl+Enter` y avance automático, más formulario de creación manual directa ("Guardar y Crear Otra").
- **Vocabulario tipificado**: campo obligatorio `type` ∈ {`word`, `phrasal_verb`, `idiom_slang`}.
- **Muro de Errores Fosilizados**: frase incorrecta vs. correcta nativa + nota mnemotécnica.
- **Bitácoras de habilidades**: Speaking (grabaciones de 3/5/10 min con buffer local de confirmación, subidas como .mp3 a Supabase Storage), Writing (textos largos con historial de versiones corregidas), Listening (enlace + transcripción manual).
- **Interruptor SRS (`is_active_srs`)** en todos los registros: si es `false`, el elemento queda como archivo de consulta y nunca entra en la cola de repasos. Conmutable con un clic desde la tabla de biblioteca.
- **Modo Anki local**: sesión de repaso a pantalla completa operable solo con teclado (Espacio voltea, 1–4 califica) sobre vocabulario, speaking, writing y listening.
- **Dashboard a tres columnas**: racha + mapa de calor de 30 días, barra segmentada Learning/Reviewing/Mastered, contador de errores críticos, distribución de esfuerzo por habilidad, carga de repasos vencidos con CTA, historial de los 5 últimos términos con edición rápida.
- **Check-in diario de hábitos**: tres casillas manuales (Reading/Listening, Speaking, Writing) que encienden la racha de forma independiente al SRS.
- Interfaz exclusivamente Desktop-First; sin soporte móvil.

## Capabilities

### New Capabilities
- `user-accounts`: registro, confirmación de email, login/logout, recuperación de contraseña, perfil, tokens personales de extensión y aislamiento de datos por usuario.
- `browser-capture`: captura de palabra + párrafo desde la extensión Chrome y su ingesta como registro `pending_curation`.
- `vocabulary-curation`: Inbox de curación a dos columnas y formulario de creación manual de vocabulario, incluyendo la tipificación `type`.
- `fossilized-errors`: registro y consulta del Muro de Errores Fosilizados.
- `speaking-log`: grabación, confirmación local, subida y reproducción de monólogos largos.
- `writing-log`: bitácora de textos largos con historial de versiones corregidas.
- `listening-log`: fichas de retos de escucha con enlace y transcripción manual.
- `study-library`: biblioteca unificada de registros y el interruptor de Modo Archivo (`is_active_srs`).
- `srs-review`: algoritmo de programación de repasos, cola de vencidos y sesión Anki operada por teclado.
- `habit-tracking`: check-in diario de hábitos y cálculo de racha / mapa de calor.
- `dashboard`: panel principal con métricas, cola del día y accesos rápidos.

### Modified Capabilities
_Ninguna (no existen specs previas)._

## Impact

- **Código nuevo**: `Backend/src/` (controllers, services, routes, middlewares, server.ts), `Frontend/src/` (components/ui, dashboard, anki, speaking, hooks, views), `Extension/` (manifest.json, background.js, content.js).
- **Infraestructura**: proyecto Supabase con Supabase Auth (email + contraseña), tablas PostgreSQL (profiles, capture_tokens, vocabulary, fossilized_errors, speaking_logs, writing_logs, writing_versions, listening_logs, review_events, habit_checkins), todas con `user_id`, y bucket de Storage para audios .mp3 organizado por usuario.
- **Dependencias**: Node.js, TypeScript, Express, `@supabase/supabase-js`, React + Tailwind CSS, codificador MP3 en el navegador.
- **APIs**: API REST propia del Backend consumida por Frontend y Extension.
- **Seguridad**: la *secret key* de Supabase solo vive en el Backend; el Frontend usa la *publishable key* únicamente para Auth. Aislamiento por usuario en el Backend y RLS en la base de datos. Envío de emails transaccionales (confirmación y recuperación) vía Supabase Auth.
