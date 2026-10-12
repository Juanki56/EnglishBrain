import type { SupabaseClient } from '@supabase/supabase-js';
import { notFound } from '../errors.js';
import { isUuid } from '../validation.js';
import { throwIfError } from './db.js';

type Row = Record<string, unknown>;

/**
 * Acceso a una tabla limitado a las filas de un usuario (design D3, capa 1).
 *
 * El cliente de Supabase usa la secret key y omite RLS, así que TODA consulta
 * de datos de usuario debe pasar por aquí:
 * - select / update / delete añaden siempre `ownerColumn = userId`;
 * - insert fuerza `ownerColumn = userId` aunque el cliente envíe otro valor;
 * - update nunca permite cambiar el dueño.
 *
 * Los métodos devuelven el query builder de Supabase, así que se pueden
 * encadenar más filtros: `scoped(...).select('id').eq('status', 'learning')`.
 *
 * @param ownerColumn columna con el id del dueño ('user_id'; en profiles es 'id').
 */
export function scoped(supabase: SupabaseClient, table: string, userId: string, ownerColumn = 'user_id') {
  const withOwner = (values: Row): Row => ({ ...values, [ownerColumn]: userId });
  const withoutOwner = (values: Row): Row => {
    const { [ownerColumn]: _ignored, ...rest } = values;
    return rest;
  };

  return {
    select: (columns = '*', options?: { count?: 'exact'; head?: boolean }) =>
      supabase.from(table).select(columns, options).eq(ownerColumn, userId),

    insert: (values: Row | Row[]) =>
      supabase.from(table).insert(Array.isArray(values) ? values.map(withOwner) : withOwner(values)),

    update: (values: Row) => supabase.from(table).update(withoutOwner(values)).eq(ownerColumn, userId),

    delete: () => supabase.from(table).delete().eq(ownerColumn, userId),

    /**
     * Fila propia por id. Si no existe, no es del usuario o el id no es un
     * uuid, lanza 404 (no revela si pertenece a otra persona).
     */
    async findById<T extends Row = Row>(id: string, columns = '*'): Promise<T> {
      if (!isUuid(id)) throw notFound();
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq(ownerColumn, userId)
        .eq('id', id)
        .maybeSingle();
      throwIfError(error);
      if (!data) throw notFound();
      return data as unknown as T;
    },
  };
}
