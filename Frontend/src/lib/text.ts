/** Utilidades de texto y tiempo compartidas por las vistas. */

/** Número de palabras de un texto. */
export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/**
 * Convierte "1:32", "01:02:03" o "92" en segundos. Devuelve null si está vacío
 * y undefined si el formato no es válido.
 */
export function parseTimestamp(value: string): number | null | undefined {
  const text = value.trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);
  const parts = text.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return undefined;
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((n) => n >= 60)) return undefined;
  return numbers.reduce((total, n) => total * 60 + n, 0);
}

/** 92 → "1:32"; 3723 → "1:02:03". */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
