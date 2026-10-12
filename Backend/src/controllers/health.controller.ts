import type { Request, Response } from 'express';

/** GET /api/health · comprueba que la API está viva. Público, sin autenticación. */
export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    service: 'englishbrain-backend',
    timestamp: new Date().toISOString(),
  });
}
