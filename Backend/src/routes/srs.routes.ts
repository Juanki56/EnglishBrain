import { Router } from 'express';
import { getReviewQueue, postReview, toggleSrs } from '../controllers/review.controller.js';
import { requireAuth } from '../middlewares/auth.js';

/** /api/srs/... · cola del día y calificaciones (todas exigen sesión). */
export const srsRouter = Router();

srsRouter.use(requireAuth);

srsRouter.get('/queue', getReviewQueue);
srsRouter.post('/review', postReview);

/** /api/items/... · acciones comunes a todos los registros (Modo Archivo). */
export const itemsRouter = Router();

itemsRouter.use(requireAuth);

itemsRouter.patch('/:type/:id/srs-toggle', toggleSrs);
