# Contexto Inicial del Proyecto: EnglishBrain

## 🏛️ 1. Arquitectura y Stack Tecnológico
El proyecto se desarrollará bajo una estructura desacoplada en un solo espacio de trabajo (estilo multi-carpeta estructurada):
- **Backend:** Node.js + TypeScript + Express. Conexión directa a Supabase.
- **Frontend:** Next.js (App Router) o React + TypeScript + Tailwind CSS. Diseñado exclusivamente para monitores de escritorio (Desktop-First). Cero adaptabilidad móvil.
- **Extension:** Chrome Extension (Manifest V3, Vanilla JS/TS).
- **Base de Datos y Almacenamiento:** Supabase (PostgreSQL para tablas y Buckets para almacenar archivos de audio .mp3).

## 📁 2. Estructura de Carpetas Requerida
El agente de desarrollo debe respetar estrictamente esta jerarquía:
- `Backend/src/` -> controllers/, services/, routes/, middlewares/, server.ts
- `Frontend/src/` -> components/ui/, components/dashboard/, components/anki/, components/speaking/, hooks/, views/
- `Extension/` -> manifest.json, background.js, content.js

## ⚙️ 3. Reglas de Negocio Estrictas (Módulos Core)
1. **Diferenciación de Vocabulario:** Todo registro de vocabulario debe contener de forma obligatoria el campo `type` con valores fijos: `word`, `phrasal_verb`, o `idiom_slang`.
2. **Captura Híbrida y Curación Manual (Inbox):** La extensión de Chrome captura la palabra subrayada y su párrafo de contexto de forma automática. El registro llega a la base de datos con estado `pending_curation`. El Frontend contará con una pantalla "Inbox" de dos columnas para que el usuario rellene manualmente la traducción y la definición. Cero automatización con IAs externas en la app.
3. **El Modo Archivo (Interruptor SRS):** Todos los registros del sistema (Vocabulario, Audios largos de Speaking, Writing, Listening) incluirán el campo booleano `is_active_srs`. Si es `false`, el elemento se almacena como biblioteca de consulta permanente y jamás ingresa a la cola de repasos del modo Anki.
4. **Modo Anki Local y Foco Total:** Interfaz minimalista operable al 100% mediante teclado (Barra espaciadora para voltear la tarjeta, números del 1 al 4 para calificar la retención).
5. **Bitácora de Habilidades Largas:** El módulo de Speaking permite grabar monólogos de hasta 10 minutos (con buffer local de confirmación antes de subir a Supabase). Writing guarda bitácoras de texto e historial de versiones.
6. **Check-in Diario de Hábitos:** Widget manual en el Dashboard para marcar actividades externas ejecutadas en el día, lo cual encenderá el mapa de calor de rachas (Streak) de forma independiente.



MÓDULO 1: PANEL PRINCIPAL (DASHBOARD)

Es la pantalla de inicio a tres columnas que consolidará tu estado actual de aprendizaje.

1.1 Sistema de Métricas y Rendimiento (Widget Superior)

• Contador de Racha Activa (Streak): Indicador numérico de días consecutivos en los que el usuario ha registrado al menos una palabra o completado un repaso manual. Incluye un minicalendario de mapa de calor (estilo GitHub) de los últimos 30 días.
• Contador General de Vocabulario: Gráfico de barra segmentada que muestra el total de términos divididos por su estado de retención:
	• Learning (Rojo): Memorizadas recientemente o falladas con frecuencia.
	• Reviewing (Amarillo): En proceso de consolidación.
	• Mastered (Verde): Dominadas a largo plazo.
• Contador de Errores Críticos: Indicador numérico destacado con la cantidad de fallos gramaticales activos en el "Muro de la Vergüenza"
- indicar en que le estas metiendo mas empeño,si en el listening, writing o algo asi


1.2 Sección Central: Cola de Repasos del Día

• Indicador de Carga de Trabajo: Texto dinámico que indica cuántas palabras tienen una fecha de repaso menor o igual a la hora actual (Ej: "Tienes 14 términos vencidos para hoy").
• Botón de Acción Principal (CTA): Acceso directo en pantalla completa para iniciar la sesión de Flashcards locales. Si no hay palabras pendientes, el botón se deshabilita y muestra un mensaje de felicitación.

1.3 Barra Lateral de Accesos Rápidos

• Historial Reciente: Lista de los últimos 5 términos agregados manualmente, con acceso directo a edición rápida mediante un clic.







⚙️ Módulo 2 Rediseñado: 	

Este módulo ahora se compone de dos partes: el mecanismo externo de captura rápida y la interfaz web de escritorio para procesar tus apuntes.

2.1 El Mecanismo de Captura Externa (Extensión de Navegador / Inyección Directa)

• Acción de Subrayado: Mientras lees cualquier artículo web en tu monitor, seleccionas una palabra o frase con el mouse (Ej: "Bite the bullet").
• Captura Automática de Contexto: El script del navegador copia la palabra seleccionada y, de forma automática, extrae el párrafo completo donde se encuentra dicha palabra.
• Envío en 1 Clic o Atajo: Haces clic derecho ➔ "Enviar a mi Cerebro de Inglés" (o usas un atajo como Alt + S). La palabra y el párrafo se envían directamente a Supabase mediante un POST HTTP. No se abre ninguna pestaña nueva ni interrumpe tu lectura.

2.2 La Base de Datos (Estado de los Campos en Supabase)

Cuando envías una palabra desde el navegador, la fila en la tabla vocabulary se crea con la siguiente lógica:
• word: "Bite the bullet" (Llenado automático)
• context_sentence: "The company was losing money, so they had to bite the bullet and lay off workers." (Párrafo capturado automáticamente)
• translation: NULL (Pendiente)
• definition: NULL (Pendiente)
• status: 'pending_curation' (Un estado especial temporal)

2.3 Interfaz Web: El Área de Curación Manual (Inbox)

Cuando abres la aplicación web en tu computadora, la sección de captura se divide en dos pantallas claras a pantalla completa:

A) La Bandeja de Entrada (The Inbox)

Es una lista superior compacta que te muestra únicamente las palabras que enviaste desde el navegador y que están en estado 'pending_curation'.
• Flujo de Rellenado Veloz: Al hacer clic en una palabra de la lista, la pantalla se divide en dos columnas utilizando todo el ancho del monitor:
	• Columna Izquierda: Te muestra la palabra en grande y el párrafo de contexto que se capturó para que recuerdes exactamente dónde la viste.
	• Columna Derecha: Un formulario enfocado con dos campos vacíos para que los llenes tú manualmente: [Traducción al Español] y [Definición propia en Inglés].
• Atajo de Guardado: Al presionar Ctrl + Enter, el sistema guarda tus datos, cambia el estado de la palabra a 'learning' (lista para entrar al algoritmo de repasos) y pasa automáticamente a la siguiente palabra de la lista sin que tengas que usar el mouse.

B) Formulario de Creación Manual Directa (Para cuando no estás navegando)

Si estás viendo una serie en la televisión o leyendo un libro físico y quieres meter una palabra directamente en la web, usas este formulario tradicional de pantalla completa:
• Input 1: Palabra / Frase (Auto-focus).
• Input 2: Contexto (La frase donde la viste, ingresada a mano).
• Input 3: Traducción al Español.
• Input 4: Definición (Opcional).
• Acción: Botón Guardar y Crear Otra (Limpia los campos y te deja el cursor en el Input 1 para seguir escribiendo).

2.4 El "Muro de los Errores Fosilizados" (Captura Manual de Fallas)

Esta sección se mantiene independiente dentro del módulo de captura, ya que los errores siempre se meten de forma consciente y manual tras recibir una corrección:
• Formulario de Dos Columnas:
	• Lado izquierdo: Frase Incorrecta (Ej: "I have a doubt").
	• Lado derecho: Frase Correcta Nativa (Ej: "I have a question").
• Campo Inferior de Notas: Un espacio para escribir tu propia regla mnemotécnica o el porqué te equivocas (Ej: "Dejar de traducir del español 'tener una duda'").







📚 El Sistema de Biblioteca Expandido (Tus 4 Habilidades)

Cada aspecto del inglés se registrará en tu app web como una "tarjeta" o "ficha" dentro de tu biblioteca, y cada una tendrá su propia forma de ser repasada:

1. Speaking (Monólogos y Audios Largos)

• El Registro: En lugar de solo grabar palabras sueltas, creas una ficha de "Audio Largo". La app web te permite iniciar una grabación de 3, 5 o 10 minutos directamente con el micrófono del navegador. Puedes ponerle un título (ej: "Mi opinión sobre la inteligencia artificial" o "Resumen de mi día"). El archivo se guarda en el almacenamiento web de tu base de datos.
• El Repaso: Cuando el sistema de repetición espaciada te muestre esta tarjeta tres semanas después, tu objetivo es escucharte a ti mismo. Al escucharte, podrás notar tus propias muletillas, tus errores de pronunciación y si hablabas pausado. Calificas tu fluidez del 1 al 4 para decidir cuándo volver a auditarte.

2. Writing (Bitácora de Textos)

• El Registro: Funciona igual que el vocabulario, pero en lugar de una palabra, el campo principal es un área de texto largo. Tú escribes ahí un párrafo, un correo de trabajo o un ensayo de forma 100% manual.
• El Repaso: El sistema te muestra tu texto tiempo después. Lo lees y evalúas si hoy, con lo que ya has aprendido, lo escribirías diferente o mejor. La app te permite añadir una "Versión Corregida" al lado o simplemente calificas qué tan cómodo te sientes con ese nivel de escritura del 1 al 4.

3. Listening (Tus Retos de Oído)

• El Registro: Guardas una ficha con un enlace (ej: un fragmento de video de YouTube que te costó entender) junto con tu transcripción manual de lo que lograste captar.
• El Repaso: La app te muestra el enlace. Vuelves a escuchar el audio directamente en tu navegador y revisas si ahora tu oído está más entrenado y comprende las palabras que antes se te escapaban. Calificas tu nivel de comprensión.	



1. El Interruptor de Estudio (Habilitar / Deshabilitar Repasos)

Para poder guardar palabras, textos o audios "porque sí" (solo por el gusto de archivarlos o tenerlos documentados) sin que te persigan en el modo Anki, añadiremos un campo tipo Interruptor (Toggle / Checkbox) en todos los formularios de captura y tablas.
• El Campo Técnico: Se llamará is_active_srs (Booleano: true / false).
• Comportamiento Visual al Guardar: Cuando metas una palabra, grabes un audio o escribas un ensayo, habrá un interruptor que dice: "¿Añadir a la cola de repasos diarios (Anki)?".
	• Si lo dejas activado, el sistema le calcula su fecha de repaso y aparecerá en el Dashboard.
	• Si lo desactivas, el elemento se guarda directamente en tu biblioteca con el estado 🔴 Archivo / Solo Almacenamiento. Se quedará ahí para siempre como consulta, pero jamás te saldrá en los exámenes web.
• Gestión desde la Tabla: En tu base de datos a pantalla completa, podrás activar o desactivar este interruptor con un solo clic en la fila de cualquier palabra o audio si cambias de opinión en el futuro.

2. El Registro de Actividad Diaria ("¿Qué hice hoy?")

Para tener un control real de tu disciplina diario (más allá de si usaste o no la sección Anki de la app), implementaremos una sección de Check-in Manual de Hábitos en el Panel Principal (Dashboard).
• La Interfaz Web: Un pequeño widget lateral en el Dashboard con botones de activación rápida para el día de hoy:
	• [ ] Hoy consumí contenido (Reading / Listening)
	• [ ] Hoy practiqué conversación (Speaking)
	• [ ] Hoy redacté algo (Writing)
• Lógica del Mapa de Calor (Racha): Tu racha del panel principal (el calendario estilo GitHub) se encenderá si cumples cualquiera de estas dos condiciones: o completaste tus tarjetas de Anki programadas, o entraste a la web y marcaste manualmente en los botones que hiciste alguna actividad de inglés de forma externa. Así, la app premia tu esfuerzo real del día.

📝 El Plan Definitivo Ajustado con tus Nuevas Reglas


Característica Añadida	Cómo funciona en la pantalla web	Beneficio directo para ti
Filtro de Modo Archivo	Un interruptor [SRS Activo / Inactivo] en cada registro.	Guardas palabras raras, audios largos o textos libres por el puro placer de archivarlos, sin acumular tareas pendientes.
Check-in Diario de Hábitos	Un listado de checkboxes en el Dashboard para marcar tus actividades externas del día.	Mantiene viva tu racha motivacional (Streak) aunque ese día no hayas hecho tests o flashcards en la app.

¡Con esto el plan queda redondo y completamente adaptado a lo que necesitas! Se convierte en un archivador personal masivo con un sistema Anki opcional.
Si estás de acuerdo con este diseño, confírmame para pasar al Paso 4: Elegir la tecnología (Base de datos de Supabase, almacenamiento de archivos .mp3 pesados y cómo Claude Code debe estructurar el código).
