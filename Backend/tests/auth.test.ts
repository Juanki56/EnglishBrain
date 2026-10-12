import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { getUserId, requireAuth } from '../src/middlewares/auth.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { AUTH_DOWN, createTwoUserSupabase, EXPIRED_SESSION, SESSION_A, USER_A } from './helpers/fakeSupabase.js';

function buildApp() {
  const { supabase } = createTwoUserSupabase();
  const app = express();
  app.locals.supabase = supabase;
  app.get('/private', requireAuth, (req, res) => {
    res.json({ userId: getUserId(req), email: req.userEmail });
  });
  app.use(errorHandler);
  return app;
}

describe('requireAuth', () => {
  it('con una sesión válida deja pasar y fija req.userId', async () => {
    const res = await request(buildApp()).get('/private').set('Authorization', `Bearer ${SESSION_A}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: USER_A.id, email: USER_A.email });
  });

  it('acepta el esquema Bearer sin distinguir mayúsculas', async () => {
    const res = await request(buildApp()).get('/private').set('Authorization', `bearer ${SESSION_A}`);

    expect(res.status).toBe(200);
  });

  it('sin cabecera Authorization responde 401', async () => {
    const res = await request(buildApp()).get('/private');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('con una cabecera mal formada responde 401', async () => {
    const res = await request(buildApp()).get('/private').set('Authorization', SESSION_A);

    expect(res.status).toBe(401);
  });

  it('con un token inválido responde 401', async () => {
    const res = await request(buildApp()).get('/private').set('Authorization', 'Bearer token-falso');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Tu sesión no es válida o ha caducado');
  });

  it('con una sesión caducada responde 401', async () => {
    const res = await request(buildApp()).get('/private').set('Authorization', `Bearer ${EXPIRED_SESSION}`);

    expect(res.status).toBe(401);
  });

  it('un token de extensión (ebk_) no sirve como sesión web', async () => {
    const res = await request(buildApp()).get('/private').set('Authorization', 'Bearer ebk_abc');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/extensión/);
  });

  it('si Supabase Auth no responde, devuelve 503 en lugar de 401', async () => {
    const res = await request(buildApp()).get('/private').set('Authorization', `Bearer ${AUTH_DOWN}`);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('service_unavailable');
  });
});
