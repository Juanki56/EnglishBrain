# Spec Delta

## Purpose

Registra retos de escucha (fragmentos de audio o video difíciles de entender) con la transcripción manual del usuario para volver a escucharlos y medir la mejora del oído.

## ADDED Requirements

### Requirement: Registro de reto de escucha
El sistema SHALL permitir crear una ficha de listening con `title` (requerido), `url` (requerida, http/https), marca de tiempo opcional de inicio, `transcription` manual (requerida) e `is_active_srs`.

#### Scenario: Crear ficha
- **WHEN** el usuario guarda un enlace de YouTube con inicio en 1:32 y su transcripción
- **THEN** se crea la ficha con esos datos

#### Scenario: URL inválida
- **WHEN** la URL no es http/https válida
- **THEN** el sistema no guarda y señala el campo

### Requirement: Apertura del recurso
Desde la ficha, el usuario SHALL poder abrir el recurso en una pestaña nueva del navegador (en la marca de tiempo indicada cuando el proveedor lo soporte).

#### Scenario: Abrir enlace
- **WHEN** el usuario pulsa "Escuchar" en la ficha
- **THEN** se abre la URL en una pestaña nueva

### Requirement: Repaso de listening
En la sesión Anki, una ficha de listening SHALL mostrar en el anverso el título y el enlace, y en el reverso la transcripción guardada; el usuario califica su comprensión 1–4.

#### Scenario: Revelar transcripción
- **WHEN** el usuario pulsa Espacio sobre una ficha de listening
- **THEN** se muestra la transcripción manual
