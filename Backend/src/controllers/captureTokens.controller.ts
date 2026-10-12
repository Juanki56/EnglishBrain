import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUserId } from '../middlewares/auth.js';
import { createCaptureToken, listCaptureTokens, revokeCaptureToken } from '../services/captureToken.service.js';
import { getSupabase } from '../services/supabase.js';
import { parse, requiredText } from '../validation.js';

const createTokenSchema = z.object({
  label: requiredText('La etiqueta', 50, 'f'),
});

/** GET /api/me/capture-tokens · lista los tokens propios (sin el token completo). */
export async function listTokens(req: Request, res: Response): Promise<void> {
  res.json(await listCaptureTokens(getSupabase(req), getUserId(req)));
}

/** POST /api/me/capture-tokens · crea un token; el valor completo solo se ve en esta respuesta. */
export async function createToken(req: Request, res: Response): Promise<void> {
  const { label } = parse(createTokenSchema, req.body);
  res.status(201).json(await createCaptureToken(getSupabase(req), getUserId(req), label));
}

/** DELETE /api/me/capture-tokens/:id · revoca un token propio. */
export async function revokeToken(req: Request<{ id: string }>, res: Response): Promise<void> {
  await revokeCaptureToken(getSupabase(req), getUserId(req), req.params.id);
  res.status(204).end();
}
