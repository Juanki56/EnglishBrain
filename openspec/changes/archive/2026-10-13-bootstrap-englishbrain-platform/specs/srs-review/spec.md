# Spec Delta

## Purpose

Programa repasos espaciados para todos los registros activos en SRS y ofrece una sesión de flashcards local, minimalista y operable al 100 % con teclado.

## ADDED Requirements

### Requirement: Cola de vencidos
La cola de repasos SHALL contener todos los registros con `is_active_srs = true`, que no estén en `pending_curation`, y cuya fecha de próximo repaso sea menor o igual al instante actual, ordenados por fecha de vencimiento ascendente.

#### Scenario: Composición de la cola
- **WHEN** hay 14 registros activos vencidos, 3 activos con fecha futura, 2 archivados vencidos y 1 pendiente de curación
- **THEN** la cola contiene exactamente los 14 vencidos activos

### Requirement: Calificación 1–4 y reprogramación
Cada calificación SHALL reprogramar el registro: 1 (Otra vez) reinicia el intervalo y lo reinserta al final de la sesión actual; 2 (Difícil), 3 (Bien) y 4 (Fácil) producen intervalos estrictamente crecientes entre sí. Cada calificación se registra como evento de repaso con fecha.

#### Scenario: Orden de intervalos
- **WHEN** un mismo registro se calificara con 2, 3 o 4 desde el mismo estado
- **THEN** el próximo repaso con 4 es posterior al de 3, y el de 3 posterior al de 2

#### Scenario: Fallo
- **WHEN** el usuario califica 1
- **THEN** el registro vuelve a aparecer antes de terminar la sesión y su intervalo se reinicia

#### Scenario: Evento registrado
- **WHEN** el usuario califica cualquier tarjeta
- **THEN** se guarda un evento de repaso con el registro, la calificación y la fecha

### Requirement: Estados de retención
El sistema SHALL derivar para cada registro activo un estado de retención: `learning` (intervalo < 7 días o tras un fallo), `reviewing` (7 a 20 días) y `mastered` (≥ 21 días). En vocabulario, este estado se refleja en `status` una vez curado.

#### Scenario: Promoción a mastered
- **WHEN** un término alcanza un intervalo de 21 días o más
- **THEN** su estado de retención es `mastered`

#### Scenario: Degradación por fallo
- **WHEN** un término `mastered` se califica con 1
- **THEN** su estado pasa a `learning`

### Requirement: Sesión a pantalla completa operable por teclado
La sesión Anki SHALL ocupar toda la pantalla con interfaz minimalista: `Espacio` voltea la tarjeta, `1`–`4` califican (solo tras voltear) y `Esc` sale. Ninguna acción de la sesión requiere ratón.

#### Scenario: Voltear y calificar
- **WHEN** el usuario pulsa Espacio y luego 3
- **THEN** se muestra el reverso, se aplica la calificación 3 y aparece la siguiente tarjeta

#### Scenario: Calificar sin voltear
- **WHEN** el usuario pulsa 3 con la tarjeta sin voltear
- **THEN** no ocurre nada

#### Scenario: Fin de sesión
- **WHEN** no quedan tarjetas en la sesión
- **THEN** se muestra un resumen con el número de tarjetas repasadas y la distribución de calificaciones

### Requirement: Presentación por tipo de registro
Cada tarjeta SHALL renderizarse según su categoría: vocabulario (anverso palabra + contexto; reverso traducción, definición y `type`), error (anverso frase incorrecta; reverso correcta + nota), speaking (título + reproductor), writing (última versión), listening (título + enlace; reverso transcripción).

#### Scenario: Tarjeta de vocabulario
- **WHEN** se voltea una tarjeta de vocabulario
- **THEN** se muestran su traducción, definición y tipo

### Requirement: Sin servicios de IA externos
La generación de contenido de tarjetas y la evaluación MUST NOT depender de servicios de IA externos; todo contenido proviene de lo que el usuario ingresó manualmente.

#### Scenario: Sin llamadas externas
- **WHEN** se ejecuta una sesión de repaso completa
- **THEN** no se realiza ninguna llamada a servicios externos distintos del Backend y Supabase
