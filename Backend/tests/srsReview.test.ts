import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTwoUserSupabase, SESSION_A, SESSION_B, USER_A, USER_B } from './helpers/fakeSupabase.js';
import { CARD, seedCards } from './helpers/srsFixtures.js';

const asA = { Authorization: `Bearer ${SESSION_A}` };
const asB = { Authorization: `Bearer ${SESSION_B}` };
const DAY = 86_400_000;

function setup() {
  const { db, supabase } = createTwoUserSupabase();
  seedCards(db);
  return { db, app: createApp({ supabase }) };
}

const review = (app: ReturnType<typeof createApp>, body: object, auth = asA) =>
  request(app).post('/api/srs/review').set(auth).send(body);

describe('POST /api/srs/review', () => {
  it('"Bien" reprograma la tarjeta según el algoritmo y responde el resultado', async () => {
    const { app, db } = setup();
    const before = Date.now();
    const res = await review(app, { item_type: 'vocabulary', item_id: CARD.vocabOld, grade: 3 });

    // interval 8, ease 2.5, 3 repeticiones ⇒ 20 días, reviewing
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ item_type: 'vocabulary', item_id: CARD.vocabOld, grade: 3, interval_days: 20, retention_state: 'reviewing', repetitions: 4 });
    const due = Date.parse(res.body.due_at);
    expect(due - before).toBeGreaterThanOrEqual(20 * DAY - 1000);
    expect(db.rows('vocabulary').find((r) => r.id === CARD.vocabOld)).toMatchObject({
      interval_days: 20, repetitions: 4, status: 'reviewing', retention_state: 'reviewing', due_at: res.body.due_at,
    });
  });

  it('anota el repaso en el historial con la nota y los intervalos', async () => {
    const { app, db } = setup();
    await review(app, { item_type: 'vocabulary', item_id: CARD.vocabOld, grade: 3 });

    expect(db.rows('review_events')).toEqual([
      expect.objectContaining({ user_id: USER_A.id, item_type: 'vocabulary', item_id: CARD.vocabOld, grade: 3, interval_before: 8, interval_after: 20 }),
    ]);
  });

  it('"Otra vez" devuelve la tarjeta en 10 minutos y la palabra pasa a learning', async () => {
    const { app, db } = setup();
    const res = await review(app, { item_type: 'vocabulary', item_id: CARD.vocabOld, grade: 1 });

    expect(res.body).toMatchObject({ interval_days: 0, retention_state: 'learning', lapses: 1 });
    expect(Date.parse(res.body.due_at) - Date.now()).toBeLessThanOrEqual(10 * 60_000);
    expect(db.rows('vocabulary').find((r) => r.id === CARD.vocabOld)?.status).toBe('learning');
  });

  it('una tarjeta calificada sale de la cola de hoy', async () => {
    const { app } = setup();
    await review(app, { item_type: 'listening', item_id: CARD.listening, grade: 4 });
    const queue = await request(app).get('/api/srs/queue').set(asA);

    expect(queue.body.total).toBe(5);
    expect(queue.body.items.map((c: { item_id: string }) => c.item_id)).not.toContain(CARD.listening);
  });

  it('funciona con los cinco tipos de tarjeta', async () => {
    const { app, db } = setup();
    const cards = [
      ['vocabulary', CARD.vocabNew], ['fossilized_error', CARD.error], ['speaking', CARD.speaking],
      ['writing', CARD.writing], ['listening', CARD.listening],
    ];
    for (const [item_type, item_id] of cards) {
      const res = await review(app, { item_type, item_id, grade: 3 });
      expect(res.status, item_type).toBe(200);
      expect(res.body.interval_days).toBe(2);
    }
    expect(db.rows('review_events')).toHaveLength(5);
  });

  it('solo en vocabulario cambia el status; en los demás tipos no existe', async () => {
    const { app, db } = setup();
    await review(app, { item_type: 'fossilized_error', item_id: CARD.error, grade: 3 });

    expect(db.rows('fossilized_errors')[0]).not.toHaveProperty('status');
  });

  it('una tarjeta archivada no se puede repasar (409) y no se anota nada', async () => {
    const { app, db } = setup();
    const res = await review(app, { item_type: 'vocabulary', item_id: CARD.vocabArchived, grade: 3 });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/archivada/);
    expect(db.rows('review_events')).toHaveLength(0);
  });

  it('una palabra del Inbox sin curar no se puede repasar (409)', async () => {
    const { app } = setup();
    const res = await review(app, { item_type: 'vocabulary', item_id: CARD.vocabPending, grade: 3 });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Inbox/);
  });

  it('B no puede calificar tarjetas de A (404) y la tarjeta no cambia', async () => {
    const { app, db } = setup();
    const res = await review(app, { item_type: 'vocabulary', item_id: CARD.vocabOld, grade: 4 }, asB);

    expect(res.status).toBe(404);
    expect(db.rows('vocabulary').find((r) => r.id === CARD.vocabOld)).toMatchObject({ interval_days: 8, user_id: USER_A.id });
    expect(db.rows('review_events').some((e) => e.user_id === USER_B.id)).toBe(false);
  });

  it('un tipo que no corresponde con la tarjeta responde 404', async () => {
    const { app } = setup();

    expect((await review(app, { item_type: 'writing', item_id: CARD.vocabOld, grade: 3 })).status).toBe(404);
  });

  it('nota fuera de 1–4, tipo inválido o id mal formado responden 400', async () => {
    const { app } = setup();

    for (const body of [
      { item_type: 'vocabulary', item_id: CARD.vocabOld, grade: 5 },
      { item_type: 'vocabulary', item_id: CARD.vocabOld, grade: 2.5 },
      { item_type: 'vocabulary', item_id: CARD.vocabOld },
      { item_type: 'palabra', item_id: CARD.vocabOld, grade: 3 },
      { item_type: 'vocabulary', item_id: 'abc', grade: 3 },
    ]) {
      expect((await review(app, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).post('/api/srs/review').send({ item_type: 'vocabulary', item_id: CARD.vocabOld, grade: 3 })).status).toBe(401);
  });
});
