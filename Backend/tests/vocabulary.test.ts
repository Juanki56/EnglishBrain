import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTwoUserSupabase, SESSION_A, SESSION_B, USER_A, USER_B } from './helpers/fakeSupabase.js';

const asA = { Authorization: `Bearer ${SESSION_A}` };
const asB = { Authorization: `Bearer ${SESSION_B}` };

const ID = {
  pendingOld: '2a000000-0000-4000-8000-000000000001',
  pendingNew: '2a000000-0000-4000-8000-000000000002',
  learning: '2a000000-0000-4000-8000-000000000003',
  manual: '2a000000-0000-4000-8000-000000000004',
  ofB: '2b000000-0000-4000-8000-000000000001',
};

function setup() {
  const { db, supabase } = createTwoUserSupabase();
  const base = { context_sentence: null, translation: null, definition: null, source_url: null, is_active_srs: true, retention_state: 'learning' };
  db.rows('vocabulary').push(
    { ...base, id: ID.pendingOld, user_id: USER_A.id, word: 'bite the bullet', type: 'idiom_slang', status: 'pending_curation', source: 'extension', created_at: '2026-10-01T10:00:00Z',
      context_sentence: 'They had to bite the bullet.' },
    { ...base, id: ID.pendingNew, user_id: USER_A.id, word: 'serendipity', type: 'word', status: 'pending_curation', source: 'extension', created_at: '2026-10-03T10:00:00Z' },
    { ...base, id: ID.learning, user_id: USER_A.id, word: 'give up', type: 'phrasal_verb', status: 'learning', source: 'extension', translation: 'rendirse', created_at: '2026-10-02T10:00:00Z' },
    { ...base, id: ID.manual, user_id: USER_A.id, word: 'awkward', type: 'word', status: 'learning', source: 'manual', translation: 'incómodo', created_at: '2026-10-04T10:00:00Z' },
    { ...base, id: ID.ofB, user_id: USER_B.id, word: 'secret of B', type: 'word', status: 'pending_curation', source: 'extension', created_at: '2026-10-05T10:00:00Z' },
  );
  return { db, app: createApp({ supabase }) };
}

const words = (body: { items: Array<{ word: string }> }) => body.items.map((item) => item.word);

describe('GET /api/vocabulary', () => {
  it('lista solo las palabras propias, de la más reciente a la más antigua, con el total', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/vocabulary').set(asA);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(words(res.body)).toEqual(['awkward', 'serendipity', 'give up', 'bite the bullet']);
  });

  it('B solo ve sus palabras, nunca las de A', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/vocabulary').set(asB);

    expect(res.body.total).toBe(1);
    expect(words(res.body)).toEqual(['secret of B']);
  });

  it('el Inbox (pending_curation) va de la más antigua a la más reciente', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/vocabulary?status=pending_curation').set(asA);

    expect(words(res.body)).toEqual(['bite the bullet', 'serendipity']);
  });

  it('filtra por tipo y por origen (historial reciente manual)', async () => {
    const { app } = setup();

    expect(words((await request(app).get('/api/vocabulary?type=phrasal_verb').set(asA)).body)).toEqual(['give up']);
    expect(words((await request(app).get('/api/vocabulary?source=manual&limit=5').set(asA)).body)).toEqual(['awkward']);
  });

  it('busca texto en palabra, contexto y traducción sin distinguir mayúsculas', async () => {
    const { app } = setup();

    expect(words((await request(app).get('/api/vocabulary?q=BULLET').set(asA)).body)).toEqual(['bite the bullet']);
    expect(words((await request(app).get('/api/vocabulary?q=rendirse').set(asA)).body)).toEqual(['give up']);
  });

  it('la búsqueda ignora caracteres especiales de los filtros', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/vocabulary').query({ q: 'bullet),status.eq.(x' }).set(asA);

    expect(res.status).toBe(200);
  });

  it('pagina con limit y offset manteniendo el total', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/vocabulary?limit=2&offset=1').set(asA);

    expect(res.body.total).toBe(4);
    expect(words(res.body)).toEqual(['serendipity', 'give up']);
  });

  it('filtros inválidos responden 400', async () => {
    const { app } = setup();

    expect((await request(app).get('/api/vocabulary?status=borrado').set(asA)).status).toBe(400);
    expect((await request(app).get('/api/vocabulary?type=slang').set(asA)).status).toBe(400);
    expect((await request(app).get('/api/vocabulary?limit=500').set(asA)).status).toBe(400);
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).get('/api/vocabulary')).status).toBe(401);
  });
});

describe('GET /api/vocabulary/:id', () => {
  it('devuelve una palabra propia', async () => {
    const { app } = setup();
    const res = await request(app).get(`/api/vocabulary/${ID.learning}`).set(asA);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: ID.learning, word: 'give up', translation: 'rendirse' });
  });

  it('una palabra de otro usuario responde 404', async () => {
    const { app } = setup();

    expect((await request(app).get(`/api/vocabulary/${ID.ofB}`).set(asA)).status).toBe(404);
  });
});

describe('PATCH /api/vocabulary/:id', () => {
  it('edita contenido de una palabra propia', async () => {
    const { app } = setup();
    const res = await request(app)
      .patch(`/api/vocabulary/${ID.learning}`)
      .set(asA)
      .send({ translation: 'darse por vencido', definition: 'to stop trying', type: 'phrasal_verb' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ translation: 'darse por vencido', definition: 'to stop trying' });
  });

  it('ignora intentos de cambiar estado, SRS o dueño', async () => {
    const { app, db } = setup();
    await request(app)
      .patch(`/api/vocabulary/${ID.learning}`)
      .set(asA)
      .send({ translation: 'rendirse', status: 'mastered', due_at: '2099-01-01', user_id: USER_B.id, is_active_srs: false });

    expect(db.rows('vocabulary').find((r) => r.id === ID.learning)).toMatchObject({
      status: 'learning',
      user_id: USER_A.id,
      is_active_srs: true,
    });
  });

  it('dejar sin traducción una palabra curada responde 400', async () => {
    const { app } = setup();
    const res = await request(app).patch(`/api/vocabulary/${ID.learning}`).set(asA).send({ translation: '' });

    expect(res.status).toBe(400);
  });

  it('un tipo inválido o un body vacío responden 400', async () => {
    const { app } = setup();

    expect((await request(app).patch(`/api/vocabulary/${ID.learning}`).set(asA).send({ type: 'slang' })).status).toBe(400);
    expect((await request(app).patch(`/api/vocabulary/${ID.learning}`).set(asA).send({})).status).toBe(400);
  });

  it('no puede editar palabras de otro usuario (404)', async () => {
    const { app, db } = setup();
    const res = await request(app).patch(`/api/vocabulary/${ID.ofB}`).set(asA).send({ word: 'hackeado' });

    expect(res.status).toBe(404);
    expect(db.rows('vocabulary').find((r) => r.id === ID.ofB)?.word).toBe('secret of B');
  });
});

describe('DELETE /api/vocabulary/:id', () => {
  it('borra una palabra propia (204)', async () => {
    const { app, db } = setup();
    const res = await request(app).delete(`/api/vocabulary/${ID.manual}`).set(asA);

    expect(res.status).toBe(204);
    expect(db.rows('vocabulary').some((r) => r.id === ID.manual)).toBe(false);
  });

  it('no puede borrar palabras de otro usuario (404)', async () => {
    const { app, db } = setup();
    const res = await request(app).delete(`/api/vocabulary/${ID.ofB}`).set(asA);

    expect(res.status).toBe(404);
    expect(db.rows('vocabulary').some((r) => r.id === ID.ofB)).toBe(true);
  });
});
