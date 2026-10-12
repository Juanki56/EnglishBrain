import type { Request, Response } from 'express';
import { z } from 'zod';
import { validationError } from '../errors.js';
import { getUserId } from '../middlewares/auth.js';
import {
  createSpeaking,
  deleteSpeaking,
  getSpeaking,
  getSpeakingAudioUrl,
  listSpeaking,
  MAX_DURATION_SECONDS,
  updateSpeakingTitle,
} from '../services/speaking.service.js';
import { getSupabase } from '../services/supabase.js';
import { isActiveSrsField, paginationFields, parse, requiredText, searchField } from '../validation.js';

const titleField = requiredText('El título', 200, 'm');

// En multipart todos los campos llegan como texto: se convierten antes de validar.
const toNumber = (value: unknown) => (value === undefined || value === '' ? undefined : Number(value));
const toBoolean = (value: unknown) => (value === 'true' ? true : value === 'false' ? false : value);

const durationField = z.preprocess(
  toNumber,
  z
    .number({
      error: (issue) =>
        issue.input === undefined ? 'La duración es obligatoria' : 'La duración debe ser un número de segundos',
    })
    .int({ error: 'La duración debe ser un número entero de segundos' })
    .min(1, { error: 'La duración mínima es de 1 segundo' })
    .max(MAX_DURATION_SECONDS, { error: 'El audio no puede durar más de 10 minutos' }),
);

const recordingLimitField = z.preprocess(
  toNumber,
  z
    .number({ error: 'El límite de grabación debe ser 3, 5 o 10 minutos' })
    .refine((value) => [3, 5, 10].includes(value), { error: 'El límite de grabación debe ser 3, 5 o 10 minutos' })
    .optional(),
);

const createSchema = z.object({
  title: titleField,
  duration_seconds: durationField,
  recording_limit_minutes: recordingLimitField,
  is_active_srs: z.preprocess(toBoolean, isActiveSrsField),
});

const listSchema = z.object({ q: searchField, ...paginationFields });

const updateSchema = z.object({ title: titleField });

/** POST /api/speaking · sube un monólogo (multipart: audio + campos). */
export async function createSpeakingEntry(req: Request, res: Response): Promise<void> {
  const input = parse(createSchema, req.body ?? {});
  if (!req.file) {
    throw validationError([{ field: 'audio', message: 'El audio es obligatorio' }]);
  }
  res.status(201).json(await createSpeaking(getSupabase(req), getUserId(req), input, req.file.buffer));
}

/** GET /api/speaking · lista de monólogos con búsqueda por título. */
export async function listSpeakingEntries(req: Request, res: Response): Promise<void> {
  const filters = parse(listSchema, req.query);
  res.json(await listSpeaking(getSupabase(req), getUserId(req), filters));
}

/** GET /api/speaking/:id */
export async function getSpeakingEntry(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.json(await getSpeaking(getSupabase(req), getUserId(req), req.params.id));
}

/** PATCH /api/speaking/:id · cambia el título. */
export async function updateSpeakingEntry(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { title } = parse(updateSchema, req.body);
  res.json(await updateSpeakingTitle(getSupabase(req), getUserId(req), req.params.id, title));
}

/** GET /api/speaking/:id/audio-url · enlace temporal (5 min) para reproducir. */
export async function getSpeakingAudio(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.json(await getSpeakingAudioUrl(getSupabase(req), getUserId(req), req.params.id));
}

/** DELETE /api/speaking/:id · borra la ficha y su audio. */
export async function deleteSpeakingEntry(req: Request<{ id: string }>, res: Response): Promise<void> {
  await deleteSpeaking(getSupabase(req), getUserId(req), req.params.id);
  res.status(204).end();
}
