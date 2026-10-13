import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createCaptureToken, revokeCaptureToken } from '../src/services/captureToken.service.js';
import { provisionalType } from '../src/services/vocabulary.service.js';
import { createTwoUserSupabase, SESSION_A, USER_A, USER_B } from './helpers/fakeSupabase.js';

async function setup() {
  const { db, supabase } = createTwoUserSupabase();
  const tokenA = await createCaptureToken(supabase, USER_A.id, 'Chrome de A');
  const tokenB = await createCaptureToken(supabase, USER_B.id, 'Chrome de B');
  return { db, supabase, app: createApp({ supabase }), tokenA, tokenB };
}

const capture = {
  word: 'bite the bullet',
  context_sentence: 'The company had to bite the bullet and lay off workers.',
  source_url: 'https://www.bbc.com/news/article',
};

describe('provisionalType', () => {
  it('un solo término es word; varios, idiom_slang', () => {
    expect(provisionalType('serendipity')).toBe('word');
    expect(provisionalType('bite the bullet')).toBe('idiom_slang');
    expect(provisionalType('give up')).toBe('idiom_slang');
  });
});

describe('POST /api/capture', () => {
  it('crea el término en pending_curation, sin traducción, en la cuenta del dueño del token', async () => {
    const { app, db, tokenA } = await setup();
    const res = await request(app).post('/api/capture').set('Authorization', `Bearer ${tokenA.token}`).send(capture);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(String), word: 'bite the bullet', type: 'idiom_slang', status: 'pending_curation' });
    expect(db.rows('vocabulary')[0]).toMatchObject({
      user_id: USER_A.id,
      word: 'bite the bullet',
      context_sentence: capture.context_sentence,
      source_url: capture.source_url,
      translation: null,
      definition: null,
      status: 'pending_curation',
      source: 'extension',
    });
  });

  it('una sola palabra recibe el tipo provisional word', async () => {
    const { app, tokenA } = await setup();
    const res = await request(app).post('/api/capture').set('Authorization', `Bearer ${tokenA.token}`).send({ word: 'serendipity' });

    expect(res.body.type).toBe('word');
  });

  it('limpia espacios sobrantes de la palabra', async () => {
    const { app, tokenA } = await setup();
    const res = await request(app)
      .post('/api/capture')
      .set('Authorization', `Bearer ${tokenA.token}`)
      .send({ word: '  bite   the\n bullet ' });

    expect(res.body.word).toBe('bite the bullet');
  });

  it('recorta a 2000 caracteres un párrafo de contexto enorme', async () => {
    const { app, db, tokenA } = await setup();
    const res = await request(app)
      .post('/api/capture')
      .set('Authorization', `Bearer ${tokenA.token}`)
      .send({ word: 'word', context_sentence: 'x'.repeat(5000) });

    expect(res.status).toBe(201);
    expect(String(db.rows('vocabulary')[0]?.context_sentence)).toHaveLength(2000);
  });

  it('contexto y URL son opcionales', async () => {
    const { app, db, tokenA } = await setup();
    const res = await request(app)
      .post('/api/capture')
      .set('Authorization', `Bearer ${tokenA.token}`)
      .send({ word: 'word', context_sentence: '', source_url: '' });

    expect(res.status).toBe(201);
    expect(db.rows('vocabulary')[0]).toMatchObject({ context_sentence: null, source_url: null });
  });

  it('permite capturar la misma palabra dos veces (cada una con su contexto)', async () => {
    const { app, db, tokenA } = await setup();
    const auth = { Authorization: `Bearer ${tokenA.token}` };
    await request(app).post('/api/capture').set(auth).send({ ...capture, context_sentence: 'Primer artículo.' });
    await request(app).post('/api/capture').set(auth).send({ ...capture, context_sentence: 'Segundo artículo.' });

    expect(db.rows('vocabulary')).toHaveLength(2);
  });

  it('sin palabra o con más de 200 caracteres responde 400 y no crea nada', async () => {
    const { app, db, tokenA } = await setup();
    const auth = { Authorization: `Bearer ${tokenA.token}` };

    expect((await request(app).post('/api/capture').set(auth).send({ context_sentence: 'x' })).status).toBe(400);
    expect((await request(app).post('/api/capture').set(auth).send({ word: '   ' })).status).toBe(400);
    expect((await request(app).post('/api/capture').set(auth).send({ word: 'x'.repeat(201) })).status).toBe(400);
    expect(db.rows('vocabulary')).toHaveLength(0);
  });

  it('una URL que no es http/https responde 400', async () => {
    const { app, tokenA } = await setup();
    const res = await request(app)
      .post('/api/capture')
      .set('Authorization', `Bearer ${tokenA.token}`)
      .send({ word: 'word', source_url: 'javascript:alert(1)' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('source_url');
  });

  it('sin token, con token revocado o con una sesión web responde 401 y no crea nada', async () => {
    const { app, db, supabase, tokenA } = await setup();
    await revokeCaptureToken(supabase, USER_A.id, tokenA.id);

    expect((await request(app).post('/api/capture').send(capture)).status).toBe(401);
    expect((await request(app).post('/api/capture').set('Authorization', `Bearer ${tokenA.token}`).send(capture)).status).toBe(401);
    expect((await request(app).post('/api/capture').set('Authorization', `Bearer ${SESSION_A}`).send(capture)).status).toBe(401);
    expect(db.rows('vocabulary')).toHaveLength(0);
  });

  it('la captura con el token de A solo aparece en el Inbox de A', async () => {
    const { app, tokenA } = await setup();
    await request(app).post('/api/capture').set('Authorization', `Bearer ${tokenA.token}`).send(capture);

    const inboxA = await request(app).get('/api/vocabulary?status=pending_curation').set('Authorization', `Bearer ${SESSION_A}`);
    const inboxB = await request(app).get('/api/vocabulary?status=pending_curation').set('Authorization', 'Bearer session-b');
    expect(inboxA.body.total).toBe(1);
    expect(inboxB.body.total).toBe(0);
  });
});

describe('GET /api/capture/check', () => {
  it('con un token activo responde 200 y no crea ningún término', async () => {
    const { app, db, tokenA } = await setup();
    const res = await request(app).get('/api/capture/check').set('Authorization', `Bearer ${tokenA.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(db.rows('vocabulary')).toHaveLength(0);
  });

  it('sin token, con token revocado o con una sesión web responde 401 con el aviso en español', async () => {
    const { app, supabase, tokenA } = await setup();
    await revokeCaptureToken(supabase, USER_A.id, tokenA.id);

    const missing = await request(app).get('/api/capture/check');
    const revoked = await request(app).get('/api/capture/check').set('Authorization', `Bearer ${tokenA.token}`);
    const session = await request(app).get('/api/capture/check').set('Authorization', `Bearer ${SESSION_A}`);
    expect([missing.status, revoked.status, session.status]).toEqual([401, 401, 401]);
    expect(revoked.body.error.message).toBe('Token de extensión inválido o revocado; genera uno nuevo en tu perfil');
  });

  it('la extensión (origen chrome-extension://) puede llamarlo por CORS', async () => {
    const { app, tokenA } = await setup();
    const res = await request(app)
      .get('/api/capture/check')
      .set('Origin', 'chrome-extension://abcdefghijklmnop')
      .set('Authorization', `Bearer ${tokenA.token}`);

    expect(res.headers['access-control-allow-origin']).toBe('chrome-extension://abcdefghijklmnop');
  });
});
