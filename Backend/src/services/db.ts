import type { PostgrestError } from '@supabase/supabase-js';
import { badRequest, conflict, notFound } from '../errors.js';

/**
 * Lanza el error HTTP adecuado si una consulta a Supabase falló.
 * Las violaciones de restricciones de la base de datos se convierten en 4xx;
 * cualquier otro fallo es un error interno (500).
 */
export function throwIfError(error: PostgrestError | null): void {
  if (!error) return;

  switch (error.code) {
    case '23505': // unique_violation
      throw conflict('Ya existe un registro con esos datos');
    case '23502': // not_null_violation
    case '23514': // check_violation
    case '22001': // string_data_right_truncation
    case '22023': // invalid_parameter_value (p. ej. zona horaria inválida)
    case '22P02': // invalid_text_representation (p. ej. uuid mal formado)
      throw badRequest('Los datos no cumplen las reglas de la base de datos');
    case 'PGRST116': // .single() sin filas
      throw notFound();
    default:
      throw new Error(`Supabase ${error.code}: ${error.message}`);
  }
}
