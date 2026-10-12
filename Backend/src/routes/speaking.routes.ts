import { Router } from 'express';
import {
  createSpeakingEntry,
  deleteSpeakingEntry,
  getSpeakingAudio,
  getSpeakingEntry,
  listSpeakingEntries,
  updateSpeakingEntry,
} from '../controllers/speaking.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { audioUpload } from '../middlewares/upload.js';

/** /api/speaking/... · monólogos y sus audios (todas exigen sesión). */
export const speakingRouter = Router();

// La sesión se comprueba antes de leer cualquier archivo.
speakingRouter.use(requireAuth);

speakingRouter.get('/', listSpeakingEntries);
speakingRouter.post('/', audioUpload, createSpeakingEntry);
speakingRouter.get('/:id', getSpeakingEntry);
speakingRouter.patch('/:id', updateSpeakingEntry);
speakingRouter.delete('/:id', deleteSpeakingEntry);
speakingRouter.get('/:id/audio-url', getSpeakingAudio);
