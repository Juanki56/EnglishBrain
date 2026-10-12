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

async function createEntry(app: ReturnType<typeof createApp>, auth = asA, title = 'Email a cliente') {
  const res = await request(app).post('/api/writing').set(auth).send({ title, content: 'Dear client, I write you for...' });
  return res.body as { id: string; versions: Array<{ version_number: number; content: string }> };
}

describe('POST /api/writing', () => {
  it('crea la entrada con su versión 1 igual al texto escrito', async () => {
    const { app, db } = setup();
    const res = await request(app).post('/api/writing').set(asA).send({ title: 'Email a cliente', content: 'Dear client, I write you for...' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Email a cliente', is_active_srs: true });
    expect(res.body.due_at).toEqual(expect.any(String));
    expect(res.body.versions).toEqual([
      { id: expect.any(String), version_number: 1, content: 'Dear client, I write you for...', created_at: expect.any(String) },
    ]);
    expect(db.rows('writing_logs')[0]?.user_id).toBe(USER_A.id);
    expect(db.rows('writing_versions')[0]?.user_id).toBe(USER_A.id);
  });

  it('se puede guardar como archivo, sin fecha de repaso', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/writing').set(asA).send({ title: 'Diario', content: 'Today…', is_active_srs: false });

    expect(res.body).toMatchObject({ is_active_srs: false, due_at: null });
  });

  it('sin título o sin texto responde 400 y no crea nada', async () => {
    const { app, db } = setup();
    const res = await request(app).post('/api/writing').set(asA).send({ title: 'Sin texto', content: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'content', message: 'El texto es obligatorio' }]);
    expect((await request(app).post('/api/writing').set(asA).send({ content: 'x' })).body.error.details[0].field).toBe('title');
    expect(db.rows('writing_logs')).toHaveLength(0);
  });

  it('acepta textos largos (ensayos) y rechaza más de 50.000 caracteres', async () => {
    const { app } = setup();

    expect((await request(app).post('/api/writing').set(asA).send({ title: 'Ensayo', content: 'x'.repeat(20_000) })).status).toBe(201);
    expect((await request(app).post('/api/writing').set(asA).send({ title: 'Enorme', content: 'x'.repeat(50_001) })).status).toBe(400);
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).post('/api/writing').send({ title: 'a', content: 'b' })).status).toBe(401);
  });
});

describe('POST /api/writing/:id/versions', () => {
  it('añade versiones numeradas 2, 3… sin tocar las anteriores', async () => {
    const { app } = setup();
    const entry = await createEntry(app);
    const v2 = await request(app).post(`/api/writing/${entry.id}/versions`).set(asA).send({ content: 'Dear client, I am writing to...' });
    const v3 = await request(app).post(`/api/writing/${entry.id}/versions`).set(asA).send({ content: 'Dear Ms. Smith, I am writing to...' });
    const detail = await request(app).get(`/api/writing/${entry.id}`).set(asA);

    expect(v2.status).toBe(201);
    expect(v2.body.version_number).toBe(2);
    expect(v3.body.version_number).toBe(3);
    expect(detail.body.versions.map((v: { version_number: number }) => v.version_number)).toEqual([1, 2, 3]);
    expect(detail.body.versions[0].content).toBe('Dear client, I write you for...');
  });

  it('un texto vacío responde 400', async () => {
    const { app } = setup();
    const entry = await createEntry(app);

    expect((await request(app).post(`/api/writing/${entry.id}/versions`).set(asA).send({ content: '' })).status).toBe(400);
  });

  it('B no puede añadir versiones a una entrada de A (404)', async () => {
    const { app, db } = setup();
    const entry = await createEntry(app);
    const res = await request(app).post(`/api/writing/${entry.id}/versions`).set(asB).send({ content: 'intruso' });

    expect(res.status).toBe(404);
    expect(db.rows('writing_versions')).toHaveLength(1);
  });
});

describe('GET /api/writing', () => {
  it('lista entradas propias con número de versiones, última versión y extracto', async () => {
    const { app } = setup();
    const entry = await createEntry(app);
    await request(app).post(`/api/writing/${entry.id}/versions`).set(asA).send({ content: `Versión corregida ${'y'.repeat(300)}` });
    const res = await request(app).get('/api/writing').set(asA);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({ id: entry.id, version_count: 2, latest_version_number: 2 });
    expect(res.body.items[0].excerpt).toHaveLength(200);
    expect(res.body.items[0].excerpt.startsWith('Versión corregida')).toBe(true);
    expect(res.body.items[0]).not.toHaveProperty('versions');
  });

  it('busca por título y B no ve las entradas de A', async () => {
    const { app } = setup();
    await createEntry(app, asA, 'Email a cliente');
    await createEntry(app, asA, 'Ensayo sobre IA');
    await createEntry(app, asB, 'Diario de B');

    const search = await request(app).get('/api/writing?q=ensayo').set(asA);
    const listB = await request(app).get('/api/writing').set(asB);
    expect(search.body.items.map((i: { title: string }) => i.title)).toEqual(['Ensayo sobre IA']);
    expect(listB.body.items.map((i: { title: string }) => i.title)).toEqual(['Diario de B']);
  });

  it('una lista vacía responde items vacíos', async () => {
    const { app } = setup();

    expect((await request(app).get('/api/writing').set(asA)).body).toEqual({ items: [], total: 0 });
  });
});

describe('GET / PATCH / DELETE /api/writing/:id', () => {
  it('B no puede ver una entrada de A (404)', async () => {
    const { app } = setup();
    const entry = await createEntry(app);

    expect((await request(app).get(`/api/writing/${entry.id}`).set(asB)).status).toBe(404);
  });

  it('PATCH cambia solo el título; un content enviado se ignora', async () => {
    const { app } = setup();
    const entry = await createEntry(app);
    const res = await request(app).patch(`/api/writing/${entry.id}`).set(asA).send({ title: 'Email al Sr. Smith', content: 'hack' });
    const detail = await request(app).get(`/api/writing/${entry.id}`).set(asA);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Email al Sr. Smith');
    expect(detail.body.versions[0].content).toBe('Dear client, I write you for...');
  });

  it('PATCH sin título responde 400; de otro usuario, 404', async () => {
    const { app } = setup();
    const entry = await createEntry(app);

    expect((await request(app).patch(`/api/writing/${entry.id}`).set(asA).send({})).status).toBe(400);
    expect((await request(app).patch(`/api/writing/${entry.id}`).set(asB).send({ title: 'x' })).status).toBe(404);
  });

  it('DELETE borra la entrada con todas sus versiones', async () => {
    const { app, db } = setup();
    const entry = await createEntry(app);
    await request(app).post(`/api/writing/${entry.id}/versions`).set(asA).send({ content: 'v2' });
    const res = await request(app).delete(`/api/writing/${entry.id}`).set(asA);

    expect(res.status).toBe(204);
    expect(db.rows('writing_logs')).toHaveLength(0);
    expect(db.rows('writing_versions')).toHaveLength(0);
  });

  it('B no puede borrar una entrada de A (404)', async () => {
    const { app, db } = setup();
    const entry = await createEntry(app);

    expect((await request(app).delete(`/api/writing/${entry.id}`).set(asB)).status).toBe(404);
    expect(db.rows('writing_logs')).toHaveLength(1);
    expect(db.rows('writing_logs')[0]?.user_id).not.toBe(USER_B.id);
  });

  it('no existe ninguna ruta para borrar o editar versiones sueltas', async () => {
    const { app } = setup();
    const entry = await createEntry(app);
    const versionId = entry.versions[0]?.version_number;

    expect((await request(app).delete(`/api/writing/${entry.id}/versions/${versionId}`).set(asA)).status).toBe(404);
    expect((await request(app).patch(`/api/writing/${entry.id}/versions/${versionId}`).set(asA).send({ content: 'x' })).status).toBe(404);
  });
});
