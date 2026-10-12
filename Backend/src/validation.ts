import { z } from 'zod';
import { validationError, type ErrorDetail } from './errors.js';

// Mensajes por defecto de zod en español: red de seguridad para cualquier campo
// sin mensaje propio. Los campos de la API usan los ayudantes de abajo.
z.config(z.locales.es());

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Devuelve el nombre canónico de una zona horaria IANA (p. ej. "America/Bogota")
 * o null si no existe.
 */
export function canonicalTimeZone(value: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Ayudantes de campos con mensajes claros en español.
// `label` lleva el artículo: "La palabra", "El título"…
// -----------------------------------------------------------------------------

type Gender = 'f' | 'm';

const requiredWord = (gender: Gender) => (gender === 'f' ? 'obligatoria' : 'obligatorio');

/** Mensaje según falte el valor o tenga otro tipo. */
export const missingOrNotText = (label: string, gender: Gender) => (issue: { input?: unknown }) =>
  issue.input === undefined || issue.input === null
    ? `${label} es ${requiredWord(gender)}`
    : `${label} debe ser un texto`;

/** Texto obligatorio: sin espacios en los extremos, 1..max caracteres. */
export function requiredText(label: string, max: number, gender: Gender) {
  return z
    .string({ error: missingOrNotText(label, gender) })
    .trim()
    .min(1, { error: `${label} es ${requiredWord(gender)}` })
    .max(max, { error: `${label} admite como máximo ${max} caracteres` });
}

/** Texto opcional: vacío ⇒ null. */
export function optionalText(label: string, max: number) {
  return z
    .string({ error: `${label} debe ser un texto` })
    .trim()
    .max(max, { error: `${label} admite como máximo ${max} caracteres` })
    .transform((value) => value || null)
    .nullable()
    .optional();
}

/** Valor obligatorio entre opciones fijas, con un mensaje propio. */
export function choice<const T extends readonly [string, ...string[]]>(values: T, message: string) {
  return z.enum(values, { error: message });
}

/** Interruptor del modo Anki; por defecto activado. */
export const isActiveSrsField = z
  .boolean({ error: 'Indica si quieres añadirlo a los repasos diarios (true o false)' })
  .default(true);

/** Número entero de un query param (llega como texto). */
export function queryInt(label: string, min: number, max: number, fallback: number) {
  const range = `${label} debe estar entre ${min} y ${max}`;
  return z.coerce
    .number({ error: `${label} debe ser un número` })
    .int({ error: `${label} debe ser un número entero` })
    .min(min, { error: range })
    .max(max, { error: range })
    .default(fallback);
}

/** Paginación común de los listados. */
export const paginationFields = {
  limit: queryInt('El límite', 1, 200, 50),
  offset: queryInt('El desplazamiento (offset)', 0, 1_000_000, 0),
};

/** Búsqueda libre: se quitan caracteres con significado especial en los filtros de Supabase. */
export const searchField = z
  .string({ error: 'La búsqueda debe ser un texto' })
  .max(100, { error: 'La búsqueda admite como máximo 100 caracteres' })
  .transform((value) => value.replace(/[%_*,()"\\]/g, ' ').replace(/\s+/g, ' ').trim() || undefined)
  .optional();

// -----------------------------------------------------------------------------
// Validación
// -----------------------------------------------------------------------------

/** Campo usado en `details` para errores que no son de un campo concreto. */
export const GENERAL_FIELD = '_general';

/** Convierte los issues de zod en detalles `{ field, message }`. */
export function toErrorDetails(issues: readonly z.core.$ZodIssue[]): ErrorDetail[] {
  return issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.map(String).join('.') : GENERAL_FIELD,
    message: issue.message,
  }));
}

/**
 * Valida `input` con `schema` y devuelve los datos ya tipados y transformados.
 * Si no son válidos lanza un HttpError 400 `validation_error` con el detalle
 * de cada campo. Uso típico en un controller:
 *
 *   const body = parse(createWordSchema, req.body);
 */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw validationError(toErrorDetails(result.error.issues));
  }
  return result.data;
}
