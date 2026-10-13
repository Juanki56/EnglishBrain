# Spec Delta

## Purpose

Bitácora de textos largos escritos 100 % a mano por el usuario, con historial de versiones corregidas para comparar su progreso de escritura con el tiempo.

## ADDED Requirements

### Requirement: Registro de texto
El sistema SHALL permitir crear una entrada de writing con `title` (requerido), un área de texto largo como contenido principal (requerido) e `is_active_srs`. El contenido original se guarda como versión 1.

#### Scenario: Crear entrada
- **WHEN** el usuario guarda un correo de trabajo con título "Email a cliente"
- **THEN** se crea la entrada con su versión 1 igual al texto escrito

#### Scenario: Contenido vacío
- **WHEN** el usuario intenta guardar sin contenido
- **THEN** el sistema no guarda y señala el campo

### Requirement: Versiones corregidas
El usuario SHALL poder añadir una "Versión Corregida" a una entrada existente; cada versión se conserva inmutable con número incremental y fecha. Las versiones anteriores MUST NOT sobrescribirse.

#### Scenario: Añadir versión
- **WHEN** el usuario añade una versión corregida a una entrada con 1 versión
- **THEN** la entrada tiene 2 versiones y la 1 permanece intacta

### Requirement: Vista comparativa
La vista de una entrada SHALL mostrar lado a lado la versión original y la versión seleccionada del historial.

#### Scenario: Comparar
- **WHEN** el usuario abre una entrada con 3 versiones y elige la 3
- **THEN** ve la versión 1 a la izquierda y la 3 a la derecha

### Requirement: Repaso de writing
En la sesión Anki, una entrada de writing SHALL mostrar su última versión y permitir calificar la comodidad 1–4 o abrir el editor de nueva versión corregida.

#### Scenario: Calificar texto
- **WHEN** el usuario califica 3 una entrada de writing en repaso
- **THEN** la entrada se reprograma según el algoritmo SRS
