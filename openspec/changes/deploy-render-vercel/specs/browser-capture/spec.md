# Spec Delta

## MODIFIED Requirements

### Requirement: Envío no intrusivo
El envío SHALL realizarse en segundo plano mediante HTTP POST, sin abrir pestañas ni ventanas y sin alterar el scroll o el foco de la página. La extensión SHALL esperar hasta 70 segundos a que el Backend responda, porque el servidor publicado puede estar despertando.

#### Scenario: Envío exitoso
- **WHEN** el Backend responde 201
- **THEN** la extensión muestra una confirmación discreta (badge o toast de ≤ 2 s) y la página permanece intacta

#### Scenario: Backend despertando
- **WHEN** el Backend tarda más de 4 s en responder
- **THEN** la extensión muestra un aviso discreto de que el servidor se está despertando y la palabra se guardará en cuanto responda, y al llegar la respuesta lo sustituye por la confirmación o el error

#### Scenario: Backend inaccesible o rechazo
- **WHEN** el Backend no responde en 70 s o devuelve un error
- **THEN** la extensión muestra un aviso de error discreto y no pierde la página actual
