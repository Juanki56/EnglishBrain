import type { SupabaseClient } from '@supabase/supabase-js';
import { conflict } from '../errors.js';
import { throwIfError } from './db.js';
import { scoped } from './scoped.js';

export const VOCABULARY_TYPES = ['word', 'phrasal_verb', 'idiom_slang'] as const;
export const VOCABULARY_STATUSES = ['pending_curation', 'learning', 'reviewing', 'mastered'] as const;
export const VOCABULARY_SOURCES = ['extension', 'manual'] as const;

export type VocabularyType = (typeof VOCABULARY_TYPES)[number];
export type VocabularyStatus = (typeof VOCABULARY_STATUSES)[number];
export type VocabularySource = (typeof VOCABULARY_SOURCES)[number];

export interface VocabularyItem {
  id: string;
  word: string;
  context_sentence: string | null;
  translation: string | null;
  definition: string | null;
  type: VocabularyType;
  status: VocabularyStatus;
  source: VocabularySource;
  source_url: string | null;
  is_active_srs: boolean;
  due_at: string | null;
  retention_state: string;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  'id, word, context_sentence, translation, definition, type, status, source, source_url, ' +
  'is_active_srs, due_at, retention_state, created_at, updated_at';

/** Máximo del párrafo de contexto (igual que el CHECK de la base de datos). */
export const CONTEXT_MAX_LENGTH = 2000;

const vocabulary = (supabase: SupabaseClient, userId: string) => scoped(supabase, 'vocabulary', userId);

/**
 * Tipo provisional de una captura (spec browser-capture): un solo término es
 * `word`; varios términos, `idiom_slang`. El usuario lo confirma en el Inbox.
 */
export function provisionalType(word: string): VocabularyType {
  return /\s/.test(word.trim()) ? 'idiom_slang' : 'word';
}

// -----------------------------------------------------------------------------
// 3.1 · Captura desde la extensión
// -----------------------------------------------------------------------------

export interface CaptureInput {
  word: string;
  context_sentence: string | null;
  source_url: string | null;
}

export async function createCapture(supabase: SupabaseClient, userId: string, input: CaptureInput) {
  const { data, error } = await vocabulary(supabase, userId)
    .insert({
      word: input.word,
      context_sentence: input.context_sentence,
      source_url: input.source_url,
      type: provisionalType(input.word),
      status: 'pending_curation',
      source: 'extension',
    })
    .select('id, word, type, status')
    .single();
  throwIfError(error);
  return data as unknown as Pick<VocabularyItem, 'id' | 'word' | 'type' | 'status'>;
}

// -----------------------------------------------------------------------------
// 3.2 · Consulta y edición
// -----------------------------------------------------------------------------

export interface ListFilters {
  status?: VocabularyStatus;
  type?: VocabularyType;
  source?: VocabularySource;
  q?: string;
  limit: number;
  offset: number;
}

/**
 * Lista con filtros y paginación. El Inbox (status=pending_curation) va del más
 * antiguo al más reciente; el resto, del más reciente al más antiguo.
 */
export async function listVocabulary(
  supabase: SupabaseClient,
  userId: string,
  filters: ListFilters,
): Promise<{ items: VocabularyItem[]; total: number }> {
  let query = vocabulary(supabase, userId).select(COLUMNS, { count: 'exact' });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.source) query = query.eq('source', filters.source);
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    query = query.or(`word.ilike.${pattern},context_sentence.ilike.${pattern},translation.ilike.${pattern}`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: filters.status === 'pending_curation' })
    .range(filters.offset, filters.offset + filters.limit - 1);
  throwIfError(error);
  return { items: (data ?? []) as unknown as VocabularyItem[], total: count ?? 0 };
}

export async function getVocabulary(supabase: SupabaseClient, userId: string, id: string): Promise<VocabularyItem> {
  return vocabulary(supabase, userId).findById<VocabularyItem & Record<string, unknown>>(id, COLUMNS);
}

/** Campos editables. El estado y los datos SRS solo cambian al curar o repasar. */
export interface VocabularyChanges {
  word?: string;
  context_sentence?: string | null;
  translation?: string | null;
  definition?: string | null;
  type?: VocabularyType;
}

export async function updateVocabulary(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  changes: VocabularyChanges,
): Promise<VocabularyItem> {
  await vocabulary(supabase, userId).findById(id, 'id');
  const { data, error } = await vocabulary(supabase, userId)
    .update({ ...changes })
    .eq('id', id)
    .select(COLUMNS)
    .single();
  throwIfError(error);
  return data as unknown as VocabularyItem;
}

export async function deleteVocabulary(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
  await vocabulary(supabase, userId).findById(id, 'id');
  const { error } = await vocabulary(supabase, userId).delete().eq('id', id);
  throwIfError(error);
}

// -----------------------------------------------------------------------------
// 3.3 · Curación (Inbox → learning)
// -----------------------------------------------------------------------------

export interface CurationInput {
  translation: string;
  type: VocabularyType;
  definition?: string | null;
  word?: string;
  context_sentence?: string | null;
  is_active_srs: boolean;
}

/**
 * Pasa un término de pending_curation a learning. Si queda activo en SRS, vence
 * ahora (entra a la cola de hoy). Curar algo ya curado responde 409.
 */
export async function curateVocabulary(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: CurationInput,
): Promise<VocabularyItem> {
  const current = await vocabulary(supabase, userId).findById<{ status: string }>(id, 'id, status');
  if (current.status !== 'pending_curation') {
    throw conflict('Esta palabra ya fue curada');
  }

  const { data, error } = await vocabulary(supabase, userId)
    .update({
      ...input,
      status: 'learning',
      retention_state: 'learning',
      ...(input.is_active_srs ? { due_at: new Date().toISOString() } : {}),
    })
    .eq('id', id)
    // Evita curar dos veces si llegan dos peticiones a la vez.
    .eq('status', 'pending_curation')
    .select(COLUMNS)
    .maybeSingle();
  throwIfError(error);
  if (!data) throw conflict('Esta palabra ya fue curada');
  return data as unknown as VocabularyItem;
}

// -----------------------------------------------------------------------------
// 3.4 · Creación manual
// -----------------------------------------------------------------------------

export interface ManualInput {
  word: string;
  translation: string;
  type: VocabularyType;
  context_sentence?: string | null;
  definition?: string | null;
  is_active_srs: boolean;
}

export async function createManualVocabulary(
  supabase: SupabaseClient,
  userId: string,
  input: ManualInput,
): Promise<VocabularyItem> {
  const { data, error } = await vocabulary(supabase, userId)
    .insert({ ...input, status: 'learning', retention_state: 'learning', source: 'manual' })
    .select(COLUMNS)
    .single();
  throwIfError(error);
  return data as unknown as VocabularyItem;
}
