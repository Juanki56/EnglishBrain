import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { CAPTURE_TOKEN_PATTERN, hashCaptureToken } from '../src/services/captureToken.service.js';
import { createTwoUserSupabase, SESSION_A, SESSION_B, USER_A, USER_B } from './helpers/fakeSupabase.js';

function setup() {
  const { db, supabase } = createTwoUserSupabase();
  return { db, app: createApp({ supabase }) };
}

const asA = { Authorization: `Bearer ${SESSION_A}` };
const asB = { Authorization: `Bearer ${SESSION_B}` };

describe('POST /api/me/capture-tokens', () => {
  it('crea un token ebk_ y lo muestra completo en la respuesta', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/me/capture-tokens').set(asA).send({ label: 'Chrome portátil' });

    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(CAPTURE_TOKEN_PATTERN);
    expect(res.body).toMatchObject({ label: 'Chrome portátil', last4: res.body.token.slice(-4), revoked_at: null });
  });

  it('en la base de datos solo guarda el hash y los últimos 4, nunca el token', async () => {
    const { app, db } = setup();
    const res = await request(app).post('/api/me/capture-tokens').set(asA).send({ label: 'Chrome' });

    const [row] = db.rows('capture_tokens');
    expect(row).toMatchObject({ user_id: USER_A.id, token_hash: hashCaptureToken(res.body.token) });
    expect(JSON.stringify(row)).not.toContain(res.body.token);
  });

  it('cada token generado es distinto', async () => {
    const { app } = setup();
    const first = await request(app).post('/api/me/capture-tokens').set(asA).send({ label: 'uno' });
    const second = await request(app).post('/api/me/capture-tokens').set(asA).send({ label: 'dos' });

    expect(first.body.token).not.toBe(second.body.token);
  });

  it('sin etiqueta o con etiqueta de más de 50 caracteres responde 400', async () => {
    const { app } = setup();

    expect((await request(app).post('/api/me/capture-tokens').set(asA).send({})).status).toBe(400);
    expect((await request(app).post('/api/me/capture-tokens').set(asA).send({ label: '   ' })).status).toBe(400);
    expect((await request(app).post('/api/me/capture-tokens').set(asA).send({ label: 'x'.repeat(51) })).status).toBe(400);
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).post('/api/me/capture-tokens').send({ label: 'x' })).status).toBe(401);
  });
});

describe('GET /api/me/capture-tokens', () => {
  it('lista los tokens propios sin el token completo ni su hash', async () => {
    const { app } = setup();
    const created = await request(app).post('/api/me/capture-tokens').set(asA).send({ label: 'Chrome' });
    const res = await request(app).get('/api/me/capture-tokens').set(asA);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual({
      id: created.body.id,
      label: 'Chrome',
      last4: created.body.last4,
      created_at: expect.any(String),
      last_used_at: null,
      revoked_at: null,
    });
    expect(JSON.stringify(res.body)).not.toContain(created.body.token);
  });

  it('un usuario no ve los tokens de otro', async () => {
    const { app } = setup();
    await request(app).post('/api/me/capture-tokens').set(asA).send({ label: 'de A' });
    const res = await request(app).get('/api/me/capture-tokens').set(asB);

    expect(res.body).toEqual([]);
  });
});

describe('DELETE /api/me/capture-tokens/:id', () => {
  it('revoca un token propio (204) y queda marcado como revocado', async () => {
    const { app } = setup();
    const created = await request(app).post('/api/me/capture-tokens').set(asA).send({ label: 'Chrome' });
    const res = await request(app).delete(`/api/me/capture-tokens/${created.body.id}`).set(asA);
    const list = await request(app).get('/api/me/capture-tokens').set(asA);

    expect(res.status).toBe(204);
    expect(list.body[0].revoked_at).toEqual(expect.any(String));
  });

  it('revocar dos veces no falla ni cambia la fecha de revocación', async () => {
    const { app, db } = setup();
    const created = await request(app).post('/api/me/capture-tokens').set(asA).send({ label: 'Chrome' });
    await request(app).delete(`/api/me/capture-tokens/${created.body.id}`).set(asA);
    const firstRevokedAt = db.rows('capture_tokens')[0]?.revoked_at;
    const again = await request(app).delete(`/api/me/capture-tokens/${created.body.id}`).set(asA);

    expect(again.status).toBe(204);
    expect(db.rows('capture_tokens')[0]?.revoked_at).toBe(firstRevokedAt);
  });

  it('un usuario no puede revocar el token de otro (404)', async () => {
    const { app, db } = setup();
    const created = await request(app).post('/api/me/capture-tokens').set(asA).send({ label: 'de A' });
    const res = await request(app).delete(`/api/me/capture-tokens/${created.body.id}`).set(asB);

    expect(res.status).toBe(404);
    expect(db.rows('capture_tokens')[0]).toMatchObject({ user_id: USER_A.id, revoked_at: null });
    expect(db.rows('capture_tokens')[0]?.user_id).not.toBe(USER_B.id);
  });

  it('un id inexistente o mal formado responde 404', async () => {
    const { app } = setup();

    expect((await request(app).delete('/api/me/capture-tokens/no-es-uuid').set(asA)).status).toBe(404);
    expect(
      (await request(app).delete('/api/me/capture-tokens/9f000000-0000-4000-8000-000000000000').set(asA)).status,
    ).toBe(404);
  });
});
