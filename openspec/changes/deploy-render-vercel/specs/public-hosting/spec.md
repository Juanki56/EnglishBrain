# Spec Delta

## Purpose

Hace que EnglishBrain funcione desde una dirección pública de internet, sin depender del PC del usuario, protegiendo los secretos y avisando cuando el servidor gratuito tarda en responder.

## ADDED Requirements

### Requirement: App web en una dirección pública
La app web SHALL estar disponible en una dirección pública con HTTPS y SHALL usar el Backend publicado, sin que el usuario tenga que arrancar nada en su PC.

#### Scenario: Abrir la app desde cualquier equipo
- **WHEN** el usuario abre la dirección pública de la app en Chrome desde cualquier equipo
- **THEN** ve la pantalla de inicio de sesión servida por HTTPS y, tras iniciar sesión, sus propios datos

### Requirement: Rutas directas de la app
Cualquier ruta de la app SHALL poder abrirse o recargarse directamente en la dirección pública, mostrando su pantalla en lugar de un error 404 del servidor.

#### Scenario: Recargar una pantalla interna
- **WHEN** el usuario recarga el navegador estando en `/inbox` o en `/review`
- **THEN** se muestra esa misma pantalla

#### Scenario: Enlace de un correo
- **WHEN** el usuario abre el enlace de confirmación o de recuperación de contraseña de un correo
- **THEN** llega a la pantalla `/auth/callback` o `/reset-password` de la app publicada

### Requirement: Backend con comprobación de salud
El Backend publicado SHALL responder en HTTPS en una dirección pública y SHALL exponer una comprobación de salud pública que el proveedor usa para saber si el servicio está listo.

#### Scenario: Comprobación de salud
- **WHEN** se pide `GET /api/health` a la dirección pública del Backend
- **THEN** responde 200 con `status: "ok"`

### Requirement: Secretos fuera del repositorio
La secret key de Supabase y la configuración sensible SHALL guardarse solo en la configuración del proveedor de hosting, nunca en el repositorio. La app web publicada MUST NOT contener la secret key.

#### Scenario: Repositorio limpio
- **WHEN** se revisan los archivos del repositorio, incluida la configuración de despliegue
- **THEN** no aparece ningún valor de la secret key ni archivos `.env`

#### Scenario: Código servido al navegador
- **WHEN** se inspecciona el código que la app publicada envía al navegador
- **THEN** solo contiene la publishable key de Supabase, nunca la secret key

### Requirement: Orígenes permitidos en producción
El Backend publicado SHALL aceptar peticiones del navegador solo desde el dominio publicado de la app y el origen de desarrollo local configurado, además de la extensión en sus rutas permitidas.

#### Scenario: Web ajena
- **WHEN** una página de otro dominio intenta llamar a la API desde el navegador
- **THEN** el navegador bloquea la respuesta

#### Scenario: App publicada
- **WHEN** la app publicada llama a la API
- **THEN** la petición se atiende con normalidad

### Requirement: Despliegue automático
Cada cambio subido a la rama principal del repositorio SHALL publicar automáticamente la nueva versión del Backend y de la app web.

#### Scenario: Subir un cambio
- **WHEN** se hace push a `main`
- **THEN** el Backend y la app web se vuelven a publicar con ese cambio sin pasos manuales

### Requirement: Aviso de servidor despertando en la app
Cuando una petición al Backend tarde más de 4 segundos, la app SHALL mostrar un aviso discreto de que el servidor se está despertando y que puede tardar hasta un minuto, y SHALL retirarlo cuando ya no quede ninguna petición lenta en curso.

#### Scenario: Primera carga con el servidor dormido
- **WHEN** el usuario abre el Panel y el Backend tarda 50 s en responder
- **THEN** a los 4 s aparece «Despertando el servidor…» y desaparece al cargar los datos

#### Scenario: Respuesta rápida
- **WHEN** todas las peticiones responden en menos de 4 s
- **THEN** no se muestra ningún aviso

#### Scenario: Petición fallida
- **WHEN** una petición lenta termina con un error
- **THEN** el aviso se retira y la pantalla muestra su error habitual
