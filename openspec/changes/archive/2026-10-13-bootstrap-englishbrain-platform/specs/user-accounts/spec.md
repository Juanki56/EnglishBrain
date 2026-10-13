# Spec Delta

## Purpose

Permite que varias personas usen EnglishBrain, cada una con su cuenta y su espacio de datos completamente privado, incluyendo el acceso autenticado de la extensión de Chrome.

## ADDED Requirements

### Requirement: Registro con email y contraseña
El sistema SHALL permitir crear una cuenta con email y contraseña desde una pantalla de registro pública. La contraseña MUST tener al menos 8 caracteres. Tras registrarse, el sistema envía un email de confirmación y muestra el aviso "Revisa tu email para confirmar tu cuenta".

#### Scenario: Registro exitoso
- **WHEN** una persona se registra con un email nuevo y una contraseña de 10 caracteres
- **THEN** se crea la cuenta, se envía el email de confirmación y se muestra el aviso de revisar el email

#### Scenario: Contraseña corta
- **WHEN** la contraseña tiene menos de 8 caracteres
- **THEN** el sistema no crea la cuenta y señala el campo

#### Scenario: Email ya registrado
- **WHEN** alguien intenta registrarse con un email que ya tiene cuenta
- **THEN** el sistema no crea una segunda cuenta

### Requirement: Confirmación de email obligatoria
Una cuenta MUST NOT poder iniciar sesión hasta que su email haya sido confirmado mediante el enlace recibido.

#### Scenario: Login sin confirmar
- **WHEN** un usuario no confirmado intenta iniciar sesión
- **THEN** el sistema rechaza el acceso e indica que debe confirmar su email

#### Scenario: Enlace de confirmación
- **WHEN** el usuario abre el enlace de confirmación
- **THEN** su cuenta queda confirmada y es redirigido a la app con sesión iniciada

### Requirement: Inicio y cierre de sesión
El sistema SHALL permitir iniciar sesión con email y contraseña y cerrar sesión desde cualquier pantalla autenticada. Las credenciales incorrectas producen un mensaje genérico que no revela si el email existe.

#### Scenario: Credenciales incorrectas
- **WHEN** el usuario introduce una contraseña errónea
- **THEN** se muestra "Email o contraseña incorrectos" sin indicar cuál falló

#### Scenario: Cerrar sesión
- **WHEN** el usuario pulsa "Cerrar sesión"
- **THEN** la sesión se invalida y es redirigido a la pantalla de login

### Requirement: Recuperación de contraseña
El sistema SHALL permitir solicitar un enlace de recuperación por email y establecer una contraseña nueva desde ese enlace. La respuesta a la solicitud MUST ser idéntica exista o no el email.

#### Scenario: Solicitud de recuperación
- **WHEN** el usuario solicita recuperar la contraseña de su email
- **THEN** se muestra "Si el email existe, recibirás un enlace" y se envía el enlace

#### Scenario: Nueva contraseña
- **WHEN** el usuario abre el enlace y guarda una contraseña nueva válida
- **THEN** puede iniciar sesión con la contraseña nueva y no con la anterior

### Requirement: Rutas protegidas
Todas las pantallas de la app salvo registro, login y recuperación SHALL requerir sesión iniciada, y todos los endpoints de la API salvo salud y captura MUST rechazar peticiones sin sesión válida.

#### Scenario: Acceso sin sesión
- **WHEN** alguien sin sesión abre el Dashboard
- **THEN** es redirigido al login

#### Scenario: API sin sesión
- **WHEN** llega una petición a la API sin token de sesión válido
- **THEN** el Backend responde 401

### Requirement: Perfil de usuario
Cada usuario SHALL tener un perfil con nombre visible y zona horaria (IANA), creado automáticamente al registrarse con la zona horaria detectada en el navegador y editable desde la pantalla de perfil.

#### Scenario: Perfil inicial
- **WHEN** un usuario se registra desde un navegador en `America/Bogota`
- **THEN** su perfil queda con zona horaria `America/Bogota`

#### Scenario: Cambiar zona horaria
- **WHEN** el usuario cambia su zona horaria a `Europe/Madrid`
- **THEN** los cálculos diarios (racha, check-in, mapa de calor) usan la nueva zona

### Requirement: Aislamiento de datos por usuario
Todo registro (vocabulario, errores, speaking y sus audios, writing y versiones, listening, repasos, check-ins, tokens) SHALL pertenecer a un único usuario. Un usuario MUST NOT poder ver, modificar ni eliminar datos de otro por ningún medio.

#### Scenario: Acceso directo a un registro ajeno
- **WHEN** el usuario A pide por id un término que pertenece al usuario B
- **THEN** el Backend responde 404 como si no existiera

#### Scenario: Listados y métricas
- **WHEN** el usuario A abre su biblioteca, su cola de repasos o su Dashboard
- **THEN** solo aparecen y se contabilizan registros del usuario A

#### Scenario: Audio ajeno
- **WHEN** el usuario A solicita la URL de reproducción de un audio del usuario B
- **THEN** el Backend responde 404

### Requirement: Tokens personales para la extensión
Cada usuario SHALL poder generar desde su perfil tokens personales para la extensión, con una etiqueta. El token completo se muestra una sola vez al crearlo; después solo se ven su etiqueta, sus últimos caracteres y su último uso. El usuario puede revocar cualquier token.

#### Scenario: Generar token
- **WHEN** el usuario genera un token con etiqueta "Chrome portátil"
- **THEN** ve el token completo una única vez y aparece en su lista de tokens

#### Scenario: Revocar token
- **WHEN** el usuario revoca un token
- **THEN** las capturas enviadas con ese token son rechazadas con 401
