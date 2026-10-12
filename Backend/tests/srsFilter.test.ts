import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTwoUserSupabase, SESSION_A, USER_A } from './helpers/fakeSupabase.js';

const asA = { Authorization: `Bearer ${SESSION_A}` };

/** Una fila activa y otra archivada en cada tabla estudiable. */
function setup() {
  const { db, supabase } = createTwoUserSupabase();
  const base = (id: string, active: boolean, extra: Record<string, unknown>) => ({
    id, user_id: USER_A.id, is_active_srs: active, due_at: null, retention_state: 'learning', created_at: `2026-10-0${active ? 2 : 1}T10:00:00Z`, ...extra,
  });
  db.rows('vocabulary').push(
    base('9a000000-0000-4000-8000-000000000001', true, { word: 'activa', type: 'word', status: 'learning', translation: 't', source: 'manual' }),
    base('9a000000-0000-4000-8000-000000000002', false, { word: 'archivada', type: 'word', status: 'learning', translation: 't', source: 'manual' }),
  );
  db.rows('fossilized_errors').push(
    base('9b000000-0000-4000-8000-000000000001', true, { incorrect_phrase: 'activa', correct_phrase: 'x', is_resolved: false }),
    base('9b000000-0000-4000-8000-000000000002', false, { incorrect_phrase: 'archivada', correct_phrase: 'x', is_resolved: false }),
  );
  db.rows('writing_logs').push(base('9c000000-0000-4000-8000-000000000001', true, { title: 'activa' }), base('9c000000-0000-4000-8000-000000000002', false, { title: 'archivada' }));
  db.rows('listening_logs').push(
    base('9d000000-0000-4000-8000-000000000001', true, { title: 'activa', url: 'https://x.com', start_seconds: null, transcription: 'activa' }),
    base('9d000000-0000-4000-8000-000000000002', false, { title: 'archivada', url: 'https://x.com', start_seconds: null, transcription: 'archivada' }),
  );
  db.rows('speaking_logs').push(
    base('9e000000-0000-4000-8000-000000000001', true, { title: 'activa', duration_seconds: 5, storage_path: 'x' }),
    base('9e000000-0000-4000-8000-000000000002', false, { title: 'archivada', duration_seconds: 5, storage_path: 'y' }),
  );
  return createApp({ supabase });
}

const LISTS: Array<[path: string, label: (item: Record<string, string>) => string]> = [
  ['/api/vocabulary', (i) => i.word!],
  ['/api/errors', (i) => i.incorrect_phrase!],
  ['/api/writing', (i) => i.title!],
  ['/api/listening', (i) => i.title!],
  ['/api/speaking', (i) => i.title!],
];

describe('Filtro de Modo Archivo (srs) en los listados de la biblioteca', () => {
  for (const [path, label] of LISTS) {
    it(`${path}: srs=active solo lo que está en repasos, srs=archived solo el archivo, sin filtro ambos`, async () => {
      const app = setup();
      const names = async (query: string) =>
        (await request(app).get(`${path}${query}`).set(asA)).body.items.map(label).sort();

      expect(await names('?srs=active')).toEqual(['activa']);
      expect(await names('?srs=archived')).toEqual(['archivada']);
      expect(await names('')).toEqual(['activa', 'archivada']);
    });
  }

  it('el filtro también se aplica junto con la búsqueda (q)', async () => {
    const app = setup();
    const res = await request(app).get('/api/listening?srs=archived&q=archivada').set(asA);

    expect(res.body.items.map((i: { title: string }) => i.title)).toEqual(['archivada']);
    expect((await request(app).get('/api/listening?srs=active&q=archivada').set(asA)).body.total).toBe(0);
  });

  it('un valor inválido responde 400 con mensaje en español', async () => {
    const res = await request(setup()).get('/api/vocabulary?srs=todos').set(asA);

    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toEqual({
      field: 'srs',
      message: 'Filtro de repasos no válido: usa active (en repasos) o archived (archivo)',
    });
  });
});
