import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { addDays, localDate } from '../src/services/dates.js';
import { getStreak } from '../src/services/habit.service.js';
import { createTwoUserSupabase, type FakeDb, SESSION_A, SESSION_B, USER_A, USER_B } from './helpers/fakeSupabase.js';

const asA = { Authorization: `Bearer ${SESSION_A}` };
const asB = { Authorization: `Bearer ${SESSION_B}` };

// "Ahora" fijo: 12 de octubre de 2026 a las 15:00 en Bogotá (20:00 UTC).
const NOW = new Date('2026-10-12T20:00:00Z');
const TODAY = '2026-10-12';

function setup() {
  const { db, supabase } = createTwoUserSupabase();
  db.rows('profiles').push(
    { id: USER_A.id, timezone: 'America/Bogota' },
    { id: USER_B.id, timezone: 'Europe/Madrid' },
  );
  return { db, supabase, app: createApp({ supabase }) };
}

/** Mediodía local en Bogotá de una fecha, como instante UTC. */
const noonBogota = (date: string) => `${date}T17:00:00.000Z`;
const checkin = (db: FakeDb, date: string, userId = USER_A.id, habit = 'speaking') =>
  db.rows('habit_checkins').push({ user_id: userId, date, habit });
const review = (db: FakeDb, iso: string, userId = USER_A.id) =>
  db.rows('review_events').push({ user_id: userId, item_type: 'vocabulary', item_id: 'x', grade: 3, reviewed_at: iso });
const word = (db: FakeDb, iso: string) =>
  db.rows('vocabulary').push({ user_id: USER_A.id, word: 'w', type: 'word', status: 'pending_curation', created_at: iso });

describe('getStreak: racha', () => {
  it('ayer y anteayer activos, hoy aún no ⇒ racha 2', async () => {
    const { db, supabase } = setup();
    review(db, noonBogota(addDays(TODAY, -1)));
    review(db, noonBogota(addDays(TODAY, -2)));

    const result = await getStreak(supabase, USER_A.id, NOW);
    expect(result).toMatchObject({ streak: 2, today_active: false, today: TODAY, timezone: 'America/Bogota' });
  });

  it('si hoy ya es activo, la racha lo incluye', async () => {
    const { db, supabase } = setup();
    review(db, noonBogota(TODAY));
    review(db, noonBogota(addDays(TODAY, -1)));

    expect(await getStreak(supabase, USER_A.id, NOW)).toMatchObject({ streak: 2, today_active: true });
  });

  it('ayer inactivo y hoy aún no ⇒ racha 0 (se rompió)', async () => {
    const { db, supabase } = setup();
    review(db, noonBogota(addDays(TODAY, -2)));
    review(db, noonBogota(addDays(TODAY, -3)));

    expect((await getStreak(supabase, USER_A.id, NOW)).streak).toBe(0);
  });

  it('un día solo con check-in (sin repasos ni palabras) cuenta como activo', async () => {
    const { db, supabase } = setup();
    checkin(db, addDays(TODAY, -1), USER_A.id, 'writing');

    expect((await getStreak(supabase, USER_A.id, NOW)).streak).toBe(1);
  });

  it('registrar una palabra también hace activo el día', async () => {
    const { db, supabase } = setup();
    word(db, noonBogota(TODAY));

    expect(await getStreak(supabase, USER_A.id, NOW)).toMatchObject({ streak: 1, today_active: true });
  });

  it('cuenta rachas más largas que el mapa de 30 días', async () => {
    const { db, supabase } = setup();
    for (let i = 1; i <= 45; i++) checkin(db, addDays(TODAY, -i));

    expect((await getStreak(supabase, USER_A.id, NOW)).streak).toBe(45);
  });

  it('un repaso a las 22:30 en Bogotá cuenta para ese día local, no para el siguiente (UTC)', async () => {
    const { db, supabase } = setup();
    // 03:30 UTC del día 12 = 22:30 del día 11 en Bogotá
    review(db, '2026-10-12T03:30:00.000Z');

    const result = await getStreak(supabase, USER_A.id, NOW);
    expect(result).toMatchObject({ streak: 1, today_active: false });
    expect(result.heatmap.find((d) => d.date === '2026-10-11')?.count).toBe(1);
  });
});

describe('getStreak: mapa de calor', () => {
  it('30 días del más antiguo a hoy, con el número de actividades de cada día', async () => {
    const { db, supabase } = setup();
    review(db, noonBogota(TODAY));
    review(db, noonBogota(TODAY));
    checkin(db, TODAY);
    word(db, noonBogota(addDays(TODAY, -5)));
    review(db, noonBogota(addDays(TODAY, -40))); // fuera del mapa

    const { heatmap } = await getStreak(supabase, USER_A.id, NOW);
    expect(heatmap).toHaveLength(30);
    expect(heatmap[0]?.date).toBe(addDays(TODAY, -29));
    expect(heatmap[29]).toEqual({ date: TODAY, count: 3 });
    expect(heatmap.find((d) => d.date === addDays(TODAY, -5))?.count).toBe(1);
    expect(heatmap.reduce((sum, d) => sum + d.count, 0)).toBe(4);
  });
});

describe('GET /api/stats/streak', () => {
  it('marcar un check-in hoy enciende la celda de hoy y la racha', async () => {
    const { app } = setup();
    await request(app).put('/api/habits/today').set(asA).send({ speaking: true });
    const res = await request(app).get('/api/stats/streak').set(asA);

    const today = localDate(new Date(), 'America/Bogota');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ streak: 1, today_active: true, today });
    expect(res.body.heatmap.at(-1)).toEqual({ date: today, count: 1 });
  });

  it('la actividad de A no cuenta para la racha de B', async () => {
    const { app, db } = setup();
    for (let i = 0; i < 5; i++) checkin(db, localDate(new Date(Date.now() - i * 86_400_000), 'America/Bogota'));
    const resB = await request(app).get('/api/stats/streak').set(asB);

    expect(resB.body.streak).toBe(0);
    expect(resB.body.heatmap.every((d: { count: number }) => d.count === 0)).toBe(true);
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).get('/api/stats/streak')).status).toBe(401);
  });
});
