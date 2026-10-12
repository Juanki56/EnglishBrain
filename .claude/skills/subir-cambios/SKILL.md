---
name: subir-cambios
description: Sube los cambios de EnglishBrain a GitHub de forma segura - revisa que no vayan secretos (.env) ni carpetas generadas (dist, node_modules), escribe un mensaje de commit en español a partir de las tareas cerradas en tasks.md, hace commit y push a origin/main y confirma que GitHub quedó igual que la copia local. Úsala cuando el usuario diga "sube lo último", "súbelo al repo", "haz push", "pushea" o "guarda en GitHub".
---

# Subir cambios a GitHub

Repositorio: `origin` → `https://github.com/Juanki56/EnglishBrain.git`, rama `main` (ya tiene upstream). Pedirlo ("sube lo último") cuenta como autorización para hacer commit y push de los cambios actuales; no hagas nada más (ni force push, ni cambiar el historial, ni otras ramas).

## 1. Revisar qué hay

```
git fetch -q origin
git status -sb
git status --short --ignored
```

- Si no hay nada que subir, dilo y termina.
- Si GitHub tiene commits que no están en local (`behind`), **detente**: explica la situación y pregunta antes de hacer `git pull`.

## 2. Comprobaciones de seguridad (obligatorias)

Tras `git add -A`, revisa `git diff --cached --name-only` y **detente si aparece**:
- Cualquier `.env` (solo se permiten `.env.example`). Nunca muestres su contenido.
- `dist/`, `node_modules/`, `coverage/` o archivos de build.
- Archivos que parezcan contener secretos (claves `sb_secret_`, tokens `ebk_`, archivos `.pem`/`.key`). Si dudas, busca esos patrones con `git diff --cached` filtrado sin imprimir el valor.
- Scripts temporales que deberían estar en el scratchpad.

Si algo no debería subirse, quítalo del stage con `git restore --staged <archivo>`, explícalo y propone añadirlo al `.gitignore`.

## 3. Mensaje de commit (en español)

- Mira qué tareas pasaron a `- [x]` en `openspec/changes/*/tasks.md` (`git diff --cached` de ese archivo, solo líneas `+- [x]`). Ojo: los cambios de saltos de línea (LF/CRLF) pueden hacer que aparezcan tareas antiguas; quédate con los grupos realmente nuevos comparando con el último commit (`git log --oneline -5`).
- Título corto: `Grupo N: <tema>` o `Grupos N-M: <temas>`. Si no hay tareas nuevas, describe el cambio ("Skills del proyecto", "Corrige …").
- Cuerpo con 2–5 viñetas de lo que incluye (endpoints, pantallas, migraciones, tests).
- Termina el mensaje con la línea de atribución que indique la sesión (Co-Authored-By).
- Usa un heredoc (`git commit -F - <<'EOF' … EOF`) para que los acentos y las líneas salgan bien.

## 4. Subir y confirmar

```
git push
git status -sb          # debe decir ## main...origin/main sin ahead/behind
git log --oneline -3
```

- Si el push pide iniciar sesión, explica que se abrirá la ventana de GitHub (Git Credential Manager) y que debe entrar con la cuenta dueña del repo.
- Si responde `403`/`Permission denied` o `rejected`, no lo fuerces: explica la causa y la solución.

## 5. Informe al usuario

En español y breve:
- El commit subido (hash corto y título) y lo que incluye, agrupado.
- Que se comprobó que no van `.env` ni `dist/`.
- Los avisos `LF will be replaced by CRLF` son normales en Windows: no los presentes como error.
- Enlace: https://github.com/Juanki56/EnglishBrain
