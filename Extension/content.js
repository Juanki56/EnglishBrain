/**
 * Se inyecta en la página solo cuando el usuario captura (activeTab + scripting).
 * Expone window.__englishBrain con:
 *   - readSelection(): palabra seleccionada + párrafo de contexto + URL
 *   - toast(mensaje, tipo): aviso efímero (≤ 2 s) que no roba el foco ni mueve el scroll
 * Va dentro de una función para poder inyectarse varias veces en la misma página.
 */
(() => {
  if (window.__englishBrain) return;

  const MAX_WORD = 200;
  const MAX_CONTEXT = 2000;
  const BLOCK_TAGS = new Set(['P', 'LI', 'BLOCKQUOTE', 'TD', 'TH', 'DD', 'DT', 'FIGCAPTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'DIV', 'ARTICLE', 'SECTION']);

  const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();

  /** Texto seleccionado, incluido el de un <input> o <textarea>. */
  function selectedText() {
    const active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && /^(text|search)$/i.test(active.type)))) {
      const { selectionStart: start, selectionEnd: end } = active;
      if (start != null && end != null && end > start) return { text: active.value.slice(start, end), block: active.value };
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return { text: '', block: '' };
    return { text: selection.toString(), block: blockText(selection.getRangeAt(0)) };
  }

  /** ¿El elemento se muestra como bloque (párrafo, celda, elemento de lista…)? */
  function isBlock(el) {
    try {
      const display = getComputedStyle(el).display;
      if (display && !display.startsWith('inline') && display !== 'contents') return true;
    } catch {
      /* sin estilos (p. ej. documentos XML): se decide por la etiqueta */
    }
    return BLOCK_TAGS.has(el.tagName);
  }

  /** Texto del ancestro de bloque más cercano a la selección. */
  function blockText(range) {
    let el = range.commonAncestorContainer;
    if (el.nodeType !== Node.ELEMENT_NODE) el = el.parentElement;
    while (el && el !== document.body && el !== document.documentElement && !isBlock(el)) el = el.parentElement;
    if (!el || el === document.body || el === document.documentElement) return '';
    return el.innerText ?? el.textContent ?? '';
  }

  /**
   * Contexto a enviar: el párrafo completo si cabe en 2000 caracteres; si no,
   * la oración que contiene la selección (y, si aun así es enorme, un recorte
   * centrado en la palabra).
   */
  function contextFor(word, rawBlock) {
    const block = clean(rawBlock);
    if (!block) return '';
    if (block.length <= MAX_CONTEXT) return block;

    const at = block.toLowerCase().indexOf(word.toLowerCase());
    if (at === -1) return block.slice(0, MAX_CONTEXT);

    const before = block.slice(0, at);
    const startMatch = before.match(/.*[.!?…]\s/s);
    const start = startMatch ? startMatch[0].length : 0;
    const after = block.slice(at + word.length);
    const endMatch = after.match(/[.!?…](\s|$)/);
    const end = endMatch ? at + word.length + endMatch.index + 1 : block.length;
    const sentence = block.slice(start, end).trim();
    if (sentence.length <= MAX_CONTEXT) return sentence;

    const from = Math.max(0, Math.min(at - Math.floor((MAX_CONTEXT - word.length) / 2), block.length - MAX_CONTEXT));
    return block.slice(from, from + MAX_CONTEXT).trim();
  }

  function readSelection() {
    const { text, block } = selectedText();
    const word = clean(text);
    if (!word) return { error: 'empty' };
    if (word.length > MAX_WORD) return { error: 'too_long' };

    const context = contextFor(word, block);
    const capture = { word };
    if (context && context !== word) capture.context_sentence = context;
    if (/^https?:/.test(location.href)) capture.source_url = location.href.slice(0, 2048);
    return { capture };
  }

  // ── Aviso efímero ────────────────────────────────────────────────────────
  // Va en un Shadow DOM para que los estilos de la página no lo alteren, y con
  // pointer-events: none para no interferir con la lectura.
  let host = null;
  let hideTimer = null;

  const COLORS = {
    success: { bg: '#14532d', fg: '#ffffff', accent: '#c8f0d6' },
    error: { bg: '#7f1d1d', fg: '#ffffff', accent: '#fecaca' },
    info: { bg: '#1f2937', fg: '#ffffff', accent: '#e5e7eb' },
  };

  function toast(message, kind = 'info') {
    if (!host) {
      host = document.createElement('englishbrain-toast');
      host.attachShadow({ mode: 'open' }).innerHTML = `
        <style>
          .toast { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; max-width: 360px;
            display: flex; gap: 10px; align-items: flex-start; padding: 12px 16px; border-radius: 12px;
            font: 500 14px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; letter-spacing: 0;
            box-shadow: 0 8px 24px rgba(0,0,0,.18); pointer-events: none;
            opacity: 0; transform: translateY(8px); transition: opacity .18s ease, transform .18s ease; }
          .toast.show { opacity: 1; transform: none; }
          .mark { font-weight: 700; }
        </style>
        <div class="toast" role="status" aria-live="polite"><span class="mark"></span><span class="text"></span></div>`;
      document.documentElement.appendChild(host);
    }
    const box = host.shadowRoot.querySelector('.toast');
    const colors = COLORS[kind] || COLORS.info;
    box.style.background = colors.bg;
    box.style.color = colors.fg;
    const mark = box.querySelector('.mark');
    mark.textContent = kind === 'success' ? '✓' : kind === 'error' ? '!' : '•';
    mark.style.color = colors.accent;
    box.querySelector('.text').textContent = message;

    requestAnimationFrame(() => box.classList.add('show'));
    clearTimeout(hideTimer);
    // Los errores se leen un poco más; las confirmaciones duran ≤ 2 s (spec browser-capture).
    hideTimer = setTimeout(() => box.classList.remove('show'), kind === 'error' ? 4000 : 1800);
  }

  window.__englishBrain = { readSelection, toast, contextFor };
})();
