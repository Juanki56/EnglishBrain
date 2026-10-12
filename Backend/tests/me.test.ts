import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTwoUserSupabase, SESSION_A, SESSION_B, USER_A, USER_B } from './helpers/fakeSupabase.js';

function setup() {
  const { db, supabase } = createTwoUserSupabase();
  db.rows('profiles').push(
    { id: USER_A.id, display_name: 'Usuario A', timezone: 'America/Bogota', created_at: 'x', updated_at: 'x' },
    { id: USER_B.id, display_name: 'Usuario B', timezone: 'Europe/Madrid', created_at: 'x', updated_at: 'x' },
  );
  return { db, app: createApp({ supabase }) };
}

const asA = { Authorization: `Bearer ${SESSION_A}` };

describe('GET /api/me', () => {
  it('devuelve el perfil del usuario autenticado con su email', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/me').set(asA);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: USER_A.id,
      email: USER_A.email,
      display_name: 'Usuario A',
      timezone: 'America/Bogota',
    });
  });

  it('cada usuario ve solo su propio perfil', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${SESSION_B}`);

    expect(res.body).toMatchObject({ id: USER_B.id, timezone: 'Europe/Madrid' });
  });

  it('si el perfil no existe lo crea con valores por defecto', async () => {
    const { db, supabase } = createTwoUserSupabase();
    const res = await request(createApp({ supabase })).get('/api/me').set(asA);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: USER_A.id, timezone: 'UTC', display_name: null });
    expect(db.rows('profiles')).toHaveLength(1);
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).get('/api/me')).status).toBe(401);
  });
});

describe('PATCH /api/me', () => {
  it('cambia nombre y zona horaria', async () => {
    const { app } = setup();
    const res = await request(app).patch('/api/me').set(asA).send({ display_name: 'Juan', timezone: 'Europe/Madrid' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ display_name: 'Juan', timezone: 'Europe/Madrid' });
  });

  it('normaliza la zona horaria a su nombre canónico', async () => {
    const { app } = setup();
    const res = await request(app).patch('/api/me').set(asA).send({ timezone: 'america/bogota' });

    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe('America/Bogota');
  });

  it('permite borrar el nombre visible enviando null', async () => {
    const { app } = setup();
    const res = await request(app).patch('/api/me').set(asA).send({ display_name: null });

    expect(res.body.display_name).toBeNull();
  });

  it('una zona horaria inválida responde 400 indicando el campo', async () => {
    const { app } = setup();
    const res = await request(app).patch('/api/me').set(asA).send({ timezone: 'Mars/Olympus' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.details[0].field).toBe('timezone');
  });

  it('un nombre de más de 60 caracteres responde 400', async () => {
    const { app } = setup();
    const res = await request(app).patch('/api/me').set(asA).send({ display_name: 'x'.repeat(61) });

    expect(res.status).toBe(400);
  });

  it('un body sin campos válidos responde 400', async () => {
    const { app } = setup();
    const res = await request(app).patch('/api/me').set(asA).send({});

    expect(res.status).toBe(400);
  });

  it('no permite cambiar el id ni tocar el perfil de otro usuario', async () => {
    const { app, db } = setup();
    await request(app).patch('/api/me').set(asA).send({ id: USER_B.id, display_name: 'Hackeado' });

    const profileB = db.rows('profiles').find((p) => p.id === USER_B.id);
    const profileA = db.rows('profiles').find((p) => p.id === USER_A.id);
    expect(profileB?.display_name).toBe('Usuario B');
    expect(profileA?.display_name).toBe('Hackeado');
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).patch('/api/me').send({ display_name: 'x' })).status).toBe(401);
  });
});
