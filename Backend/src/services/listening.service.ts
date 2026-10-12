import type { SupabaseClient } from '@supabase/supabase-js';
import { throwIfError } from './db.js';
import { scoped } from './scoped.js';
import type { SrsFilter } from '../validation.js';

/** Retos de escucha (spec listening-log). */
export interface ListeningEntry {
  id: string;
  title: string;
  url: string;
  start_seconds: number | null;
  transcription: string;
  is_active_srs: boolean;
  due_at: string | null;
  retention_state: string;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  'id, title, url, start_seconds, transcription, is_active_srs, due_at, retention_state, created_at, updated_at';

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']);

/**
 * Enlace para el botón "Escuchar": en YouTube salta al segundo de inicio
 * (parámetro `t`); en cualquier otro sitio es la URL original.
 */
export function buildOpenUrl(url: string, startSeconds: number | null): string {
  if (!startSeconds) return url;
  try {
    const parsed = new URL(url);
    if (!YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) return url;
    parsed.searchParams.set('t', String(startSeconds));
    return parsed.toString();
  } catch {
    return url;
  }
}

const withOpenUrl = (entry: ListeningEntry) => ({ ...entry, open_url: buildOpenUrl(entry.url, entry.start_seconds) });

const listening = (supabase: SupabaseClient, userId: string) => scoped(supabase, 'listening_logs', userId);

export async function listListening(
  supabase: SupabaseClient,
  userId: string,
  filters: { q?: string; srs?: SrsFilter; limit: number; offset: number },
) {
  let query = listening(supabase, userId).select(COLUMNS, { count: 'exact' });
  if (filters.srs) query = query.eq('is_active_srs', filters.srs === 'active');
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    query = query.or(`title.ilike.${pattern},transcription.ilike.${pattern}`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);
  throwIfError(error);
  return { items: ((data ?? []) as unknown as ListeningEntry[]).map(withOpenUrl), total: count ?? 0 };
}

export interface NewListening {
  title: string;
  url: string;
  start_seconds?: number | null;
  transcription: string;
  is_active_srs: boolean;
}

export async function createListening(supabase: SupabaseClient, userId: string, input: NewListening) {
  const { data, error } = await listening(supabase, userId).insert({ ...input }).select(COLUMNS).single();
  throwIfError(error);
  return withOpenUrl(data as unknown as ListeningEntry);
}

export async function getListening(supabase: SupabaseClient, userId: string, id: string) {
  return withOpenUrl(await listening(supabase, userId).findById<ListeningEntry & Record<string, unknown>>(id, COLUMNS));
}

export type ListeningChanges = Partial<Omit<NewListening, 'is_active_srs'>>;

export async function updateListening(supabase: SupabaseClient, userId: string, id: string, changes: ListeningChanges) {
  await listening(supabase, userId).findById(id, 'id');
  const { data, error } = await listening(supabase, userId)
    .update({ ...changes })
    .eq('id', id)
    .select(COLUMNS)
    .single();
  throwIfError(error);
  return withOpenUrl(data as unknown as ListeningEntry);
}

export async function deleteListening(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
  await listening(supabase, userId).findById(id, 'id');
  const { error } = await listening(supabase, userId).delete().eq('id', id);
  throwIfError(error);
}
