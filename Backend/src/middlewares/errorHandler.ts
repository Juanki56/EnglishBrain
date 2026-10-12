import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError, notFound } from '../errors.js';
import { toErrorDetails } from '../validation.js';

/** Errores que lanza express.json() (body-parser). */
interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

/** Rutas inexistentes: 404 con el formato estándar. Va después de todas las rutas. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound(`No existe la ruta ${req.method} ${req.path}`));
};

/**
 * Convierte cualquier error en `{ error: { code, message, details? } }`.
 * Los errores inesperados responden 500 sin revelar detalles internos.
 * Va al final de la cadena de middlewares.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'validation_error', message: 'Los datos enviados no son válidos', details: toErrorDetails(err.issues) },
    });
    return;
  }

  const bodyError = err as BodyParserError;
  if (bodyError.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'invalid_json', message: 'El cuerpo de la petición no es JSON válido' } });
    return;
  }
  if (bodyError.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'payload_too_large', message: 'El cuerpo de la petición es demasiado grande' } });
    return;
  }

  console.error('[error no controlado]', err);
  res.status(500).json({ error: { code: 'internal_error', message: 'Error interno del servidor' } });
};
