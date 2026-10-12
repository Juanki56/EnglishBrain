/**
 * Algoritmo de repaso espaciado (design D5): SM-2 simplificado con 4 botones.
 * Función pura: no toca la base de datos.
 *
 * 1 Otra vez · 2 Difícil · 3 Bien · 4 Fácil
 * Los intervalos se redondean a días enteros y siempre Difícil < Bien < Fácil.
 */
export type Grade = 1 | 2 | 3 | 4;
export type RetentionState = 'learning' | 'reviewing' | 'mastered';

export interface SrsState {
  interval_days: number;
  ease: number;
  repetitions: number;
  lapses: number;
}

export interface SrsResult extends SrsState {
  retention_state: RetentionState;
  due_at: Date;
}

export const MIN_EASE = 1.3;
export const RELEARN_MINUTES = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/** learning < 7 días ≤ reviewing < 21 días ≤ mastered (spec srs-review). */
export function retentionFor(intervalDays: number): RetentionState {
  if (intervalDays < 7) return 'learning';
  if (intervalDays < 21) return 'reviewing';
  return 'mastered';
}

const roundEase = (ease: number) => Math.round(Math.max(MIN_EASE, ease) * 100) / 100;

export function schedule(state: SrsState, grade: Grade, now: Date = new Date()): SrsResult {
  const ease = Number(state.ease) || 2.5;
  const interval = Number(state.interval_days) || 0;
  const repetitions = Number(state.repetitions) || 0;
  const lapses = Number(state.lapses) || 0;

  // 1 · Otra vez: se reinicia y vuelve en 10 minutos (al final de la sesión).
  if (grade === 1) {
    return {
      interval_days: 0,
      ease: roundEase(ease - 0.2),
      repetitions: 0,
      lapses: lapses + 1,
      retention_state: 'learning',
      due_at: new Date(now.getTime() + RELEARN_MINUTES * 60 * 1000),
    };
  }

  // Intervalos candidatos, forzando Difícil < Bien < Fácil.
  const hard = Math.max(1, Math.round(interval * 1.2));
  const goodRaw = repetitions === 0 ? 1 : repetitions === 1 ? 3 : interval * ease;
  const good = Math.max(Math.round(goodRaw), hard + 1);
  const easy = Math.max(Math.round(good * 1.3), good + 1);

  const next = { 2: hard, 3: good, 4: easy }[grade];
  const nextEase = grade === 2 ? ease - 0.15 : grade === 4 ? ease + 0.15 : ease;

  return {
    interval_days: next,
    ease: roundEase(nextEase),
    repetitions: repetitions + 1,
    lapses,
    retention_state: retentionFor(next),
    due_at: new Date(now.getTime() + next * DAY_MS),
  };
}
