import { Router } from 'express';
import {
  createListeningEntry,
  deleteListeningEntry,
  getListeningEntry,
  listListeningEntries,
  updateListeningEntry,
} from '../controllers/listening.controller.js';
import { requireAuth } from '../middlewares/auth.js';

/** /api/listening/... · retos de escucha (todas exigen sesión). */
export const listeningRouter = Router();

listeningRouter.use(requireAuth);

listeningRouter.get('/', listListeningEntries);
listeningRouter.post('/', createListeningEntry);
listeningRouter.get('/:id', getListeningEntry);
listeningRouter.patch('/:id', updateListeningEntry);
listeningRouter.delete('/:id', deleteListeningEntry);
