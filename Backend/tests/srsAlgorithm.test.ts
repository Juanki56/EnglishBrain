import { describe, expect, it } from 'vitest';
import { type Grade, MIN_EASE, retentionFor, schedule, type SrsState } from '../src/services/srs.service.js';

const NOW = new Date('2026-10-12T12:00:00.000Z');
const NEW: SrsState = { interval_days: 0, ease: 2.5, repetitions: 0, lapses: 0 };
const days = (result: { due_at: Date }) => (result.due_at.getTime() - NOW.getTime()) / 86_400_000;

/** Aplica una serie de calificaciones a una tarjeta nueva. */
function run(grades: Grade[]) {
  let state: SrsState = NEW;
  const intervals: number[] = [];
  for (const grade of grades) {
    const result = schedule(state, grade, NOW);
    intervals.push(result.interval_days);
    state = result;
  }
  return { state: state as ReturnType<typeof schedule>, intervals };
}

describe('schedule: tarjeta nueva', () => {
  it('Difícil 1 día, Bien 2 días, Fácil 3 días', () => {
    expect(schedule(NEW, 2, NOW).interval_days).toBe(1);
    expect(schedule(NEW, 3, NOW).interval_days).toBe(2);
    expect(schedule(NEW, 4, NOW).interval_days).toBe(3);
  });

  it('la fecha de repaso es ahora + intervalo en días', () => {
    expect(days(schedule(NEW, 3, NOW))).toBe(2);
  });
});

describe('schedule: progresión con "Bien"', () => {
  it('2, 3, 8, 20, 50 días y pasa por learning → reviewing → mastered', () => {
    const { intervals } = run([3, 3, 3, 3, 3]);

    expect(intervals).toEqual([2, 3, 8, 20, 50]);
    expect(intervals.map(retentionFor)).toEqual(['learning', 'learning', 'reviewing', 'reviewing', 'mastered']);
  });

  it('los intervalos son siempre días enteros', () => {
    const { intervals } = run([3, 2, 4, 3, 2, 4, 3]);

    expect(intervals.every(Number.isInteger)).toBe(true);
  });
});

describe('schedule: orden de los botones', () => {
  it('desde cualquier estado, Difícil < Bien < Fácil', () => {
    const states: SrsState[] = [
      NEW,
      { interval_days: 2, ease: 2.5, repetitions: 1, lapses: 0 },
      { interval_days: 1, ease: 1.3, repetitions: 5, lapses: 4 },
      { interval_days: 30, ease: 2.8, repetitions: 6, lapses: 0 },
      { interval_days: 0, ease: 1.3, repetitions: 0, lapses: 3 },
    ];
    for (const state of states) {
      const [hard, good, easy] = ([2, 3, 4] as Grade[]).map((g) => schedule(state, g, NOW).interval_days);
      expect(hard).toBeLessThan(good!);
      expect(good).toBeLessThan(easy!);
    }
  });
});

describe('schedule: "Otra vez" (1)', () => {
  it('reinicia la tarjeta y la devuelve en 10 minutos', () => {
    const mastered: SrsState = { interval_days: 50, ease: 2.5, repetitions: 5, lapses: 0 };
    const result = schedule(mastered, 1, NOW);

    expect(result).toMatchObject({ interval_days: 0, repetitions: 0, lapses: 1, retention_state: 'learning' });
    expect(result.due_at.getTime() - NOW.getTime()).toBe(10 * 60 * 1000);
  });

  it('una tarjeta mastered que se olvida vuelve a learning', () => {
    const { state } = run([3, 3, 3, 3, 3, 1]);

    expect(state.retention_state).toBe('learning');
  });

  it('tras olvidarla, vuelve a empezar desde intervalos cortos', () => {
    const { intervals } = run([3, 3, 3, 1, 3]);

    expect(intervals.slice(-2)).toEqual([0, 2]);
  });
});

describe('schedule: facilidad (ease)', () => {
  it('baja con Otra vez y Difícil, se mantiene con Bien y sube con Fácil', () => {
    expect(schedule(NEW, 1, NOW).ease).toBe(2.3);
    expect(schedule(NEW, 2, NOW).ease).toBe(2.35);
    expect(schedule(NEW, 3, NOW).ease).toBe(2.5);
    expect(schedule(NEW, 4, NOW).ease).toBe(2.65);
  });

  it('nunca baja de 1,3 aunque se falle muchas veces', () => {
    const { state } = run([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2]);

    expect(state.ease).toBe(MIN_EASE);
    expect(state.lapses).toBe(10);
  });

  it('con facilidad baja los intervalos crecen más despacio', () => {
    const lowEase = schedule({ interval_days: 10, ease: 1.3, repetitions: 4, lapses: 3 }, 3, NOW);
    const highEase = schedule({ interval_days: 10, ease: 2.5, repetitions: 4, lapses: 0 }, 3, NOW);

    expect(lowEase.interval_days).toBe(13);
    expect(highEase.interval_days).toBe(25);
  });
});

describe('retentionFor', () => {
  it('learning < 7 ≤ reviewing < 21 ≤ mastered', () => {
    expect([0, 6, 7, 20, 21, 100].map(retentionFor)).toEqual([
      'learning', 'learning', 'reviewing', 'reviewing', 'mastered', 'mastered',
    ]);
  });
});

describe('schedule: datos de la base de datos', () => {
  it('acepta los valores numéricos que llegan como texto (columnas numeric)', () => {
    const fromDb = { interval_days: '8.00', ease: '2.50', repetitions: 3, lapses: 0 } as unknown as SrsState;

    expect(schedule(fromDb, 3, NOW).interval_days).toBe(20);
  });
});
