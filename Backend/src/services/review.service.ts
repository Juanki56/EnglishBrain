import type { SupabaseClient } from '@supabase/supabase-js';
import { conflict } from '../errors.js';
import { throwIfError } from './db.js';
import { buildOpenUrl } from './listening.service.js';
import { scoped } from './scoped.js';
import { type Grade, schedule, type SrsState } from './srs.service.js';

/**
 * Cola de repasos, calificación y Modo Archivo (spec srs-review y
 * study-library). Las cinco categorías estudiables comparten la maquinaria SRS.
 */
export const ITEM_TYPES = ['vocabulary', 'fossilized_error', 'speaking', 'writing', 'listening'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

const TABLES: Record<ItemType, string> = {
  vocabulary: 'vocabulary',
  fossilized_error: 'fossilized_errors',
  speaking: 'speaking_logs',
  writing: 'writing_logs',
  listening: 'listening_logs',
};

/** Nombres de tipo en las URLs de la biblioteca (/api/items/:type/...). */
export const URL_TYPES = {
  vocabulary: 'vocabulary',
  errors: 'fossilized_error',
  speaking: 'speaking',
  writing: 'writing',
  listening: 'listening',
} as const satisfies Record<string, ItemType>;
export type UrlType = keyof typeof URL_TYPES;

// -----------------------------------------------------------------------------
// 6.2 · Cola del día
// -----------------------------------------------------------------------------

type Row = Record<string, unknown>;

export interface QueueCard {
  item_type: ItemType;
  item_id: string;
  due_at: string;
  retention_state: string;
  /** Lo que se ve antes de voltear. */
  front: Row;
  /** Lo que aparece al voltear (Espacio). */
  back: Row;
}

/** Columnas y anverso/reverso de cada tipo de tarjeta (spec srs-review "Presentación por tipo"). */
const CARDS: Record<ItemType, { columns: string; front: (row: Row) => Row; back: (row: Row) => Row }> = {
  vocabulary: {
    columns: 'id, retention_state, word, context_sentence, translation, definition, type',
    front: (r) => ({ word: r.word, context_sentence: r.context_sentence }),
    back: (r) => ({ translation: r.translation, definition: r.definition, type: r.type }),
  },
  fossilized_error: {
    columns: 'id, retention_state, incorrect_phrase, correct_phrase, notes',
    front: (r) => ({ incorrect_phrase: r.incorrect_phrase }),
    back: (r) => ({ correct_phrase: r.correct_phrase, notes: r.notes }),
  },
  speaking: {
    // El audio se pide con GET /api/speaking/:id/audio-url al mostrar la tarjeta.
    columns: 'id, retention_state, title, duration_seconds',
    front: (r) => ({ title: r.title, duration_seconds: r.duration_seconds }),
    back: () => ({}),
  },
  writing: {
    columns: 'id, retention_state, title',
    front: (r) => ({ title: r.title }),
    back: (r) => ({ content: r.content ?? null, version_number: r.version_number ?? null }),
  },
  listening: {
    columns: 'id, retention_state, title, url, start_seconds, transcription',
    front: (r) => ({ title: r.title, open_url: buildOpenUrl(String(r.url), (r.start_seconds as number | null) ?? null) }),
    back: (r) => ({ transcription: r.transcription }),
  },
};

/** Añade a cada entrada de writing el texto de su última versión. */
async function attachLatestVersions(supabase: SupabaseClient, userId: string, rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  const { data, error } = await scoped(supabase, 'writing_versions', userId)
    .select('writing_id, version_number, content')
    .in('writing_id', rows.map((row) => row.id));
  throwIfError(error);

  const latest = new Map<unknown, Row>();
  for (const version of (data ?? []) as unknown as Row[]) {
    const current = latest.get(version.writing_id);
    if (!current || Number(version.version_number) > Number(current.version_number)) latest.set(version.writing_id, version);
  }
  for (const row of rows) {
    row.content = latest.get(row.id)?.content ?? null;
    row.version_number = latest.get(row.id)?.version_number ?? null;
  }
}

/** Tarjetas vencidas, de la más atrasada a la más reciente, con su contenido. */
export async function getQueue(
  supabase: SupabaseClient,
  userId: string,
  page: { limit: number; offset: number },
): Promise<{ items: QueueCard[]; total: number }> {
  const { data, error, count } = await scoped(supabase, 'srs_queue', userId)
    .select('item_type, item_id, due_at', { count: 'exact' })
    .order('due_at', { ascending: true })
    .range(page.offset, page.offset + page.limit - 1);
  throwIfError(error);
  const entries = (data ?? []) as unknown as Array<{ item_type: ItemType; item_id: string; due_at: string }>;

  // Contenido de cada tipo en una sola consulta por tabla.
  const contents = new Map<string, Row>();
  for (const type of ITEM_TYPES) {
    const ids = entries.filter((entry) => entry.item_type === type).map((entry) => entry.item_id);
    if (ids.length === 0) continue;
    const rows = await scoped(supabase, TABLES[type], userId).select(CARDS[type].columns).in('id', ids);
    throwIfError(rows.error);
    const list = (rows.data ?? []) as unknown as Row[];
    if (type === 'writing') await attachLatestVersions(supabase, userId, list);
    for (const row of list) contents.set(`${type}:${row.id}`, row);
  }

  const items = entries.flatMap((entry) => {
    const row = contents.get(`${entry.item_type}:${entry.item_id}`);
    if (!row) return []; // borrado entre las dos consultas
    const card = CARDS[entry.item_type];
    return [{
      item_type: entry.item_type,
      item_id: entry.item_id,
      due_at: entry.due_at,
      retention_state: String(row.retention_state),
      front: card.front(row),
      back: card.back(row),
    }];
  });
  return { items, total: count ?? 0 };
}

// -----------------------------------------------------------------------------
// 6.3 · Calificar
// -----------------------------------------------------------------------------

export interface ReviewResult {
  item_type: ItemType;
  item_id: string;
  grade: Grade;
  interval_days: number;
  ease: number;
  repetitions: number;
  lapses: number;
  retention_state: string;
  due_at: string;
}

/**
 * Aplica una calificación 1–4: anota el repaso en review_events (alimenta la
 * racha) y reprograma la tarjeta. En vocabulario, status sigue al estado de retención.
 */
export async function reviewItem(
  supabase: SupabaseClient,
  userId: string,
  itemType: ItemType,
  itemId: string,
  grade: Grade,
  now: Date = new Date(),
): Promise<ReviewResult> {
  const table = scoped(supabase, TABLES[itemType], userId);
  const columns = `id, is_active_srs, interval_days, ease, repetitions, lapses${itemType === 'vocabulary' ? ', status' : ''}`;
  const current = await table.findById<SrsState & { is_active_srs: boolean; status?: string } & Row>(itemId, columns);

  if (!current.is_active_srs) {
    throw conflict('Esta tarjeta está archivada; actívala para poder repasarla');
  }
  if (itemType === 'vocabulary' && current.status === 'pending_curation') {
    throw conflict('Cura esta palabra en el Inbox antes de repasarla');
  }

  const next = schedule(current, grade, now);

  // Primero el historial: si la reprogramación fallara, el repaso cuenta para la racha
  // y la tarjeta simplemente vuelve a aparecer.
  const event = await scoped(supabase, 'review_events', userId).insert({
    item_type: itemType,
    item_id: itemId,
    grade,
    interval_before: Number(current.interval_days) || 0,
    interval_after: next.interval_days,
    reviewed_at: now.toISOString(),
  });
  throwIfError(event.error);

  const changes: Row = {
    interval_days: next.interval_days,
    ease: next.ease,
    repetitions: next.repetitions,
    lapses: next.lapses,
    retention_state: next.retention_state,
    due_at: next.due_at.toISOString(),
    last_reviewed_at: now.toISOString(),
    ...(itemType === 'vocabulary' ? { status: next.retention_state } : {}),
  };
  const { error } = await table.update(changes).eq('id', itemId);
  throwIfError(error);

  return {
    item_type: itemType,
    item_id: itemId,
    grade,
    interval_days: next.interval_days,
    ease: next.ease,
    repetitions: next.repetitions,
    lapses: next.lapses,
    retention_state: next.retention_state,
    due_at: next.due_at.toISOString(),
  };
}

// -----------------------------------------------------------------------------
// 6.4 · Modo Archivo
// -----------------------------------------------------------------------------

/**
 * Activa o archiva un registro. Archivar conserva su historial y su fecha;
 * reactivar algo que nunca tuvo fecha lo deja vencido hoy (trigger srs_defaults).
 */
export async function setActiveSrs(
  supabase: SupabaseClient,
  userId: string,
  itemType: ItemType,
  itemId: string,
  isActive: boolean,
): Promise<{ id: string; is_active_srs: boolean; due_at: string | null }> {
  const table = scoped(supabase, TABLES[itemType], userId);
  await table.findById(itemId, 'id');
  const { data, error } = await table
    .update({ is_active_srs: isActive })
    .eq('id', itemId)
    .select('id, is_active_srs, due_at')
    .single();
  throwIfError(error);
  return data as unknown as { id: string; is_active_srs: boolean; due_at: string | null };
}
