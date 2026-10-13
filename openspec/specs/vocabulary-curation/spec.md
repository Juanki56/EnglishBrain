# vocabulary-curation Specification

## Purpose
Convierte las capturas crudas en vocabulario listo para estudiar mediante curación manual veloz (Inbox) y permite crear términos directamente sin pasar por el navegador.

## Requirements

### Requirement: Tipificación obligatoria del vocabulario
Todo registro de vocabulario SHALL tener un campo `type` con uno de los valores fijos `word`, `phrasal_verb` o `idiom_slang`. Cualquier otro valor o su ausencia MUST rechazarse.

#### Scenario: Tipo válido
- **WHEN** se guarda un término con `type = 'phrasal_verb'`
- **THEN** el registro se persiste con ese tipo

#### Scenario: Tipo inválido
- **WHEN** se intenta guardar un término con `type = 'slang'` o sin `type`
- **THEN** el sistema responde con error de validación y no persiste el cambio

### Requirement: Lista del Inbox
La vista Inbox SHALL mostrar en una lista superior compacta únicamente los términos con `status = 'pending_curation'`, ordenados del más antiguo al más reciente.

#### Scenario: Solo pendientes
- **WHEN** existen 3 términos `pending_curation` y 10 en `learning`
- **THEN** el Inbox lista exactamente los 3 pendientes

#### Scenario: Inbox vacío
- **WHEN** no hay términos pendientes
- **THEN** el Inbox muestra un estado vacío "No hay capturas por curar"

### Requirement: Vista de curación a dos columnas
Al seleccionar un término del Inbox, la pantalla SHALL dividirse a todo el ancho en dos columnas: izquierda con la palabra en grande y su párrafo de contexto; derecha con un formulario de `translation` (español), `definition` (inglés, propia), selector de `type` e interruptor SRS.

#### Scenario: Apertura de un término
- **WHEN** el usuario hace clic en "bite the bullet" del Inbox
- **THEN** la columna izquierda muestra la frase y su contexto y el foco queda en el campo de traducción

### Requirement: Guardado con Ctrl+Enter y avance automático
Al pulsar `Ctrl+Enter` en el formulario de curación, el sistema SHALL guardar los datos, cambiar `status` a `learning` y abrir automáticamente el siguiente término pendiente con el foco en el campo de traducción.

#### Scenario: Guardar y avanzar
- **WHEN** el usuario completa la traducción y pulsa `Ctrl+Enter`
- **THEN** el término queda en `learning` y se abre el siguiente pendiente sin usar el ratón

#### Scenario: Último pendiente
- **WHEN** se guarda el último término pendiente
- **THEN** el Inbox muestra el estado vacío

#### Scenario: Traducción vacía
- **WHEN** el usuario pulsa `Ctrl+Enter` con la traducción vacía
- **THEN** el sistema no guarda y marca el campo como requerido

### Requirement: Descarte de capturas
El usuario SHALL poder descartar (eliminar) una captura del Inbox.

#### Scenario: Descartar
- **WHEN** el usuario descarta un término pendiente
- **THEN** el término desaparece del Inbox y de la base de datos

### Requirement: Formulario de creación manual directa
El sistema SHALL ofrecer un formulario de pantalla completa con: Palabra/Frase (auto-focus, requerido), Contexto (manual), Traducción (requerida), Definición (opcional), `type` (requerido) e interruptor SRS. El término creado nace en `status = 'learning'` con `source = 'manual'`.

#### Scenario: Guardar y Crear Otra
- **WHEN** el usuario pulsa "Guardar y Crear Otra" con datos válidos
- **THEN** el término se persiste, todos los campos se limpian y el cursor vuelve a Palabra/Frase

#### Scenario: Campo requerido faltante
- **WHEN** falta la palabra o la traducción
- **THEN** el sistema no guarda y señala el campo faltante
