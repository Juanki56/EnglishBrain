import type { SupabaseClient } from '@supabase/supabase-js';
import { throwIfError } from './db.js';
import { scoped } from './scoped.js';

/** Muro de Errores Fosilizados (spec fossilized-errors). */
export interface FossilizedError {
  id: string;
  incorrect_phrase: string;
  correct_phrase: string;
  notes: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  is_active_srs: boolean;
  due_at: string | null;
  retention_state: string;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  'id, incorrect_phrase, correct_phrase, notes, is_resolved, resolved_at, ' +
  'is_active_srs, due_at, retention_state, created_at, updated_at';

const errors = (supabase: SupabaseClient, userId: string) => scoped(supabase, 'fossilized_errors', userId);

export interface ErrorFilters {
  status?: 'active' | 'resolved';
  q?: string;
  limit: number;
  offset: number;
}

export async function listErrors(
  supabase: SupabaseClient,
  userId: string,
  filters: ErrorFilters,
): Promise<{ items: FossilizedError[]; total: number }> {
  let query = errors(supabase, userId).select(COLUMNS, { count: 'exact' });
  if (filters.status) query = query.eq('is_resolved', filters.status === 'resolved');
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    query = query.or(`incorrect_phrase.ilike.${pattern},correct_phrase.ilike.${pattern},notes.ilike.${pattern}`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);
  throwIfError(error);
  return { items: (data ?? []) as unknown as FossilizedError[], total: count ?? 0 };
}

export interface NewError {
  incorrect_phrase: string;
  correct_phrase: string;
  notes?: string | null;
  is_active_srs: boolean;
}

export async function createError(supabase: SupabaseClient, userId: string, input: NewError): Promise<FossilizedError> {
  const { data, error } = await errors(supabase, userId).insert({ ...input }).select(COLUMNS).single();
  throwIfError(error);
  return data as unknown as FossilizedError;
}

export async function getError(supabase: SupabaseClient, userId: string, id: string): Promise<FossilizedError> {
  return errors(supabase, userId).findById<FossilizedError & Record<string, unknown>>(id, COLUMNS);
}

export interface ErrorChanges {
  incorrect_phrase?: string;
  correct_phrase?: string;
  notes?: string | null;
  is_resolved?: boolean;
}

/**
 * Edita un error. Marcarlo como superado guarda cuándo (resolved_at); volver a
 * marcarlo no cambia esa fecha. Desmarcarlo la borra. No afecta al SRS.
 */
export async function updateError(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  changes: ErrorChanges,
): Promise<FossilizedError> {
  const current = await errors(supabase, userId).findById<{ is_resolved: boolean }>(id, 'id, is_resolved');

  const resolution =
    changes.is_resolved === undefined || changes.is_resolved === current.is_resolved
      ? {}
      : { resolved_at: changes.is_resolved ? new Date().toISOString() : null };

  const { data, error } = await errors(supabase, userId)
    .update({ ...changes, ...resolution })
    .eq('id', id)
    .select(COLUMNS)
    .single();
  throwIfError(error);
  return data as unknown as FossilizedError;
}

export async function deleteError(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
  await errors(supabase, userId).findById(id, 'id');
  const { error } = await errors(supabase, userId).delete().eq('id', id);
  throwIfError(error);
}
