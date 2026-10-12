import { useEffect, useRef } from 'react';

/**
 * Atajos de teclado globales. Las combinaciones se escriben como
 * "ctrl+Enter", "Space", "1", "Escape", "shift+?"… (el modificador "mod" es
 * Ctrl en Windows/Linux y ⌘ en Mac).
 *
 * Mientras se escribe en un campo de texto los atajos se ignoran, salvo los
 * indicados en `allowInInputs` (p. ej. "ctrl+Enter" para guardar el Inbox).
 */
export type HotkeyMap = Record<string, (event: KeyboardEvent) => void>;

export interface HotkeyOptions {
  allowInInputs?: string[];
  enabled?: boolean;
}

/** Normaliza un evento a la forma "ctrl+alt+shift+meta+Tecla". */
export function comboFromEvent(event: KeyboardEvent): string {
  const key = event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const parts = [event.ctrlKey && 'ctrl', event.altKey && 'alt', event.shiftKey && key.length > 1 && 'shift', event.metaKey && 'meta'];
  return [...parts.filter(Boolean), key].join('+');
}

/** Normaliza una combinación escrita a mano ("mod+Enter", "Ctrl+S"…). */
export function normalizeCombo(combo: string, isMac = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '')): string {
  const parts = combo.split('+').map((p) => p.trim());
  const key = parts.pop()!;
  const mods = new Set(parts.map((m) => m.toLowerCase()).map((m) => (m === 'mod' ? (isMac ? 'meta' : 'ctrl') : m)));
  const normalizedKey = key === ' ' || key.toLowerCase() === 'space' ? 'Space' : key.length === 1 ? key.toLowerCase() : key;
  // En teclas de un carácter ("?", "A") Shift ya está incluido en el propio carácter.
  if (normalizedKey.length === 1) mods.delete('shift');
  return [...['ctrl', 'alt', 'shift', 'meta'].filter((m) => mods.has(m)), normalizedKey].join('+');
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function useHotkeys(bindings: HotkeyMap, { allowInInputs = [], enabled = true }: HotkeyOptions = {}): void {
  // Las funciones más recientes sin volver a registrar el listener en cada render.
  const latest = useRef(bindings);
  latest.current = bindings;

  const allowed = allowInInputs.map((combo) => normalizeCombo(combo)).join('|');

  useEffect(() => {
    if (!enabled) return;
    const allowedSet = new Set(allowed ? allowed.split('|') : []);

    const onKeyDown = (event: KeyboardEvent) => {
      const combo = comboFromEvent(event);
      const handlers = Object.entries(latest.current).map(([c, h]) => [normalizeCombo(c), h] as const);
      const match = handlers.find(([c]) => c === combo);
      if (!match) return;
      if (isTypingTarget(event.target) && !allowedSet.has(combo)) return;
      event.preventDefault();
      match[1](event);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, allowed]);
}
