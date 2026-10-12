import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceUnavailable, validationError } from '../errors.js';
import { throwIfError } from './db.js';
import { scoped } from './scoped.js';

/**
 * Monólogos de Speaking (spec speaking-log, design D6). El audio vive en el
 * bucket privado speaking-audio, en {user_id}/{id}.mp3; la ficha lo referencia.
 */
export const SPEAKING_BUCKET = 'speaking-audio';
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
export const MAX_DURATION_SECONDS = 600;
export const SIGNED_URL_SECONDS = 300;

export interface SpeakingEntry {
  id: string;
  title: string;
  duration_seconds: number;
  size_bytes: number | null;
  recording_limit_minutes: number | null;
  is_active_srs: boolean;
  due_at: string | null;
  retention_state: string;
  created_at: string;
  updated_at: string;
}

// storage_path es interno: nunca se envía al cliente.
const COLUMNS =
  'id, title, duration_seconds, size_bytes, recording_limit_minutes, is_active_srs, due_at, retention_state, created_at, updated_at';

const speaking = (supabase: SupabaseClient, userId: string) => scoped(supabase, 'speaking_logs', userId);

/** true si los primeros bytes son de un MP3 (etiqueta ID3 o cabecera de trama MPEG). */
export function looksLikeMp3(bytes: Buffer): boolean {
  if (bytes.length < 4) return false;
  const hasId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const hasFrameSync = bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0;
  return hasId3 || hasFrameSync;
}

/**
 * La duración la informa el Frontend; se comprueba que cuadre con el tamaño
 * (entre ~4 y ~400 kbps, con margen para cabeceras). Evita declarar
 * "2 minutos" con un archivo de una hora, o 10 minutos con un archivo vacío.
 */
export function sizeMatchesDuration(sizeBytes: number, durationSeconds: number): boolean {
  const minBytes = durationSeconds * 500;
  const maxBytes = durationSeconds * 50_000 + 64 * 1024;
  return sizeBytes >= minBytes && sizeBytes <= maxBytes;
}

export interface NewSpeaking {
  title: string;
  duration_seconds: number;
  recording_limit_minutes?: number | null;
  is_active_srs: boolean;
}

/**
 * Sube el audio y crea la ficha. Si la subida falla no se crea nada; si la
 * ficha falla, se borra el audio recién subido para no dejar huérfanos.
 */
export async function createSpeaking(
  supabase: SupabaseClient,
  userId: string,
  input: NewSpeaking,
  audio: Buffer,
): Promise<SpeakingEntry> {
  if (!looksLikeMp3(audio)) {
    throw validationError([{ field: 'audio', message: 'El archivo no es un audio MP3 válido' }]);
  }
  if (!sizeMatchesDuration(audio.length, input.duration_seconds)) {
    throw validationError([{ field: 'duration_seconds', message: 'La duración no coincide con el tamaño del audio' }]);
  }

  const id = randomUUID();
  const storagePath = `${userId}/${id}.mp3`;
  const storage = supabase.storage.from(SPEAKING_BUCKET);

  const uploaded = await storage.upload(storagePath, audio, { contentType: 'audio/mpeg', upsert: false });
  if (uploaded.error) {
    console.error('[speaking] fallo al subir el audio', uploaded.error);
    throw serviceUnavailable('No se pudo subir el audio; inténtalo de nuevo');
  }

  const { data, error } = await speaking(supabase, userId)
    .insert({ ...input, id, storage_path: storagePath, size_bytes: audio.length })
    .select(COLUMNS)
    .single();
  if (error) {
    const cleanup = await storage.remove([storagePath]);
    if (cleanup.error) console.error(`[speaking] audio huérfano sin borrar: ${storagePath}`, cleanup.error);
    throwIfError(error);
  }
  return data as unknown as SpeakingEntry;
}

export async function listSpeaking(
  supabase: SupabaseClient,
  userId: string,
  filters: { q?: string; limit: number; offset: number },
): Promise<{ items: SpeakingEntry[]; total: number }> {
  let query = speaking(supabase, userId).select(COLUMNS, { count: 'exact' });
  if (filters.q) query = query.or(`title.ilike.%${filters.q}%`);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);
  throwIfError(error);
  return { items: (data ?? []) as unknown as SpeakingEntry[], total: count ?? 0 };
}

export async function getSpeaking(supabase: SupabaseClient, userId: string, id: string): Promise<SpeakingEntry> {
  return speaking(supabase, userId).findById<SpeakingEntry & Record<string, unknown>>(id, COLUMNS);
}

export async function updateSpeakingTitle(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  title: string,
): Promise<SpeakingEntry> {
  await speaking(supabase, userId).findById(id, 'id');
  const { data, error } = await speaking(supabase, userId).update({ title }).eq('id', id).select(COLUMNS).single();
  throwIfError(error);
  return data as unknown as SpeakingEntry;
}

/** Enlace firmado de corta duración para reproducir el audio. Solo para su dueño. */
export async function getSpeakingAudioUrl(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<{ url: string; expires_at: string }> {
  const entry = await speaking(supabase, userId).findById<{ storage_path: string }>(id, 'id, storage_path');
  const { data, error } = await supabase.storage.from(SPEAKING_BUCKET).createSignedUrl(entry.storage_path, SIGNED_URL_SECONDS);
  if (error || !data) {
    console.error('[speaking] fallo al firmar el enlace', error);
    throw serviceUnavailable('No se pudo preparar el audio; inténtalo de nuevo');
  }
  return { url: data.signedUrl, expires_at: new Date(Date.now() + SIGNED_URL_SECONDS * 1000).toISOString() };
}

/**
 * Borra la ficha y después su audio. Si el audio no se pudiera borrar, la
 * ficha ya no existe para el usuario y el archivo queda en el log.
 */
export async function deleteSpeaking(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
  const entry = await speaking(supabase, userId).findById<{ storage_path: string }>(id, 'id, storage_path');
  const { error } = await speaking(supabase, userId).delete().eq('id', id);
  throwIfError(error);

  const removed = await supabase.storage.from(SPEAKING_BUCKET).remove([entry.storage_path]);
  if (removed.error) console.error(`[speaking] audio huérfano sin borrar: ${entry.storage_path}`, removed.error);
}
