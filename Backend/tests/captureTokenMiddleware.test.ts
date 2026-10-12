import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { getUserId } from '../src/middlewares/auth.js';
import { requireCaptureToken } from '../src/middlewares/captureToken.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { createCaptureToken, revokeCaptureToken } from '../src/services/captureToken.service.js';
import { createTwoUserSupabase, SESSION_A, USER_A, USER_B } from './helpers/fakeSupabase.js';

// Simula la futura ruta de captura (tarea 3.1).
async function setup() {
  const { db, supabase } = createTwoUserSupabase();
  const app = express();
  app.locals.supabase = supabase;
  app.post('/capture', requireCaptureToken, (req, res) => {
    res.json({ userId: getUserId(req), tokenId: req.captureTokenId });
  });
  app.use(errorHandler);

  const tokenA = await createCaptureToken(supabase, USER_A.id, 'Chrome de A');
  const tokenB = await createCaptureToken(supabase, USER_B.id, 'Chrome de B');
  return { app, db, supabase, tokenA, tokenB };
}

describe('requireCaptureToken', () => {
  it('con un token activo identifica a su dueño', async () => {
    const { app, tokenA, tokenB } = await setup();
    const resA = await request(app).post('/capture').set('Authorization', `Bearer ${tokenA.token}`);
    const resB = await request(app).post('/capture').set('Authorization', `Bearer ${tokenB.token}`);

    expect(resA.status).toBe(200);
    expect(resA.body).toEqual({ userId: USER_A.id, tokenId: tokenA.id });
    expect(resB.body.userId).toBe(USER_B.id);
  });

  it('registra la fecha de último uso del token', async () => {
    const { app, db, tokenA } = await setup();
    await request(app).post('/capture').set('Authorization', `Bearer ${tokenA.token}`);

    const row = db.rows('capture_tokens').find((r) => r.id === tokenA.id);
    expect(row?.last_used_at).toEqual(expect.any(String));
  });

  it('un token revocado responde 401', async () => {
    const { app, supabase, tokenA } = await setup();
    await revokeCaptureToken(supabase, USER_A.id, tokenA.id);
    const res = await request(app).post('/capture').set('Authorization', `Bearer ${tokenA.token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/revocado/);
  });

  it('un token con formato válido pero inexistente responde 401', async () => {
    const { app } = await setup();
    const res = await request(app)
      .post('/capture')
      .set('Authorization', `Bearer ebk_${'A'.repeat(43)}`);

    expect(res.status).toBe(401);
  });

  it('sin token responde 401', async () => {
    const { app } = await setup();

    expect((await request(app).post('/capture')).status).toBe(401);
  });

  it('una sesión web no sirve como token de extensión', async () => {
    const { app } = await setup();
    const res = await request(app).post('/capture').set('Authorization', `Bearer ${SESSION_A}`);

    expect(res.status).toBe(401);
  });
});
