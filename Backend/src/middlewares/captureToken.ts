import type { RequestHandler } from 'express';
import { unauthorized } from '../errors.js';
import { findActiveCaptureToken, touchCaptureToken } from '../services/captureToken.service.js';
import { getSupabase } from '../services/supabase.js';
import { bearerToken } from './auth.js';

/**
 * Exige un token personal de extensión activo (`Authorization: Bearer ebk_…`).
 * Identifica al dueño por el hash del token, registra su último uso y fija
 * req.userId. Solo se monta en las rutas de captura: no da acceso a nada más.
 */
export const requireCaptureToken: RequestHandler = async (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) {
    throw unauthorized('Falta el token de la extensión; genéralo en tu perfil');
  }

  const supabase = getSupabase(req);
  const match = await findActiveCaptureToken(supabase, token);
  if (!match) {
    throw unauthorized('Token de extensión inválido o revocado; genera uno nuevo en tu perfil');
  }

  await touchCaptureToken(supabase, match.tokenId);

  req.userId = match.userId;
  req.captureTokenId = match.tokenId;
  next();
};
