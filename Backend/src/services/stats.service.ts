import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, localDate } from './dates.js';
import { throwIfError } from './db.js';
import { getProfile } from './profile.service.js';
import { scoped } from './scoped.js';

/** Estadísticas del Dashboard (spec dashboard, design D9). */

type Filter = (query: any) => any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Cuenta filas propias de una tabla o vista sin traerlas (las vistas no tienen columna id). */
async function count(supabase: SupabaseClient, userId: string, table: string, filter: Filter = (q) => q): Promise<number> {
  const { count: total, error } = await filter(scoped(supabase, table, userId).select('*', { count: 'exact', head: true }));
  throwIfError(error);
  return total ?? 0;
}

export interface Overview {
  vocabulary: { total: number; learning: number; reviewing: number; mastered: number; pending_curation: number };
  critical_errors: number;
  due_count: number;
}

/**
 * Widget superior y cola del día: vocabulario curado por estado de retención
 * (los pendientes del Inbox no cuentan en el total), errores activos y vencidos.
 */
export async function getOverview(supabase: SupabaseClient, userId: string): Promise<Overview> {
  const byStatus = (status: string) => count(supabase, userId, 'vocabulary', (q) => q.eq('status', status));
  const [learning, reviewing, mastered, pending, criticalErrors, due] = await Promise.all([
    byStatus('learning'),
    byStatus('reviewing'),
    byStatus('mastered'),
    byStatus('pending_curation'),
    count(supabase, userId, 'fossilized_errors', (q) => q.eq('is_resolved', false)),
    count(supabase, userId, 'srs_queue', (q) => q),
  ]);

  return {
    vocabulary: { total: learning + reviewing + mastered, learning, reviewing, mastered, pending_curation: pending },
    critical_errors: criticalErrors,
    due_count: due,
  };
}

export const EFFORT_DAYS = 30;

export const SKILLS = [
  { skill: 'vocabulary_reading', label: 'Vocabulario / Reading' },
  { skill: 'listening', label: 'Listening' },
  { skill: 'speaking', label: 'Speaking' },
  { skill: 'writing', label: 'Writing' },
] as const;
export type Skill = (typeof SKILLS)[number]['skill'];

export interface Effort {
  since: string;
  skills: Array<{ skill: Skill; label: string; count: number; share: number }>;
  /** Habilidad con más actividad, o null si no hubo actividad. */
  top: Skill | null;
}

/**
 * En qué habilidad se puso más esfuerzo en los últimos 30 días: registros
 * creados + repasos + check-ins de cada una. El check-in "Reading / Listening"
 * se reparte a medias entre Vocabulario/Reading y Listening.
 */
export async function getEffort(supabase: SupabaseClient, userId: string, now = new Date()): Promise<Effort> {
  const { timezone } = await getProfile(supabase, userId);
  const since = addDays(localDate(now, timezone), -(EFFORT_DAYS - 1));
  const sinceInstant = new Date(now.getTime() - EFFORT_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const created = (table: string) => count(supabase, userId, table, (q) => q.gte('created_at', sinceInstant));
  const reviews = (itemType: string) =>
    count(supabase, userId, 'review_events', (q) => q.eq('item_type', itemType).gte('reviewed_at', sinceInstant));
  const checkins = (habit: string) => count(supabase, userId, 'habit_checkins', (q) => q.eq('habit', habit).gte('date', since));

  const [
    vocabCreated, listeningCreated, speakingCreated, writingCreated,
    vocabReviews, errorReviews, listeningReviews, speakingReviews, writingReviews,
    readingCheckins, speakingCheckins, writingCheckins,
  ] = await Promise.all([
    created('vocabulary'), created('listening_logs'), created('speaking_logs'), created('writing_logs'),
    reviews('vocabulary'), reviews('fossilized_error'), reviews('listening'), reviews('speaking'), reviews('writing'),
    checkins('reading_listening'), checkins('speaking'), checkins('writing'),
  ]);

  const counts: Record<Skill, number> = {
    vocabulary_reading: vocabCreated + vocabReviews + errorReviews + readingCheckins / 2,
    listening: listeningCreated + listeningReviews + readingCheckins / 2,
    speaking: speakingCreated + speakingReviews + speakingCheckins,
    writing: writingCreated + writingReviews + writingCheckins,
  };
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const skills = SKILLS.map(({ skill, label }) => ({
    skill,
    label,
    count: counts[skill],
    share: total > 0 ? Math.round((counts[skill] / total) * 1000) / 1000 : 0,
  }));
  const best = skills.reduce((top, item) => (item.count > top.count ? item : top));

  return { since, skills, top: best.count > 0 ? best.skill : null };
}
