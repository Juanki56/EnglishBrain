import { useMemo } from 'react';
import { type ApiClient, createApiClient } from '../lib/api';
import { env } from '../lib/env';
import { serverWake } from '../lib/serverWake';
import { supabase } from '../lib/supabase';
import { useSession } from './useSession';

/**
 * Cliente de la API con la sesión actual. Ante un 401 cierra la sesión
 * marcándola como caducada: la ruta protegida lleva al login con el aviso.
 */
export function useApi(): ApiClient {
  const { expireSession } = useSession();
  return useMemo(
    () =>
      createApiClient({
        baseUrl: env.apiUrl,
        // getSession devuelve un token vigente (lo refresca si hace falta).
        getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
        onUnauthorized: () => void expireSession(),
        // Aviso «Despertando el servidor…» si una petición tarda más de 4 s.
        onSlowStart: serverWake.start,
        onSlowEnd: serverWake.end,
      }),
    [expireSession],
  );
}
