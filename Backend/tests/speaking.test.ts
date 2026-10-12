import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { looksLikeMp3, SPEAKING_BUCKET, sizeMatchesDuration } from '../src/services/speaking.service.js';
import { makeMp3, makeMp3WithId3 } from './helpers/audio.js';
import { createTwoUserSupabase, SESSION_A, SESSION_B, USER_A, USER_B } from './helpers/fakeSupabase.js';

const asA = { Authorization: `Bearer ${SESSION_A}` };
const asB = { Authorization: `Bearer ${SESSION_B}` };

function setup() {
  const { db, supabase } = createTwoUserSupabase();
  return { db, app: createApp({ supabase }), files: db.bucket(SPEAKING_BUCKET) };
}

type App = ReturnType<typeof createApp>;

/** Sube un monólogo como lo haría el Frontend (multipart). */
function upload(app: App, auth: Record<string, string>, fields: Record<string, string>, audio: Buffer | null = makeMp3(5)) {
  const req = request(app).post('/api/speaking').set(auth);
  for (const [key, value] of Object.entries(fields)) req.field(key, value);
  if (audio) req.attach('audio', audio, { filename: 'monologo.mp3', contentType: 'audio/mpeg' });
  return req;
}

const okFields = { title: 'Resumen de mi día', duration_seconds: '5', recording_limit_minutes: '5' };

async function uploaded(app: App, auth = asA) {
  return (await upload(app, auth, okFields)).body as { id: string };
}

const silenceErrors = () => vi.spyOn(console, 'error').mockImplementation(() => {});

describe('looksLikeMp3 / sizeMatchesDuration', () => {
  it('reconoce MP3 por su cabecera de trama o etiqueta ID3', () => {
    expect(looksLikeMp3(makeMp3(1))).toBe(true);
    expect(looksLikeMp3(makeMp3WithId3(1))).toBe(true);
    expect(looksLikeMp3(Buffer.from('%PDF-1.7 documento'))).toBe(false);
    expect(looksLikeMp3(Buffer.from([0x49]))).toBe(false);
  });

  it('acepta tamaños coherentes con la duración y rechaza los absurdos', () => {
    expect(sizeMatchesDuration(makeMp3(300).length, 300)).toBe(true);
    expect(sizeMatchesDuration(4_800_000, 600)).toBe(true); // 10 min a 64 kbps
    expect(sizeMatchesDuration(14_000_000, 120)).toBe(false); // "2 minutos" con un archivo enorme
    expect(sizeMatchesDuration(1_000, 600)).toBe(false); // "10 minutos" casi vacío
  });
});

describe('POST /api/speaking (5.1)', () => {
  it('sube el audio a la carpeta del usuario y crea la ficha', async () => {
    const { app, db, files } = setup();
    const res = await upload(app, asA, okFields);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Resumen de mi día',
      duration_seconds: 5,
      recording_limit_minutes: 5,
      size_bytes: makeMp3(5).length,
      is_active_srs: true,
    });
    expect(res.body.due_at).toEqual(expect.any(String));
    expect(res.body).not.toHaveProperty('storage_path');

    const path = `${USER_A.id}/${res.body.id}.mp3`;
    expect(files.get(path)?.contentType).toBe('audio/mpeg');
    expect(db.rows('speaking_logs')[0]).toMatchObject({ user_id: USER_A.id, storage_path: path });
  });

  it('acepta MP3 con etiqueta ID3 y se puede guardar como archivo', async () => {
    const { app } = setup();
    const res = await upload(app, asA, { title: 'Archivo', duration_seconds: '3', is_active_srs: 'false' }, makeMp3WithId3(3));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ is_active_srs: false, due_at: null, recording_limit_minutes: null });
  });

  it('sin audio responde 400 en el campo audio y no crea nada', async () => {
    const { app, db } = setup();
    const res = await upload(app, asA, okFields, null);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'audio', message: 'El audio es obligatorio' }]);
    expect(db.rows('speaking_logs')).toHaveLength(0);
  });

  it('un archivo que no es MP3 (aunque se llame .mp3) responde 400', async () => {
    const { app, files } = setup();
    const res = await upload(app, asA, okFields, Buffer.from('%PDF-1.7 esto no es audio'.repeat(5000)));

    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toEqual({ field: 'audio', message: 'El archivo no es un audio MP3 válido' });
    expect(files.size).toBe(0);
  });

  it('más de 15 MB responde 413 sin subir nada', async () => {
    const { app, files } = setup();
    const res = await upload(app, asA, { title: 'Enorme', duration_seconds: '600' }, Buffer.concat([makeMp3(1), Buffer.alloc(15 * 1024 * 1024)]));

    expect(res.status).toBe(413);
    expect(res.body.error.details[0]).toEqual({ field: 'audio', message: 'El audio no puede pesar más de 15 MB' });
    expect(files.size).toBe(0);
  });

  it('más de 10 minutos responde 400', async () => {
    const { app } = setup();
    const res = await upload(app, asA, { title: 'Largo', duration_seconds: '601' });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toEqual({ field: 'duration_seconds', message: 'El audio no puede durar más de 10 minutos' });
  });

  it('una duración que no cuadra con el tamaño responde 400', async () => {
    const { app, files } = setup();
    const res = await upload(app, asA, { title: 'Trampa', duration_seconds: '2' }, makeMp3(120));

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('duration_seconds');
    expect(files.size).toBe(0);
  });

  it('sin título, sin duración o con límite de grabación inválido responde 400', async () => {
    const { app } = setup();
    const res = await upload(app, asA, { recording_limit_minutes: '7' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['duration_seconds', 'recording_limit_minutes', 'title']);
  });

  it('si la subida falla no crea ficha y pide reintentar (503)', async () => {
    const { app, db } = setup();
    db.storageFailures.upload = true;
    const spy = silenceErrors();
    const res = await upload(app, asA, okFields);
    spy.mockRestore();

    expect(res.status).toBe(503);
    expect(res.body.error.message).toBe('No se pudo subir el audio; inténtalo de nuevo');
    expect(db.rows('speaking_logs')).toHaveLength(0);
  });

  it('si la ficha falla, borra el audio recién subido (no deja huérfanos)', async () => {
    const { app, db, files } = setup();
    db.insertFailures.add('speaking_logs');
    const spy = silenceErrors();
    const res = await upload(app, asA, okFields);
    spy.mockRestore();

    expect(res.status).toBe(500);
    expect(files.size).toBe(0);
  });

  it('ignora un user_id enviado: el audio va siempre a la carpeta de quien sube', async () => {
    const { app, db, files } = setup();
    const res = await upload(app, asA, { ...okFields, user_id: USER_B.id });

    expect(db.rows('speaking_logs')[0]?.user_id).toBe(USER_A.id);
    expect([...files.keys()]).toEqual([`${USER_A.id}/${res.body.id}.mp3`]);
  });

  it('sin sesión responde 401 y no sube nada', async () => {
    const { app, files } = setup();

    expect((await upload(app, {}, okFields)).status).toBe(401);
    expect(files.size).toBe(0);
  });
});

describe('GET /api/speaking/:id/audio-url (5.2)', () => {
  it('devuelve un enlace firmado de 5 minutos para el dueño', async () => {
    const { app } = setup();
    const { id } = await uploaded(app);
    const before = Date.now();
    const res = await request(app).get(`/api/speaking/${id}/audio-url`).set(asA);

    expect(res.status).toBe(200);
    expect(res.body.url).toContain(`${USER_A.id}/${id}.mp3`);
    expect(res.body.url).toContain('expires=300');
    const expires = Date.parse(res.body.expires_at);
    expect(expires - before).toBeGreaterThanOrEqual(299_000);
    expect(expires - before).toBeLessThanOrEqual(301_000);
  });

  it('B no obtiene enlace para un audio de A (404)', async () => {
    const { app } = setup();
    const { id } = await uploaded(app);

    expect((await request(app).get(`/api/speaking/${id}/audio-url`).set(asB)).status).toBe(404);
  });

  it('si Storage no puede firmar el enlace responde 503', async () => {
    const { app, db } = setup();
    const { id } = await uploaded(app);
    db.storageFailures.signedUrl = true;
    const spy = silenceErrors();
    const res = await request(app).get(`/api/speaking/${id}/audio-url`).set(asA);
    spy.mockRestore();

    expect(res.status).toBe(503);
  });
});

describe('DELETE /api/speaking/:id (5.2)', () => {
  it('borra la ficha y su audio', async () => {
    const { app, db, files } = setup();
    const { id } = await uploaded(app);
    const res = await request(app).delete(`/api/speaking/${id}`).set(asA);

    expect(res.status).toBe(204);
    expect(db.rows('speaking_logs')).toHaveLength(0);
    expect(files.size).toBe(0);
  });

  it('B no puede borrar un audio de A (404) y todo sigue intacto', async () => {
    const { app, db, files } = setup();
    const { id } = await uploaded(app);

    expect((await request(app).delete(`/api/speaking/${id}`).set(asB)).status).toBe(404);
    expect(db.rows('speaking_logs')).toHaveLength(1);
    expect(files.size).toBe(1);
  });

  it('si el audio no se puede borrar, la ficha desaparece igual y se registra el huérfano', async () => {
    const { app, db } = setup();
    const { id } = await uploaded(app);
    db.storageFailures.remove = true;
    const spy = silenceErrors();
    const res = await request(app).delete(`/api/speaking/${id}`).set(asA);
    const logged = spy.mock.calls.some((call) => String(call[0]).includes('huérfano'));
    spy.mockRestore();

    expect(res.status).toBe(204);
    expect(db.rows('speaking_logs')).toHaveLength(0);
    expect(logged).toBe(true);
  });
});

describe('Biblioteca: GET / PATCH /api/speaking', () => {
  it('lista los monólogos propios con búsqueda por título, sin rutas internas', async () => {
    const { app } = setup();
    await upload(app, asA, { ...okFields, title: 'Resumen de mi día' });
    await upload(app, asA, { ...okFields, title: 'Opinión sobre la IA' });
    await upload(app, asB, { ...okFields, title: 'Monólogo de B' });

    const all = await request(app).get('/api/speaking').set(asA);
    const search = await request(app).get('/api/speaking?q=opinion').set(asA);
    expect(all.body.total).toBe(2);
    expect(all.body.items[0]).not.toHaveProperty('storage_path');
    expect(search.body.items.map((i: { title: string }) => i.title)).toEqual([]);
    expect((await request(app).get('/api/speaking?q=Opinión').set(asA)).body.total).toBe(1);
    expect((await request(app).get('/api/speaking').set(asB)).body.items.map((i: { title: string }) => i.title)).toEqual(['Monólogo de B']);
  });

  it('GET /:id devuelve la ficha propia y 404 si es de otro usuario', async () => {
    const { app } = setup();
    const { id } = await uploaded(app);

    expect((await request(app).get(`/api/speaking/${id}`).set(asA)).body.title).toBe('Resumen de mi día');
    expect((await request(app).get(`/api/speaking/${id}`).set(asB)).status).toBe(404);
  });

  it('PATCH cambia solo el título; vacío responde 400 y de otro usuario 404', async () => {
    const { app } = setup();
    const { id } = await uploaded(app);
    const res = await request(app).patch(`/api/speaking/${id}`).set(asA).send({ title: 'Mi día (v2)', duration_seconds: 999 });

    expect(res.body).toMatchObject({ title: 'Mi día (v2)', duration_seconds: 5 });
    expect((await request(app).patch(`/api/speaking/${id}`).set(asA).send({ title: '' })).status).toBe(400);
    expect((await request(app).patch(`/api/speaking/${id}`).set(asB).send({ title: 'x' })).status).toBe(404);
  });
});
