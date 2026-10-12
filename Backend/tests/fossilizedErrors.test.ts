import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTwoUserSupabase, SESSION_A, SESSION_B, USER_A, USER_B } from './helpers/fakeSupabase.js';

const asA = { Authorization: `Bearer ${SESSION_A}` };
const asB = { Authorization: `Bearer ${SESSION_B}` };

const ID = {
  active: '6a000000-0000-4000-8000-000000000001',
  resolved: '6a000000-0000-4000-8000-000000000002',
  ofB: '6b000000-0000-4000-8000-000000000001',
};

function setup() {
  const { db, supabase } = createTwoUserSupabase();
  const base = { notes: null, is_active_srs: true, due_at: null, retention_state: 'learning', updated_at: 'x' };
  db.rows('fossilized_errors').push(
    { ...base, id: ID.active, user_id: USER_A.id, incorrect_phrase: 'I have a doubt', correct_phrase: 'I have a question',
      notes: 'Dejar de traducir "tener una duda"', is_resolved: false, resolved_at: null, created_at: '2026-10-01T10:00:00Z' },
    { ...base, id: ID.resolved, user_id: USER_A.id, incorrect_phrase: 'People is', correct_phrase: 'People are',
      is_resolved: true, resolved_at: '2026-10-05T10:00:00Z', created_at: '2026-10-02T10:00:00Z' },
    { ...base, id: ID.ofB, user_id: USER_B.id, incorrect_phrase: 'secret of B', correct_phrase: 'x',
      is_resolved: false, resolved_at: null, created_at: '2026-10-03T10:00:00Z' },
  );
  return { db, app: createApp({ supabase }) };
}

const phrases = (body: { items: Array<{ incorrect_phrase: string }> }) => body.items.map((i) => i.incorrect_phrase);
const row = (db: ReturnType<typeof setup>['db'], id: string) => db.rows('fossilized_errors').find((r) => r.id === id);

describe('POST /api/errors', () => {
  it('registra un error activo con sus dos frases y la nota', async () => {
    const { app, db } = setup();
    const res = await request(app).post('/api/errors').set(asA).send({
      incorrect_phrase: '  I am agree ',
      correct_phrase: 'I agree',
      notes: 'agree ya es un verbo',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      incorrect_phrase: 'I am agree',
      correct_phrase: 'I agree',
      notes: 'agree ya es un verbo',
      is_resolved: false,
      resolved_at: null,
      is_active_srs: true,
    });
    expect(res.body.due_at).toEqual(expect.any(String));
    expect(row(db, res.body.id)?.user_id).toBe(USER_A.id);
  });

  it('la nota es opcional y el interruptor de Anki se puede desactivar', async () => {
    const { app } = setup();
    const res = await request(app)
      .post('/api/errors')
      .set(asA)
      .send({ incorrect_phrase: 'a', correct_phrase: 'b', is_active_srs: false });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ notes: null, is_active_srs: false, due_at: null });
  });

  it('sin alguna de las dos frases responde 400 indicando cuál', async () => {
    const { app, db } = setup();
    const before = db.rows('fossilized_errors').length;
    const res = await request(app).post('/api/errors').set(asA).send({ incorrect_phrase: 'I have a doubt' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'correct_phrase', message: 'La frase correcta es obligatoria' }]);
    expect(db.rows('fossilized_errors')).toHaveLength(before);
  });

  it('frases de más de 500 caracteres o nota de más de 2000 responden 400', async () => {
    const { app } = setup();

    expect((await request(app).post('/api/errors').set(asA).send({ incorrect_phrase: 'x'.repeat(501), correct_phrase: 'b' })).status).toBe(400);
    expect((await request(app).post('/api/errors').set(asA).send({ incorrect_phrase: 'a', correct_phrase: 'b', notes: 'x'.repeat(2001) })).status).toBe(400);
  });

  it('ignora un user_id o is_resolved enviados al crear', async () => {
    const { app, db } = setup();
    const res = await request(app)
      .post('/api/errors')
      .set(asA)
      .send({ incorrect_phrase: 'a', correct_phrase: 'b', user_id: USER_B.id, is_resolved: true });

    expect(row(db, res.body.id)).toMatchObject({ user_id: USER_A.id, is_resolved: false });
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).post('/api/errors').send({ incorrect_phrase: 'a', correct_phrase: 'b' })).status).toBe(401);
  });
});

describe('GET /api/errors', () => {
  it('lista solo los errores propios, del más reciente al más antiguo', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/errors').set(asA);

    expect(res.body.total).toBe(2);
    expect(phrases(res.body)).toEqual(['People is', 'I have a doubt']);
  });

  it('filtra activos y superados', async () => {
    const { app } = setup();

    expect(phrases((await request(app).get('/api/errors?status=active').set(asA)).body)).toEqual(['I have a doubt']);
    expect(phrases((await request(app).get('/api/errors?status=resolved').set(asA)).body)).toEqual(['People is']);
  });

  it('busca en las frases y en la nota', async () => {
    const { app } = setup();

    expect(phrases((await request(app).get('/api/errors?q=QUESTION').set(asA)).body)).toEqual(['I have a doubt']);
    expect(phrases((await request(app).get('/api/errors?q=duda').set(asA)).body)).toEqual(['I have a doubt']);
  });

  it('B no ve los errores de A', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/errors').set(asB);

    expect(phrases(res.body)).toEqual(['secret of B']);
  });

  it('un filtro inválido responde 400', async () => {
    const { app } = setup();

    expect((await request(app).get('/api/errors?status=todos').set(asA)).status).toBe(400);
  });
});

describe('GET /api/errors/:id', () => {
  it('devuelve un error propio y 404 si es de otro usuario', async () => {
    const { app } = setup();

    expect((await request(app).get(`/api/errors/${ID.active}`).set(asA)).body.correct_phrase).toBe('I have a question');
    expect((await request(app).get(`/api/errors/${ID.ofB}`).set(asA)).status).toBe(404);
  });
});

describe('PATCH /api/errors/:id', () => {
  it('marcar como superado guarda la fecha de superación', async () => {
    const { app } = setup();
    const res = await request(app).patch(`/api/errors/${ID.active}`).set(asA).send({ is_resolved: true });

    expect(res.status).toBe(200);
    expect(res.body.is_resolved).toBe(true);
    expect(res.body.resolved_at).toEqual(expect.any(String));
  });

  it('marcar como superado no lo saca de Anki', async () => {
    const { app } = setup();
    const res = await request(app).patch(`/api/errors/${ID.active}`).set(asA).send({ is_resolved: true });

    expect(res.body.is_active_srs).toBe(true);
  });

  it('volver a marcar un error ya superado conserva la fecha original', async () => {
    const { app } = setup();
    const res = await request(app).patch(`/api/errors/${ID.resolved}`).set(asA).send({ is_resolved: true });

    expect(res.body.resolved_at).toBe('2026-10-05T10:00:00Z');
  });

  it('desmarcarlo lo vuelve activo y borra la fecha', async () => {
    const { app } = setup();
    const res = await request(app).patch(`/api/errors/${ID.resolved}`).set(asA).send({ is_resolved: false });

    expect(res.body).toMatchObject({ is_resolved: false, resolved_at: null });
  });

  it('edita frases y nota; vaciar la nota la deja en null', async () => {
    const { app } = setup();
    const res = await request(app)
      .patch(`/api/errors/${ID.active}`)
      .set(asA)
      .send({ correct_phrase: 'I have a question about…', notes: '' });

    expect(res.body).toMatchObject({ correct_phrase: 'I have a question about…', notes: null });
  });

  it('vaciar una frase obligatoria o enviar un body vacío responde 400', async () => {
    const { app } = setup();

    expect((await request(app).patch(`/api/errors/${ID.active}`).set(asA).send({ correct_phrase: ' ' })).status).toBe(400);
    expect((await request(app).patch(`/api/errors/${ID.active}`).set(asA).send({})).status).toBe(400);
    expect((await request(app).patch(`/api/errors/${ID.active}`).set(asA).send({ is_resolved: 'si' })).status).toBe(400);
  });

  it('B no puede editar ni marcar como superado un error de A (404)', async () => {
    const { app, db } = setup();
    const res = await request(app).patch(`/api/errors/${ID.active}`).set(asB).send({ is_resolved: true });

    expect(res.status).toBe(404);
    expect(row(db, ID.active)?.is_resolved).toBe(false);
  });
});

describe('DELETE /api/errors/:id', () => {
  it('borra un error propio (204) y 404 si es de otro usuario', async () => {
    const { app, db } = setup();

    expect((await request(app).delete(`/api/errors/${ID.ofB}`).set(asA)).status).toBe(404);
    expect((await request(app).delete(`/api/errors/${ID.active}`).set(asA)).status).toBe(204);
    expect(row(db, ID.active)).toBeUndefined();
    expect(row(db, ID.ofB)).toBeDefined();
  });
});
