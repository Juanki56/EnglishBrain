/**
 * Configuración y llamadas al Backend compartidas por background.js
 * (con importScripts) y options.html (con <script>).
 * La configuración vive en chrome.storage.local: el token no se sincroniza
 * con la cuenta de Google y el service worker no guarda nada en memoria.
 */
self.EB = {
  DEFAULT_API_URL: 'http://localhost:3000',
  TOKEN_PATTERN: /^ebk_[A-Za-z0-9_-]{43}$/,
  // El Backend gratuito de Render se duerme tras 15 min sin uso y tarda ~50 s
  // en despertar: se espera hasta 70 s y, pasados 4 s, se avisa de la espera.
  TIMEOUT_MS: 70000,
  SLOW_MS: 4000,

  /** Valida y limpia la dirección del Backend ("https://api.x.com/" → "https://api.x.com"). */
  normalizeApiUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) return { error: 'La dirección del Backend es obligatoria' };
    let url;
    try {
      url = new URL(value);
    } catch {
      return { error: 'Escribe una dirección completa, por ejemplo http://localhost:3000' };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { error: 'La dirección debe empezar por http:// o https://' };
    }
    return { url: (url.origin + url.pathname).replace(/\/+$/, '') };
  },

  validateToken(raw) {
    const value = String(raw || '').trim();
    if (!value) return { error: 'El token es obligatorio; genéralo en la app, en Perfil → Tokens de la extensión' };
    if (!EB.TOKEN_PATTERN.test(value)) return { error: 'Ese no parece un token de EnglishBrain: empieza por ebk_ y tiene 47 caracteres' };
    return { token: value };
  },

  /** Patrón de permiso de Chrome para la dirección del Backend. */
  originPattern(apiUrl) {
    return `${new URL(apiUrl).origin}/*`;
  },

  async hasPermission(apiUrl) {
    return chrome.permissions.contains({ origins: [EB.originPattern(apiUrl)] });
  },

  async loadConfig() {
    const { apiUrl, token } = await chrome.storage.local.get(['apiUrl', 'token']);
    return { apiUrl: apiUrl || '', token: token || '' };
  },

  /**
   * Llama al Backend con el token de la extensión. Devuelve { status, body };
   * lanza { network: true } si no responde a tiempo o no se puede conectar.
   */
  async request(apiUrl, path, { token, method = 'GET', body } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EB.TIMEOUT_MS);
    try {
      const res = await fetch(apiUrl + path, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      return { status: res.status, body: data };
    } catch {
      throw { network: true };
    } finally {
      clearTimeout(timer);
    }
  },

  /** Mensaje en español para una respuesta de error del Backend. */
  errorMessage(status, body) {
    if (status === 401) return 'Token inválido o revocado. Genera uno nuevo en tu perfil y pégalo en las opciones de la extensión.';
    if (status === 404) return 'Esa dirección no parece ser el Backend de EnglishBrain. Revísala en las opciones.';
    const detail = body?.error?.details?.[0]?.message;
    if (status === 400 && detail) return detail;
    if (body?.error?.message) return body.error.message;
    return `El Backend respondió con un error (${status}).`;
  },

  networkMessage(apiUrl) {
    return `No se pudo conectar con el Backend (${apiUrl}). Comprueba que está encendido y que la dirección es correcta.`;
  },
};
