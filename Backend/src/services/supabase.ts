import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import type { Config } from '../config.js';

/**
 * Cliente de Supabase con la secret key (design D2). Omite RLS, así que todo
 * acceso a datos de usuario debe filtrar por user_id (design D3, capa 1).
 * Es un cliente de servidor: no guarda ni refresca sesiones.
 */
export function createSupabaseAdmin(config: Pick<Config, 'supabaseUrl' | 'supabaseSecretKey'>): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/** Cliente compartido que createApp guarda en app.locals. */
export function getSupabase(req: Request): SupabaseClient {
  const client = req.app.locals.supabase as SupabaseClient | undefined;
  if (!client) {
    throw new Error('Cliente de Supabase no configurado: pásalo a createApp({ supabase })');
  }
  return client;
}
