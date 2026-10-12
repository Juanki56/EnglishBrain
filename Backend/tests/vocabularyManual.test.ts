import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTwoUserSupabase, SESSION_A, SESSION_B, USER_A, USER_B } from './helpers/fakeSupabase.js';

const asA = { Authorization: `Bearer ${SESSION_A}` };
const asB = { Authorization: `Bearer ${SESSION_B}` };

function setup() {
  const { db, supabase } = createTwoUserSupabase();
  return { db, app: createApp({ supabase }) };
}

const manual = {
  word: 'awkward',
  translation: 'incómodo',
  type: 'word',
  context_sentence: 'It was an awkward silence.',
  definition: 'causing embarrassment',
};

describe('POST /api/vocabulary (creación manual)', () => {
  it('crea la palabra en learning, con origen manual y activa en SRS por defecto', async () => {
    const { app, db } = setup();
    const res = await request(app).post('/api/vocabulary').set(asA).send(manual);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...manual, status: 'learning', source: 'manual', is_active_srs: true });
    expect(res.body.due_at).toEqual(expect.any(String));
    expect(db.rows('vocabulary')[0]?.user_id).toBe(USER_A.id);
  });

  it('contexto y definición son opcionales', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/vocabulary').set(asA).send({ word: 'give up', translation: 'rendirse', type: 'phrasal_verb' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ context_sentence: null, definition: null });
  });

  it('con el interruptor desactivado se guarda como archivo, sin fecha de repaso', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/vocabulary').set(asA).send({ ...manual, is_active_srs: false });

    expect(res.body).toMatchObject({ is_active_srs: false, due_at: null });
  });

  it('aparece en el historial reciente (source=manual)', async () => {
    const { app } = setup();
    await request(app).post('/api/vocabulary').set(asA).send(manual);
    const recent = await request(app).get('/api/vocabulary?source=manual&limit=5').set(asA);

    expect(recent.body.items.map((i: { word: string }) => i.word)).toEqual(['awkward']);
  });

  it('ignora un user_id o status enviados por el cliente', async () => {
    const { app, db } = setup();
    await request(app).post('/api/vocabulary').set(asA).send({ ...manual, user_id: USER_B.id, status: 'mastered' });

    expect(db.rows('vocabulary')[0]).toMatchObject({ user_id: USER_A.id, status: 'learning' });
  });

  it('sin palabra, traducción o tipo responde 400 indicando los campos', async () => {
    const { app, db } = setup();
    const res = await request(app).post('/api/vocabulary').set(asA).send({ context_sentence: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['translation', 'type', 'word']);
    expect(db.rows('vocabulary')).toHaveLength(0);
  });

  it('un contexto escrito a mano de más de 2000 caracteres responde 400', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/vocabulary').set(asA).send({ ...manual, context_sentence: 'x'.repeat(2001) });

    expect(res.status).toBe(400);
  });

  it('lo creado por A no aparece para B', async () => {
    const { app } = setup();
    await request(app).post('/api/vocabulary').set(asA).send(manual);

    expect((await request(app).get('/api/vocabulary').set(asB)).body.total).toBe(0);
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).post('/api/vocabulary').send(manual)).status).toBe(401);
  });
});

describe('Descartar una captura del Inbox', () => {
  it('DELETE elimina la captura pendiente y desaparece del Inbox', async () => {
    const { app, db } = setup();
    db.rows('vocabulary').push({
      id: '4a000000-0000-4000-8000-000000000001', user_id: USER_A.id, word: 'typo capturado', type: 'word',
      status: 'pending_curation', source: 'extension', created_at: '2026-10-01T10:00:00Z',
    });
    const res = await request(app).delete('/api/vocabulary/4a000000-0000-4000-8000-000000000001').set(asA);
    const inbox = await request(app).get('/api/vocabulary?status=pending_curation').set(asA);

    expect(res.status).toBe(204);
    expect(inbox.body.total).toBe(0);
  });
});
