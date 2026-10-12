import cors, { type CorsOptions } from 'cors';
import type { Request, RequestHandler } from 'express';

/** Rutas que la extensión de Chrome puede llamar desde su origen chrome-extension://. */
const EXTENSION_PATHS = ['/api/capture', '/api/health'];

/**
 * CORS: qué webs pueden llamar a la API desde un navegador.
 * - Los orígenes de CORS_ORIGINS (el Frontend): todas las rutas.
 * - La extensión de Chrome (chrome-extension://…): solo captura y salud.
 * - Cualquier otro origen: sin cabeceras CORS ⇒ el navegador bloquea la respuesta.
 * Las peticiones sin cabecera Origin (curl, servidores) no se ven afectadas.
 * No se usan cookies, así que no hace falta `credentials`.
 */
export function corsMiddleware(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);

  const isAllowed = (origin: string, path: string) =>
    allowed.has(origin) || (origin.startsWith('chrome-extension://') && EXTENSION_PATHS.some((p) => path.startsWith(p)));

  return cors((req: Request, callback: (error: Error | null, options?: CorsOptions) => void) => {
    const origin = req.header('Origin');
    callback(null, {
      origin: origin ? isAllowed(origin, req.path) : false,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    });
  });
}
