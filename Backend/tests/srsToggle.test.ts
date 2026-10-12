import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTwoUserSupabase, SESSION_A, SESSION_B } from './helpers/fakeSupabase.js';
import { CARD, seedCards } from './helpers/srsFixtures.js';

const asA = { Authorization: `Bearer ${SESSION_A}` };
const asB = { Authorization: `Bearer ${SESSION_B}` };

function setup() {
  const { db, supabase } = createTwoUserSupabase();
  seedCards(db);
  return { db, app: createApp({ supabase }) };
}

const toggle = (app: ReturnType<typeof createApp>, type: string, id: string, body: object, auth = asA) =>
  request(app).patch(`/api/items/${type}/${id}/srs-toggle`).set(auth).send(body);

const queueIds = async (app: ReturnType<typeof createApp>) =>
  (await request(app).get('/api/srs/queue').set(asA)).body.items.map((c: { item_id: string }) => c.item_id);

describe('PATCH /api/items/:type/:id/srs-toggle', () => {
  it('archivar saca la tarjeta de la cola al instante y conserva su historial', async () => {
    const { app, db } = setup();
    const res = await toggle(app, 'vocabulary', CARD.vocabOld, { is_active_srs: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: CARD.vocabOld, is_active_srs: false });
    expect(await queueIds(app)).not.toContain(CARD.vocabOld);
    expect(db.rows('vocabulary').find((r) => r.id === CARD.vocabOld)).toMatchObject({ interval_days: 8, repetitions: 3, retention_state: 'reviewing' });
  });

  it('reactivar algo archivado con fecha pasada lo devuelve a la cola donde lo dejó', async () => {
    const { app } = setup();
    const res = await toggle(app, 'vocabulary', CARD.vocabArchived, { is_active_srs: true });

    expect(res.body.is_active_srs).toBe(true);
    expect(await queueIds(app)).toContain(CARD.vocabArchived);
  });

  it('reactivar algo que nunca tuvo fecha lo deja vencido hoy', async () => {
    const { app } = setup();
    const res = await toggle(app, 'vocabulary', CARD.neverScheduled, { is_active_srs: true });

    expect(res.body.due_at).toEqual(expect.any(String));
    expect(Date.parse(res.body.due_at)).toBeLessThanOrEqual(Date.now());
    expect(await queueIds(app)).toContain(CARD.neverScheduled);
  });

  it('funciona con los cinco tipos usando sus nombres de URL', async () => {
    const { app } = setup();
    for (const [type, id] of [
      ['vocabulary', CARD.vocabNew], ['errors', CARD.error], ['speaking', CARD.speaking], ['writing', CARD.writing], ['listening', CARD.listening],
    ]) {
      expect((await toggle(app, type!, id!, { is_active_srs: false })).status, type).toBe(200);
    }
    expect(await queueIds(app)).toEqual([CARD.vocabOld]);
  });

  it('un tipo de URL desconocido responde 404', async () => {
    const { app } = setup();
    const res = await toggle(app, 'fossilized_error', CARD.error, { is_active_srs: false });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/Tipo de registro no válido/);
  });

  it('sin is_active_srs o con un valor que no es true/false responde 400', async () => {
    const { app } = setup();

    expect((await toggle(app, 'vocabulary', CARD.vocabOld, {})).status).toBe(400);
    expect((await toggle(app, 'vocabulary', CARD.vocabOld, { is_active_srs: 'no' })).status).toBe(400);
  });

  it('B no puede archivar registros de A (404) y la tarjeta sigue en la cola de A', async () => {
    const { app } = setup();
    const res = await toggle(app, 'vocabulary', CARD.vocabOld, { is_active_srs: false }, asB);

    expect(res.status).toBe(404);
    expect(await queueIds(app)).toContain(CARD.vocabOld);
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).patch(`/api/items/vocabulary/${CARD.vocabOld}/srs-toggle`).send({ is_active_srs: false })).status).toBe(401);
  });
});
