import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { localDate } from '../src/services/dates.js';
import { getTodayHabits, setTodayHabits } from '../src/services/habit.service.js';
import { createTwoUserSupabase, SESSION_A, SESSION_B, USER_A, USER_B } from './helpers/fakeSupabase.js';

const asA = { Authorization: `Bearer ${SESSION_A}` };
const asB = { Authorization: `Bearer ${SESSION_B}` };

function setup(timezoneA = 'America/Bogota') {
  const { db, supabase } = createTwoUserSupabase();
  db.rows('profiles').push(
    { id: USER_A.id, display_name: 'A', timezone: timezoneA, created_at: 'x', updated_at: 'x' },
    { id: USER_B.id, display_name: 'B', timezone: 'Europe/Madrid', created_at: 'x', updated_at: 'x' },
  );
  return { db, supabase, app: createApp({ supabase }) };
}

describe('GET /api/habits/today', () => {
  it('devuelve las tres casillas sin marcar y la fecha local del usuario', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/habits/today').set(asA);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      date: localDate(new Date(), 'America/Bogota'),
      timezone: 'America/Bogota',
      habits: { reading_listening: false, speaking: false, writing: false },
    });
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).get('/api/habits/today')).status).toBe(401);
  });
});

describe('PUT /api/habits/today', () => {
  it('marcar una casilla guarda el check-in de hoy', async () => {
    const { app, db } = setup();
    const res = await request(app).put('/api/habits/today').set(asA).send({ speaking: true });

    expect(res.status).toBe(200);
    expect(res.body.habits).toEqual({ reading_listening: false, speaking: true, writing: false });
    expect(db.rows('habit_checkins')).toEqual([
      expect.objectContaining({ user_id: USER_A.id, habit: 'speaking', date: res.body.date }),
    ]);
  });

  it('marcar dos veces la misma casilla no falla ni duplica', async () => {
    const { app, db } = setup();
    await request(app).put('/api/habits/today').set(asA).send({ speaking: true });
    const again = await request(app).put('/api/habits/today').set(asA).send({ speaking: true });

    expect(again.status).toBe(200);
    expect(db.rows('habit_checkins')).toHaveLength(1);
  });

  it('desmarcar elimina el check-in de hoy', async () => {
    const { app, db } = setup();
    await request(app).put('/api/habits/today').set(asA).send({ speaking: true, writing: true });
    const res = await request(app).put('/api/habits/today').set(asA).send({ speaking: false });

    expect(res.body.habits).toEqual({ reading_listening: false, speaking: false, writing: true });
    expect(db.rows('habit_checkins').map((r) => r.habit)).toEqual(['writing']);
  });

  it('a las 23:30 en Bogotá el check-in cuenta para ese día local, aunque en UTC ya sea mañana', async () => {
    const { supabase, db } = setup();
    const lateNight = new Date('2026-01-10T04:30:00Z'); // 23:30 del 9 de enero en Bogotá
    const result = await setTodayHabits(supabase, USER_A.id, { writing: true }, lateNight);

    expect(result.date).toBe('2026-01-09');
    expect(db.rows('habit_checkins')[0]?.date).toBe('2026-01-09');
  });

  it('cambiar la zona horaria del perfil cambia qué día es "hoy"', async () => {
    const { supabase } = setup('Asia/Tokyo');
    const instant = new Date('2026-01-09T20:00:00Z'); // ya es 10 de enero en Tokio

    expect((await getTodayHabits(supabase, USER_A.id, instant)).date).toBe('2026-01-10');
  });

  it('un body vacío o con valores que no son true/false responde 400', async () => {
    const { app } = setup();
    const empty = await request(app).put('/api/habits/today').set(asA).send({});
    const wrong = await request(app).put('/api/habits/today').set(asA).send({ speaking: 'sí' });

    expect(empty.status).toBe(400);
    expect(empty.body.error.details[0].message).toBe('Envía al menos un hábito para marcar o desmarcar');
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.details[0]).toEqual({ field: 'speaking', message: 'Indica si practicaste conversación (Speaking) hoy (true o false)' });
  });

  it('los check-ins de A no aparecen para B', async () => {
    const { app } = setup();
    await request(app).put('/api/habits/today').set(asA).send({ reading_listening: true, speaking: true, writing: true });
    const resB = await request(app).get('/api/habits/today').set(asB);

    expect(resB.body.habits).toEqual({ reading_listening: false, speaking: false, writing: false });
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).put('/api/habits/today').send({ speaking: true })).status).toBe(401);
  });
});
