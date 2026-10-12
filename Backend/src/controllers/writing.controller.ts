import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUserId } from '../middlewares/auth.js';
import { getSupabase } from '../services/supabase.js';
import {
  addWritingVersion,
  createWriting,
  deleteWriting,
  getWriting,
  listWriting,
  updateWritingTitle,
} from '../services/writing.service.js';
import { isActiveSrsField, paginationFields, parse, requiredText, searchField, srsFilterField } from '../validation.js';

const titleField = requiredText('El título', 200, 'm');
const contentField = requiredText('El texto', 50_000, 'm');

const listSchema = z.object({ q: searchField, srs: srsFilterField, ...paginationFields });

const createSchema = z.object({
  title: titleField,
  content: contentField,
  is_active_srs: isActiveSrsField,
});

const updateSchema = z.object({ title: titleField });

const versionSchema = z.object({ content: contentField });

/** GET /api/writing · entradas con número de versiones y extracto de la última. */
export async function listWritingEntries(req: Request, res: Response): Promise<void> {
  const filters = parse(listSchema, req.query);
  res.json(await listWriting(getSupabase(req), getUserId(req), filters));
}

/** POST /api/writing · crea la entrada con su versión 1 (el original). */
export async function createWritingEntry(req: Request, res: Response): Promise<void> {
  const input = parse(createSchema, req.body);
  res.status(201).json(await createWriting(getSupabase(req), getUserId(req), input));
}

/** GET /api/writing/:id · entrada con todas sus versiones. */
export async function getWritingEntry(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.json(await getWriting(getSupabase(req), getUserId(req), req.params.id));
}

/** PATCH /api/writing/:id · cambia el título. */
export async function updateWritingEntry(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { title } = parse(updateSchema, req.body);
  res.json(await updateWritingTitle(getSupabase(req), getUserId(req), req.params.id, title));
}

/** POST /api/writing/:id/versions · añade una versión corregida. */
export async function addVersion(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { content } = parse(versionSchema, req.body);
  res.status(201).json(await addWritingVersion(getSupabase(req), getUserId(req), req.params.id, content));
}

/** DELETE /api/writing/:id · borra la entrada con todas sus versiones. */
export async function deleteWritingEntry(req: Request<{ id: string }>, res: Response): Promise<void> {
  await deleteWriting(getSupabase(req), getUserId(req), req.params.id);
  res.status(204).end();
}
