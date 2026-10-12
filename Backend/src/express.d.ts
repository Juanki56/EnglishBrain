// Datos que los middlewares de autenticación añaden a cada petición.
declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado (sesión web o token de extensión). */
      userId?: string;
      /** Email del usuario, solo con sesión web. */
      userEmail?: string | null;
      /** Token de extensión usado, solo en rutas de captura. */
      captureTokenId?: string;
    }
  }
}

export {};
