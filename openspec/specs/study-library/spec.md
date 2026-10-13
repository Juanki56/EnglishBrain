# study-library Specification

## Purpose
Biblioteca unificada a pantalla completa de todos los registros del usuario (vocabulario, errores, speaking, writing, listening) y control del Modo Archivo que decide si cada elemento participa o no en el repaso espaciado.

## Requirements

### Requirement: Campo is_active_srs universal
Todo registro estudiable (vocabulario, error fosilizado, speaking, writing, listening) SHALL tener el booleano `is_active_srs`, con valor por defecto `true`.

#### Scenario: Valor por defecto
- **WHEN** se crea un registro sin indicar `is_active_srs`
- **THEN** el registro queda con `is_active_srs = true`

### Requirement: Interruptor en formularios de captura
Todo formulario de creación SHALL mostrar el interruptor "¿Añadir a la cola de repasos diarios (Anki)?", activado por defecto.

#### Scenario: Guardar como archivo
- **WHEN** el usuario desactiva el interruptor y guarda
- **THEN** el registro queda con `is_active_srs = false`, sin fecha de repaso, y se muestra con la etiqueta "🔴 Archivo / Solo Almacenamiento"

#### Scenario: Guardar como estudiable
- **WHEN** el usuario deja el interruptor activado y guarda
- **THEN** el registro recibe una fecha de próximo repaso

### Requirement: Exclusión total del modo Anki
Un registro con `is_active_srs = false` MUST NOT aparecer en la cola de repasos, en el contador de vencidos ni en ninguna sesión Anki, sin importar su fecha de repaso almacenada.

#### Scenario: Registro archivado vencido
- **WHEN** un registro con fecha de repaso pasada tiene `is_active_srs = false`
- **THEN** no aparece en la cola ni cuenta en "términos vencidos"

### Requirement: Conmutación desde la tabla
La tabla de biblioteca SHALL permitir activar o desactivar `is_active_srs` con un solo clic en la fila, persistiendo el cambio de inmediato.

#### Scenario: Reactivar un archivado
- **WHEN** el usuario activa el interruptor de un registro archivado
- **THEN** `is_active_srs = true` y el registro recibe fecha de repaso igual a ahora (vencido hoy) si no tenía programación previa

#### Scenario: Archivar un activo
- **WHEN** el usuario desactiva el interruptor de un registro activo
- **THEN** sale de la cola inmediatamente y conserva su historial de repasos

### Requirement: Navegación y filtros de la biblioteca
La biblioteca SHALL mostrar los registros en tablas por categoría (Vocabulario, Errores, Speaking, Writing, Listening) con búsqueda por texto y filtros por estado SRS (activo/archivo) y, en vocabulario, por `type` y por estado de retención.

#### Scenario: Filtrar por tipo
- **WHEN** el usuario filtra Vocabulario por `phrasal_verb`
- **THEN** solo se muestran términos de ese tipo

#### Scenario: Buscar texto
- **WHEN** el usuario busca "bullet"
- **THEN** se muestran los registros cuyo texto principal o contexto contiene "bullet"

### Requirement: Edición y eliminación de registros
El usuario SHALL poder editar los campos de cualquier registro y eliminarlo con confirmación; al eliminar un speaking se elimina también su archivo de audio.

#### Scenario: Eliminar speaking
- **WHEN** el usuario confirma la eliminación de una ficha de speaking
- **THEN** se eliminan la ficha y su .mp3 del almacenamiento
