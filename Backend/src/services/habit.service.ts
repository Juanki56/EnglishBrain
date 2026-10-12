import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, localDate } from './dates.js';
import { throwIfError } from './db.js';
import { getProfile } from './profile.service.js';
import { scoped } from './scoped.js';

/** Check-in diario y racha (spec habit-tracking, design D8). */
export const HABITS = ['reading_listening', 'speaking', 'writing'] as const;
export type Habit = (typeof HABITS)[number];

export const HEATMAP_DAYS = 30;

export interface TodayHabits {
  date: string;
  timezone: string;
  habits: Record<Habit, boolean>;
}

/** Casillas del día de hoy, en la zona horaria del perfil. */
export async function getTodayHabits(supabase: SupabaseClient, userId: string, now = new Date()): Promise<TodayHabits> {
  const { timezone } = await getProfile(supabase, userId);
  const date = localDate(now, timezone);

  const { data, error } = await scoped(supabase, 'habit_checkins', userId).select('habit').eq('date', date);
  throwIfError(error);
  const done = new Set(((data ?? []) as unknown as Array<{ habit: Habit }>).map((row) => row.habit));

  return {
    date,
    timezone,
    habits: Object.fromEntries(HABITS.map((habit) => [habit, done.has(habit)])) as Record<Habit, boolean>,
  };
}

/** Marca (true) o desmarca (false) casillas de hoy. Repetir una marca no falla. */
export async function setTodayHabits(
  supabase: SupabaseClient,
  userId: string,
  changes: Partial<Record<Habit, boolean>>,
  now = new Date(),
): Promise<TodayHabits> {
  const current = await getTodayHabits(supabase, userId, now);
  const checkins = scoped(supabase, 'habit_checkins', userId);

  for (const habit of HABITS) {
    const wanted = changes[habit];
    if (wanted === undefined || wanted === current.habits[habit]) continue;
    if (wanted) {
      const { error } = await checkins.insert({ date: current.date, habit });
      // Otra petición pudo marcarla a la vez: el resultado es el mismo.
      if (error && error.code !== '23505') throwIfError(error);
    } else {
      const { error } = await checkins.delete().eq('date', current.date).eq('habit', habit);
      throwIfError(error);
    }
  }
  return getTodayHabits(supabase, userId, now);
}

export interface StreakInfo {
  timezone: string;
  today: string;
  today_active: boolean;
  streak: number;
  /** Últimos 30 días, del más antiguo a hoy; `count` = actividades del día. */
  heatmap: Array<{ date: string; count: number }>;
}

/**
 * Racha = días activos consecutivos terminando hoy; si hoy aún no es activo,
 * terminando ayer. Un día es activo con vocabulario nuevo, un repaso o un check-in.
 */
export async function getStreak(supabase: SupabaseClient, userId: string, now = new Date()): Promise<StreakInfo> {
  const { timezone } = await getProfile(supabase, userId);
  const today = localDate(now, timezone);

  // Una fila por día activo (vista daily_activity); 1000 días cubren ~3 años de racha.
  const { data, error } = await scoped(supabase, 'daily_activity', userId)
    .select('day, total')
    .order('day', { ascending: false })
    .limit(1000);
  throwIfError(error);

  const totals = new Map<string, number>();
  for (const row of (data ?? []) as unknown as Array<{ day: string; total: number }>) {
    if (Number(row.total) > 0) totals.set(String(row.day).slice(0, 10), Number(row.total));
  }

  const todayActive = totals.has(today);
  let streak = 0;
  for (let day = todayActive ? today : addDays(today, -1); totals.has(day); day = addDays(day, -1)) streak++;

  const heatmap = Array.from({ length: HEATMAP_DAYS }, (_, i) => {
    const date = addDays(today, i - (HEATMAP_DAYS - 1));
    return { date, count: totals.get(date) ?? 0 };
  });

  return { timezone, today, today_active: todayActive, streak, heatmap };
}
