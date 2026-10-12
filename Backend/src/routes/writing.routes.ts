import { Router } from 'express';
import {
  addVersion,
  createWritingEntry,
  deleteWritingEntry,
  getWritingEntry,
  listWritingEntries,
  updateWritingEntry,
} from '../controllers/writing.controller.js';
import { requireAuth } from '../middlewares/auth.js';

/** /api/writing/... · bitácora de textos (todas exigen sesión). */
export const writingRouter = Router();

writingRouter.use(requireAuth);

writingRouter.get('/', listWritingEntries);
writingRouter.post('/', createWritingEntry);
writingRouter.get('/:id', getWritingEntry);
writingRouter.patch('/:id', updateWritingEntry);
writingRouter.delete('/:id', deleteWritingEntry);
writingRouter.post('/:id/versions', addVersion);
