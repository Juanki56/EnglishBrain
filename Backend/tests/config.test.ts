import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';

const validEnv = {
  SUPABASE_URL: 'https://ujipnxeaipreyjcnoean.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test_value',
  CORS_ORIGINS: 'http://localhost:5173',
};

describe('loadConfig', () => {
  it('devuelve la configuración con valores válidos', () => {
    expect(loadConfig({ ...validEnv, PORT: '4000' })).toEqual({
      supabaseUrl: validEnv.SUPABASE_URL,
      supabaseSecretKey: validEnv.SUPABASE_SECRET_KEY,
      corsOrigins: ['http://localhost:5173'],
      port: 4000,
    });
  });

  it('usa el puerto 3000 si PORT no está definido o está vacío', () => {
    expect(loadConfig(validEnv).port).toBe(3000);
    expect(loadConfig({ ...validEnv, PORT: '' }).port).toBe(3000);
  });

  it('separa varios orígenes CORS por coma', () => {
    const config = loadConfig({ ...validEnv, CORS_ORIGINS: 'http://localhost:5173, https://app.example.com' });

    expect(config.corsOrigins).toEqual(['http://localhost:5173', 'https://app.example.com']);
  });

  it('falla nombrando todas las variables obligatorias que faltan', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/SUPABASE_URL, SUPABASE_SECRET_KEY, CORS_ORIGINS/);
  });

  it('trata una variable vacía como faltante', () => {
    expect(() => loadConfig({ ...validEnv, SUPABASE_SECRET_KEY: '   ' })).toThrow(
      /Faltan variables de entorno: SUPABASE_SECRET_KEY/,
    );
  });

  it('rechaza una URL de Supabase inválida', () => {
    expect(() => loadConfig({ ...validEnv, SUPABASE_URL: 'no-es-una-url' })).toThrow(/SUPABASE_URL/);
  });

  it('rechaza la publishable key puesta por error en lugar de la secret key', () => {
    expect(() => loadConfig({ ...validEnv, SUPABASE_SECRET_KEY: 'sb_publishable_abc' })).toThrow(/sb_secret_/);
  });

  it('rechaza un origen CORS inválido', () => {
    expect(() => loadConfig({ ...validEnv, CORS_ORIGINS: 'http://localhost:5173,basura' })).toThrow(/CORS_ORIGINS/);
  });

  it('rechaza un PORT fuera de rango o no numérico', () => {
    expect(() => loadConfig({ ...validEnv, PORT: '70000' })).toThrow(/PORT/);
    expect(() => loadConfig({ ...validEnv, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('.env.example documenta todas las variables', () => {
    const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

    for (const name of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'CORS_ORIGINS', 'PORT']) {
      expect(example).toMatch(new RegExp(`^${name}=`, 'm'));
    }
  });
});
