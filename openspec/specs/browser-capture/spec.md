# browser-capture Specification

## Purpose
Permite capturar desde cualquier página web una palabra o frase seleccionada junto con su párrafo de contexto y enviarla al cerebro de inglés sin interrumpir la lectura.

## Requirements

### Requirement: Captura de selección y párrafo de contexto
La extensión SHALL tomar el texto seleccionado por el usuario y extraer automáticamente el párrafo completo (elemento de bloque contenedor) donde se encuentra la selección.

#### Scenario: Selección dentro de un párrafo
- **WHEN** el usuario selecciona "bite the bullet" dentro de un `<p>` y dispara la captura
- **THEN** el payload enviado contiene `word = "bite the bullet"` y `context_sentence` con el texto completo de ese párrafo

#### Scenario: Selección vacía
- **WHEN** el usuario dispara la captura sin texto seleccionado
- **THEN** la extensión no envía nada y muestra un aviso breve "Selecciona una palabra primero"

### Requirement: Disparadores de envío
La extensión SHALL ofrecer dos disparadores equivalentes: la opción de menú contextual "Enviar a mi Cerebro de Inglés" y el atajo de teclado `Alt+S`.

#### Scenario: Envío por menú contextual
- **WHEN** el usuario hace clic derecho sobre una selección y elige "Enviar a mi Cerebro de Inglés"
- **THEN** la captura se envía al Backend

#### Scenario: Envío por atajo
- **WHEN** el usuario pulsa `Alt+S` con texto seleccionado
- **THEN** la captura se envía al Backend igual que con el menú contextual

### Requirement: Envío no intrusivo
El envío SHALL realizarse en segundo plano mediante HTTP POST, sin abrir pestañas ni ventanas y sin alterar el scroll o el foco de la página.

#### Scenario: Envío exitoso
- **WHEN** el Backend responde 201
- **THEN** la extensión muestra una confirmación discreta (badge o toast de ≤ 2 s) y la página permanece intacta

#### Scenario: Backend inaccesible o rechazo
- **WHEN** el Backend no responde o devuelve un error
- **THEN** la extensión muestra un aviso de error discreto y no pierde la página actual

### Requirement: Ingesta como pendiente de curación
El Backend SHALL crear, en la cuenta del dueño del token, un registro de vocabulario con `word` y `context_sentence` provistos, `translation` y `definition` en NULL, `status = 'pending_curation'`, `source = 'extension'` y la URL de origen.

#### Scenario: Registro creado
- **WHEN** llega una captura válida
- **THEN** existe una fila nueva en `vocabulary` con `status = 'pending_curation'`, `translation = NULL` y `definition = NULL`

#### Scenario: Tipo provisional asignado
- **WHEN** llega una captura (la extensión no conoce el tipo)
- **THEN** el registro recibe un `type` provisional: `word` si la selección es un solo término, `idiom_slang` si contiene varios; el usuario lo confirma o corrige en el Inbox

#### Scenario: Payload inválido
- **WHEN** la captura llega sin `word` o con `word` de más de 200 caracteres
- **THEN** el Backend responde 400 y no crea ningún registro

### Requirement: Autenticación de la extensión
El endpoint de captura SHALL exigir un token personal (generado por el usuario en su perfil, ver user-accounts) configurado en la página de opciones de la extensión; las credenciales de Supabase MUST NOT residir en la extensión.

#### Scenario: Captura atribuida al dueño del token
- **WHEN** el usuario A envía una captura con su token
- **THEN** el registro aparece solo en el Inbox del usuario A

#### Scenario: Token ausente o inválido
- **WHEN** una captura llega sin token válido
- **THEN** el Backend responde 401 y no crea ningún registro

#### Scenario: Token revocado
- **WHEN** una captura llega con un token que el usuario revocó
- **THEN** el Backend responde 401 y la extensión muestra un aviso para configurar un token nuevo
