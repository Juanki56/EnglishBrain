import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { localDate } from '../src/services/dates.js';
import { createTwoUserSupabase, type FakeDb, SESSION_A, SESSION_B, USER_A, USER_B } from './helpers/fakeSupabase.js';

const asA = { Authorization: `Bearer ${SESSION_A}` };
const asB = { Authorization: `Bearer ${SESSION_B}` };

function setup() {
  const { db, supabase } = createTwoUserSupabase();
  db.rows('profiles').push({ id: USER_A.id, timezone: 'America/Bogota' }, { id: USER_B.id, timezone: 'UTC' });
  return { db, app: createApp({ supabase }) };
}

const recent = () => new Date(Date.now() - 2 * 86_400_000).toISOString();
const old = () => new Date(Date.now() - 60 * 86_400_000).toISOString();

function words(db: FakeDb, status: string, n: number, userId = USER_A.id, createdAt = recent()) {
  for (let i = 0; i < n; i++) {
    db.rows('vocabulary').push({
      user_id: userId, word: `${status}-${i}`, type: 'word', status, retention_state: status === 'pending_curation' ? 'learning' : status,
      translation: status === 'pending_curation' ? null : 't', is_active_srs: false, due_at: null, created_at: createdAt,
    });
  }
}

describe('GET /api/stats/overview', () => {
  it('10 learning, 5 reviewing, 5 mastered y 4 pendientes ⇒ total 20 (los pendientes no cuentan)', async () => {
    const { app, db } = setup();
    words(db, 'learning', 10);
    words(db, 'reviewing', 5);
    words(db, 'mastered', 5);
    words(db, 'pending_curation', 4);
    const res = await request(app).get('/api/stats/overview').set(asA);

    expect(res.status).toBe(200);
    expect(res.body.vocabulary).toEqual({ total: 20, learning: 10, reviewing: 5, mastered: 5, pending_curation: 4 });
  });

  it('6 errores con 2 superados ⇒ 4 errores críticos', async () => {
    const { app, db } = setup();
    for (let i = 0; i < 6; i++) {
      db.rows('fossilized_errors').push({ user_id: USER_A.id, incorrect_phrase: `e${i}`, correct_phrase: 'c', is_resolved: i < 2, is_active_srs: false });
    }

    expect((await request(app).get('/api/stats/overview').set(asA)).body.critical_errors).toBe(4);
  });

  it('due_count es el número de tarjetas vencidas de la cola', async () => {
    const { app, db } = setup();
    const due = new Date(Date.now() - 3_600_000).toISOString();
    db.rows('vocabulary').push(
      { user_id: USER_A.id, word: 'a', type: 'word', status: 'learning', retention_state: 'learning', translation: 't', is_active_srs: true, due_at: due },
      { user_id: USER_A.id, word: 'b', type: 'word', status: 'learning', retention_state: 'learning', translation: 't', is_active_srs: true, due_at: due },
    );
    db.rows('listening_logs').push({ user_id: USER_A.id, title: 'l', is_active_srs: true, due_at: due });

    expect((await request(app).get('/api/stats/overview').set(asA)).body.due_count).toBe(3);
  });

  it('las cifras de A no incluyen nada de B', async () => {
    const { app, db } = setup();
    words(db, 'learning', 3, USER_B.id);
    db.rows('fossilized_errors').push({ user_id: USER_B.id, incorrect_phrase: 'x', correct_phrase: 'y', is_resolved: false });

    expect((await request(app).get('/api/stats/overview').set(asA)).body).toEqual({
      vocabulary: { total: 0, learning: 0, reviewing: 0, mastered: 0, pending_curation: 0 },
      critical_errors: 0,
      due_count: 0,
    });
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).get('/api/stats/overview')).status).toBe(401);
  });
});

describe('GET /api/stats/effort', () => {
  type Skill = { skill: string; count: number; share: number; label: string };
  const bySkill = (body: { skills: Skill[] }) => Object.fromEntries(body.skills.map((s) => [s.skill, s]));
  const reviewsOf = (db: FakeDb, itemType: string, n: number, at = recent()) => {
    for (let i = 0; i < n; i++) db.rows('review_events').push({ user_id: USER_A.id, item_type: itemType, item_id: 'x', grade: 3, reviewed_at: at });
  };

  it('40 de vocabulario, 10 de writing, 5 de speaking y 5 de listening ⇒ foco en Vocabulario / Reading', async () => {
    const { app, db } = setup();
    words(db, 'learning', 20);
    reviewsOf(db, 'vocabulary', 20);
    reviewsOf(db, 'writing', 10);
    reviewsOf(db, 'speaking', 5);
    reviewsOf(db, 'listening', 5);
    const res = await request(app).get('/api/stats/effort').set(asA);
    const skills = bySkill(res.body);

    expect(res.status).toBe(200);
    expect(res.body.top).toBe('vocabulary_reading');
    expect(skills.vocabulary_reading).toMatchObject({ count: 40, share: 0.667, label: 'Vocabulario / Reading' });
    expect(skills.writing).toMatchObject({ count: 10, share: 0.167 });
    expect(skills.speaking?.count).toBe(5);
    expect(skills.listening?.count).toBe(5);
    expect(res.body.since).toBe(localDate(new Date(Date.now() - 29 * 86_400_000), 'America/Bogota'));
  });

  it('cuenta registros creados, repasos de errores y check-ins por habilidad', async () => {
    const { app, db } = setup();
    db.rows('writing_logs').push({ user_id: USER_A.id, title: 'w', created_at: recent() });
    db.rows('speaking_logs').push({ user_id: USER_A.id, title: 's', created_at: recent() });
    reviewsOf(db, 'fossilized_error', 2);
    const today = localDate(new Date(), 'America/Bogota');
    db.rows('habit_checkins').push(
      { user_id: USER_A.id, date: today, habit: 'writing' },
      { user_id: USER_A.id, date: today, habit: 'speaking' },
    );
    const skills = bySkill((await request(app).get('/api/stats/effort').set(asA)).body);

    expect(skills.writing?.count).toBe(2);
    expect(skills.speaking?.count).toBe(2);
    expect(skills.vocabulary_reading?.count).toBe(2);
  });

  it('el check-in Reading / Listening se reparte a medias entre ambas habilidades', async () => {
    const { app, db } = setup();
    db.rows('habit_checkins').push({ user_id: USER_A.id, date: localDate(new Date(), 'America/Bogota'), habit: 'reading_listening' });
    const skills = bySkill((await request(app).get('/api/stats/effort').set(asA)).body);

    expect(skills.vocabulary_reading?.count).toBe(0.5);
    expect(skills.listening?.count).toBe(0.5);
  });

  it('ignora la actividad de hace más de 30 días', async () => {
    const { app, db } = setup();
    words(db, 'learning', 5, USER_A.id, old());
    reviewsOf(db, 'speaking', 5, old());
    db.rows('habit_checkins').push({ user_id: USER_A.id, date: '2020-01-01', habit: 'writing' });

    expect((await request(app).get('/api/stats/effort').set(asA)).body.top).toBeNull();
  });

  it('sin actividad: todas las habilidades en 0 y top null', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/stats/effort').set(asA);

    expect(res.body.top).toBeNull();
    expect(res.body.skills.map((s: Skill) => [s.skill, s.count, s.share])).toEqual([
      ['vocabulary_reading', 0, 0], ['listening', 0, 0], ['speaking', 0, 0], ['writing', 0, 0],
    ]);
  });

  it('la actividad de A no cuenta para B', async () => {
    const { app, db } = setup();
    reviewsOf(db, 'speaking', 10);

    expect((await request(app).get('/api/stats/effort').set(asB)).body.top).toBeNull();
  });

  it('sin sesión responde 401', async () => {
    const { app } = setup();

    expect((await request(app).get('/api/stats/effort')).status).toBe(401);
  });
});
