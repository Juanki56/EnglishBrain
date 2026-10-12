import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUserId } from '../middlewares/auth.js';
import {
  createError,
  deleteError,
  getError,
  listErrors,
  updateError,
} from '../services/fossilizedErrors.service.js';
import { getSupabase } from '../services/supabase.js';
import {
  choice,
  isActiveSrsField,
  optionalText,
  paginationFields,
  parse,
  requiredText,
  searchField,
  srsFilterField,
} from '../validation.js';

const incorrectField = requiredText('La frase incorrecta', 500, 'f');
const correctField = requiredText('La frase correcta', 500, 'f');
const notesField = optionalText('La nota', 2000);

const listSchema = z.object({
  status: choice(['active', 'resolved'], 'Filtro no válido: usa active (activos) o resolved (superados)').optional(),
  q: searchField,
  srs: srsFilterField,
  ...paginationFields,
});

const createSchema = z.object({
  incorrect_phrase: incorrectField,
  correct_phrase: correctField,
  notes: notesField,
  is_active_srs: isActiveSrsField,
});

const updateSchema = z
  .object({
    incorrect_phrase: incorrectField.optional(),
    correct_phrase: correctField.optional(),
    notes: notesField,
    is_resolved: z.boolean({ error: 'Indica si el error está superado (true o false)' }).optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    error: 'Envía al menos un campo para editar',
  });

/** GET /api/errors · lista con filtro activos/superados, búsqueda y paginación. */
export async function listFossilizedErrors(req: Request, res: Response): Promise<void> {
  const filters = parse(listSchema, req.query);
  res.json(await listErrors(getSupabase(req), getUserId(req), filters));
}

/** POST /api/errors · registra un error (nace activo). */
export async function createFossilizedError(req: Request, res: Response): Promise<void> {
  const input = parse(createSchema, req.body);
  res.status(201).json(await createError(getSupabase(req), getUserId(req), input));
}

/** GET /api/errors/:id */
export async function getFossilizedError(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.json(await getError(getSupabase(req), getUserId(req), req.params.id));
}

/** PATCH /api/errors/:id · edita frases, nota o lo marca como superado. */
export async function updateFossilizedError(req: Request<{ id: string }>, res: Response): Promise<void> {
  const changes = parse(updateSchema, req.body);
  res.json(await updateError(getSupabase(req), getUserId(req), req.params.id, changes));
}

/** DELETE /api/errors/:id */
export async function deleteFossilizedError(req: Request<{ id: string }>, res: Response): Promise<void> {
  await deleteError(getSupabase(req), getUserId(req), req.params.id);
  res.status(204).end();
}
