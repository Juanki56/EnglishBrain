# habit-tracking Specification

## Purpose
Mide la disciplina diaria real del usuario mediante un check-in manual de actividades externas y una racha con mapa de calor que premia cualquier esfuerzo del día, dentro o fuera de la app.

## Requirements

### Requirement: Check-in diario manual
El Dashboard SHALL mostrar un widget con tres casillas para el día actual: "Hoy consumí contenido (Reading / Listening)", "Hoy practiqué conversación (Speaking)" y "Hoy redacté algo (Writing)". Marcar o desmarcar persiste el estado de inmediato.

#### Scenario: Marcar hábito
- **WHEN** el usuario marca "Hoy practiqué conversación"
- **THEN** se guarda el check-in de speaking para la fecha de hoy

#### Scenario: Desmarcar
- **WHEN** el usuario desmarca una casilla del día actual
- **THEN** se elimina ese check-in de hoy

### Requirement: Definición de día activo
Un día SHALL considerarse activo si se cumple al menos una condición: se registró al menos un término de vocabulario, se completó al menos un repaso en la sesión Anki, o se marcó al menos un check-in de hábito. Los días se calculan en la zona horaria configurada en el perfil de cada usuario.

#### Scenario: Activo solo por check-in
- **WHEN** en un día no hubo repasos ni términos nuevos pero se marcó "Hoy redacté algo"
- **THEN** ese día cuenta como activo

#### Scenario: Frontera de día según zona horaria
- **WHEN** un usuario con zona `America/Bogota` marca un check-in a las 23:30 hora local
- **THEN** el check-in cuenta para ese día local aunque en UTC ya sea el día siguiente

#### Scenario: Día inactivo
- **WHEN** en un día no se cumplió ninguna condición
- **THEN** ese día no es activo

### Requirement: Racha activa
La racha SHALL ser el número de días activos consecutivos terminando hoy; si hoy aún no es activo, termina ayer. Un día inactivo anterior la reinicia.

#### Scenario: Hoy pendiente
- **WHEN** ayer y anteayer fueron activos y hoy aún no
- **THEN** la racha es 2

#### Scenario: Racha rota
- **WHEN** ayer no fue activo y hoy aún no
- **THEN** la racha es 0

### Requirement: Mapa de calor de 30 días
El sistema SHALL mostrar un minicalendario estilo GitHub de los últimos 30 días, donde cada celda indica si el día fue activo y su intensidad crece con la cantidad de actividades del día.

#### Scenario: Celda encendida
- **WHEN** el usuario marca un check-in hoy
- **THEN** la celda de hoy se enciende sin recargar la página
