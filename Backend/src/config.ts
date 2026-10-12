import { z } from 'zod';

export interface Config {
  supabaseUrl: string;
  supabaseSecretKey: string;
  corsOrigins: string[];
  port: number;
}

/** Error de configuración: el servidor no debe arrancar. */
export class ConfigError extends Error {
  override name = 'ConfigError';
}

const REQUIRED_VARS = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'CORS_ORIGINS'] as const;

const envSchema = z.object({
  SUPABASE_URL: z.url({ error: 'debe ser una URL válida, p. ej. https://<proyecto>.supabase.co' }),
  SUPABASE_SECRET_KEY: z
    .string()
    .trim()
    .startsWith('sb_secret_', { error: 'debe ser la secret key de Supabase (empieza por sb_secret_)' }),
  CORS_ORIGINS: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url({ error: 'cada origen debe ser una URL válida' })).min(1)),
  PORT: z.coerce
    .number({ error: 'debe ser un número' })
    .int()
    .min(1, { error: 'debe estar entre 1 y 65535' })
    .max(65535, { error: 'debe estar entre 1 y 65535' })
    .default(3000),
});

/**
 * Lee y valida las variables de entorno. Lanza ConfigError con un mensaje
 * legible si falta alguna obligatoria o si tiene un formato inválido.
 * PORT es opcional (por defecto 3000).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const missing = REQUIRED_VARS.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new ConfigError(
      `Faltan variables de entorno: ${missing.join(', ')}. Copia .env.example a .env y complétalas.`,
    );
  }

  const parsed = envSchema.safeParse({
    ...env,
    PORT: env.PORT?.trim() ? env.PORT : undefined,
  });
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path[0] ? String(issue.path[0]) : 'env'}: ${issue.message}`)
      .join('\n');
    throw new ConfigError(`Variables de entorno inválidas:\n${details}`);
  }

  return {
    supabaseUrl: parsed.data.SUPABASE_URL,
    supabaseSecretKey: parsed.data.SUPABASE_SECRET_KEY,
    corsOrigins: parsed.data.CORS_ORIGINS,
    port: parsed.data.PORT,
  };
}
