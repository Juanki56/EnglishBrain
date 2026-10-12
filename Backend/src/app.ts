import express, { type Express } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { captureRouter } from './routes/capture.routes.js';
import { errorsRouter } from './routes/errors.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { listeningRouter } from './routes/listening.routes.js';
import { meRouter } from './routes/me.routes.js';
import { speakingRouter } from './routes/speaking.routes.js';
import { vocabularyRouter } from './routes/vocabulary.routes.js';
import { writingRouter } from './routes/writing.routes.js';

export interface AppDeps {
  /** Cliente compartido de Supabase; disponible en `req.app.locals.supabase`. */
  supabase?: SupabaseClient;
}

/**
 * Construye la aplicación Express sin ponerla a escuchar, para poder
 * probarla con supertest. server.ts es quien la arranca.
 */
export function createApp(deps: AppDeps = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  app.locals.supabase = deps.supabase;
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/me', meRouter);
  app.use('/api/capture', captureRouter);
  app.use('/api/vocabulary', vocabularyRouter);
  app.use('/api/errors', errorsRouter);
  app.use('/api/writing', writingRouter);
  app.use('/api/listening', listeningRouter);
  app.use('/api/speaking', speakingRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
