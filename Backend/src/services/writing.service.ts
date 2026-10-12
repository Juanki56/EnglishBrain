import type { SupabaseClient } from '@supabase/supabase-js';
import { throwIfError } from './db.js';
import { scoped } from './scoped.js';

/**
 * Bitácora de Writing (spec writing-log). El texto vive en writing_versions:
 * la versión 1 es el original y las siguientes son correcciones inmutables
 * (la base de datos las numera y bloquea su modificación).
 */
export interface WritingEntry {
  id: string;
  title: string;
  is_active_srs: boolean;
  due_at: string | null;
  retention_state: string;
  created_at: string;
  updated_at: string;
}

export interface WritingVersion {
  id: string;
  version_number: number;
  content: string;
  created_at: string;
}

export interface WritingListItem extends WritingEntry {
  version_count: number;
  latest_version_number: number;
  latest_version_at: string | null;
  /** Primeros caracteres de la última versión, para la biblioteca. */
  excerpt: string;
}

const ENTRY_COLUMNS = 'id, title, is_active_srs, due_at, retention_state, created_at, updated_at';
const VERSION_COLUMNS = 'id, version_number, content, created_at';
export const EXCERPT_LENGTH = 200;

const entries = (supabase: SupabaseClient, userId: string) => scoped(supabase, 'writing_logs', userId);
const versions = (supabase: SupabaseClient, userId: string) => scoped(supabase, 'writing_versions', userId);

export async function listWriting(
  supabase: SupabaseClient,
  userId: string,
  filters: { q?: string; limit: number; offset: number },
): Promise<{ items: WritingListItem[]; total: number }> {
  let query = entries(supabase, userId).select(ENTRY_COLUMNS, { count: 'exact' });
  if (filters.q) query = query.or(`title.ilike.%${filters.q}%`);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);
  throwIfError(error);
  const list = (data ?? []) as unknown as WritingEntry[];
  if (list.length === 0) return { items: [], total: count ?? 0 };

  const versionRows = await versions(supabase, userId)
    .select('writing_id, version_number, content, created_at')
    .in('writing_id', list.map((entry) => entry.id));
  throwIfError(versionRows.error);

  // Última versión y número de versiones de cada entrada.
  const byEntry = new Map<string, { count: number; latest: WritingVersion | null }>();
  for (const version of (versionRows.data ?? []) as unknown as Array<WritingVersion & { writing_id: string }>) {
    const summary = byEntry.get(version.writing_id) ?? { count: 0, latest: null };
    summary.count += 1;
    if (!summary.latest || version.version_number > summary.latest.version_number) summary.latest = version;
    byEntry.set(version.writing_id, summary);
  }

  const items = list.map((entry) => {
    const summary = byEntry.get(entry.id);
    return {
      ...entry,
      version_count: summary?.count ?? 0,
      latest_version_number: summary?.latest?.version_number ?? 0,
      latest_version_at: summary?.latest?.created_at ?? null,
      excerpt: (summary?.latest?.content ?? '').slice(0, EXCERPT_LENGTH),
    };
  });
  return { items, total: count ?? 0 };
}

/** Entrada con todas sus versiones, de la 1 a la última. */
export async function getWriting(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<WritingEntry & { versions: WritingVersion[] }> {
  const entry = await entries(supabase, userId).findById<WritingEntry & Record<string, unknown>>(id, ENTRY_COLUMNS);
  const { data, error } = await versions(supabase, userId)
    .select(VERSION_COLUMNS)
    .eq('writing_id', id)
    .order('version_number', { ascending: true });
  throwIfError(error);
  return { ...entry, versions: (data ?? []) as unknown as WritingVersion[] };
}

/** Crea la entrada y su versión 1. Si la versión falla, se deshace la entrada. */
export async function createWriting(
  supabase: SupabaseClient,
  userId: string,
  input: { title: string; content: string; is_active_srs: boolean },
): Promise<WritingEntry & { versions: WritingVersion[] }> {
  const created = await entries(supabase, userId)
    .insert({ title: input.title, is_active_srs: input.is_active_srs })
    .select('id')
    .single();
  throwIfError(created.error);
  const id = (created.data as { id: string }).id;

  const first = await versions(supabase, userId).insert({ writing_id: id, content: input.content });
  if (first.error) {
    await entries(supabase, userId).delete().eq('id', id);
    throwIfError(first.error);
  }
  return getWriting(supabase, userId, id);
}

/** Solo cambia el título: el texto se corrige añadiendo versiones. */
export async function updateWritingTitle(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  title: string,
): Promise<WritingEntry> {
  await entries(supabase, userId).findById(id, 'id');
  const { data, error } = await entries(supabase, userId).update({ title }).eq('id', id).select(ENTRY_COLUMNS).single();
  throwIfError(error);
  return data as unknown as WritingEntry;
}

/** Añade una versión corregida; la base de datos le asigna el siguiente número. */
export async function addWritingVersion(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  content: string,
): Promise<WritingVersion> {
  await entries(supabase, userId).findById(id, 'id');
  const { data, error } = await versions(supabase, userId)
    .insert({ writing_id: id, content })
    .select(VERSION_COLUMNS)
    .single();
  throwIfError(error);
  return data as unknown as WritingVersion;
}

/** Borra la entrada; sus versiones se borran en cascada. No hay borrado de versiones sueltas. */
export async function deleteWriting(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
  await entries(supabase, userId).findById(id, 'id');
  const { error } = await entries(supabase, userId).delete().eq('id', id);
  throwIfError(error);
}
