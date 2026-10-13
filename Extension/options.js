/**
 * Opciones de la extensión: dirección del Backend y token personal, con
 * "Probar conexión" (GET /api/capture/check, que no crea nada).
 * El permiso para una dirección que no sea localhost se pide aquí, al pulsar
 * un botón, porque Chrome solo lo permite tras un gesto del usuario.
 */
const $ = (id) => document.getElementById(id);
const form = $('form');
const fields = { apiUrl: $('apiUrl'), token: $('token') };

function setError(name, message) {
  $(`${name}-error`).textContent = message || '';
  fields[name].setAttribute('aria-invalid', message ? 'true' : 'false');
}

function setStatus(message, kind) {
  const status = $('status');
  status.textContent = message;
  status.className = `status ${kind || ''}`;
}

/** Valida el formulario; devuelve { apiUrl, token } o null (y marca los errores). */
function readForm() {
  const url = EB.normalizeApiUrl(fields.apiUrl.value);
  const token = EB.validateToken(fields.token.value);
  setError('apiUrl', url.error);
  setError('token', token.error);
  if (url.error || token.error) {
    (url.error ? fields.apiUrl : fields.token).focus();
    return null;
  }
  return { apiUrl: url.url, token: token.token };
}

/** Pide permiso para la dirección (sin ventana si es localhost: ya viene concedido). */
async function ensurePermission(apiUrl) {
  try {
    if (await chrome.permissions.request({ origins: [EB.originPattern(apiUrl)] })) return true;
  } catch {
    /* patrón no admitido: se trata como permiso denegado */
  }
  setStatus(`Sin permiso para ${new URL(apiUrl).host} la extensión no puede enviar palabras. Pulsa de nuevo y elige «Permitir».`, 'fail');
  return false;
}

async function withBusy(button, task) {
  button.disabled = true;
  try {
    await task();
  } finally {
    button.disabled = false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const config = readForm();
  if (!config) return;
  // permissions.request va antes de cualquier await para conservar el gesto del usuario.
  const permission = ensurePermission(config.apiUrl);
  void withBusy($('save'), async () => {
    if (!(await permission)) return;
    await chrome.storage.local.set(config);
    fields.apiUrl.value = config.apiUrl;
    setStatus('Guardado. Pulsa «Probar conexión» para comprobar el token.', 'ok');
  });
});

$('test').addEventListener('click', () => {
  const config = readForm();
  if (!config) return;
  const permission = ensurePermission(config.apiUrl);
  void withBusy($('test'), async () => {
    if (!(await permission)) return;
    setStatus('Probando… si el servidor estaba dormido puede tardar hasta un minuto.', 'busy');
    try {
      const { status, body } = await EB.request(config.apiUrl, '/api/capture/check', { token: config.token });
      if (status === 200) {
        await chrome.storage.local.set(config);
        setStatus('Conexión correcta: el token es válido y quedó guardado. Ya puedes capturar palabras.', 'ok');
      } else {
        if (status === 401) setError('token', 'Token inválido o revocado');
        setStatus(EB.errorMessage(status, body), 'fail');
      }
    } catch {
      setStatus(EB.networkMessage(config.apiUrl), 'fail');
    }
  });
});

$('toggleToken').addEventListener('click', (event) => {
  const show = fields.token.type === 'password';
  fields.token.type = show ? 'text' : 'password';
  event.currentTarget.textContent = show ? 'Ocultar' : 'Mostrar';
  event.currentTarget.setAttribute('aria-pressed', String(show));
});

$('shortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));

// Valores guardados y atajo actual.
(async () => {
  const { apiUrl, token } = await EB.loadConfig();
  fields.apiUrl.value = apiUrl || EB.DEFAULT_API_URL;
  fields.token.value = token;
  if (!token) fields.token.focus();
  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((c) => c.name === 'capture-selection')?.shortcut;
  $('shortcut').textContent = shortcut || 'sin atajo (asígnalo abajo)';
})();
