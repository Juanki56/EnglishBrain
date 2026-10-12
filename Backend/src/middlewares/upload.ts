import multer from 'multer';
import { MAX_AUDIO_BYTES } from '../services/speaking.service.js';

/**
 * Recibe un único audio en el campo "audio" (multipart/form-data) y lo deja en
 * memoria (req.file.buffer). Los errores (tamaño, campo inesperado) los
 * traduce errorHandler.
 */
export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 10, fieldSize: 10 * 1024 },
}).single('audio');
