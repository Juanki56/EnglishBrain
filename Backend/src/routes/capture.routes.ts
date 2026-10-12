import { Router } from 'express';
import { captureWord } from '../controllers/vocabulary.controller.js';
import { requireCaptureToken } from '../middlewares/captureToken.js';

/** /api/capture · solo la extensión, con su token ebk_. */
export const captureRouter = Router();

captureRouter.post('/', requireCaptureToken, captureWord);
