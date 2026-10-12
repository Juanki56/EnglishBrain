---
name: prueba-real
description: Prueba de extremo a extremo del Backend de EnglishBrain contra el proyecto real de Supabase del usuario - script temporal en el scratchpad que crea dos cuentas de prueba, ejercita el flujo de un grupo de tareas y el aislamiento entre usuarios, y borra todo al terminar sin mostrar secretos. Úsala al terminar un grupo de Backend, tras aplicar una migración, o cuando el usuario pida "probarlo de verdad", "prueba real" o "contra Supabase".
---

# Prueba real contra Supabase

Los tests de `npm test` usan un Supabase falso en memoria. Esta prueba confirma que el código funciona con la **base real** (CHECKs, triggers, RLS, Storage). Ya se hizo así en grupos anteriores (p. ej. 23/23, 17/17 y aislamiento 20/20).

**Antes de ejecutar**, explica al usuario qué va a probar el script y que creará y borrará dos cuentas temporales en su proyecto; espera su "dale".

## Reglas de seguridad (obligatorias)

- **Nunca imprimas, copies ni registres valores de `Backend/.env`** (ni la URL completa, ni claves, ni tokens de sesión). Como mucho, di qué variables existen.
- El script vive **solo en el scratchpad** de la sesión, nunca en el repo.
- Cuentas de prueba con correos claramente falsos (`eb-real-a-<aleatorio>@example.com`) y contraseña aleatoria generada en el script.
- Borrado en un bloque `finally`: aunque falle algo, se eliminan los usuarios con `auth.admin.deleteUser` (el `on delete cascade` borra sus datos) y cualquier archivo subido a Storage. Al final, verifica que no quedan filas de esos usuarios.

## Cómo montar el script

1. Archivo `.ts` en el scratchpad, ejecutado desde `Backend/` con `npx tsx <ruta-del-script>` para reutilizar sus dependencias.
2. Carga `Backend/.env` con `dotenv` y crea el cliente con la secret key (igual que `src/services/supabase.ts`).
3. Crea las dos cuentas con `auth.admin.createUser({ email, password, email_confirm: true })` y obtén sus tokens de sesión con `signInWithPassword` en un cliente aparte.
4. Arranca la app en proceso: `createApp({ supabase })` de `Backend/src/app.ts` y llámala con `supertest` y `Authorization: Bearer <token>`. (No hace falta que el usuario tenga `npm run dev` abierto.)
5. Implementa un mini-reporte: cada comprobación imprime `✅ PASS` / `❌ FAIL` con una descripción en español, y al final `N/M PASS`.

## Qué probar

- **Flujo del grupo**: crear, listar (filtros, búsqueda, paginación), leer, editar, borrar; reglas de negocio de la spec; que los triggers reales hacen lo esperado (p. ej. `due_at` con `is_active_srs`, numeración de versiones).
- **Validación**: 2–3 casos inválidos devuelven 400 con mensajes en español.
- **Aislamiento**: el usuario B no puede listar, leer, editar ni borrar lo de A (404) y los datos de A siguen intactos tras los intentos.
- **Storage** (si aplica): subir, leer y borrar en la ruta `{user_id}/{id}.mp3`; B no puede acceder al archivo de A.
- **Limpieza**: tras el `finally`, cero filas y cero archivos de las cuentas de prueba.

## Al terminar

- Muestra al usuario el resumen `N/M PASS` y explica cualquier FAIL en lenguaje sencillo, con su causa probable.
- Si hay fallos, propón la corrección y espera aprobación antes de tocar código.
- No dejes el script en el proyecto. Si el usuario quiere conservarlo, pregunta dónde.
