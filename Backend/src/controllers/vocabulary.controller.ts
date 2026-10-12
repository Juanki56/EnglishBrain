import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUserId } from '../middlewares/auth.js';
import { getSupabase } from '../services/supabase.js';
import {
  CONTEXT_MAX_LENGTH,
  createCapture,
  createManualVocabulary,
  curateVocabulary,
  deleteVocabulary,
  getVocabulary,
  listVocabulary,
  updateVocabulary,
  VOCABULARY_SOURCES,
  VOCABULARY_STATUSES,
  VOCABULARY_TYPES,
} from '../services/vocabulary.service.js';
import {
  choice,
  isActiveSrsField,
  missingOrNotText,
  optionalText,
  paginationFields,
  parse,
  requiredText,
  searchField,
  srsFilterField,
} from '../validation.js';

// -----------------------------------------------------------------------------
// Campos reutilizables
// -----------------------------------------------------------------------------

/** Palabra o frase: sin espacios sobrantes, 1–200 caracteres. */
const wordField = z
  .string({ error: missingOrNotText('La palabra', 'f') })
  .transform((value) => value.replace(/\s+/g, ' '))
  .pipe(requiredText('La palabra', 200, 'f'));

const translationField = requiredText('La traducción', 500, 'f');

const typeField = choice(
  VOCABULARY_TYPES,
  'Elige un tipo válido: palabra (word), phrasal verb (phrasal_verb) o idiom/slang (idiom_slang)',
);

// -----------------------------------------------------------------------------
// Esquemas por endpoint
// -----------------------------------------------------------------------------

const captureSchema = z.object({
  word: wordField,
  // Párrafos enormes se recortan en lugar de perder la captura.
  context_sentence: z
    .string({ error: 'El contexto debe ser un texto' })
    .optional()
    .nullable()
    .transform((value) => value?.trim().slice(0, CONTEXT_MAX_LENGTH) || null),
  source_url: z
    .string({ error: 'La URL debe ser un texto' })
    .trim()
    .max(2048, { error: 'La URL admite como máximo 2048 caracteres' })
    .refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), {
      error: 'La URL debe empezar por http:// o https://',
    })
    .optional()
    .nullable()
    .transform((value) => value || null),
});

const listSchema = z.object({
  status: choice(VOCABULARY_STATUSES, 'Estado no válido: usa pending_curation, learning, reviewing o mastered').optional(),
  type: typeField.optional(),
  source: choice(VOCABULARY_SOURCES, 'Origen no válido: usa extension o manual').optional(),
  q: searchField,
  srs: srsFilterField,
  ...paginationFields,
});

const updateSchema = z
  .object({
    word: wordField.optional(),
    context_sentence: optionalText('El contexto', CONTEXT_MAX_LENGTH),
    translation: optionalText('La traducción', 500),
    definition: optionalText('La definición', 2000),
    type: typeField.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    error: 'Envía al menos un campo para editar',
  });

const curateSchema = z.object({
  translation: translationField,
  type: typeField,
  definition: optionalText('La definición', 2000),
  word: wordField.optional(),
  context_sentence: optionalText('El contexto', CONTEXT_MAX_LENGTH),
  is_active_srs: isActiveSrsField,
});

const manualSchema = z.object({
  word: wordField,
  translation: translationField,
  type: typeField,
  context_sentence: optionalText('El contexto', CONTEXT_MAX_LENGTH),
  definition: optionalText('La definición', 2000),
  is_active_srs: isActiveSrsField,
});

// -----------------------------------------------------------------------------
// Handlers
// -----------------------------------------------------------------------------

/** POST /api/capture · captura desde la extensión (token ebk_). */
export async function captureWord(req: Request, res: Response): Promise<void> {
  const input = parse(captureSchema, req.body);
  res.status(201).json(await createCapture(getSupabase(req), getUserId(req), input));
}

/** GET /api/vocabulary · lista con filtros, búsqueda y paginación. */
export async function listWords(req: Request, res: Response): Promise<void> {
  const filters = parse(listSchema, req.query);
  res.json(await listVocabulary(getSupabase(req), getUserId(req), filters));
}

/** GET /api/vocabulary/:id */
export async function getWord(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.json(await getVocabulary(getSupabase(req), getUserId(req), req.params.id));
}

/** PATCH /api/vocabulary/:id · edita contenido (no estado ni SRS). */
export async function updateWord(req: Request<{ id: string }>, res: Response): Promise<void> {
  const changes = parse(updateSchema, req.body);
  res.json(await updateVocabulary(getSupabase(req), getUserId(req), req.params.id, changes));
}

/** DELETE /api/vocabulary/:id · borra (también sirve para descartar capturas). */
export async function deleteWord(req: Request<{ id: string }>, res: Response): Promise<void> {
  await deleteVocabulary(getSupabase(req), getUserId(req), req.params.id);
  res.status(204).end();
}

/** PATCH /api/vocabulary/:id/curate · Inbox → learning. */
export async function curateWord(req: Request<{ id: string }>, res: Response): Promise<void> {
  const input = parse(curateSchema, req.body);
  res.json(await curateVocabulary(getSupabase(req), getUserId(req), req.params.id, input));
}

/** POST /api/vocabulary · creación manual directa. */
export async function createWord(req: Request, res: Response): Promise<void> {
  const input = parse(manualSchema, req.body);
  res.status(201).json(await createManualVocabulary(getSupabase(req), getUserId(req), input));
}
