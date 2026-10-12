/** Detalle de un campo inválido, usado en errores de validación. */
export interface ErrorDetail {
  field: string;
  message: string;
}

/**
 * Error con estado HTTP y código estable. El middleware de errores lo
 * convierte en `{ error: { code, message, details? } }`.
 */
export class HttpError extends Error {
  override name = 'HttpError';

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: ErrorDetail[]) =>
  new HttpError(400, 'bad_request', message, details);

export const validationError = (details: ErrorDetail[]) =>
  new HttpError(400, 'validation_error', 'Los datos enviados no son válidos', details);

export const unauthorized = (message = 'Necesitas iniciar sesión') => new HttpError(401, 'unauthorized', message);

export const forbidden = (message = 'No tienes permiso para esta acción') => new HttpError(403, 'forbidden', message);

// Un registro de otro usuario también responde not_found (spec user-accounts: aislamiento).
export const notFound = (message = 'Recurso no encontrado') => new HttpError(404, 'not_found', message);

export const conflict = (message: string) => new HttpError(409, 'conflict', message);

export const serviceUnavailable = (message: string) => new HttpError(503, 'service_unavailable', message);
