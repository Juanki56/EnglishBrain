# speaking-log Specification

## Purpose
Permite grabar monólogos largos desde el micrófono del navegador, confirmarlos localmente antes de subirlos y volver a escucharlos más tarde para auditar la propia fluidez.

## Requirements

### Requirement: Grabación con duración seleccionable
La vista Speaking SHALL permitir iniciar una grabación con un límite elegido entre 3, 5 o 10 minutos, mostrando un temporizador visible, y detenerla automáticamente al alcanzar el límite.

#### Scenario: Límite alcanzado
- **WHEN** el usuario graba con límite de 5 minutos y no la detiene
- **THEN** la grabación se detiene automáticamente a los 5:00

#### Scenario: Detención manual
- **WHEN** el usuario detiene la grabación a los 2:13
- **THEN** la grabación termina con una duración de ~2:13

#### Scenario: Micrófono denegado
- **WHEN** el navegador deniega el permiso de micrófono
- **THEN** la vista muestra un mensaje explicativo y no inicia la grabación

### Requirement: Buffer local de confirmación
Tras detener la grabación, el audio SHALL permanecer solo en el navegador hasta que el usuario lo escuche opcionalmente y elija "Subir" o "Descartar". Nada se envía al servidor antes de "Subir".

#### Scenario: Descartar
- **WHEN** el usuario elige "Descartar"
- **THEN** el audio se elimina del navegador y no se crea ningún registro ni archivo remoto

#### Scenario: Pérdida de pestaña antes de confirmar
- **WHEN** el usuario intenta cerrar o salir de la vista con una grabación sin confirmar
- **THEN** el navegador pide confirmación antes de abandonar

### Requirement: Subida y registro del monólogo
Al confirmar, el sistema SHALL subir el audio como archivo .mp3 al almacenamiento de Supabase y crear una ficha con `title` (requerido), duración, ruta del archivo e `is_active_srs`.

#### Scenario: Subida exitosa
- **WHEN** el usuario pone el título "Resumen de mi día" y pulsa "Subir"
- **THEN** existe un .mp3 en el bucket de audios y una ficha de speaking que lo referencia

#### Scenario: Fallo de subida
- **WHEN** la subida falla
- **THEN** el audio sigue en el buffer local y el usuario puede reintentar sin perderlo

#### Scenario: Audio demasiado largo
- **WHEN** el Backend recibe un audio de duración superior a 10 minutos
- **THEN** lo rechaza con error de validación

### Requirement: Reproducción y calificación de fluidez
Las fichas de speaking SHALL poder reproducirse desde la biblioteca y, si están en SRS, en la sesión de repaso, donde el usuario califica su fluidez de 1 a 4.

#### Scenario: Audio accesible solo para su dueño
- **WHEN** un usuario distinto del dueño solicita reproducir el audio
- **THEN** el sistema no entrega el audio ni una URL para obtenerlo

#### Scenario: Repaso de un monólogo
- **WHEN** una ficha de speaking vencida aparece en la sesión Anki
- **THEN** se muestra su título y un reproductor del audio, y la calificación 1–4 reprograma la ficha
