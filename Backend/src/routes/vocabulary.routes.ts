import { Router } from 'express';
import {
  createWord,
  curateWord,
  deleteWord,
  getWord,
  listWords,
  updateWord,
} from '../controllers/vocabulary.controller.js';
import { requireAuth } from '../middlewares/auth.js';

/** /api/vocabulary/... (todas exigen sesión). */
export const vocabularyRouter = Router();

vocabularyRouter.use(requireAuth);

vocabularyRouter.get('/', listWords);
vocabularyRouter.post('/', createWord);
vocabularyRouter.get('/:id', getWord);
vocabularyRouter.patch('/:id', updateWord);
vocabularyRouter.delete('/:id', deleteWord);
vocabularyRouter.patch('/:id/curate', curateWord);
