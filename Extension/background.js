/**
 * Service worker de la extensión (design D7): menú contextual y atajo Alt+S.
 * Pide la selección al content script, la envía con un POST en segundo plano
 * (sin abrir pestañas) y avisa con un toast en la página y el badge del icono.
 * No guarda estado en memoria: Chrome puede suspenderlo en cualquier momento.
 */
importScripts('config.js');

const MENU_ID = 'send-to-englishbrain';

chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: MENU_ID, title: 'Enviar a mi Cerebro de Inglés', contexts: ['selection'] });
  // Recién instalada y sin configurar: abre las opciones para pegar el token.
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID) void capture(tab, info.frameId ?? 0, info.selectionText ?? '');
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'capture-selection') void capture(tab, 0, '');
});

// El icono abre las opciones (la extensión no tiene ventana emergente).
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

/** Captura la selección de la pestaña y la envía al Backend. */
async function capture(tab, frameId, fallbackText) {
  if (!tab?.id) return;
  const target = { tabId: tab.id, frameIds: [frameId] };
  const toast = (message, kind) =>
    chrome.scripting
      .executeScript({ target, func: (m, k) => window.__englishBrain?.toast(m, k), args: [message, kind] })
      .catch(() => {});

  // 1. Leer la selección y su párrafo en la página.
  let read;
  try {
    await chrome.scripting.executeScript({ target, files: ['content.js'] });
    const [result] = await chrome.scripting.executeScript({ target, func: () => window.__englishBrain.readSelection() });
    read = result?.result;
  } catch {
    // Páginas donde Chrome no deja entrar a las extensiones (chrome://, la tienda, el visor de PDF…).
    if (fallbackText.trim()) {
      read = { capture: { word: fallbackText.trim().replace(/\s+/g, ' ').slice(0, 200) } };
    } else {
      return flashBadge(tab.id, 'error', 'EnglishBrain no puede leer esta página: Chrome no permite extensiones aquí.');
    }
  }

  if (read?.error === 'empty') return toast('Selecciona una palabra primero', 'info');
  if (read?.error === 'too_long') return toast('La selección es demasiado larga: elige una palabra o frase de hasta 200 caracteres.', 'error');
  if (!read?.capture) return toast('No se pudo leer la selección. Inténtalo de nuevo.', 'error');

  // 2. Configuración (se lee en cada envío).
  const { apiUrl, token } = await EB.loadConfig();
  if (!apiUrl || !token) {
    await toast('Falta configurar la extensión: haz clic en su icono y pega tu token.', 'error');
    return flashBadge(tab.id, 'error', 'Falta configurar la extensión');
  }
  if (!(await EB.hasPermission(apiUrl))) {
    await toast(`Falta dar permiso para ${new URL(apiUrl).host}: abre las opciones y pulsa Guardar.`, 'error');
    return flashBadge(tab.id, 'error', 'Falta permiso para el Backend');
  }

  // 3. Enviar en segundo plano. Si el servidor tarda (Render gratuito dormido),
  // a los 4 s se avisa de la espera; el resultado sustituye ese aviso.
  let waiting = null;
  const waitTimer = setTimeout(() => {
    waiting = toast('Despertando el servidor… la palabra se guardará en cuanto responda.', 'wait');
  }, EB.SLOW_MS);
  let response = null;
  try {
    response = await EB.request(apiUrl, '/api/capture', { token, method: 'POST', body: read.capture });
  } catch {
    response = null;
  } finally {
    clearTimeout(waitTimer);
    await waiting; // el aviso de espera nunca debe tapar el resultado
  }

  if (!response) {
    const message = EB.networkMessage(apiUrl);
    await toast(message, 'error');
    return flashBadge(tab.id, 'error', message);
  }
  if (response.status === 201) {
    await toast(`«${read.capture.word}» guardada en tu Inbox`, 'success');
    return flashBadge(tab.id, 'success', 'Guardada en tu Inbox');
  }
  const message = EB.errorMessage(response.status, response.body);
  await toast(message, 'error');
  flashBadge(tab.id, 'error', message);
}

/** Marca el icono un momento: ✓ verde si salió bien, ! rojo si no. */
function flashBadge(tabId, kind, title) {
  const ok = kind === 'success';
  chrome.action.setBadgeBackgroundColor({ tabId, color: ok ? '#1f7a4d' : '#dc2626' });
  chrome.action.setBadgeText({ tabId, text: ok ? '✓' : '!' });
  chrome.action.setTitle({ tabId, title: `EnglishBrain · ${title}` });
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    chrome.action.setTitle({ tabId, title: 'EnglishBrain · selecciona una palabra y pulsa Alt+S' }).catch(() => {});
  }, ok ? 2000 : 5000);
}
