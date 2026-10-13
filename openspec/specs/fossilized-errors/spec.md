# fossilized-errors Specification

## Purpose
Registra de forma consciente y manual los errores gramaticales recurrentes del usuario junto con su forma nativa correcta y una regla mnemotécnica, para combatirlos activamente.

## Requirements

### Requirement: Registro de error fosilizado
El sistema SHALL ofrecer un formulario a dos columnas — izquierda "Frase Incorrecta", derecha "Frase Correcta Nativa" — con un campo inferior de notas. Ambas frases son requeridas; las notas son opcionales.

#### Scenario: Registro válido
- **WHEN** el usuario guarda "I have a doubt" / "I have a question" con la nota "Dejar de traducir 'tener una duda'"
- **THEN** se crea un error fosilizado con esos tres valores y estado activo

#### Scenario: Frase faltante
- **WHEN** falta la frase incorrecta o la correcta
- **THEN** el sistema no guarda y señala el campo faltante

### Requirement: Estado activo / superado
Cada error SHALL tener un indicador `is_resolved` (por defecto `false`). Un error con `is_resolved = false` se considera "crítico activo".

#### Scenario: Marcar como superado
- **WHEN** el usuario marca un error como superado
- **THEN** `is_resolved = true` y deja de contar como crítico activo

### Requirement: Muro de errores
El sistema SHALL listar todos los errores mostrando ambas frases lado a lado y la nota, con filtro entre activos y superados.

#### Scenario: Filtrar activos
- **WHEN** el usuario filtra por activos
- **THEN** solo se muestran errores con `is_resolved = false`

### Requirement: Participación en SRS
Los errores fosilizados SHALL incluir `is_active_srs` y, si es `true`, entrar en la cola de repasos mostrando la frase incorrecta en el anverso y la correcta + nota en el reverso.

#### Scenario: Error en sesión de repaso
- **WHEN** un error con `is_active_srs = true` está vencido
- **THEN** aparece en la sesión Anki con la frase incorrecta como anverso
