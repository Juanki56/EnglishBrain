import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTwoUserSupabase, SESSION_A, SESSION_B, USER_A, USER_B } from './helpers/fakeSupabase.js';

const asA = { Authorization: `Bearer ${SESSION_A}` };
const asB = { Authorization: `Bearer ${SESSION_B}` };

const PENDING = '3a000000-0000-4000-8000-000000000001';
const PENDING_2 = '3a000000-0000-4000-8000-000000000002';
const CURATED = '3a000000-0000-4000-8000-000000000003';

function setup() {
  const { db, supabase } = createTwoUserSupabase();
  const captured = '2026-10-01T10:00:00.000Z';
  const base = { user_id: USER_A.id, definition: null, source: 'extension', source_url: null, is_active_srs: true,
    retention_state: 'learning', due_at: captured, created_at: captured };
  db.rows('vocabulary').push(
    { ...base, id: PENDING, word: 'bite the bullet', context_sentence: 'They had to bite the bullet.', translation: null, type: 'idiom_slang', status: 'pending_curation' },
    { ...base, id: PENDING_2, word: 'serendipity', context_sentence: null, translation: null, type: 'word', status: 'pending_curation' },
    { ...base, id: CURATED, word: 'give up', context_sentence: null, translation: 'rendirse', type: 'phrasal_verb', status: 'learning' },
  );
  return { db, app: createApp({ supabase }) };
}

const row = (db: ReturnType<typeof setup>['db'], id: string) => db.rows('vocabulary').find((r) => r.id === id);

describe('PATCH /api/vocabulary/:id/curate', () => {
  it('guarda traducción, definición y tipo, y pasa a learning', async () => {
    const { app } = setup();
    const res = await request(app)
      .patch(`/api/vocabulary/${PENDING}/curate`)
      .set(asA)
      .send({ translation: 'afrontar algo difícil', definition: 'to accept something unpleasant', type: 'idiom_slang' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      translation: 'afrontar algo difícil',
      definition: 'to accept something unpleasant',
      type: 'idiom_slang',
      status: 'learning',
      retention_state: 'learning',
      is_active_srs: true,
    });
  });

  it('activa en SRS queda vencida ahora (entra en la cola de hoy)', async () => {
    const { app, db } = setup();
    const before = Date.now();
    await request(app).patch(`/api/vocabulary/${PENDING}/curate`).set(asA).send({ translation: 'afrontar', type: 'idiom_slang' });

    const dueAt = Date.parse(String(row(db, PENDING)?.due_at));
    expect(dueAt).toBeGreaterThanOrEqual(before - 1000);
    expect(dueAt).toBeLessThanOrEqual(Date.now());
  });

  it('con el interruptor desactivado se guarda como archivo', async () => {
    const { app, db } = setup();
    const res = await request(app)
      .patch(`/api/vocabulary/${PENDING}/curate`)
      .set(asA)
      .send({ translation: 'afrontar', type: 'idiom_slang', is_active_srs: false });

    expect(res.body).toMatchObject({ status: 'learning', is_active_srs: false });
    expect(row(db, PENDING)?.is_active_srs).toBe(false);
  });

  it('permite corregir el tipo provisional, la palabra y el contexto al curar', async () => {
    const { app } = setup();
    const res = await request(app)
      .patch(`/api/vocabulary/${PENDING_2}/curate`)
      .set(asA)
      .send({ translation: 'casualidad afortunada', type: 'word', word: ' Serendipity ', context_sentence: 'What a serendipity!' });

    expect(res.body).toMatchObject({ word: 'Serendipity', context_sentence: 'What a serendipity!', type: 'word' });
  });

  it('sin traducción o sin tipo responde 400 y la palabra sigue pendiente', async () => {
    const { app, db } = setup();

    const noTranslation = await request(app).patch(`/api/vocabulary/${PENDING}/curate`).set(asA).send({ type: 'idiom_slang' });
    const blank = await request(app).patch(`/api/vocabulary/${PENDING}/curate`).set(asA).send({ translation: '  ', type: 'word' });
    const noType = await request(app).patch(`/api/vocabulary/${PENDING}/curate`).set(asA).send({ translation: 'afrontar' });

    expect([noTranslation.status, blank.status, noType.status]).toEqual([400, 400, 400]);
    expect(noTranslation.body.error.details[0].field).toBe('translation');
    expect(row(db, PENDING)?.status).toBe('pending_curation');
  });

  it('un tipo inválido responde 400', async () => {
    const { app } = setup();
    const res = await request(app).patch(`/api/vocabulary/${PENDING}/curate`).set(asA).send({ translation: 'x', type: 'slang' });

    expect(res.status).toBe(400);
  });

  it('curar una palabra ya curada responde 409 (doble Ctrl+Enter)', async () => {
    const { app } = setup();
    const first = await request(app).patch(`/api/vocabulary/${PENDING}/curate`).set(asA).send({ translation: 'afrontar', type: 'idiom_slang' });
    const second = await request(app).patch(`/api/vocabulary/${PENDING}/curate`).set(asA).send({ translation: 'otra', type: 'word' });
    const already = await request(app).patch(`/api/vocabulary/${CURATED}/curate`).set(asA).send({ translation: 'x', type: 'word' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('conflict');
    expect(already.status).toBe(409);
  });

  it('tras curar, desaparece del Inbox', async () => {
    const { app } = setup();
    await request(app).patch(`/api/vocabulary/${PENDING}/curate`).set(asA).send({ translation: 'afrontar', type: 'idiom_slang' });
    const inbox = await request(app).get('/api/vocabulary?status=pending_curation').set(asA);

    expect(inbox.body.items.map((i: { id: string }) => i.id)).toEqual([PENDING_2]);
  });

  it('B no puede curar palabras de A (404) y la palabra no cambia', async () => {
    const { app, db } = setup();
    const res = await request(app).patch(`/api/vocabulary/${PENDING}/curate`).set(asB).send({ translation: 'x', type: 'word' });

    expect(res.status).toBe(404);
    expect(row(db, PENDING)).toMatchObject({ status: 'pending_curation', user_id: USER_A.id });
    expect(row(db, PENDING)?.user_id).not.toBe(USER_B.id);
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).patch(`/api/vocabulary/${PENDING}/curate`).send({ translation: 'x', type: 'word' })).status).toBe(401);
  });
});
