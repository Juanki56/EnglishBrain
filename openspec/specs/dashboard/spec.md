# dashboard Specification

## Purpose
Pantalla de inicio de escritorio a tres columnas que consolida el estado de aprendizaje del usuario: métricas, carga de repasos del día y accesos rápidos.

## Requirements

### Requirement: Layout de escritorio a tres columnas
El Dashboard SHALL presentarse en tres columnas (métricas, cola del día, barra lateral de accesos rápidos y check-in) diseñadas para monitores de escritorio. La aplicación MUST NOT ofrecer layouts adaptados a móvil.

#### Scenario: Monitor de escritorio
- **WHEN** el usuario abre la app en una ventana de 1280 px o más de ancho
- **THEN** ve las tres columnas simultáneamente

### Requirement: Contador general de vocabulario
El widget superior SHALL mostrar el total de términos curados y una barra segmentada por estado de retención: Learning (rojo), Reviewing (amarillo) y Mastered (verde). Los términos `pending_curation` no se incluyen.

#### Scenario: Distribución
- **WHEN** hay 10 términos learning, 5 reviewing, 5 mastered y 4 pendientes
- **THEN** el total mostrado es 20 y la barra tiene segmentos de 50 %, 25 % y 25 %

### Requirement: Indicador de racha
El widget superior SHALL mostrar el número de la racha activa y el mapa de calor de 30 días definidos en habit-tracking.

#### Scenario: Racha visible
- **WHEN** la racha es 7
- **THEN** el Dashboard muestra "7" junto al mapa de calor

### Requirement: Contador de errores críticos
El widget superior SHALL mostrar destacado el número de errores fosilizados activos (no superados).

#### Scenario: Conteo
- **WHEN** hay 6 errores, 2 de ellos superados
- **THEN** el contador muestra 4

### Requirement: Distribución de esfuerzo por habilidad
El Dashboard SHALL indicar en qué habilidad (Vocabulario/Reading, Listening, Speaking, Writing) el usuario ha invertido más esfuerzo en los últimos 30 días, contando registros creados, repasos realizados y check-ins por habilidad, y mostrar la proporción de cada una.

#### Scenario: Habilidad dominante
- **WHEN** en 30 días hubo 40 actividades de vocabulario, 10 de writing, 5 de speaking y 5 de listening
- **THEN** el Dashboard destaca Vocabulario/Reading como foco principal y muestra las cuatro proporciones

### Requirement: Carga de trabajo del día
La sección central SHALL mostrar un texto dinámico con el número de registros en la cola de vencidos (p. ej. "Tienes 14 términos vencidos para hoy").

#### Scenario: Con vencidos
- **WHEN** la cola contiene 14 registros
- **THEN** se muestra "Tienes 14 términos vencidos para hoy"

### Requirement: Botón principal de repaso
El CTA SHALL iniciar la sesión Anki a pantalla completa. Si la cola está vacía, el botón se deshabilita y se muestra un mensaje de felicitación.

#### Scenario: Iniciar sesión
- **WHEN** hay vencidos y el usuario pulsa el CTA
- **THEN** se abre la sesión Anki a pantalla completa

#### Scenario: Sin vencidos
- **WHEN** la cola está vacía
- **THEN** el CTA está deshabilitado y se muestra un mensaje de felicitación

### Requirement: Historial reciente con edición rápida
La barra lateral SHALL listar los 5 últimos términos de vocabulario agregados manualmente (`source = 'manual'`), del más reciente al más antiguo; un clic abre su edición rápida.

#### Scenario: Edición rápida
- **WHEN** el usuario hace clic en uno de los 5 términos recientes
- **THEN** se abre un editor del término sin abandonar el Dashboard y al guardar la lista se actualiza
