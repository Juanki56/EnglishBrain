import { Router } from 'express';
import {
  createFossilizedError,
  deleteFossilizedError,
  getFossilizedError,
  listFossilizedErrors,
  updateFossilizedError,
} from '../controllers/fossilizedErrors.controller.js';
import { requireAuth } from '../middlewares/auth.js';

/** /api/errors/... · Muro de Errores Fosilizados (todas exigen sesión). */
export const errorsRouter = Router();

errorsRouter.use(requireAuth);

errorsRouter.get('/', listFossilizedErrors);
errorsRouter.post('/', createFossilizedError);
errorsRouter.get('/:id', getFossilizedError);
errorsRouter.patch('/:id', updateFossilizedError);
errorsRouter.delete('/:id', deleteFossilizedError);
