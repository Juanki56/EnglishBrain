import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { buildOpenUrl } from '../src/services/listening.service.js';
import { createTwoUserSupabase, SESSION_A, SESSION_B, USER_A, USER_B } from './helpers/fakeSupabase.js';

const asA = { Authorization: `Bearer ${SESSION_A}` };
const asB = { Authorization: `Bearer ${SESSION_B}` };

const challenge = {
  title: 'Podcast BBC 6 Minute English',
  url: 'https://www.youtube.com/watch?v=abc123',
  start_seconds: 92,
  transcription: "I reckon that's a bit of a stretch...",
};

function setup() {
  const { db, supabase } = createTwoUserSupabase();
  return { db, app: createApp({ supabase }) };
}

describe('buildOpenUrl', () => {
  it('en YouTube añade el segundo de inicio', () => {
    expect(buildOpenUrl('https://www.youtube.com/watch?v=abc123', 92)).toBe('https://www.youtube.com/watch?v=abc123&t=92');
    expect(buildOpenUrl('https://youtu.be/abc123', 92)).toBe('https://youtu.be/abc123?t=92');
    expect(buildOpenUrl('https://m.youtube.com/watch?v=abc123&t=10', 92)).toBe('https://m.youtube.com/watch?v=abc123&t=92');
  });

  it('fuera de YouTube o sin inicio devuelve la URL original', () => {
    expect(buildOpenUrl('https://open.spotify.com/episode/x', 92)).toBe('https://open.spotify.com/episode/x');
    expect(buildOpenUrl('https://www.youtube.com/watch?v=abc123', null)).toBe('https://www.youtube.com/watch?v=abc123');
    expect(buildOpenUrl('https://www.youtube.com/watch?v=abc123', 0)).toBe('https://www.youtube.com/watch?v=abc123');
  });

  it('un dominio que solo imita a YouTube no recibe el parámetro', () => {
    expect(buildOpenUrl('https://youtube.com.evil.example/watch', 92)).toBe('https://youtube.com.evil.example/watch');
  });
});

describe('POST /api/listening', () => {
  it('registra el reto con su enlace listo para abrir en el segundo exacto', async () => {
    const { app, db } = setup();
    const res = await request(app).post('/api/listening').set(asA).send(challenge);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...challenge, is_active_srs: true, open_url: 'https://www.youtube.com/watch?v=abc123&t=92' });
    expect(res.body.due_at).toEqual(expect.any(String));
    expect(db.rows('listening_logs')[0]?.user_id).toBe(USER_A.id);
  });

  it('el inicio es opcional', async () => {
    const { app } = setup();
    const { start_seconds: _omit, ...withoutStart } = challenge;
    const res = await request(app).post('/api/listening').set(asA).send(withoutStart);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ start_seconds: null, open_url: challenge.url });
  });

  it('sin título, URL o transcripción responde 400 indicando los campos', async () => {
    const { app, db } = setup();
    const res = await request(app).post('/api/listening').set(asA).send({});

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['title', 'transcription', 'url']);
    expect(db.rows('listening_logs')).toHaveLength(0);
  });

  it('una URL que no es http/https responde 400', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/listening').set(asA).send({ ...challenge, url: 'ftp://example.com/audio' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toEqual({ field: 'url', message: 'La URL debe empezar por http:// o https://' });
  });

  it('un inicio negativo, decimal o en texto responde 400', async () => {
    const { app } = setup();

    for (const start_seconds of [-5, 1.5, '1:32']) {
      expect((await request(app).post('/api/listening').set(asA).send({ ...challenge, start_seconds })).status).toBe(400);
    }
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).post('/api/listening').send(challenge)).status).toBe(401);
  });
});

describe('GET /api/listening', () => {
  it('lista los retos propios con open_url y busca en título y transcripción', async () => {
    const { app } = setup();
    await request(app).post('/api/listening').set(asA).send(challenge);
    await request(app).post('/api/listening').set(asA).send({ ...challenge, title: 'Serie Friends', transcription: 'How you doin?' });
    await request(app).post('/api/listening').set(asB).send({ ...challenge, title: 'Reto de B' });

    const all = await request(app).get('/api/listening').set(asA);
    const search = await request(app).get('/api/listening?q=reckon').set(asA);
    expect(all.body.total).toBe(2);
    expect(all.body.items[0]).toHaveProperty('open_url');
    expect(search.body.items.map((i: { title: string }) => i.title)).toEqual([challenge.title]);
    expect((await request(app).get('/api/listening').set(asB)).body.items.map((i: { title: string }) => i.title)).toEqual(['Reto de B']);
  });
});

describe('GET / PATCH / DELETE /api/listening/:id', () => {
  async function created(app: ReturnType<typeof createApp>) {
    return (await request(app).post('/api/listening').set(asA).send(challenge)).body as { id: string };
  }

  it('devuelve un reto propio y 404 si es de otro usuario', async () => {
    const { app } = setup();
    const { id } = await created(app);

    expect((await request(app).get(`/api/listening/${id}`).set(asA)).body.title).toBe(challenge.title);
    expect((await request(app).get(`/api/listening/${id}`).set(asB)).status).toBe(404);
  });

  it('PATCH edita campos y recalcula open_url; null quita el inicio', async () => {
    const { app } = setup();
    const { id } = await created(app);
    const moved = await request(app).patch(`/api/listening/${id}`).set(asA).send({ start_seconds: 30 });
    const cleared = await request(app).patch(`/api/listening/${id}`).set(asA).send({ start_seconds: null, transcription: 'Corregida' });

    expect(moved.body.open_url).toBe('https://www.youtube.com/watch?v=abc123&t=30');
    expect(cleared.body).toMatchObject({ start_seconds: null, transcription: 'Corregida', open_url: challenge.url });
  });

  it('PATCH no cambia el SRS ni el dueño', async () => {
    const { app, db } = setup();
    const { id } = await created(app);
    await request(app).patch(`/api/listening/${id}`).set(asA).send({ title: 'Nuevo', is_active_srs: false, user_id: USER_B.id });

    expect(db.rows('listening_logs')[0]).toMatchObject({ title: 'Nuevo', is_active_srs: true, user_id: USER_A.id });
  });

  it('PATCH con body vacío o URL inválida responde 400; de otro usuario, 404', async () => {
    const { app } = setup();
    const { id } = await created(app);

    expect((await request(app).patch(`/api/listening/${id}`).set(asA).send({})).status).toBe(400);
    expect((await request(app).patch(`/api/listening/${id}`).set(asA).send({ url: 'notaurl' })).status).toBe(400);
    expect((await request(app).patch(`/api/listening/${id}`).set(asB).send({ title: 'x' })).status).toBe(404);
  });

  it('DELETE borra un reto propio (204) y 404 si es de otro usuario', async () => {
    const { app, db } = setup();
    const { id } = await created(app);

    expect((await request(app).delete(`/api/listening/${id}`).set(asB)).status).toBe(404);
    expect((await request(app).delete(`/api/listening/${id}`).set(asA)).status).toBe(204);
    expect(db.rows('listening_logs')).toHaveLength(0);
  });
});
