import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUserId } from '../middlewares/auth.js';
import { getStreak, getTodayHabits, setTodayHabits } from '../services/habit.service.js';
import { getEffort, getOverview } from '../services/stats.service.js';
import { getSupabase } from '../services/supabase.js';
import { parse } from '../validation.js';

const habitField = (label: string) =>
  z.boolean({ error: `Indica si ${label} hoy (true o false)` }).optional();

const updateHabitsSchema = z
  .object({
    reading_listening: habitField('consumiste contenido (Reading / Listening)'),
    speaking: habitField('practicaste conversación (Speaking)'),
    writing: habitField('redactaste algo (Writing)'),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    error: 'Envía al menos un hábito para marcar o desmarcar',
  });

/** GET /api/habits/today · casillas del día (fecha local del perfil). */
export async function getHabitsToday(req: Request, res: Response): Promise<void> {
  res.json(await getTodayHabits(getSupabase(req), getUserId(req)));
}

/** PUT /api/habits/today · marca o desmarca casillas de hoy. */
export async function putHabitsToday(req: Request, res: Response): Promise<void> {
  const changes = parse(updateHabitsSchema, req.body);
  res.json(await setTodayHabits(getSupabase(req), getUserId(req), changes));
}

/** GET /api/stats/streak · racha y mapa de calor de 30 días. */
export async function getStreakStats(req: Request, res: Response): Promise<void> {
  res.json(await getStreak(getSupabase(req), getUserId(req)));
}

/** GET /api/stats/overview · vocabulario por estado, errores críticos y vencidos. */
export async function getOverviewStats(req: Request, res: Response): Promise<void> {
  res.json(await getOverview(getSupabase(req), getUserId(req)));
}

/** GET /api/stats/effort · esfuerzo por habilidad en los últimos 30 días. */
export async function getEffortStats(req: Request, res: Response): Promise<void> {
  res.json(await getEffort(getSupabase(req), getUserId(req)));
}
