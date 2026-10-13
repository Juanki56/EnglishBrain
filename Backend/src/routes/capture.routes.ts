import { Router } from 'express';
import { captureWord } from '../controllers/vocabulary.controller.js';
import { requireCaptureToken } from '../middlewares/captureToken.js';

/** /api/capture · solo la extensión, con su token ebk_. */
export const captureRouter = Router();

captureRouter.post('/', requireCaptureToken, captureWord);

/** Botón "Probar conexión" de la extensión: valida el token sin crear nada. */
captureRouter.get('/check', requireCaptureToken, (_req, res) => {
  res.json({ ok: true });
});
