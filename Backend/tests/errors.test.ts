import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { notFound } from '../src/errors.js';
import { errorHandler, notFoundHandler } from '../src/middlewares/errorHandler.js';
import { parse } from '../src/validation.js';

// Mini app de prueba con las mismas piezas que usará cada controller real.
const wordSchema = z.object({
  word: z.string().trim().min(1).max(200),
  type: z.enum(['word', 'phrasal_verb', 'idiom_slang']),
});

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.post('/words', (req, res) => {
    const body = parse(wordSchema, req.body);
    res.status(201).json(body);
  });
  app.get('/missing', () => {
    throw notFound('Término no encontrado');
  });
  app.get('/boom', () => {
    throw new Error('detalle interno secreto');
  });
  app.get('/boom-async', async () => {
    throw new Error('fallo asíncrono');
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('validación con parse()', () => {
  it('acepta un body válido y devuelve los datos transformados', async () => {
    const res = await request(buildTestApp()).post('/words').send({ word: '  bite the bullet ', type: 'idiom_slang' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ word: 'bite the bullet', type: 'idiom_slang' });
  });

  it('un body inválido produce 400 con { error: { code, message, details } }', async () => {
    const res = await request(buildTestApp()).post('/words').send({ word: '', type: 'slang' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(typeof res.body.error.message).toBe('string');
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['type', 'word']);
  });

  it('un body ausente también es un error de validación', async () => {
    const res = await request(buildTestApp()).post('/words');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });
});

describe('middleware de errores', () => {
  it('convierte un HttpError en su estado y código', async () => {
    const res = await request(buildTestApp()).get('/missing');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'not_found', message: 'Término no encontrado' } });
  });

  it('un error inesperado responde 500 sin revelar el detalle interno', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(buildTestApp()).get('/boom');
    spy.mockRestore();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'internal_error', message: 'Error interno del servidor' } });
    expect(JSON.stringify(res.body)).not.toContain('secreto');
  });

  it('captura también los errores de handlers asíncronos', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(buildTestApp()).get('/boom-async');
    spy.mockRestore();

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('internal_error');
  });
});

describe('createApp', () => {
  it('una ruta inexistente responde 404 con el formato estándar', async () => {
    const res = await request(createApp()).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'not_found', message: 'No existe la ruta GET /api/no-existe' } });
  });

  it('un JSON mal formado responde 400 invalid_json', async () => {
    const res = await request(createApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"word": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_json');
  });

  it('un body de más de 100 KB responde 413 payload_too_large', async () => {
    const res = await request(createApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'x'.repeat(110 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('payload_too_large');
  });
});
