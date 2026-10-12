import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { createCaptureToken } from '../src/services/captureToken.service.js';
import { GENERAL_FIELD, parse } from '../src/validation.js';
import { createTwoUserSupabase, SESSION_A, USER_A } from './helpers/fakeSupabase.js';

/** Palabras típicas de los mensajes por defecto de zod en inglés. */
const ENGLISH = /\b(invalid|expected|received|too (big|small)|required|must|option|input|string|number|boolean)\b/i;

const WORD_ID = '5a000000-0000-4000-8000-000000000001';

async function setup() {
  const { db, supabase } = createTwoUserSupabase();
  db.rows('vocabulary').push({
    id: WORD_ID, user_id: USER_A.id, word: 'give up', translation: 'rendirse', type: 'phrasal_verb',
    status: 'learning', retention_state: 'learning', source: 'manual', created_at: '2026-10-01T10:00:00Z',
  });
  const { token } = await createCaptureToken(supabase, USER_A.id, 'Chrome');
  return { app: createApp({ supabase }), token };
}

type Case = [method: 'get' | 'post' | 'patch' | 'put', path: string, body?: unknown, auth?: 'session' | 'token'];

// Un caso inválido por cada campo validado de la API.
const INVALID_CASES: Case[] = [
  ['post', '/api/vocabulary', {}],
  ['post', '/api/vocabulary', { word: 123, translation: true, type: 'slang', is_active_srs: 'si' }],
  ['post', '/api/vocabulary', { word: 'x'.repeat(201), translation: 'x'.repeat(501), type: 'word', definition: 5, context_sentence: 'x'.repeat(2001) }],
  ['patch', `/api/vocabulary/${WORD_ID}`, {}],
  ['patch', `/api/vocabulary/${WORD_ID}`, { word: '', type: 1, translation: 9 }],
  ['patch', `/api/vocabulary/${WORD_ID}/curate`, { translation: '', is_active_srs: 'no' }],
  ['get', '/api/vocabulary?status=borrado&type=slang&source=web&limit=500&offset=-1'],
  ['get', '/api/vocabulary?limit=abc&offset=1.5'],
  ['get', `/api/vocabulary?q=${'x'.repeat(101)}`],
  ['post', '/api/capture', { word: 123, context_sentence: 5, source_url: 'javascript:x' }, 'token'],
  ['post', '/api/capture', {}, 'token'],
  ['patch', '/api/me', {}],
  ['patch', '/api/me', { display_name: 5, timezone: 7 }],
  ['patch', '/api/me', { display_name: '', timezone: 'Mars/Olympus' }],
  ['post', '/api/me/capture-tokens', {}],
  ['post', '/api/me/capture-tokens', { label: 5 }],
  // Muro de errores
  ['post', '/api/errors', {}],
  ['post', '/api/errors', { incorrect_phrase: 1, correct_phrase: 'x'.repeat(501), notes: 3, is_active_srs: 'no' }],
  ['patch', `/api/errors/${WORD_ID}`, {}],
  ['patch', `/api/errors/${WORD_ID}`, { is_resolved: 'si', correct_phrase: '' }],
  ['get', '/api/errors?status=todos&limit=0'],
  // Writing
  ['post', '/api/writing', {}],
  ['post', '/api/writing', { title: 5, content: 'x'.repeat(50_001), is_active_srs: 1 }],
  ['patch', `/api/writing/${WORD_ID}`, { title: '' }],
  ['post', `/api/writing/${WORD_ID}/versions`, { content: 7 }],
  ['get', '/api/writing?limit=abc'],
  // Listening
  ['post', '/api/listening', {}],
  ['post', '/api/listening', { title: 1, url: 'ftp://x', start_seconds: '1:32', transcription: 2, is_active_srs: 'si' }],
  ['post', '/api/listening', { title: 'a', url: 'https://x.com', start_seconds: -1, transcription: 'b' }],
  ['patch', `/api/listening/${WORD_ID}`, {}],
  ['patch', `/api/listening/${WORD_ID}`, { start_seconds: 1.5, url: '' }],
  // Speaking (los campos de texto; el archivo se prueba en speaking.test.ts)
  ['post', '/api/speaking', {}],
  ['post', '/api/speaking', { title: 5, duration_seconds: 'abc', recording_limit_minutes: 7, is_active_srs: 'quizás' }],
  ['post', '/api/speaking', { title: 'a', duration_seconds: 601 }],
  ['patch', `/api/speaking/${WORD_ID}`, { title: '' }],
  ['get', '/api/speaking?limit=0'],
  // Motor de repasos
  ['get', '/api/srs/queue?limit=abc&offset=-2'],
  ['post', '/api/srs/review', {}],
  ['post', '/api/srs/review', { item_type: 'palabra', item_id: 5, grade: 'bien' }],
  ['post', '/api/srs/review', { item_type: 'vocabulary', item_id: 'abc', grade: 7 }],
  ['patch', `/api/items/vocabulary/${WORD_ID}/srs-toggle`, {}],
  ['patch', `/api/items/errors/${WORD_ID}/srs-toggle`, { is_active_srs: 'no' }],
  // Hábitos
  ['put', '/api/habits/today', {}],
  ['put', '/api/habits/today', { reading_listening: 1, speaking: 'sí', writing: null }],
];

async function send(app: ReturnType<typeof createApp>, token: string, [method, path, body, auth = 'session']: Case) {
  const req = request(app)[method](path).set('Authorization', `Bearer ${auth === 'token' ? token : SESSION_A}`);
  return body === undefined ? req : req.send(body as object);
}

describe('mensajes de error en español', () => {
  it('ningún mensaje de validación de la API sale en inglés', async () => {
    const { app, token } = await setup();
    const english: string[] = [];

    for (const testCase of INVALID_CASES) {
      const res = await send(app, token, testCase);
      expect(res.status, `${testCase[0]} ${testCase[1]}`).toBe(400);
      for (const detail of res.body.error.details ?? []) {
        if (ENGLISH.test(detail.message)) english.push(`${testCase[1]} → ${detail.field}: ${detail.message}`);
      }
      if (ENGLISH.test(res.body.error.message)) english.push(`${testCase[1]} → ${res.body.error.message}`);
    }

    expect(english).toEqual([]);
  });

  it('distingue entre campo ausente y tipo incorrecto', async () => {
    const { app } = await setup();
    const missing = await request(app).post('/api/vocabulary').set('Authorization', `Bearer ${SESSION_A}`).send({});
    const wrongType = await request(app)
      .post('/api/vocabulary')
      .set('Authorization', `Bearer ${SESSION_A}`)
      .send({ word: 123, translation: 'x', type: 'word' });

    const byField = (res: typeof missing) =>
      Object.fromEntries(res.body.error.details.map((d: { field: string; message: string }) => [d.field, d.message]));
    expect(byField(missing)).toMatchObject({
      word: 'La palabra es obligatoria',
      translation: 'La traducción es obligatoria',
    });
    expect(byField(wrongType).word).toBe('La palabra debe ser un texto');
  });

  it('usa lenguaje claro en lugar de nombres técnicos', async () => {
    const { app } = await setup();
    const res = await request(app)
      .post('/api/vocabulary')
      .set('Authorization', `Bearer ${SESSION_A}`)
      .send({ word: 'a', translation: 'b', type: 'slang', is_active_srs: 'si' });

    const messages = res.body.error.details.map((d: { message: string }) => d.message).join(' | ');
    expect(messages).toContain('Elige un tipo válido');
    expect(messages).toContain('Indica si quieres añadirlo a los repasos diarios');
  });

  it('los filtros de búsqueda explican el rango permitido', async () => {
    const { app } = await setup();
    const res = await request(app).get('/api/vocabulary?limit=500').set('Authorization', `Bearer ${SESSION_A}`);

    expect(res.body.error.details[0]).toEqual({ field: 'limit', message: 'El límite debe estar entre 1 y 200' });
  });

  it('los errores que no son de un campo usan el campo _general', async () => {
    const { app } = await setup();
    const res = await request(app).patch(`/api/vocabulary/${WORD_ID}`).set('Authorization', `Bearer ${SESSION_A}`).send({});

    expect(res.body.error.details[0]).toEqual({ field: GENERAL_FIELD, message: 'Envía al menos un campo para editar' });
  });

  it('un campo sin mensaje propio usa la traducción española de zod', () => {
    expect(() => parse(z.object({ n: z.number() }), { n: 'x' })).toThrow();
    try {
      parse(z.object({ n: z.number() }), { n: 'x' });
    } catch (error) {
      const message = (error as { details: Array<{ message: string }> }).details[0]?.message ?? '';
      expect(message).not.toMatch(ENGLISH);
      expect(message).toMatch(/se esperaba/);
    }
  });
});
