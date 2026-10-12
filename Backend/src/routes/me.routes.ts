import { Router } from 'express';
import { createToken, listTokens, revokeToken } from '../controllers/captureTokens.controller.js';
import { getMe, patchMe } from '../controllers/me.controller.js';
import { requireAuth } from '../middlewares/auth.js';

/** Rutas del usuario autenticado: /api/me/... (todas exigen sesión). */
export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get('/', getMe);
meRouter.patch('/', patchMe);

meRouter.get('/capture-tokens', listTokens);
meRouter.post('/capture-tokens', createToken);
meRouter.delete('/capture-tokens/:id', revokeToken);
