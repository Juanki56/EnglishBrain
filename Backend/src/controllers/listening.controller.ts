import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUserId } from '../middlewares/auth.js';
import {
  createListening,
  deleteListening,
  getListening,
  listListening,
  updateListening,
} from '../services/listening.service.js';
import { getSupabase } from '../services/supabase.js';
import { isActiveSrsField, paginationFields, parse, requiredText, searchField, srsFilterField } from '../validation.js';

const titleField = requiredText('El título', 200, 'm');

const urlField = requiredText('La URL', 2048, 'f').refine((value) => /^https?:\/\/\S+$/i.test(value), {
  error: 'La URL debe empezar por http:// o https://',
});

/** Segundo de inicio (el Frontend convierte "1:32" en 92). */
const startSecondsField = z
  .number({ error: 'El inicio debe ser un número de segundos (p. ej. 92 para 1:32)' })
  .int({ error: 'El inicio debe ser un número entero de segundos' })
  .min(0, { error: 'El inicio no puede ser negativo' })
  .max(86_400, { error: 'El inicio no puede superar las 24 horas' })
  .nullable()
  .optional();

const transcriptionField = requiredText('La transcripción', 20_000, 'f');

const listSchema = z.object({ q: searchField, srs: srsFilterField, ...paginationFields });

const createSchema = z.object({
  title: titleField,
  url: urlField,
  start_seconds: startSecondsField,
  transcription: transcriptionField,
  is_active_srs: isActiveSrsField,
});

const updateSchema = z
  .object({
    title: titleField.optional(),
    url: urlField.optional(),
    start_seconds: startSecondsField,
    transcription: transcriptionField.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    error: 'Envía al menos un campo para editar',
  });

/** GET /api/listening · lista con búsqueda en título y transcripción. */
export async function listListeningEntries(req: Request, res: Response): Promise<void> {
  const filters = parse(listSchema, req.query);
  res.json(await listListening(getSupabase(req), getUserId(req), filters));
}

/** POST /api/listening · registra un reto de escucha. */
export async function createListeningEntry(req: Request, res: Response): Promise<void> {
  const input = parse(createSchema, req.body);
  res.status(201).json(await createListening(getSupabase(req), getUserId(req), input));
}

/** GET /api/listening/:id */
export async function getListeningEntry(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.json(await getListening(getSupabase(req), getUserId(req), req.params.id));
}

/** PATCH /api/listening/:id · edita cualquier campo (no el SRS). */
export async function updateListeningEntry(req: Request<{ id: string }>, res: Response): Promise<void> {
  const changes = parse(updateSchema, req.body);
  res.json(await updateListening(getSupabase(req), getUserId(req), req.params.id, changes));
}

/** DELETE /api/listening/:id */
export async function deleteListeningEntry(req: Request<{ id: string }>, res: Response): Promise<void> {
  await deleteListening(getSupabase(req), getUserId(req), req.params.id);
  res.status(204).end();
}
