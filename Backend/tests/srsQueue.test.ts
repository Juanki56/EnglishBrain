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

type Card = { item_type: string; item_id: string; front: Record<string, unknown>; back: Record<string, unknown>; retention_state: string };
const ids = (body: { items: Card[] }) => body.items.map((card) => card.item_id);

describe('GET /api/srs/queue', () => {
  it('devuelve las 6 tarjetas vencidas de los cinco tipos, de la más atrasada a la más reciente', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/srs/queue').set(asA);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(6);
    expect(ids(res.body)).toEqual([CARD.vocabOld, CARD.error, CARD.speaking, CARD.writing, CARD.listening, CARD.vocabNew]);
  });

  it('excluye lo que vence en el futuro, lo archivado y lo pendiente de curación', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/srs/queue').set(asA);

    expect(ids(res.body)).not.toContain(CARD.vocabFuture);
    expect(ids(res.body)).not.toContain(CARD.vocabArchived);
    expect(ids(res.body)).not.toContain(CARD.vocabPending);
    expect(ids(res.body)).not.toContain(CARD.neverScheduled);
  });

  it('cada tarjeta trae su anverso y reverso según su tipo', async () => {
    const { app } = setup();
    const { body } = await request(app).get('/api/srs/queue').set(asA);
    const byType = Object.fromEntries((body.items as Card[]).map((card) => [card.item_id, card]));

    expect(byType[CARD.vocabOld]).toMatchObject({
      item_type: 'vocabulary',
      retention_state: 'reviewing',
      front: { word: 'bite the bullet', context_sentence: 'They had to bite the bullet.' },
      back: { translation: 'afrontar', definition: 'to face something hard', type: 'idiom_slang' },
    });
    expect(byType[CARD.error]).toMatchObject({
      front: { incorrect_phrase: 'I have a doubt' },
      back: { correct_phrase: 'I have a question', notes: 'No traducir' },
    });
    expect(byType[CARD.speaking]).toMatchObject({ front: { title: 'Resumen de mi día', duration_seconds: 312 }, back: {} });
    expect(byType[CARD.writing]).toMatchObject({ front: { title: 'Email a cliente' }, back: { content: 'Corregida', version_number: 2 } });
    expect(byType[CARD.listening]).toMatchObject({
      front: { title: 'BBC 6 Minute English', open_url: 'https://www.youtube.com/watch?v=abc&t=92' },
      back: { transcription: "I reckon that's a stretch" },
    });
  });

  it('no expone rutas internas ni datos del algoritmo', async () => {
    const { app } = setup();
    const { body } = await request(app).get('/api/srs/queue').set(asA);
    const json = JSON.stringify(body);

    expect(json).not.toContain('storage_path');
    expect(json).not.toContain('"ease"');
  });

  it('pagina con limit y offset manteniendo el total', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/srs/queue?limit=2&offset=1').set(asA);

    expect(res.body.total).toBe(6);
    expect(ids(res.body)).toEqual([CARD.error, CARD.speaking]);
  });

  it('B solo ve su propia cola', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/srs/queue').set(asB);

    expect(res.body.total).toBe(1);
    expect(ids(res.body)).toEqual([CARD.vocabOfB]);
  });

  it('una cola vacía responde items vacíos y total 0', async () => {
    const { supabase } = createTwoUserSupabase();
    const res = await request(createApp({ supabase })).get('/api/srs/queue').set(asA);

    expect(res.body).toEqual({ items: [], total: 0 });
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).get('/api/srs/queue')).status).toBe(401);
  });
});
