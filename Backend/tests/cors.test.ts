import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTwoUserSupabase, SESSION_A } from './helpers/fakeSupabase.js';

const FRONTEND = 'http://localhost:5173';
const EXTENSION = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const EVIL = 'https://evil.example';

function app() {
  const { supabase } = createTwoUserSupabase();
  return createApp({ supabase, corsOrigins: [FRONTEND] });
}

/** Preflight: lo que el navegador pregunta antes de una petición con Authorization. */
const preflight = (path: string, origin: string, method = 'PATCH') =>
  request(app())
    .options(path)
    .set('Origin', origin)
    .set('Access-Control-Request-Method', method)
    .set('Access-Control-Request-Headers', 'authorization,content-type');

describe('CORS', () => {
  it('el Frontend pasa el preflight con los métodos y cabeceras que usa', async () => {
    const res = await preflight('/api/vocabulary/x', FRONTEND);

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND);
    expect(res.headers['access-control-allow-methods']).toBe('GET,POST,PUT,PATCH,DELETE');
    expect(res.headers['access-control-allow-headers']).toBe('Authorization,Content-Type');
    expect(res.headers['access-control-max-age']).toBe('600');
  });

  it('las respuestas reales al Frontend llevan su origen permitido', async () => {
    const res = await request(app()).get('/api/vocabulary').set('Origin', FRONTEND).set('Authorization', `Bearer ${SESSION_A}`);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND);
  });

  it('una web desconocida no recibe permiso: el navegador bloqueará la respuesta', async () => {
    const pre = await preflight('/api/vocabulary', EVIL, 'GET');
    const real = await request(app()).get('/api/health').set('Origin', EVIL);

    expect(pre.headers['access-control-allow-origin']).toBeUndefined();
    expect(real.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('la extensión de Chrome puede llamar a /api/capture y /api/health', async () => {
    const capture = await preflight('/api/capture', EXTENSION, 'POST');
    const health = await request(app()).get('/api/health').set('Origin', EXTENSION);

    expect(capture.status).toBe(204);
    expect(capture.headers['access-control-allow-origin']).toBe(EXTENSION);
    expect(health.headers['access-control-allow-origin']).toBe(EXTENSION);
  });

  it('la extensión no tiene permiso para el resto de la API', async () => {
    for (const path of ['/api/vocabulary', '/api/me', '/api/srs/queue']) {
      const res = await preflight(path, EXTENSION, 'GET');
      expect(res.headers['access-control-allow-origin'], path).toBeUndefined();
    }
  });

  it('un origen parecido al Frontend pero distinto no pasa', async () => {
    const res = await preflight('/api/me', 'http://localhost:5174', 'GET');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('las peticiones sin Origin (servidores, curl) funcionan igual', async () => {
    const res = await request(app()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('no permite cookies ni credenciales del navegador', async () => {
    const res = await preflight('/api/me', FRONTEND, 'GET');

    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });
});
