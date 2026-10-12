import type { Request, RequestHandler } from 'express';
import { serviceUnavailable, unauthorized } from '../errors.js';
import { getSupabase } from '../services/supabase.js';

/** Extrae el token de `Authorization: Bearer <token>`, o null. */
export function bearerToken(req: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
  return match?.[1] ?? null;
}

/**
 * Exige una sesión web válida (design D3). Valida el access token con
 * Supabase Auth —así un logout se respeta al instante— y fija req.userId.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) {
    throw unauthorized();
  }
  // Los tokens de la extensión no sirven como sesión web.
  if (token.startsWith('ebk_')) {
    throw unauthorized('Este token solo sirve para la extensión de Chrome');
  }

  const { data, error } = await getSupabase(req).auth.getUser(token);

  if (error) {
    if (error.name === 'AuthRetryableFetchError' || (error.status ?? 0) >= 500) {
      throw serviceUnavailable('No se pudo verificar la sesión; inténtalo de nuevo');
    }
    throw unauthorized('Tu sesión no es válida o ha caducado');
  }
  if (!data.user) {
    throw unauthorized('Tu sesión no es válida o ha caducado');
  }

  req.userId = data.user.id;
  req.userEmail = data.user.email ?? null;
  next();
};

/** Id del usuario autenticado. Usar solo en rutas protegidas por requireAuth o requireCaptureToken. */
export function getUserId(req: Request): string {
  if (!req.userId) {
    throw unauthorized();
  }
  return req.userId;
}
