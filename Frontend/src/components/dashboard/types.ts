/** Respuestas de los endpoints de estadísticas y hábitos que usa el Panel. */

export interface Overview {
  vocabulary: { total: number; learning: number; reviewing: number; mastered: number; pending_curation: number };
  critical_errors: number;
  due_count: number;
}

export interface Streak {
  streak: number;
  today_active: boolean;
  today: string;
  timezone: string;
  /** 30 días, del más antiguo a hoy (el último es hoy). */
  heatmap: Array<{ date: string; count: number }>;
}

export type Habit = 'reading_listening' | 'speaking' | 'writing';

export interface TodayHabits {
  date: string;
  timezone: string;
  habits: Record<Habit, boolean>;
}

export type Skill = 'vocabulary_reading' | 'listening' | 'speaking' | 'writing';

export interface Effort {
  since: string;
  skills: Array<{ skill: Skill; label: string; count: number; share: number }>;
  top: Skill | null;
}

/** Porcentaje entero para mostrar (0,333 → "33 %"). */
export const percent = (share: number) => `${Math.round(share * 100)} %`;
