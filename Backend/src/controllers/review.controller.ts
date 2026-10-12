import type { Request, Response } from 'express';
import { z } from 'zod';
import { notFound } from '../errors.js';
import { getUserId } from '../middlewares/auth.js';
import { getQueue, ITEM_TYPES, reviewItem, setActiveSrs, URL_TYPES, type UrlType } from '../services/review.service.js';
import type { Grade } from '../services/srs.service.js';
import { getSupabase } from '../services/supabase.js';
import { choice, isUuid, paginationFields, parse } from '../validation.js';

const queueSchema = z.object({ ...paginationFields });

const reviewSchema = z.object({
  item_type: choice(ITEM_TYPES, 'Tipo de tarjeta no válido: usa vocabulary, fossilized_error, speaking, writing o listening'),
  item_id: z
    .string({ error: (issue) => (issue.input === undefined ? 'Falta indicar la tarjeta (item_id)' : 'La tarjeta (item_id) debe ser un texto') })
    .refine(isUuid, { error: 'La tarjeta (item_id) no es un identificador válido' }),
  grade: z
    .number({ error: (issue) => (issue.input === undefined ? 'La calificación es obligatoria' : 'La calificación debe ser un número del 1 al 4') })
    .int({ error: 'La calificación debe ser un número del 1 al 4' })
    .min(1, { error: 'La calificación debe ser un número del 1 al 4' })
    .max(4, { error: 'La calificación debe ser un número del 1 al 4' }),
});

const toggleSchema = z.object({
  is_active_srs: z.boolean({
    error: (issue) =>
      issue.input === undefined
        ? 'Indica si quieres añadirlo a los repasos diarios (is_active_srs)'
        : 'Indica si quieres añadirlo a los repasos diarios (true o false)',
  }),
});

/** GET /api/srs/queue · tarjetas vencidas con su contenido y el total para el Dashboard. */
export async function getReviewQueue(req: Request, res: Response): Promise<void> {
  const page = parse(queueSchema, req.query);
  res.json(await getQueue(getSupabase(req), getUserId(req), page));
}

/** POST /api/srs/review · aplica una calificación 1–4. */
export async function postReview(req: Request, res: Response): Promise<void> {
  const { item_type, item_id, grade } = parse(reviewSchema, req.body);
  res.json(await reviewItem(getSupabase(req), getUserId(req), item_type, item_id, grade as Grade));
}

/** PATCH /api/items/:type/:id/srs-toggle · activa o archiva cualquier registro. */
export async function toggleSrs(req: Request<{ type: string; id: string }>, res: Response): Promise<void> {
  if (!Object.hasOwn(URL_TYPES, req.params.type)) {
    throw notFound('Tipo de registro no válido: usa vocabulary, errors, speaking, writing o listening');
  }
  const itemType = URL_TYPES[req.params.type as UrlType];
  const { is_active_srs } = parse(toggleSchema, req.body);
  res.json(await setActiveSrs(getSupabase(req), getUserId(req), itemType, req.params.id, is_active_srs));
}
